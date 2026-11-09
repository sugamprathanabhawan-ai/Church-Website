import React, { useState, useEffect } from 'react';
import { Home, Zap, Bell, Users, FileText, Image as ImageIcon, X, Menu, Copy, Check } from 'lucide-react';
import type {
  SectionItem,
  ConnectionStatus,
  NoticeItem,
  NoteItem,
  DeviceAuditInfo,
  ChatParticipant,
  DirectNotification,
} from '../types';
import { ImageViewer } from './ImageViewer';
import { NotesViewer } from './NotesViewer';
import { NoticePopup } from './NoticePopup';
import { NoticeBroadcaster } from './NoticeBroadcaster';
import { resolveSlideState, normalizeToSingleSection, flattenSections } from '../lib/presentationUtils';
import { getSession, subscribeToSession, broadcastParticipantPresence } from '../lib/supabaseClient';
import { getOrCreateDeviceId } from '../lib/deviceUtils';

interface SubModeProps {
  sessionCode: string;
  initialDeviceInfo?: DeviceAuditInfo;
  onExit: () => void;
}

export const SubMode: React.FC<SubModeProps> = ({ sessionCode, initialDeviceInfo, onExit }) => {
  const [sections, setSections] = useState<SectionItem[]>(() => normalizeToSingleSection());
  const [currentGlobalIndex, setCurrentGlobalIndex] = useState(0);
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting');
  const [sessionEnded, setSessionEnded] = useState(false);

  // Notes and Notice states
  const [activeSectionView, setActiveSectionView] = useState<'slides' | 'notes'>('slides');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNotice, setActiveNotice] = useState<NoticeItem | null>(null);
  const [directNotification, setDirectNotification] = useState<DirectNotification | null>(null);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [showExitModal, setShowExitModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isKicked, setIsKicked] = useState(false);

  const myDeviceId = getOrCreateDeviceId();
  const myName =
    initialDeviceInfo?.deviceName ||
    (typeof window !== 'undefined' ? localStorage.getItem('zensync_user_name') : '') ||
    'Audience Member';

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sessionCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const data = await getSession(sessionCode);
      if (isMounted && data) {
        if (data.content?.kicked_devices?.includes(myDeviceId)) {
          setIsKicked(true);
          return;
        }
        setSections(normalizeToSingleSection(data.content?.sections));
        setNotes(data.content?.notes || []);
        setActiveNotice(data.content?.activeNotice || null);
        setCurrentGlobalIndex(data.current_slide?.globalIndex || 0);
        setStatus('connected');
      }
    }
    load();

    // Broadcast Sub presence on join and every 15s so Helper and Admin can see this user in their sliding combo box
    broadcastParticipantPresence(sessionCode, {
      deviceId: myDeviceId,
      name: myName,
      role: 'sub',
      lastSeen: Date.now(),
    }).catch(() => { });

    const presenceInterval = setInterval(() => {
      broadcastParticipantPresence(sessionCode, {
        deviceId: myDeviceId,
        name: myName,
        role: 'sub',
        lastSeen: Date.now(),
      }).catch(() => { });
    }, 15000);

    const unsubscribe = subscribeToSession(sessionCode, {
      onSlideChange: (newSlide) => {
        setCurrentGlobalIndex((prev) => (prev !== newSlide.globalIndex ? newSlide.globalIndex : prev));
        setStatus('connected');
      },
      onContentChange: (newSections) => {
        setSections(normalizeToSingleSection(newSections));
        setStatus('connected');
      },
      onNotesChange: (newNotes) => {
        setNotes(newNotes);
        setStatus('connected');
      },
      onNoticeReceived: (newNotice) => {
        setActiveNotice(newNotice);
        setStatus('connected');
      },
      onDirectNotification: (notif) => {
        if (
          notif.recipientRole === 'sub' ||
          notif.recipientRole === 'all' ||
          notif.recipientDeviceId === myDeviceId
        ) {
          setDirectNotification(notif);
        }
      },
      onParticipantPresence: (part) => {
        setParticipants((prev) => {
          const filtered = prev.filter((p) => p.deviceId !== part.deviceId);
          return [...filtered, part];
        });
      },
      onMemberKicked: (payload) => {
        if (payload?.deviceId === myDeviceId) {
          setIsKicked(true);
        }
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onSessionDeleted: () => {
        setSessionEnded(true);
      },
    });

    return () => {
      isMounted = false;
      clearInterval(presenceInterval);
      unsubscribe();
    };
  }, [sessionCode, myDeviceId, myName]);

  // Derived slide info
  const { activeFlatSlide, totalSlides } = resolveSlideState(sections, {
    globalIndex: currentGlobalIndex,
  });

  if (isKicked) {
    return (
      <div className="fullscreen-container" style={{ backgroundColor: 'var(--bg-secondary)', flexDirection: 'column', padding: '1.25rem' }}>
        <div className="join-card" style={{ textAlign: 'center', maxWidth: '420px', padding: '2rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <X size={28} strokeWidth={2.5} />
          </div>
          <h3 className="join-title" style={{ marginBottom: '0.5rem', color: '#0f172a', fontSize: '1.25rem' }}>
            Removed from Session
          </h3>
          <p className="join-subtitle" style={{ marginBottom: '1.5rem', color: '#64748b', lineHeight: 1.5 }}>
            You have been removed from presentation session <strong>{sessionCode}</strong> by the host.
          </p>
          <button
            onClick={onExit}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '0.85rem',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: '1.5px solid #0369a1',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="fullscreen-container" style={{ backgroundColor: 'var(--bg-secondary)', flexDirection: 'column' }}>
        <div className="join-card" style={{ textAlign: 'center' }}>
          <h3 className="join-title" style={{ marginBottom: '0.5rem' }}>Presentation Ended</h3>
          <p className="join-subtitle" style={{ marginBottom: '1.5rem' }}>
            This presentation has been ended and deleted by the presenter.
          </p>
          <button onClick={onExit} className="btn-primary" style={{ width: '100%', padding: '0.85rem', backgroundColor: '#0284c7', color: '#ffffff', border: '1.5px solid #0369a1', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)' }}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="presentation-root"
      style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}
    >
      {/* Real-time Notice Pop-up Banner for Sub */}
      <NoticePopup
        notice={activeNotice}
        directNotification={directNotification}
        onDismiss={() => setActiveNotice(null)}
        onDismissDirect={() => setDirectNotification(null)}
        onOpenNotes={() => setActiveSectionView('notes')}
      />

      {/* Top Navbar matching exact user interface (3-lines menu, center images/notice toggle, right exit) */}
      <header className="app-navbar sub-navbar">
        <div className="navbar-left">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className={`btn-icon ${sidebarOpen ? 'active' : ''}`}
            style={{ display: 'flex', flexShrink: 0 }}
            title="Toggle Menu (3 Lines)"
            aria-label="Toggle Sidebar Menu"
            id="btn-sub-sidebar-toggle"
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Center: Toggle between images and the notice */}
        <div className="navbar-center">
          <div className="header-view-switcher" role="tablist">
            <button
              type="button"
              onClick={() => setActiveSectionView('slides')}
              className={`header-tab-btn ${activeSectionView === 'slides' ? 'active' : ''}`}
              title="Images View"
              aria-label="Images View"
            >
              <span>🖼️</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSectionView('notes')}
              className={`header-tab-btn ${activeSectionView === 'notes' ? 'active' : ''}`}
              title="Notice View"
              aria-label="Notice View"
            >
              <span>📝</span>
            </button>
          </div>
        </div>

        {/* Right: Exit Presentation */}
        <div className="navbar-actions">
          <button
            type="button"
            onClick={() => setShowExitModal(true)}
            className="btn-exit-danger"
            title="Exit Presentation"
            aria-label="Exit Presentation"
            id="btn-sub-exit"
          >
            <X size={15} strokeWidth={2.5} color="#dc2626" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Mobile Backdrop */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setSidebarOpen(false);
        }}
      />

      {/* Left Sidebar Drawer for Sub-Joiner (strictly Code, Send Notification, and Down Exit only) */}
      <aside
        className={`presentation-sidebar ${sidebarOpen ? 'open' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sidebar-content">
          {/* 1. Session Code Card */}
          <div className="sidebar-drawer-card sidebar-code-compact-card">
            <div className="sidebar-code-label-group">
              <span className="sidebar-code-tag">CODE:</span>
              <span className="sidebar-code-digits">{sessionCode}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="sidebar-code-compact-btn"
              title="Copy 4-digit code to clipboard"
            >
              {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* 2. Send Notification Feature */}
          <div className="sidebar-drawer-card sidebar-notice-broadcaster-card">
            <div
              className="sidebar-card-label"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginBottom: '0.5rem',
                fontWeight: 700,
                fontSize: '0.78rem',
                color: '#475569',
                letterSpacing: '0.04em',
              }}
            >
              <Bell size={13} color="#8b5cf6" />
              <span>NOTICE BROADCASTER</span>
            </div>
            <NoticeBroadcaster
              sessionCode={sessionCode}
              senderName={myName}
              activeNotice={activeNotice}
              onNoticeSent={(notice) => setActiveNotice(notice)}
            />
          </div>
        </div>

        {/* Sidebar Bottom Action - Down Exit */}
        <div className="sidebar-footer">
          <button
            onClick={() => setShowExitModal(true)}
            className="btn-outline btn-sidebar-exit"
            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem' }}
            title="Exit Presentation"
            id="btn-sub-sidebar-exit"
          >
            <Home size={16} />
            <span>Exit Presentation</span>
          </button>
        </div>
      </aside>

      {/* Main Layout Area: Stage / Notice */}
      <div className="presentation-layout">
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeSectionView === 'notes' ? (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <NotesViewer notes={notes} activeNotice={activeNotice} />
            </div>
          ) : (
            <ImageViewer
              activeSlide={activeFlatSlide}
              currentIndex={currentGlobalIndex}
              totalSlides={totalSlides}
              allSlides={flattenSections(sections)}
              onPrevious={() => {}}
              onNext={() => {}}
              canNavigate={false}
            />
          )}
        </div>
      </div>
      {/* Exit Confirmation Dialog Modal */}
      {showExitModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowExitModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100dvh',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div
            className="modal-card exit-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '360px',
              width: '90%',
              margin: 'auto',
              padding: '1.5rem',
              textAlign: 'center',
              borderRadius: '20px',
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
              border: '1.5px solid rgba(255, 255, 255, 0.18)',
            }}
          >
            <div
              className="exit-icon-badge"
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.18)',
                border: '1.5px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: '#f87171',
              }}
            >
              <X size={26} strokeWidth={2.5} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
              Are you sure you want to exit?
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.35rem', lineHeight: 1.5 }}>
              You will leave the live presentation session.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="btn-outline"
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
                id="btn-cancel-sub-exit"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  onExit();
                }}
                className="btn-danger"
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                }}
                id="btn-confirm-sub-exit"
              >
                Yes, Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
