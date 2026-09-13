import React, { useState, useRef } from 'react';
import { Presentation, Eye, SlidersHorizontal, ArrowRight, X, Sparkles } from 'lucide-react';
import type { UserRole } from '../types';

interface HomeScreenProps {
  onSelectRole: (role: UserRole, code?: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectRole,
}) => {
  const [modalRole, setModalRole] = useState<'sub' | 'helper' | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

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

    const nextIndex = Math.min(pasted.length, 3);
    inputRefs[nextIndex].current?.focus();
  };

  const handleJoinSession = () => {
    const code = pin.join('');
    if (code.length < 4) {
      setErrorMessage('Please enter all 4 digits of the session code.');
      return;
    }

    if (modalRole) {
      onSelectRole(modalRole, code);
      setModalRole(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
            href="#/"
            className="btn-outline"
            style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            title="Return to Church Website"
          >
            <span>← Church Website</span>
          </a>
        </div>
      </header>

      {/* Main Hero & 3 Role Cards */}
      <main className="home-container">
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
            onClick={() => onSelectRole('main')}
            id="role-card-main"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectRole('main')}
          >
            <div className="role-card-icon">
              <Presentation size={28} />
            </div>
            <h2 className="role-card-title">MAIN</h2>
            <p className="role-card-desc">
              Create and control a presentation. Manage sections, upload hymn slides, and drive the live presentation.
            </p>
            <div className="role-card-action">
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
            <div className="role-card-action">
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
            <div className="role-card-action">
              <span>Join as Controller</span>
              <ArrowRight size={18} />
            </div>
          </div>
        </div>
      </main>

      {/* PIN Code Entry Modal for SUB and HELPER */}
      {modalRole && (
        <div className="join-modal-overlay">
          <div className="join-card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-1rem' }}>
              <button
                onClick={() => setModalRole(null)}
                className="btn-icon"
                style={{ width: '2rem', height: '2rem' }}
                aria-label="Close"
              >
                <X size={16} />
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
              className="btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '1.05rem', letterSpacing: '0.02em' }}
              id="btn-join-session"
            >
              JOIN SESSION
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
