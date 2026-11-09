import React, { useState, useRef, useEffect } from 'react';
import {
  Presentation,
  Eye,
  SlidersHorizontal,
  Music,
  ArrowRight,
  X,
  Sparkles,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react';
import type { UserRole, DeviceAuditInfo, SessionData } from '../types';
import {
  getInitialDeviceNameSuggestion,
  detectDeviceModel,
  collectDeviceAuditInfo,
  getOrCreateDeviceId,
} from '../lib/deviceUtils';
import {
  getSession,
  claimHelperRole,
  requestHelperJoin,
  requestRejoinSession,
  subscribeToSession,
  getStoredHostToken,
  getSupabase,
  isDeviceAuthorizedAdmin,
  authorizeAdminForSession,
  verifySessionAdminPassword,
  claimAdminRole,
} from '../lib/supabaseClient';
import { AdminSessionManager } from './AdminSessionManager';

interface HomeScreenProps {
  onSelectRole: (role: UserRole, code?: string, deviceInfo?: DeviceAuditInfo, adminPassword?: string) => void;
  isAdmin?: boolean;
  onLogin?: (email: string, pass: string) => Promise<{ success?: boolean; error?: string } | any>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSelectRole,
  isAdmin = false,
  onLogin,
}) => {
  const [modalRole, setModalRole] = useState<'sub' | 'helper' | 'musician' | null>(null);
  const [showMainAccessModal, setShowMainAccessModal] = useState(false);
  const [showMainDeviceModal, setShowMainDeviceModal] = useState(false);
  const [showAdminManager, setShowAdminManager] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [createdAdminPassword, setCreatedAdminPassword] = useState('');
  const [showCreatedPassword, setShowCreatedPassword] = useState(false);
  const [creationError, setCreationError] = useState('');

  // Password verification when joining as Admin/Main on another device
  const [showAdminPasswordPrompt, setShowAdminPasswordPrompt] = useState(false);
  const [pendingAdminSession, setPendingAdminSession] = useState<SessionData | null>(null);
  const [inputAdminPassword, setInputAdminPassword] = useState('');
  const [showInputAdminPassword, setShowInputAdminPassword] = useState(false);
  const [adminPasswordError, setAdminPasswordError] = useState('');
  const [isVerifyingAdminPassword, setIsVerifyingAdminPassword] = useState(false);
  const adminPasswordInputRef = useRef<HTMLInputElement>(null);

  const [detectedModel, setDetectedModel] = useState({ model: '', platform: '' });
  const [isStartingMain, setIsStartingMain] = useState(false);
  const [isVerifyingMain, setIsVerifyingMain] = useState(false);
  const [isVerifyingJoin, setIsVerifyingJoin] = useState(false);
  const [isWaitingHelperApproval, setIsWaitingHelperApproval] = useState(false);
  const [waitingHelperInfo, setWaitingHelperInfo] = useState<{ code: string; devInfo: DeviceAuditInfo } | null>(null);
  const [isWaitingRejoinApproval, setIsWaitingRejoinApproval] = useState(false);
  const [waitingRejoinInfo, setWaitingRejoinInfo] = useState<{ code: string; role: 'sub' | 'helper' | 'musician'; devInfo: DeviceAuditInfo } | null>(null);
  const [joinName, setJoinName] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('zensync_user_name') || '';
    }
    return '';
  });
  const helperUnsubRef = useRef<(() => void) | null>(null);
  const rejoinUnsubRef = useRef<(() => void) | null>(null);

  // Sub & Helper PIN state
  const [pin, setPin] = useState(['', '', '', '']);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Main Presenter PIN state (resume existing session)
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

    // Open session manager if URL specifies manage=true and user is authenticated
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('manage') === 'true' || searchParams.get('admin') === 'true') {
        if (isAdmin) {
          setShowAdminManager(true);
        } else {
          setShowAdminLoginModal(true);
        }
      }
    }
    return () => {
      if (helperUnsubRef.current) {
        helperUnsubRef.current();
        helperUnsubRef.current = null;
      }
      if (rejoinUnsubRef.current) {
        rejoinUnsubRef.current();
        rejoinUnsubRef.current = null;
      }
    };
  }, [isAdmin]);

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) return;

    setAdminLoginLoading(true);
    setAdminLoginError('');

    try {
      if (onLogin) {
        const res = await onLogin(adminEmail.trim(), adminPassword);
        if (res && res.error) {
          setAdminLoginError(res.error);
          return;
        }
      } else {
        const client = getSupabase();
        if (client) {
          const { error } = await client.auth.signInWithPassword({
            email: adminEmail.trim(),
            password: adminPassword,
          });
          if (error) {
            setAdminLoginError(error.message || 'Invalid administrator credentials');
            return;
          }
        }
      }

      // Login success
      setShowAdminLoginModal(false);
      setShowAdminManager(true);
      setAdminEmail('');
      setAdminPassword('');
    } catch (err: any) {
      setAdminLoginError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

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

    const nextIndex = Math.min(pasted.length, 3);
    mainInputRefs[nextIndex].current?.focus();
  };

  const handleMainPinSubmit = async () => {
    const code = mainPin.join('');

    if (code.length === 4) {
      setIsVerifyingMain(true);
      setMainErrorMessage('');
      try {
        const session = await getSession(code);
        if (!session) {
          setMainErrorMessage(`Session "${code}" was not found or has expired. Please verify the code or start a new presentation below.`);
          setIsVerifyingMain(false);
          return;
        }

        const myDeviceId = getOrCreateDeviceId();
        const now = Date.now();

        // 1. Enforce rule: Only 1 admin can be in the session at a time
        const isAnotherAdminOnline = Boolean(
          session.content?.admin_is_online &&
          session.content?.active_admin_signature &&
          session.content.active_admin_signature !== myDeviceId &&
          now - (session.content?.admin_heartbeat || 0) < 30000
        );

        if (isAnotherAdminOnline) {
          const activeName = session.content?.active_admin_device_name || 'Another admin';
          setMainErrorMessage(`Only 1 admin can be in the session at a time. ${activeName} is currently active in session "${code}".`);
          setIsVerifyingMain(false);
          return;
        }

        // 2. If the admin comes out and wants to rejoin (or joins), prompt for the admin password
        if (session.content?.adminPassword) {
          setPendingAdminSession(session);
          setShowAdminPasswordPrompt(true);
          setInputAdminPassword('');
          setAdminPasswordError('');
          setShowMainAccessModal(false);
          setTimeout(() => {
            adminPasswordInputRef.current?.focus();
          }, 100);
          return;
        }

        // 3. Fallback for legacy session without password: claim admin role
        const claimRes = await claimAdminRole(code, myDeviceId, undefined, deviceName);
        if (!claimRes.success) {
          setMainErrorMessage(claimRes.error || 'Only 1 admin can be in the session.');
          setIsVerifyingMain(false);
          return;
        }

        authorizeAdminForSession(code);
        setShowMainAccessModal(false);
        onSelectRole('main', code, session.device_info);
      } catch (err: any) {
        setMainErrorMessage(err.message || 'Session verification failed.');
      } finally {
        setIsVerifyingMain(false);
      }
      return;
    }

    setMainErrorMessage('Please enter your 4-digit session code, or start a new presentation below.');
  };

  const handleVerifyAdminPasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingAdminSession) return;

    if (!inputAdminPassword.trim()) {
      setAdminPasswordError('Please enter the session admin password.');
      return;
    }

    setIsVerifyingAdminPassword(true);
    setAdminPasswordError('');

    try {
      const isMatch = verifySessionAdminPassword(pendingAdminSession, inputAdminPassword);
      if (isMatch) {
        const myDeviceId = getOrCreateDeviceId();
        // Claim the 1 admin slot in Supabase
        const claimRes = await claimAdminRole(
          pendingAdminSession.code,
          myDeviceId,
          inputAdminPassword.trim(),
          deviceName
        );

        if (!claimRes.success) {
          setAdminPasswordError(claimRes.error || 'Only 1 admin can be in the session at a time.');
          return;
        }

        authorizeAdminForSession(pendingAdminSession.code, pendingAdminSession.content?.creatorToken);
        setShowAdminPasswordPrompt(false);
        const dev = pendingAdminSession.device_info;
        const code = pendingAdminSession.code;
        const pass = inputAdminPassword.trim();
        setPendingAdminSession(null);
        onSelectRole('main', code, dev, pass);
      } else {
        setAdminPasswordError('Incorrect admin password. You cannot control this session as admin.');
      }
    } catch (err: any) {
      setAdminPasswordError(err.message || 'Verification failed');
    } finally {
      setIsVerifyingAdminPassword(false);
    }
  };

  const handleProceedToCreateMain = () => {
    setShowMainAccessModal(false);
    setShowMainDeviceModal(true);
    setCreatedAdminPassword('');
    setCreationError('');
    setTimeout(() => {
      deviceInputRef.current?.focus();
      deviceInputRef.current?.select();
    }, 100);
  };

  const handleConfirmMainDevice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!deviceName.trim()) return;

    if (!createdAdminPassword.trim()) {
      setCreationError('Please create a session admin password to protect your presentation.');
      return;
    }

    if (createdAdminPassword.trim().length < 3) {
      setCreationError('Password must be at least 3 characters long.');
      return;
    }

    setIsStartingMain(true);
    setCreationError('');
    try {
      const auditInfo = await collectDeviceAuditInfo(deviceName);
      setShowMainDeviceModal(false);
      onSelectRole('main', undefined, auditInfo, createdAdminPassword.trim());
    } catch (err) {
      console.error('Failed to collect device audit info:', err);
      onSelectRole('main', undefined, undefined, createdAdminPassword.trim());
    } finally {
      setIsStartingMain(false);
    }
  };

  const handleClosePinModal = () => {
    if (helperUnsubRef.current) {
      helperUnsubRef.current();
      helperUnsubRef.current = null;
    }
    if (rejoinUnsubRef.current) {
      rejoinUnsubRef.current();
      rejoinUnsubRef.current = null;
    }
    setIsWaitingHelperApproval(false);
    setWaitingHelperInfo(null);
    setIsWaitingRejoinApproval(false);
    setWaitingRejoinInfo(null);
    setModalRole(null);
    setErrorMessage('');
  };

  const handleOpenPinModal = (role: 'sub' | 'helper' | 'musician') => {
    if (helperUnsubRef.current) {
      helperUnsubRef.current();
      helperUnsubRef.current = null;
    }
    if (rejoinUnsubRef.current) {
      rejoinUnsubRef.current();
      rejoinUnsubRef.current = null;
    }
    setIsWaitingHelperApproval(false);
    setWaitingHelperInfo(null);
    setIsWaitingRejoinApproval(false);
    setWaitingRejoinInfo(null);
    setModalRole(role);
    setPin(['', '', '', '']);
    setErrorMessage('');
    const storedName = localStorage.getItem('zensync_user_name') || '';
    if (storedName) {
      setJoinName(storedName);
    }
    setTimeout(() => {
      if (!storedName) {
        document.getElementById('input-join-name')?.focus();
      } else {
        inputRefs[0].current?.focus();
      }
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

  const handleJoinSession = async () => {
    if (!joinName.trim()) {
      setErrorMessage('Please enter your name to join.');
      document.getElementById('input-join-name')?.focus();
      return;
    }

    const code = pin.join('');

    if (code.length < 4) {
      setErrorMessage('Please enter all 4 digits of the session code.');
      return;
    }

    if (!modalRole) return;

    localStorage.setItem('zensync_user_name', joinName.trim());
    setIsVerifyingJoin(true);
    setErrorMessage('');

    try {
      const myDevInfo = await collectDeviceAuditInfo(joinName.trim());
      const myDeviceId = getOrCreateDeviceId();

      const session = await getSession(code);
      if (!session) {
        setErrorMessage(`Session "${code}" was not found. Please verify the code with the Main presenter.`);
        setIsVerifyingJoin(false);
        return;
      }

      // Check if this device was kicked out by the Admin
      const isKicked = Boolean(session.content?.kicked_devices?.includes(myDeviceId));

      if (isKicked) {
        // Must submit a re-entry request and wait for the Admin to accept
        const rejoinRes = await requestRejoinSession(code, {
          deviceId: myDeviceId,
          name: joinName.trim(),
          role: modalRole,
          helperInfo: myDevInfo,
        });

        if (!rejoinRes.success) {
          setErrorMessage(rejoinRes.error || 'Failed to request re-entry.');
          setIsVerifyingJoin(false);
          return;
        }

        setIsWaitingRejoinApproval(true);
        setWaitingRejoinInfo({ code, role: modalRole, devInfo: myDevInfo });
        setIsVerifyingJoin(false);

        if (rejoinUnsubRef.current) {
          rejoinUnsubRef.current();
        }

        const unsub = subscribeToSession(code, {
          onRejoinDecision: (decision) => {
            if (decision.deviceId === myDeviceId) {
              if (rejoinUnsubRef.current) {
                rejoinUnsubRef.current();
                rejoinUnsubRef.current = null;
              }
              setIsWaitingRejoinApproval(false);
              setWaitingRejoinInfo(null);
              if (decision.status === 'approved') {
                const targetRole = decision.role || modalRole || 'helper';
                setModalRole(null);
                onSelectRole(targetRole, code, myDevInfo);
              } else {
                setErrorMessage('The Admin declined your request to rejoin this session.');
              }
            }
          },
          onHelperDecision: (decision) => {
            if (modalRole === 'helper' && decision.deviceId === myDeviceId) {
              if (rejoinUnsubRef.current) {
                rejoinUnsubRef.current();
                rejoinUnsubRef.current = null;
              }
              setIsWaitingRejoinApproval(false);
              setWaitingRejoinInfo(null);
              if (decision.status === 'approved') {
                setModalRole(null);
                onSelectRole('helper', code, myDevInfo);
              } else {
                setErrorMessage('The Admin declined your request to rejoin this session.');
              }
            }
          },
          onSessionDeleted: () => {
            if (rejoinUnsubRef.current) {
              rejoinUnsubRef.current();
              rejoinUnsubRef.current = null;
            }
            setIsWaitingRejoinApproval(false);
            setWaitingRejoinInfo(null);
            setErrorMessage('The presentation session was ended by the presenter.');
          },
        });

        rejoinUnsubRef.current = unsub;
        return;
      }

      if (modalRole === 'helper') {
        // 1. Submit helper join request to Main presenter
        const reqRes = await requestHelperJoin(code, myDeviceId, myDevInfo);
        if (!reqRes.success) {
          setErrorMessage(reqRes.error || 'Only 1 Helper is allowed per presentation session.');
          setIsVerifyingJoin(false);
          return;
        }

        if (reqRes.status === 'approved') {
          // Already approved or re-joining
          onSelectRole('helper', code, myDevInfo);
          setModalRole(null);
          setIsVerifyingJoin(false);
          return;
        }

        // 2. Put Helper into waiting state and listen for Main decision
        setIsWaitingHelperApproval(true);
        setWaitingHelperInfo({ code, devInfo: myDevInfo });
        setIsVerifyingJoin(false);

        if (helperUnsubRef.current) {
          helperUnsubRef.current();
        }

        const unsub = subscribeToSession(code, {
          onHelperDecision: (decision) => {
            if (decision.deviceId === myDeviceId) {
              if (helperUnsubRef.current) {
                helperUnsubRef.current();
                helperUnsubRef.current = null;
              }
              setIsWaitingHelperApproval(false);
              setWaitingHelperInfo(null);
              if (decision.status === 'approved') {
                setModalRole(null);
                onSelectRole('helper', code, myDevInfo);
              } else if (decision.status === 'rejected') {
                setErrorMessage('The Main Presenter declined your request to join as Helper.');
              }
            }
          },
          onSessionDeleted: () => {
            if (helperUnsubRef.current) {
              helperUnsubRef.current();
              helperUnsubRef.current = null;
            }
            setIsWaitingHelperApproval(false);
            setWaitingHelperInfo(null);
            setErrorMessage('The presentation session was ended by the presenter.');
          },
        });

        helperUnsubRef.current = unsub;
        return;
      } else if (modalRole === 'sub') {
        onSelectRole('sub', code, myDevInfo);
        setModalRole(null);
      } else if (modalRole === 'musician') {
        onSelectRole('musician', code, myDevInfo);
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

        <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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

          {/* MUSICIAN Role Card */}
          <div
            className="role-card"
            onClick={() => handleOpenPinModal('musician')}
            id="role-card-musician"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleOpenPinModal('musician')}
          >
            <div className="role-card-icon" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
              <Music size={28} />
            </div>
            <h2 className="role-card-title">MUSICIAN</h2>
            <p className="role-card-desc">
              Follow with independent slide control. View uploaded songs, replace slides locally with chord sheets, and stay out of sync.
            </p>
            <div className="role-card-btn role-card-btn-musician" style={{ backgroundColor: '#8b5cf6', borderColor: '#7c3aed' }}>
              <span>Join as Musician</span>
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
                onClick={handleClosePinModal}
                className="btn-icon modal-close-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {isWaitingRejoinApproval ? (
              <div className="helper-waiting-container" style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <div
                  className="role-card-icon"
                  style={{
                    margin: '0 auto 1.25rem',
                    width: '56px',
                    height: '56px',
                    backgroundColor: 'rgba(217, 119, 6, 0.1)',
                    color: '#d97706',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <ShieldAlert size={28} />
                </div>
                <h3 className="join-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#0f172a' }}>
                  Admin Re-entry Approval Required
                </h3>
                <p className="join-subtitle" style={{ marginBottom: '1.25rem', lineHeight: 1.5, color: '#64748b' }}>
                  You were previously removed from presentation session <strong>{waitingRejoinInfo?.code}</strong>.
                  <br /><br />
                  A request to rejoin as <strong>{waitingRejoinInfo?.role === 'helper' ? 'Helper' : waitingRejoinInfo?.role === 'musician' ? 'Musician' : 'Sub Member'}</strong> has been sent to the Admin.
                </p>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1.2rem',
                    backgroundColor: 'rgba(217, 119, 6, 0.08)',
                    border: '1.5px solid rgba(217, 119, 6, 0.25)',
                    borderRadius: '2rem',
                    color: '#b45309',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    marginBottom: '1.5rem',
                  }}
                >
                  <Loader2 size={16} className="spin" />
                  <span>Waiting for Admin to Accept...</span>
                </div>

                {errorMessage && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500 }}>
                    {errorMessage}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleClosePinModal}
                  className="btn-outline"
                  style={{ width: '100%', padding: '0.85rem' }}
                >
                  Cancel Request
                </button>
              </div>
            ) : isWaitingHelperApproval ? (
              <div className="helper-waiting-container" style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <div
                  className="role-card-icon"
                  style={{
                    margin: '0 auto 1.25rem',
                    width: '56px',
                    height: '56px',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    color: '#0284c7',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <SlidersHorizontal size={28} />
                </div>
                <h3 className="join-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  Waiting for Presenter Approval
                </h3>
                <p className="join-subtitle" style={{ marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  A join request has been sent to the Main Presenter for presentation session <strong>{waitingHelperInfo?.code}</strong>.
                  <br /><br />
                  Device: <strong>{waitingHelperInfo?.devInfo.deviceName}</strong> ({waitingHelperInfo?.devInfo.deviceModel})
                </p>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1.2rem',
                    backgroundColor: 'rgba(2, 132, 199, 0.08)',
                    border: '1.5px solid rgba(2, 132, 199, 0.25)',
                    borderRadius: '2rem',
                    color: '#0284c7',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    marginBottom: '1.5rem',
                  }}
                >
                  <Loader2 size={16} className="spin" />
                  <span>Awaiting Presenter Acceptance...</span>
                </div>

                {errorMessage && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 500 }}>
                    {errorMessage}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleClosePinModal}
                  className="btn-outline"
                  style={{ width: '100%', padding: '0.85rem' }}
                >
                  Cancel Request
                </button>
              </div>
            ) : (
              <>
                <div className="join-header">
                  <div
                    className="role-card-icon"
                    style={{ margin: '0 auto 1.25rem', width: '48px', height: '48px' }}
                  >
                    {modalRole === 'sub' ? <Eye size={24} /> : modalRole === 'musician' ? <Music size={24} color="#8b5cf6" /> : <SlidersHorizontal size={24} />}
                  </div>
                  <h3 className="join-title">
                    {modalRole === 'sub' ? 'Join as Sub' : modalRole === 'musician' ? 'Join as Musician' : 'Join as Helper'}
                  </h3>
                  <p className="join-subtitle">Enter your name and the 4-digit session code</p>
                </div>

                {/* Name Input */}
                <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                  <label
                    htmlFor="input-join-name"
                    style={{
                      display: 'block',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      marginBottom: '0.35rem',
                    }}
                  >
                    Your Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    id="input-join-name"
                    type="text"
                    placeholder="Enter your name (e.g. Alex, Maria)"
                    value={joinName}
                    onChange={(e) => {
                      setJoinName(e.target.value);
                      setErrorMessage('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        inputRefs[0].current?.focus();
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border-color)',
                      fontSize: '0.92rem',
                      outline: 'none',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '0.4rem', textAlign: 'left' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                    }}
                  >
                    Session Code (4 Digits) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Presenter Device Verification Modal for MAIN Mode */}
      {showMainDeviceModal && (
        <div className="join-modal-overlay">
          <div className="join-card device-modal-card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-0.25rem' }}>
              <button
                onClick={() => setShowMainDeviceModal(false)}
                className="btn-icon modal-close-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="join-header" style={{ marginBottom: '1rem' }}>
              <div
                className="role-card-icon"
                style={{
                  margin: '0 auto 0.6rem',
                  width: '42px',
                  height: '42px',
                  backgroundColor: 'rgba(2, 132, 199, 0.1)',
                  color: '#0284c7',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Smartphone size={22} />
              </div>
              <h3 className="join-title" style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>
                Presenter Device Setup
              </h3>
              <p className="join-subtitle" style={{ fontSize: '0.82rem', margin: 0, color: 'var(--text-muted)' }}>
                Set your presenter device name and admin session password.
              </p>
            </div>

            <form onSubmit={handleConfirmMainDevice} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
                <label
                  htmlFor="device-name-input"
                  style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}
                >
                  Your Phone / Device Name:
                </label>
                <input
                  id="device-name-input"
                  ref={deviceInputRef}
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="e.g. Aryan's Phone, Laptop"
                  maxLength={50}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--border-color)',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}
                  required
                />
              </div>

              {/* Session Admin Password Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label
                    htmlFor="session-password-input"
                    style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Lock size={13} style={{ color: '#0284c7' }} />
                    <span>Session Admin Password (Required):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCreatedPassword(!showCreatedPassword)}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.75rem', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                  >
                    {showCreatedPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  id="session-password-input"
                  type={showCreatedPassword ? 'text' : 'password'}
                  value={createdAdminPassword}
                  onChange={(e) => {
                    setCreatedAdminPassword(e.target.value);
                    setCreationError('');
                  }}
                  placeholder="Create admin password (e.g. 1234)"
                  maxLength={40}
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: creationError ? '1.5px solid var(--danger)' : '1.5px solid var(--border-color)',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}
                  required
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                  Required to enter as Admin from other devices. Viewers don't need it.
                </span>
              </div>

              {creationError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 600, margin: 0, textAlign: 'left' }}>
                  {creationError}
                </p>
              )}

              {/* Hardware hint pill */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.4rem 0.75rem',
                  backgroundColor: 'rgba(2, 132, 199, 0.06)',
                  border: '1px solid rgba(2, 132, 199, 0.15)',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  color: '#0369a1',
                  alignSelf: 'flex-start',
                }}
              >
                <Smartphone size={13} style={{ flexShrink: 0 }} />
                <span>
                  Detected: <strong>{detectedModel.model || 'Device'}</strong> ({detectedModel.platform})
                </span>
              </div>

              <button
                type="submit"
                disabled={isStartingMain || !deviceName.trim()}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  marginTop: '0.35rem',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: (isStartingMain || !deviceName.trim()) ? 'not-allowed' : 'pointer',
                }}
                id="btn-confirm-main-device"
              >
                {isStartingMain ? (
                  <>
                    <Loader2 size={17} className="spin" />
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

      {/* Session Admin Password Verification Modal (When joining existing session as Main from another device) */}
      {showAdminPasswordPrompt && pendingAdminSession && (
        <div className="join-modal-overlay">
          <div className="join-card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-0.5rem' }}>
              <button
                onClick={() => {
                  setShowAdminPasswordPrompt(false);
                  setPendingAdminSession(null);
                }}
                className="btn-icon modal-close-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="join-header">
              <div
                className="role-card-icon"
                style={{
                  margin: '0 auto 1.25rem',
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'rgba(2, 132, 199, 0.1)',
                  color: '#0284c7'
                }}
              >
                <Lock size={24} />
              </div>
              <h3 className="join-title">Admin Password Required</h3>
              <p className="join-subtitle">
                Presentation session <strong>#{pendingAdminSession.code}</strong> is protected. Enter the password set by the creator to unlock Admin/Main controls.
              </p>
            </div>

            <form onSubmit={handleVerifyAdminPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label
                    htmlFor="input-admin-password"
                    style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}
                  >
                    Enter Session Password:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowInputAdminPassword(!showInputAdminPassword)}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}
                  >
                    {showInputAdminPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  id="input-admin-password"
                  ref={adminPasswordInputRef}
                  type={showInputAdminPassword ? 'text' : 'password'}
                  value={inputAdminPassword}
                  onChange={(e) => {
                    setInputAdminPassword(e.target.value);
                    setAdminPasswordError('');
                  }}
                  placeholder="Enter session admin password"
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: adminPasswordError ? '1.5px solid var(--danger)' : '1.5px solid var(--border-color)',
                    fontSize: '1rem',
                  }}
                  required
                />
              </div>

              {adminPasswordError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, margin: 0, textAlign: 'left' }}>
                  {adminPasswordError}
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button
                  type="submit"
                  disabled={isVerifyingAdminPassword || !inputAdminPassword.trim()}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.85rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: '1.5px solid #0369a1',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                    cursor: (isVerifyingAdminPassword || !inputAdminPassword.trim()) ? 'not-allowed' : 'pointer',
                  }}
                  id="btn-verify-session-password"
                >
                  {isVerifyingAdminPassword ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Unlock Admin Controls</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const code = pendingAdminSession.code;
                    setShowAdminPasswordPrompt(false);
                    setPendingAdminSession(null);
                    onSelectRole('sub', code);
                  }}
                  className="btn-outline"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.88rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Eye size={15} />
                  <span>Join as Viewer (Sub) Instead</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Manager Modal */}
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

