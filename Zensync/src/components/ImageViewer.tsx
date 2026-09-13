import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, ImageOff, Plus } from 'lucide-react';
import type { FlatSlide } from '../types';

interface ImageViewerProps {
  activeSlide: FlatSlide | null;
  currentIndex: number;
  totalSlides: number;
  onPrevious?: () => void;
  onNext?: () => void;
  canNavigate?: boolean; // false for Sub mode, true for Main & Helper
  onAddSlidePrompt?: () => void;
  showFullscreenBtn?: boolean;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  activeSlide,
  currentIndex,
  totalSlides,
  onPrevious,
  onNext,
  canNavigate = true,
  onAddSlidePrompt,
  showFullscreenBtn = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch((err) => {
        console.warn('Error attempting to enable full-screen mode:', err);
      });
    } else {
      document.exitFullscreen?.().catch((err) => {
        console.warn('Error attempting to exit full-screen mode:', err);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && canNavigate && onPrevious) {
        e.preventDefault();
        onPrevious();
      } else if (e.key === 'ArrowRight' && canNavigate && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === ' ' && canNavigate && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === 'f' || e.key === 'F') {
        if (showFullscreenBtn) {
          e.preventDefault();
          toggleFullscreen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canNavigate, onPrevious, onNext, showFullscreenBtn]);

  // Touch swipe handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canNavigate) return;
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!canNavigate || touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;

    // Minimum swipe distance of 50px
    if (Math.abs(deltaX) > 50) {
      if (deltaX < 0 && onNext) {
        onNext(); // Swiped left -> next
      } else if (deltaX > 0 && onPrevious) {
        onPrevious(); // Swiped right -> previous
      }
    }
    setTouchStartX(null);
  };

  return (
    <div
      ref={containerRef}
      className={`viewer-stage ${isFullscreen ? 'fullscreen-container' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Canvas Area */}
      <div className="viewer-canvas-area">
        {activeSlide ? (
          <div className="viewer-image-wrapper">
            <img
              key={activeSlide.slide.id}
              src={activeSlide.slide.url}
              alt={activeSlide.slide.name || 'Presentation Slide'}
              className="presentation-image"
              loading="eager"
            />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '2.5rem',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              border: '2px dashed var(--primary-border)',
              maxWidth: '480px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary-soft)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <ImageOff size={32} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              No Slides in Presentation
            </h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              Add sections and upload slide images to start presenting.
            </p>
            {onAddSlidePrompt && (
              <button onClick={onAddSlidePrompt} className="btn-primary">
                <Plus size={18} />
                Add First Slide
              </button>
            )}
          </div>
        )}

        {/* Floating section title tag in presentation view */}
        {activeSlide && !isFullscreen && (
          <div
            style={{
              position: 'absolute',
              top: '1.25rem',
              left: '1.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(6px)',
              border: '1px solid var(--border-color)',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--primary)',
              boxShadow: 'var(--shadow-sm)',
              pointerEvents: 'none',
            }}
          >
            {activeSlide.sectionTitle}
          </div>
        )}
      </div>

      {/* Control Bar (shown for Main/Helper or when controls are active) */}
      {canNavigate && !isFullscreen && (
        <div className="viewer-control-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {activeSlide ? activeSlide.sectionTitle : 'Zen Sync'}
            </div>
          </div>

          <div className="nav-buttons-center">
            <button
              onClick={onPrevious}
              disabled={currentIndex <= 0 || totalSlides === 0}
              className="btn-outline"
              style={{ padding: '0.65rem 1.25rem', fontWeight: 600 }}
              title="Previous Slide (Left Arrow)"
              id="btn-previous-slide"
            >
              <ChevronLeft size={20} />
              Previous
            </button>

            <div className="slide-counter-badge" title="Current Slide / Total Slides">
              {totalSlides > 0 ? `${currentIndex + 1} / ${totalSlides}` : '0 / 0'}
            </div>

            <button
              onClick={onNext}
              disabled={currentIndex >= totalSlides - 1 || totalSlides === 0}
              className="btn-primary"
              style={{ padding: '0.65rem 1.4rem' }}
              title="Next Slide (Right Arrow or Space)"
              id="btn-next-slide"
            >
              Next
              <ChevronRight size={20} />
            </button>
          </div>

          <div>
            {showFullscreenBtn && (
              <button
                onClick={toggleFullscreen}
                className="btn-icon"
                title="Fullscreen Mode (F)"
                id="btn-fullscreen-toggle"
              >
                {isFullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Overlay Controls (subtle, fade-in on hover) */}
      {isFullscreen && (
        <div className="fullscreen-overlay-controls">
          {canNavigate && (
            <button
              onClick={onPrevious}
              disabled={currentIndex <= 0}
              className="btn-outline"
              style={{ padding: '0.4rem 0.8rem' }}
            >
              <ChevronLeft size={18} />
            </button>
          )}

          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
            {totalSlides > 0 ? `${currentIndex + 1} / ${totalSlides}` : '0 / 0'}
          </div>

          {canNavigate && (
            <button
              onClick={onNext}
              disabled={currentIndex >= totalSlides - 1}
              className="btn-primary"
              style={{ padding: '0.4rem 0.8rem' }}
            >
              <ChevronRight size={18} />
            </button>
          )}

          <button onClick={toggleFullscreen} className="btn-icon" style={{ width: '2rem', height: '2rem' }}>
            <Minimize2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
