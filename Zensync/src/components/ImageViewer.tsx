import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ImageOff,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
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

  // Zoom and Pan State
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Reset zoom & pan whenever active slide changes
  useEffect(() => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex, activeSlide?.slide.id]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(3.5, Math.round((prev + 0.25) * 100) / 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => {
      const next = Math.max(0.5, Math.round((prev - 0.25) * 100) / 100);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  }, []);

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

  // Mouse drag panning when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setPan({
      x: panStartRef.current.x + deltaX,
      y: panStartRef.current.y + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Keyboard navigation & zoom shortcuts
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
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canNavigate, onPrevious, onNext, showFullscreenBtn, handleZoomIn, handleZoomOut, handleResetZoom]);

  // Touch swipe handling for mobile slide navigation (only when not zoomed in)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel > 1) {
      if (e.touches.length === 1) {
        setIsDragging(true);
        dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panStartRef.current = { ...pan };
      }
      return;
    }
    if (!canNavigate) return;
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (zoomLevel > 1 && isDragging && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - dragStartRef.current.x;
      const deltaY = e.touches[0].clientY - dragStartRef.current.y;
      setPan({
        x: panStartRef.current.x + deltaX,
        y: panStartRef.current.y + deltaY,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(false);
      return;
    }
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
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Canvas Area */}
      <div className="viewer-canvas-area">
        {activeSlide ? (
          <div
            className="viewer-image-wrapper"
            style={{
              overflow: 'hidden',
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              userSelect: 'none',
              touchAction: zoomLevel > 1 ? 'none' : 'auto',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={() => {
              if (zoomLevel > 1) {
                handleResetZoom();
              } else {
                setZoomLevel(2);
              }
            }}
          >
            <img
              key={activeSlide.slide.id}
              src={activeSlide.slide.url}
              alt={activeSlide.slide.name || 'Presentation Slide'}
              className="presentation-image"
              loading="eager"
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
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
              backgroundColor: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(6px)',
              border: '1px solid var(--border-color)',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--primary)',
              boxShadow: 'var(--shadow-sm)',
              pointerEvents: 'none',
              zIndex: 12,
            }}
          >
            {activeSlide.sectionTitle}
          </div>
        )}

        {/* Floating Zoom Controls (+ / - / Reset) */}
        {activeSlide && (
          <div className="viewer-zoom-controls" role="toolbar" aria-label="Zoom Controls">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              disabled={zoomLevel <= 0.5}
              className="btn-zoom-action"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
              id="btn-zoom-out"
            >
              <ZoomOut size={16} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleResetZoom();
              }}
              className="btn-zoom-reset"
              title="Reset Zoom to 100% (Click to Reset)"
              aria-label="Reset Zoom"
              id="btn-zoom-reset"
            >
              <span>{Math.round(zoomLevel * 100)}%</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              disabled={zoomLevel >= 3.5}
              className="btn-zoom-action"
              title="Zoom In (+)"
              aria-label="Zoom In"
              id="btn-zoom-in"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        )}

        {/* On-canvas Slide Navigation Arrows (< and > to slide between images) */}
        {canNavigate && totalSlides > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (currentIndex > 0 && onPrevious) onPrevious();
              }}
              disabled={currentIndex <= 0}
              className="canvas-nav-arrow canvas-nav-prev"
              aria-label="Previous Slide"
              title="Previous Slide (Left Arrow)"
              id="btn-canvas-prev-slide"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (currentIndex < totalSlides - 1 && onNext) onNext();
              }}
              disabled={currentIndex >= totalSlides - 1}
              className="canvas-nav-arrow canvas-nav-next"
              aria-label="Next Slide"
              title="Next Slide (Right Arrow)"
              id="btn-canvas-next-slide"
            >
              <ChevronRight size={28} />
            </button>
          </>
        )}
      </div>

      {/* Control Bar (shown for Main/Helper or when controls are active) */}
      {canNavigate && !isFullscreen && (
        <div className="viewer-control-bar">
          <div className="viewer-section-title-wrap">
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {activeSlide ? activeSlide.sectionTitle : 'Zen Sync'}
            </div>
          </div>

          <div className="nav-buttons-center">
            <button
              onClick={onPrevious}
              disabled={currentIndex <= 0 || totalSlides === 0}
              className="btn-outline nav-btn-prev"
              title="Previous Slide (Left Arrow)"
              id="btn-previous-slide"
            >
              <ChevronLeft size={20} />
              <span className="nav-btn-text">Previous</span>
            </button>

            <div className="slide-counter-badge" title="Current Slide / Total Slides">
              {totalSlides > 0 ? `${currentIndex + 1} / ${totalSlides}` : '0 / 0'}
            </div>

            <button
              onClick={onNext}
              disabled={currentIndex >= totalSlides - 1 || totalSlides === 0}
              className="btn-primary nav-btn-next"
              title="Next Slide (Right Arrow or Space)"
              id="btn-next-slide"
            >
              <span className="nav-btn-text">Next</span>
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="viewer-fullscreen-btn-wrap">
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

      {/* Fullscreen Overlay Controls (always visible on mobile, high contrast) */}
      {isFullscreen && (
        <div className="fullscreen-overlay-controls">
          {canNavigate && (
            <button
              onClick={onPrevious}
              disabled={currentIndex <= 0}
              className="btn-outline fs-nav-btn"
              title="Previous Slide"
            >
              <ChevronLeft size={18} />
              <span className="fs-btn-text">Prev</span>
            </button>
          )}

          <div className="fs-counter-badge">
            {totalSlides > 0 ? `${currentIndex + 1} / ${totalSlides}` : '0 / 0'}
          </div>

          {canNavigate && (
            <button
              onClick={onNext}
              disabled={currentIndex >= totalSlides - 1}
              className="btn-primary fs-nav-btn"
              title="Next Slide"
            >
              <span className="fs-btn-text">Next</span>
              <ChevronRight size={18} />
            </button>
          )}

          <button onClick={toggleFullscreen} className="btn-icon fs-exit-btn" title="Exit Fullscreen Mode">
            <Minimize2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
