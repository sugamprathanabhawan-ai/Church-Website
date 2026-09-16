import React, { useState, useEffect } from 'react';
import { Home, Menu, X, ShieldAlert } from 'lucide-react';
import type { SectionItem, ConnectionStatus } from '../types';
import { ImageViewer } from './ImageViewer';
import {
  flattenSections,
  resolveSlideState,
} from '../lib/presentationUtils';
import {
  getSession,
  updateSessionSlide,
  subscribeToSession,
  claimHelperRole,
  releaseHelperRole,
} from '../lib/supabaseClient';
import { getOrCreateDeviceId, collectDeviceAuditInfo } from '../lib/deviceUtils';

interface HelperModeProps {
  sessionCode: string;
  onExit: () => void;
}

export const HelperMode: React.FC<HelperModeProps> = ({ sessionCode, onExit }) => {
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [currentGlobalIndex, setCurrentGlobalIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isUnauthorizedHelper, setIsUnauthorizedHelper] = useState(false);
  const [claimedHelperDevice, setClaimedHelperDevice] = useState('');

  const handleSafeExit = async () => {
    try {
      await releaseHelperRole(sessionCode, getOrCreateDeviceId());
    } catch (e) {
      console.warn('Error releasing helper role:', e);
    }
    onExit();
  };

  useEffect(() => {
    let isMounted = true;
    const myDeviceId = getOrCreateDeviceId();

    async function load() {
      const data = await getSession(sessionCode);
      if (isMounted && data) {
        // Verify exclusivity: only 1 helper can claim the role
        const existingHelperSig = data.helper_signature || data.content?.helper_signature;
        if (existingHelperSig && existingHelperSig !== myDeviceId) {
          setIsUnauthorizedHelper(true);
          setClaimedHelperDevice(
            data.helper_device_info?.deviceName ||
            data.content?.helper_device_info?.deviceName ||
            'another device'
          );
          return;
        }

        // Claim role if not claimed yet
        try {
          const myInfo = await collectDeviceAuditInfo();
          await claimHelperRole(sessionCode, myDeviceId, myInfo);
        } catch (err) {
          console.warn('Could not auto-claim helper role on mount:', err);
        }

        setSections(data.content?.sections || []);
        setCurrentGlobalIndex(data.current_slide?.globalIndex || 0);
        setStatus('connected');
      }
    }
    load();

    const unsubscribe = subscribeToSession(sessionCode, {
      onSlideChange: (newSlide) => {
        setCurrentGlobalIndex(newSlide.globalIndex);
        setStatus('connected');
      },
      onContentChange: (newSections) => {
        setSections(newSections);
        setStatus('connected');
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onSessionDeleted: () => {
        setSessionEnded(true);
      },
    });

    const handleBeforeUnload = () => {
      releaseHelperRole(sessionCode, myDeviceId);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionCode]);

  // Derived flat slide info
  const { currentSlide, activeFlatSlide, totalSlides } = resolveSlideState(sections, {
    globalIndex: currentGlobalIndex,
  });

  const handleGoToSlide = (globalIndex: number) => {
    const nextState = resolveSlideState(sections, { globalIndex });
    setCurrentGlobalIndex(nextState.currentSlide.globalIndex);
    updateSessionSlide(sessionCode, nextState.currentSlide);
  };

  const handleNext = () => {
    if (currentGlobalIndex < totalSlides - 1) {
      handleGoToSlide(currentGlobalIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentGlobalIndex > 0) {
      handleGoToSlide(currentGlobalIndex - 1);
    }
  };

  if (isUnauthorizedHelper) {
    return (
      <div className="fullscreen-container" style={{ backgroundColor: 'var(--bg-secondary)', flexDirection: 'column', padding: '1.25rem' }}>
        <div className="join-card" style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <ShieldAlert size={28} />
          </div>
          <h3 className="join-title" style={{ marginBottom: '0.5rem', fontSize: '1.35rem' }}>
            Access Denied: Helper Occupied
          </h3>
          <p className="join-subtitle" style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
            A Helper has already joined presentation session <strong>{sessionCode}</strong> on <strong>{claimedHelperDevice || 'another device'}</strong>.
            <br /><br />
            Only <strong>1 Helper</strong> can control the presentation at a time.
          </p>
          <button onClick={onExit} className="btn-primary" style={{ width: '100%', padding: '0.85rem', backgroundColor: '#0284c7', color: '#ffffff', border: '1.5px solid #0369a1', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)' }}>
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
          <button onClick={handleSafeExit} className="btn-primary" style={{ width: '100%', padding: '0.85rem', backgroundColor: '#0284c7', color: '#ffffff', border: '1.5px solid #0369a1', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)' }}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
      {/* Top Navbar */}
      <header className="app-navbar helper-navbar">
        <div className="navbar-left">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="btn-icon"
            style={{ display: 'flex', flexShrink: 0 }}
            title="Toggle Sections Sidebar"
            aria-label="Toggle Sidebar"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="app-brand" onClick={handleSafeExit} title="Return to Home">
            <span className="app-brand-title">ZEN SYNC</span>
          </div>

          <div className="code-badge" title={`Session Code: ${sessionCode}`}>
            <span className="code-label">CODE:</span>
            <span>{sessionCode}</span>
          </div>

          <div className="role-pill-badge helper">
            HELPER
          </div>
        </div>

        <div className="navbar-actions">
          {status === 'connected' ? (
            <div className="status-pill connected" title="Live Synced with Presenter">
              <span className="status-dot green" />
              <span className="status-text-full">LIVE</span>
            </div>
          ) : status === 'reconnecting' ? (
            <div className="status-pill reconnecting" title="Reconnecting...">
              <span className="status-dot amber" />
              <span className="status-text-full">Reconnecting</span>
            </div>
          ) : (
            <div className="status-pill demo" title="Local Synced">
              <span className="status-dot blue" />
              <span className="status-text-full">Synced</span>
            </div>
          )}

          <button
            onClick={handleSafeExit}
            className="btn-outline btn-exit"
            title="Exit Presentation"
            id="btn-helper-exit"
          >
            <Home size={15} />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Mobile Backdrop */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Main Layout Area: Read-Only Section Sidebar + Image Viewer with Controls */}
      <div className="presentation-layout">
        {/* Left Sidebar (Read-only sections & slides list) */}
        <aside className={`presentation-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <span className="sidebar-title">Sections ({sections.length})</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600 }}>
                Read-Only
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="btn-icon"
                style={{ width: '28px', height: '28px', border: 'none' }}
                title="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="sidebar-content">
            {sections.map((section) => {
              const isActiveSection = currentSlide.sectionId === section.id;

              return (
                <div
                  key={section.id}
                  className={`section-card ${isActiveSection ? 'active-section' : ''}`}
                >
                  <div className="section-header">
                    <div className="section-header-title">
                      <span>{section.title}</span>
                      <span className="section-count-badge">{section.slides.length} slides</span>
                    </div>
                  </div>

                  <div className="section-slides-list">
                    {section.slides.map((slide, slideIdx) => {
                      const isCurrent =
                        currentSlide.sectionId === section.id &&
                        currentSlide.slideIndex === slideIdx;

                      const flat = flattenSections(sections);
                      const targetFlat = flat.find(
                        (f) => f.sectionId === section.id && f.slideIndex === slideIdx
                      );

                      return (
                        <div
                          key={slide.id}
                          className={`slide-row ${isCurrent ? 'active' : ''}`}
                          onClick={() => {
                            if (targetFlat) {
                              handleGoToSlide(targetFlat.globalIndex);
                            }
                          }}
                        >
                          <div className="slide-row-info">
                            <div className="slide-num-pill">{slideIdx + 1}</div>
                            <span style={{ fontSize: '0.85rem' }}>{slide.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar Bottom Action - Always accessible Exit button */}
          <div className="sidebar-footer">
            <button
              onClick={handleSafeExit}
              className="btn-outline btn-sidebar-exit"
              style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem' }}
              title="Exit Presentation"
              id="btn-helper-sidebar-exit"
            >
              <Home size={16} />
              <span>Exit Presentation</span>
            </button>
          </div>
        </aside>

        {/* Center Presentation Stage with Full Control (Previous/Next/Fullscreen) */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Horizontal Section Track for Fast Mobile Access */}
          {sections.length > 0 && (
            <div className="mobile-section-bar">
              {sections.map((sec) => {
                const isActive = currentSlide.sectionId === sec.id;
                const flat = flattenSections(sections);
                const firstInSec = flat.find((f) => f.sectionId === sec.id);

                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      if (firstInSec) handleGoToSlide(firstInSec.globalIndex);
                    }}
                    className={`mobile-section-chip ${isActive ? 'active' : ''}`}
                  >
                    <span>{sec.title}</span>
                    <span className="mobile-section-chip-count">({sec.slides.length})</span>
                  </button>
                );
              })}
            </div>
          )}

          <ImageViewer
            activeSlide={activeFlatSlide}
            currentIndex={currentGlobalIndex}
            totalSlides={totalSlides}
            onPrevious={handlePrevious}
            onNext={handleNext}
            canNavigate={true}
          />
        </div>
      </div>
    </div>
  );
};
