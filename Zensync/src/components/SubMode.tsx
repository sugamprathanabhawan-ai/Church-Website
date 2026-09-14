import React, { useState, useEffect } from 'react';
import { Home, Maximize2, Minimize2 } from 'lucide-react';
import type { SectionItem, ConnectionStatus } from '../types';
import { ImageViewer } from './ImageViewer';
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

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const data = await getSession(sessionCode);
      if (isMounted) {
        if (data) {
          setSections(data.content?.sections || []);
          setCurrentGlobalIndex(data.current_slide?.globalIndex || 0);
          setStatus('connected');
        } else {
          // If not found in remote DB or local storage yet, keep listening via Realtime
        }
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
          <button onClick={onExit} className="btn-primary" style={{ width: '100%' }}>
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
    >
      {/* Floating Sub Header with Status and Exit */}
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
            className="btn-outline"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(6px)', padding: '0.4rem 0.75rem' }}
            title="Leave Session"
          >
            <Home size={15} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Exit</span>
          </button>

          <div
            className="code-badge"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(6px)',
              padding: '0.25rem 0.6rem',
              fontSize: '0.85rem',
            }}
          >
            CODE: <span>{sessionCode}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Status Indicator */}
          {status === 'connected' ? (
            <div className="status-pill connected" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(6px)' }}>
              <span className="status-dot green" />
              <span>● LIVE</span>
            </div>
          ) : status === 'reconnecting' ? (
            <div className="status-pill reconnecting" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(6px)' }}>
              <span className="status-dot amber" />
              <span>○ Reconnecting...</span>
            </div>
          ) : (
            <div className="status-pill demo" style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(6px)' }}>
              <span className="status-dot blue" />
              <span>● Synced</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="btn-icon"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(6px)', width: '2.2rem', height: '2.2rem' }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Maximized Image Display (No Prev/Next buttons, read-only) */}
      <ImageViewer
        activeSlide={activeFlatSlide}
        currentIndex={currentGlobalIndex}
        totalSlides={totalSlides}
        canNavigate={false}
        showFullscreenBtn={false}
      />
    </div>
  );
};
