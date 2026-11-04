import React, { useState, useEffect } from 'react';
import { Home, Maximize2, Minimize2, FileText, Image as ImageIcon } from 'lucide-react';
import type { SectionItem, ConnectionStatus, NoteItem, NoticeItem } from '../types';
import { ImageViewer } from './ImageViewer';
import { NotesViewer } from './NotesViewer';
import { NoticePopup } from './NoticePopup';
import { resolveSlideState } from '../lib/presentationUtils';
import { getSession, subscribeToSession } from '../lib/supabaseClient';

interface SubModeProps {
  sessionCode: string;
  onExit: () => void;
}

export const SubMode: React.FC<SubModeProps> = ({ sessionCode, onExit }) => {
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [currentGlobalIndex, setCurrentGlobalIndex] = useState(0);
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);

  // Notes and Notice states
  const [activeSectionView, setActiveSectionView] = useState<'slides' | 'notes'>('slides');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNotice, setActiveNotice] = useState<NoticeItem | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const data = await getSession(sessionCode);
      if (isMounted && data) {
        setSections(data.content?.sections || []);
        setNotes(data.content?.notes || []);
        setActiveNotice(data.content?.activeNotice || null);
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
      onNotesChange: (newNotes) => {
        setNotes(newNotes);
        setStatus('connected');
      },
      onNoticeReceived: (newNotice) => {
        setActiveNotice(newNotice);
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

  // Derived slide info
  const { activeFlatSlide, totalSlides } = resolveSlideState(sections, {
    globalIndex: currentGlobalIndex,
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(console.warn);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(console.warn);
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

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
      className="sub-presentation-stage"
      onClick={() => setHeaderVisible((prev) => !prev)}
      title="Tap anywhere to toggle header"
      style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: '100dvh', overflow: 'hidden' }}
    >
      {/* Real-time Notice Pop-up Banner for Sub */}
      <NoticePopup
        notice={activeNotice}
        onDismiss={() => setActiveNotice(null)}
        onOpenNotes={() => {
          setActiveSectionView('notes');
          setHeaderVisible(true);
        }}
      />

      {/* Floating Sub Header with Status, View Switcher and Exit */}
      <div
        className="sub-header"
        style={{
          opacity: headerVisible ? 1 : 0,
          pointerEvents: headerVisible ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onExit}
            className="btn-outline btn-sub-exit"
            style={{
              backgroundColor: '#ffffff',
              color: 'var(--primary)',
              border: '1.5px solid var(--primary)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
              padding: '0.45rem 0.85rem',
              fontWeight: 700,
            }}
            title="Leave Session"
            id="btn-sub-exit"
          >
            <Home size={16} />
            <span style={{ fontSize: '0.85rem' }}>Exit</span>
          </button>

          <div
            className="code-badge"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.96)',
              border: '1.5px solid var(--primary-border)',
              padding: '0.25rem 0.65rem',
              fontSize: '0.85rem',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
            }}
          >
            CODE: <span>{sessionCode}</span>
          </div>

          {/* Sub View Mode Switcher: Slides vs Notes Section */}
          <div className="sub-view-switcher">
            <button
              type="button"
              onClick={() => setActiveSectionView('slides')}
              className={`sub-view-tab-btn ${activeSectionView === 'slides' ? 'active' : ''}`}
              title="View Slides presentation"
            >
              <ImageIcon size={14} />
              <span>Slides</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSectionView('notes')}
              className={`sub-view-tab-btn ${activeSectionView === 'notes' ? 'active' : ''}`}
              title="View Service Notes Section"
            >
              <FileText size={14} />
              <span>Notes</span>
              {activeNotice && <span className="sub-view-notice-dot" title="Active Notice Available" />}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Status Indicator */}
          {status === 'connected' ? (
            <div className="status-pill connected" style={{ backgroundColor: '#ffffff', border: '1.5px solid #a7f3d0', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)' }}>
              <span className="status-dot green" />
              <span style={{ fontWeight: 700 }}>LIVE</span>
            </div>
          ) : status === 'reconnecting' ? (
            <div className="status-pill reconnecting" style={{ backgroundColor: '#ffffff', border: '1.5px solid #fde68a', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)' }}>
              <span className="status-dot amber" />
              <span>Reconnecting...</span>
            </div>
          ) : (
            <div className="status-pill demo" style={{ backgroundColor: '#ffffff', border: '1.5px solid var(--primary-border)', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)' }}>
              <span className="status-dot blue" />
              <span>Synced</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="btn-icon btn-sub-fs"
            style={{
              backgroundColor: '#ffffff',
              color: 'var(--text-main)',
              border: '1.5px solid var(--border-hover)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
              width: '2.4rem',
              height: '2.4rem',
            }}
            title="Toggle Fullscreen"
            id="btn-sub-fullscreen"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Discreet restore button if header is dismissed on mobile */}
      {!headerVisible && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setHeaderVisible(true);
          }}
          className="sub-header-restore-btn"
          title="Show Header & Exit"
          aria-label="Show menu and exit button"
        >
          <Home size={14} />
          <span>Menu</span>
        </button>
      )}

      {/* Main Content: Notes Section or Maximized Slides Display */}
      {activeSectionView === 'notes' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', backgroundColor: '#09090b', width: '100%' }}>
          <NotesViewer notes={notes} activeNotice={activeNotice} />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <ImageViewer
            activeSlide={activeFlatSlide}
            currentIndex={currentGlobalIndex}
            totalSlides={totalSlides}
            canNavigate={false}
            showFullscreenBtn={false}
          />
        </div>
      )}
    </div>
  );
};
