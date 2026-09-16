import React, { useState, useRef, useEffect } from 'react';
import {
  Presentation,
  Eye,
  SlidersHorizontal,
  ArrowRight,
  X,
  Sparkles,
  Smartphone,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import type { UserRole, DeviceAuditInfo } from '../types';
import {
  getInitialDeviceNameSuggestion,
  detectDeviceModel,
  collectDeviceAuditInfo,
  getOrCreateDeviceId,
} from '../lib/deviceUtils';
import { getSession, claimHelperRole } from '../lib/supabaseClient';
import { AdminSessionManager } from './AdminSessionManager';

interface HomeScreenProps {
  onSelectRole: (role: UserRole, code?: string, deviceInfo?: DeviceAuditInfo) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectRole,
}) => {
  const [modalRole, setModalRole] = useState<'sub' | 'helper' | null>(null);
  const [showMainAccessModal, setShowMainAccessModal] = useState(false);
  const [showMainDeviceModal, setShowMainDeviceModal] = useState(false);
  const [showAdminManager, setShowAdminManager] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [detectedModel, setDetectedModel] = useState({ model: '', platform: '' });
  const [isStartingMain, setIsStartingMain] = useState(false);
  const [isVerifyingMain, setIsVerifyingMain] = useState(false);
  const [isVerifyingJoin, setIsVerifyingJoin] = useState(false);

  // Sub & Helper PIN state
  const [pin, setPin] = useState(['', '', '', '']);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Main Presenter PIN state (2244 for Admin, or resume existing session)
  const [mainPin, setMainPin] = useState(['', '', '', '']);
  const [mainErrorMessage, setMainErrorMessage] = useState('');
  const mainInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const deviceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const detected = detectDeviceModel();
    setDetectedModel(detected);
    const suggested = getInitialDeviceNameSuggestion();
    setDeviceName(suggested);
  }, []);

  // When clicking MAIN card on home screen
  const handleOpenMainModal = () => {
    setShowMainAccessModal(true);
    setMainPin(['', '', '', '']);
    setMainErrorMessage('');
    setTimeout(() => {
      mainInputRefs[0].current?.focus();
    }, 100);
  };

  const handleMainPinChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const newPin = [...mainPin];
    newPin[index] = char;
    setMainPin(newPin);
    setMainErrorMessage('');

    // Instant unlock if 2244 is entered
    if (newPin.join('') === '2244') {
      setShowMainAccessModal(false);
      setShowAdminManager(true);
      return;
    }

    if (char && index < 3) {
      mainInputRefs[index + 1].current?.focus();
    }
  };

  const handleMainPinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !mainPin[index] && index > 0) {
      mainInputRefs[index - 1].current?.focus();
    } else if (e.key === 'Enter') {
      handleMainPinSubmit();
    }
  };

  const handleMainPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    const newPin = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newPin[i] = pasted[i];
    }
    setMainPin(newPin);

    if (pasted === '2244') {
      setShowMainAccessModal(false);
      setShowAdminManager(true);
      return;
    }

    const nextIndex = Math.min(pasted.length, 3);
    mainInputRefs[nextIndex].current?.focus();
  };

  const handleMainPinSubmit = async () => {
    const code = mainPin.join('');
    if (code === '2244') {
      setShowMainAccessModal(false);
      setShowAdminManager(true);
      return;
    }

    if (code.length === 4) {
      setIsVerifyingMain(true);
      setMainErrorMessage('');
      try {
        const session = await getSession(code);
        if (!session) {
          setMainErrorMessage(`Session "${code}" was not found. Please verify the code or start a new presentation below.`);
          setIsVerifyingMain(false);
          return;
        }

        const existingMainSig = session.main_signature || session.content?.main_signature;
        const myDeviceId = getOrCreateDeviceId();

        if (existingMainSig && existingMainSig !== myDeviceId) {
          const presenterDevice =
            session.device_info?.deviceName ||
            session.content?.device_info?.deviceName ||
            'another device';
          setMainErrorMessage(
            `A Main presenter has already claimed session "${code}" on ${presenterDevice}. Only 1 Main presenter is allowed per presentation.`
          );
          setIsVerifyingMain(false);
          return;
        }

        // Authorized
        setShowMainAccessModal(false);
        onSelectRole('main', code, session.device_info);
      } catch (err) {
        console.warn('Main verification fallback:', err);
        setShowMainAccessModal(false);
        onSelectRole('main', code);
      } finally {
        setIsVerifyingMain(false);
      }
      return;
    }

    setMainErrorMessage('Please enter your 4-digit session code, or start a new presentation below.');
  };

  const handleProceedToCreateMain = () => {
    setShowMainAccessModal(false);
    setShowMainDeviceModal(true);
    setTimeout(() => {
      deviceInputRef.current?.focus();
      deviceInputRef.current?.select();
    }, 100);
  };

  const handleConfirmMainDevice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!deviceName.trim()) return;

    // If 2244 is entered as device name, also unlock admin
    if (deviceName.trim() === '2244') {
      setShowMainDeviceModal(false);
      setShowAdminManager(true);
      return;
    }

    setIsStartingMain(true);
    try {
      const auditInfo = await collectDeviceAuditInfo(deviceName);
      setShowMainDeviceModal(false);
      onSelectRole('main', undefined, auditInfo);
    } catch (err) {
      console.error('Failed to collect device audit info:', err);
      // Fallback
      onSelectRole('main');
    } finally {
      setIsStartingMain(false);
    }
  };

  const handleOpenPinModal = (role: 'sub' | 'helper') => {
    setModalRole(role);
    setPin(['', '', '', '']);
    setErrorMessage('');
    setTimeout(() => {
      inputRefs[0].current?.focus();
    }, 100);
  };

  const handlePinChange = (index: number, value: string) => {
    // Keep only the last character entered if user typed more
    const char = value.replace(/\D/g, '').slice(-1);
    const newPin = [...pin];
    newPin[index] = char;
    setPin(newPin);
    setErrorMessage('');

    // If user types 2244 anywhere in Sub/Helper modal, also open Admin
    if (newPin.join('') === '2244') {
      setModalRole(null);
      setShowAdminManager(true);
      return;
    }

    if (char && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    } else if (e.key === 'Enter') {
      handleJoinSession();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    const newPin = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newPin[i] = pasted[i];
    }
    setPin(newPin);

    // If 2244 pasted, trigger admin
    if (pasted === '2244') {
      setModalRole(null);
      setShowAdminManager(true);
      return;
    }

    const nextIndex = Math.min(pasted.length, 3);
    inputRefs[nextIndex].current?.focus();
  };

  const handleJoinSession = async () => {
    const code = pin.join('');
    if (code === '2244') {
      setModalRole(null);
      setShowAdminManager(true);
      return;
    }

    if (code.length < 4) {
      setErrorMessage('Please enter all 4 digits of the session code.');
      return;
    }

    if (!modalRole) return;

    setIsVerifyingJoin(true);
    setErrorMessage('');

    try {
      if (modalRole === 'helper') {
        const myDevInfo = await collectDeviceAuditInfo();
        const myDeviceId = getOrCreateDeviceId();
        const claimRes = await claimHelperRole(code, myDeviceId, myDevInfo);
        if (!claimRes.success) {
          setErrorMessage(claimRes.error || 'Only 1 Helper is allowed per presentation session.');
          setIsVerifyingJoin(false);
          return;
        }

        onSelectRole('helper', code, myDevInfo);
        setModalRole(null);
      } else if (modalRole === 'sub') {
        // Check if presentation exists
        const session = await getSession(code);
        if (!session) {
          setErrorMessage(`Session "${code}" was not found. Please verify the code with the Main presenter.`);
          setIsVerifyingJoin(false);
          return;
        }

        onSelectRole('sub', code);
        setModalRole(null);
      }
    } catch (err) {
      console.error('Error joining session:', err);
      setErrorMessage('Connection error. Please check your network and try again.');
    } finally {
      setIsVerifyingJoin(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <header className="app-navbar">
        <div className="app-brand">
          <div className="app-brand-icon">
            <Sparkles size={18} />
          </div>
          <span className="app-brand-title">Zen Sync</span>
        </div>

        <div className="navbar-actions">
          <a
            href="/"
            className="btn-outline"
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            title="Return to Church Website"
          >
            <span>← Church Website</span>
          </a>
        </div>
      </header>

      {/* Main Hero & 3 Role Cards */}
      <section className="home-container">
        <div className="home-hero">
          <div className="home-badge">
            Choir &amp; Church Presentation System
          </div>
          <h1 className="home-title">ZEN SYNC</h1>
          <p className="home-subtitle">Synchronized Choir Presentation</p>
        </div>

        <div className="home-cards-grid">
          {/* MAIN Role Card */}
          <div
            className="role-card"
            onClick={handleOpenMainModal}
            id="role-card-main"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleOpenMainModal()}
          >
            <div className="role-card-icon">
              <Presentation size={28} />
            </div>
            <h2 className="role-card-title">MAIN</h2>
            <p className="role-card-desc">
              Create and control a presentation. Manage sections, upload hymn slides, and drive the live presentation.
            </p>
            <div className="role-card-btn role-card-btn-main">
              <span>Start Presentation</span>
              <ArrowRight size={18} />
            </div>
          </div>

          {/* SUB Role Card */}
          <div
            className="role-card"
            onClick={() => handleOpenPinModal('sub')}
            id="role-card-sub"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleOpenPinModal('sub')}
          >
            <div className="role-card-icon">
              <Eye size={28} />
            </div>
            <h2 className="role-card-title">SUB</h2>
            <p className="role-card-desc">
              Follow the presentation in real-time. Clean, maximized view area for singers, congregation, and choir members.
            </p>
            <div className="role-card-btn role-card-btn-sub">
              <span>Join to Follow</span>
              <ArrowRight size={18} />
            </div>
          </div>

          {/* HELPER Role Card */}
          <div
            className="role-card"
            onClick={() => handleOpenPinModal('helper')}
            id="role-card-helper"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleOpenPinModal('helper')}
          >
            <div className="role-card-icon">
              <SlidersHorizontal size={28} />
            </div>
            <h2 className="role-card-title">HELPER</h2>
            <p className="role-card-desc">
              Control the presentation. Navigate slides and sections with synchronized permissions without altering content.
            </p>
            <div className="role-card-btn role-card-btn-helper">
              <span>Join as Controller</span>
              <ArrowRight size={18} />
            </div>
          </div>
        </div>
      </section>

      {/* PIN Code Entry Modal for SUB and HELPER */}
      {modalRole && (
        <div className="join-modal-overlay">
          <div className="join-card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-0.5rem' }}>
              <button
                onClick={() => setModalRole(null)}
                className="btn-icon modal-close-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="join-header">
              <div
                className="role-card-icon"
                style={{ margin: '0 auto 1.25rem', width: '48px', height: '48px' }}
              >
                {modalRole === 'sub' ? <Eye size={24} /> : <SlidersHorizontal size={24} />}
              </div>
              <h3 className="join-title">
                {modalRole === 'sub' ? 'Join as Sub' : 'Join as Helper'}
              </h3>
              <p className="join-subtitle">Enter the 4-digit session code from the Main presenter</p>
            </div>

            <div className="pin-inputs-container">
              {pin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  aria-label={`PIN Digit ${idx + 1}`}
                  onChange={(e) => handlePinChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className="pin-input"
                  id={`pin-input-${idx}`}
                />
              ))}
            </div>

            {errorMessage && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500 }}>
                {errorMessage}
              </p>
            )}

            <button
              onClick={handleJoinSession}
              disabled={isVerifyingJoin}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.9rem',
                fontSize: '1.05rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: '1.5px solid #0369a1',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                cursor: isVerifyingJoin ? 'not-allowed' : 'pointer',
              }}
              id="btn-join-session"
            >
              {isVerifyingJoin ? (
                <>
                  <Loader2 size={19} className="spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <span>JOIN SESSION</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Presenter Device Verification Modal for MAIN Mode */}
      {showMainDeviceModal && (
        <div className="join-modal-overlay">
          <div className="join-card device-modal-card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-0.5rem' }}>
              <button
                onClick={() => setShowMainDeviceModal(false)}
                className="btn-icon modal-close-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="join-header" style={{ marginBottom: '1.25rem' }}>
              <div
                className="role-card-icon"
                style={{ margin: '0 auto 1rem', width: '48px', height: '48px', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
              >
                <Smartphone size={26} />
              </div>
              <h3 className="join-title" style={{ fontSize: '1.25rem' }}>
                Presenter Device Setup
              </h3>
              <p className="join-subtitle">
                Enter your device / phone name. This records ownership of the session so uploaded presentation slides are traceable.
              </p>
            </div>

            <form onSubmit={handleConfirmMainDevice} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
                <label
                  htmlFor="device-name-input"
                  style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}
                >
                  Your Phone / Device Name:
                </label>
                <input
                  id="device-name-input"
                  ref={deviceInputRef}
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. John's iPhone, Samsung S24"
                  maxLength={50}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border-color)',
                    fontSize: '1rem',
                    fontWeight: 500,
                  }}
                  required
                />
              </div>

              {/* Hardware hint pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 0.85rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                <Smartphone size={15} style={{ flexShrink: 0 }} />
                <span>
                  Detected: <strong>{detectedModel.model || 'Mobile Device'}</strong> ({detectedModel.platform})
                </span>
              </div>

              {/* Security Audit notice */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.55rem',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  color: '#92400e',
                  lineHeight: 1.4,
                  textAlign: 'left',
                }}
              >
                <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#b45309' }} />
                <span>
                  <strong>Security Tracking Active:</strong> Device name, ID, and IP are linked to this session to track and hold accountable anyone uploading unwanted pictures.
                </span>
              </div>

              <button
                type="submit"
                disabled={isStartingMain || !deviceName.trim()}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  letterSpacing: '0.02em',
                  marginTop: '0.25rem',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: '1.5px solid #0369a1',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                  cursor: (isStartingMain || !deviceName.trim()) ? 'not-allowed' : 'pointer',
                }}
                id="btn-confirm-main-device"
              >
                {isStartingMain ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>Connecting Device...</span>
                  </>
                ) : (
                  <span>Start Presentation</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Presenter & Admin Access Modal */}
      {showMainAccessModal && (
        <div className="join-modal-overlay">
          <div className="join-card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-1rem' }}>
              <button
                onClick={() => setShowMainAccessModal(false)}
                className="btn-icon modal-close-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="join-header">
              <div
                className="role-card-icon"
                style={{ margin: '0 auto 1.25rem', width: '48px', height: '48px', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
              >
                <Presentation size={24} />
              </div>
              <h3 className="join-title">
                Main Presenter
              </h3>
              <p className="join-subtitle">
                Enter your 4-digit session code to resume, or start a new live presentation
              </p>
            </div>

            <div className="pin-inputs-container">
              {mainPin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={mainInputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  aria-label={`Session PIN Digit ${idx + 1}`}
                  onChange={(e) => handleMainPinChange(idx, e.target.value)}
                  onKeyDown={(e) => handleMainPinKeyDown(idx, e)}
                  onPaste={handleMainPaste}
                  className="pin-input"
                  id={`main-pin-input-${idx}`}
                />
              ))}
            </div>

            {mainErrorMessage && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500 }}>
                {mainErrorMessage}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
              <button
                onClick={handleMainPinSubmit}
                disabled={isVerifyingMain}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: '1.5px solid #0369a1',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                  cursor: isVerifyingMain ? 'not-allowed' : 'pointer',
                }}
                id="btn-main-pin-submit"
              >
                {isVerifyingMain ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>Verifying Session...</span>
                  </>
                ) : (
                  <span>Resume Session</span>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.2rem 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>OR</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
              </div>

              <button
                onClick={handleProceedToCreateMain}
                className="btn-outline"
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  fontSize: '0.95rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontWeight: 600,
                  backgroundColor: '#f0f9ff',
                  color: '#0284c7',
                  border: '1.5px solid #0284c7',
                }}
                id="btn-start-new-main"
              >
                <Sparkles size={16} color="var(--primary)" />
                <span>Start New Presentation</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Session Manager Modal (PIN 2244) */}
      {showAdminManager && (
        <AdminSessionManager
          onClose={() => setShowAdminManager(false)}
          onJoinSession={(role, code) => onSelectRole(role, code)}
          onCreateNewSession={() => {
            setShowAdminManager(false);
            setShowMainDeviceModal(true);
          }}
        />
      )}
    </div>
  );
};

