import React, { useState, useEffect } from 'react';
import { Home, Menu, X } from 'lucide-react';
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
} from '../lib/supabaseClient';

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

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const data = await getSession(sessionCode);
      if (isMounted && data) {
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

    return () => {
      isMounted = false;
      unsubscribe();
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

  if (sessionEnded) {
    return (
      <div className="fullscreen-container" style={{ backgroundColor: 'var(--bg-secondary)', flexDirection: 'column' }}>
        <div className="join-card" style={{ textAlign: 'center' }}>
          <h3 className="join-title" style={{ marginBottom: '0.5rem' }}>Presentation Ended</h3>
          <p className="join-subtitle" style={{ marginBottom: '1.5rem' }}>
            This presentation has been ended and deleted by the presenter.
          </p>
          <button onClick={onExit} className="btn-primary" style={{ width: '100%' }}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Navbar */}
      <header className="app-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="btn-icon"
            style={{ display: 'flex' }}
            title="Toggle Sections Sidebar"
            aria-label="Toggle Sidebar"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="app-brand" onClick={onExit} title="Return to Home">
            <span className="app-brand-title">ZEN SYNC</span>
          </div>

          <div className="code-badge" title="Session Code">
            CODE: <span>{sessionCode}</span>
          </div>

          <div
            style={{
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            HELPER
          </div>
        </div>

        <div className="navbar-actions">
          {status === 'connected' ? (
            <div className="status-pill connected">
              <span className="status-dot green" />
              <span>● LIVE — Synced</span>
            </div>
          ) : status === 'reconnecting' ? (
            <div className="status-pill reconnecting">
              <span className="status-dot amber" />
              <span>○ Reconnecting...</span>
            </div>
          ) : (
            <div className="status-pill demo">
              <span className="status-dot blue" />
              <span>● Local Synced</span>
            </div>
          )}

          <button onClick={onExit} className="btn-outline" title="Exit Presentation">
            <Home size={16} />
            <span style={{ display: 'inline-block' }}>Exit</span>
          </button>
        </div>
      </header>

      {/* Main Layout Area: Read-Only Section Sidebar + Image Viewer with Controls */}
      <div className="presentation-layout">
        {/* Left Sidebar (Read-only sections & slides list) */}
        <aside className={`presentation-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <span className="sidebar-title">Presentation Sections</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 600 }}>
              Read-Only
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
        </aside>

        {/* Center Presentation Stage with Full Control (Previous/Next/Fullscreen) */}
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
  );
};
