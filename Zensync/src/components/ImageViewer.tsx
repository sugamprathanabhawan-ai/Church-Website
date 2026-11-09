import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
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
  allSlides?: FlatSlide[];
  onPrevious?: () => void;
  onNext?: () => void;
  canNavigate?: boolean; // false for Sub mode, true for Main & Helper
  onAddSlidePrompt?: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  activeSlide,
  currentIndex,
  totalSlides,
  allSlides = [],
  onPrevious,
  onNext,
  canNavigate = true,
  onAddSlidePrompt,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Dual-layer state for seamless, flicker-free cross-fade transitions
  const [currentSlideItem, setCurrentSlideItem] = useState<FlatSlide | null>(activeSlide);
  const [prevSlideItem, setPrevSlideItem] = useState<FlatSlide | null>(null);
  const [isCrossFading, setIsCrossFading] = useState<boolean>(false);
  const fadeTimeoutRef = useRef<number | null>(null);

  // Next & Previous Controls visibility: vanished by default so the image is seen clearly
  // Revealed ONLY when the user clicks / taps the screen; auto-vanishes after 3.5s of inactivity
  const [showControls, setShowControls] = useState<boolean>(false);
  const hideControlsTimerRef = useRef<number | null>(null);

  // Auto-vanish timer: when controls become visible, auto-hide after 3.5s of inactivity
  // Resets timer whenever user changes slides so controls remain while actively presenting
  useEffect(() => {
    if (!showControls) return;

    hideControlsTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 3500);

    return () => {
      if (hideControlsTimerRef.current) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [showControls, currentIndex]);

  const toggleControls = useCallback(() => {
    setShowControls((prev) => !prev);
  }, []);

  const keepControlsAlive = useCallback(() => {
    setShowControls(true);
  }, []);

  // Zoom and strictly Vertical-only Pan State (Zero horizontal movement)
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panY, setPanY] = useState<number>(0);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  // Touch & Gesture Tracking Refs
  const pinchDistanceRef = useRef<number | null>(null);
  const pinchInitialZoomRef = useRef<number>(1);
  const isPinchingRef = useRef<boolean>(false);
  const touchStartYRef = useRef<number | null>(null);
  const panStartYRef = useRef<number>(0);
  const dragStartYRef = useRef<number>(0);
  const lastTapRef = useRef<number>(0);

  // Object-fit mode ('contain' by default so 100% of the slide is fully visible with zero cropping)
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('contain');

  // Preload adjacent slides into browser image cache so next/prev clicks render instantly
  useEffect(() => {
    if (!allSlides || allSlides.length === 0) return;
    const preloadIndices = [currentIndex + 1, currentIndex + 2, currentIndex - 1].filter(
      (idx) => idx >= 0 && idx < allSlides.length
    );
    preloadIndices.forEach((idx) => {
      const slide = allSlides[idx];
      if (slide?.slide?.url) {
        const preloadImg = new Image();
        preloadImg.src = slide.slide.url;
      }
    });
  }, [currentIndex, allSlides]);

  // Handle slide transitions smoothly without unmounting flicker
  useEffect(() => {
    if (!activeSlide) {
      setCurrentSlideItem(null);
      setPrevSlideItem(null);
      return;
    }

    // When slide changes or slide URL updates, keep outgoing slide in background while incoming slide dissolves in
    if (currentSlideItem && (currentSlideItem.slide.id !== activeSlide.slide.id || currentSlideItem.slide.url !== activeSlide.slide.url)) {
      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current);
      }
      setPrevSlideItem(currentSlideItem);
      setCurrentSlideItem(activeSlide);
      setIsCrossFading(true);

      fadeTimeoutRef.current = window.setTimeout(() => {
        setIsCrossFading(false);
        setPrevSlideItem(null);
      }, 190);
    } else if (!currentSlideItem) {
      setCurrentSlideItem(activeSlide);
    }

    return () => {
      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [activeSlide?.slide?.id, activeSlide?.slide?.url]);

  // Reset zoom & pan whenever active slide changes
  useEffect(() => {
    if (zoomLevel !== 1) setZoomLevel(1);
    if (panY !== 0) setPanY(0);
  }, [currentIndex, activeSlide?.slide.id]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(3.5, Math.round((prev + 0.25) * 100) / 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => {
      const next = Math.max(0.5, Math.round((prev - 0.25) * 100) / 100);
      if (next <= 1) setPanY(0);
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanY(0);
  }, []);

  // Desktop Mouse Drag Panning (Vertical only, no left-right shift)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsInteracting(true);
    dragStartYRef.current = e.clientY;
    panStartYRef.current = panY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isInteracting || zoomLevel <= 1) return;
    const deltaY = e.clientY - dragStartYRef.current;
    const maxPanY = Math.max(100, (zoomLevel - 1) * 350);
    setPanY(Math.max(-maxPanY, Math.min(maxPanY, panStartYRef.current + deltaY)));
  };

  const handleMouseUp = () => {
    setIsInteracting(false);
  };

  // Keyboard navigation & zoom shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && canNavigate && onPrevious) {
        e.preventDefault();
        keepControlsAlive();
        onPrevious();
      } else if (e.key === 'ArrowRight' && canNavigate && onNext) {
        e.preventDefault();
        keepControlsAlive();
        onNext();
      } else if (e.key === ' ' && canNavigate && onNext) {
        e.preventDefault();
        keepControlsAlive();
        onNext();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        keepControlsAlive();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        keepControlsAlive();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        keepControlsAlive();
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canNavigate, onPrevious, onNext, handleZoomIn, handleZoomOut, handleResetZoom, keepControlsAlive]);

  // Touch Gesture Handling:
  // 1. Smooth 2-finger pinch-to-zoom (in place, without any left-right translation).
  // 2. Vertical-only scrolling when zoomed in so the user can read the full sheet/lyrics.
  // 3. ZERO touch swipe slide changing: left/right navigation between lyrics ONLY happens on Next or Previous button click!
  const handleTouchStart = (e: React.TouchEvent) => {
    // 2-Finger Pinch to Zoom
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchDistanceRef.current = dist;
      pinchInitialZoomRef.current = zoomLevel;
      isPinchingRef.current = true;
      setIsInteracting(true);
      return;
    }

    // 1-Finger touch: check double-tap for quick zoom & enable vertical pan if zoomed
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        // Double tap toggle
        if (zoomLevel > 1.2) {
          handleResetZoom();
        } else {
          setZoomLevel(2.0);
        }
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (zoomLevel > 1) {
        touchStartYRef.current = e.touches[0].clientY;
        panStartYRef.current = panY;
        setIsInteracting(true);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Smooth Pinch Zooming
    if (e.touches.length === 2 && pinchDistanceRef.current !== null) {
      if (e.cancelable) e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = currentDist / pinchDistanceRef.current;
      const targetZoom = Math.min(4.0, Math.max(1.0, Math.round(pinchInitialZoomRef.current * scale * 100) / 100));
      setZoomLevel(targetZoom);
      if (targetZoom <= 1.05) {
        setPanY(0);
      }
      return;
    }

    // 1-Finger Vertical Scroll when Zoomed In (No horizontal translation!)
    if (e.touches.length === 1 && zoomLevel > 1 && touchStartYRef.current !== null && !isPinchingRef.current) {
      if (e.cancelable) e.preventDefault();
      const deltaY = e.touches[0].clientY - touchStartYRef.current;
      const maxPanY = Math.max(100, (zoomLevel - 1) * 350);
      const targetY = panStartYRef.current + deltaY;
      setPanY(Math.max(-maxPanY, Math.min(maxPanY, targetY)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchDistanceRef.current = null;
      isPinchingRef.current = false;
    }

    if (e.touches.length === 0) {
      touchStartYRef.current = null;
      setIsInteracting(false);
      if (zoomLevel < 1.05) {
        setZoomLevel(1);
        setPanY(0);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="viewer-stage"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        toggleControls();
      }}
    >
      {/* Canvas Area (Click anywhere to reveal Next & Previous controls, or click again to vanish) */}
      <div className="viewer-canvas-area">
        {(currentSlideItem || prevSlideItem) ? (
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
              paddingTop: 'calc(58px + env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(46px, env(safe-area-inset-bottom, 16px))',
              paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(8px, env(safe-area-inset-right, 0px))',
              boxSizing: 'border-box',
              cursor: zoomLevel > 1 ? (isInteracting ? 'grabbing' : 'grab') : 'default',
              userSelect: 'none',
              touchAction: 'none',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={() => {
              if (zoomLevel > 1.2) {
                handleResetZoom();
              } else {
                setFitMode((prev) => (prev === 'cover' ? 'contain' : 'cover'));
              }
            }}
          >
            {/* Background Layer: Outgoing slide retained during cross-fade to eliminate black flicker */}
            {prevSlideItem && (
              <img
                src={prevSlideItem.slide.url}
                alt={prevSlideItem.slide.name || 'Previous Slide'}
                className="presentation-image presentation-image-bg"
                loading="eager"
                decoding="async"
                draggable={false}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: fitMode,
                  pointerEvents: 'none',
                  zIndex: 1,
                  opacity: 1,
                  padding: 'inherit',
                  boxSizing: 'border-box',
                  transform: `translate3d(0px, ${panY}px, 0px) scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'none',
                  willChange: 'opacity, transform',
                }}
              />
            )}

            {/* Foreground Layer: Incoming slide with gentle, subtle cross-fade */}
            {currentSlideItem && (
              <img
                src={currentSlideItem.slide.url}
                alt={currentSlideItem.slide.name || 'Presentation Slide'}
                className="presentation-image presentation-image-fg"
                loading="eager"
                decoding="async"
                draggable={false}
                style={{
                  position: prevSlideItem ? 'absolute' : 'relative',
                  inset: prevSlideItem ? 0 : undefined,
                  width: '100%',
                  height: '100%',
                  objectFit: fitMode,
                  pointerEvents: 'none',
                  zIndex: 2,
                  padding: prevSlideItem ? 'inherit' : undefined,
                  boxSizing: 'border-box',
                  animation: isCrossFading ? 'zensyncFadeIn 0.18s cubic-bezier(0.2, 0, 0, 1) forwards' : 'none',
                  transform: `translate3d(0px, ${panY}px, 0px) scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: isInteracting ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'opacity, transform',
                }}
              />
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '3rem 2.5rem',
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(24px) saturate(160%)',
              WebkitBackdropFilter: 'blur(24px) saturate(160%)',
              borderRadius: '24px',
              border: '1.5px solid rgba(255, 255, 255, 0.95)',
              maxWidth: '480px',
              boxShadow: '0 20px 50px -10px rgba(33, 75, 96, 0.1), inset 0 1px 2px rgba(255, 255, 255, 1)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.95)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
                boxShadow: '0 6px 18px rgba(33, 75, 96, 0.06), inset 0 1px 1px rgba(255, 255, 255, 1)',
              }}
            >
              <ImageOff size={30} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              No Slides in Presentation
            </h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              Upload your song slides or sermon images to start presenting.
            </p>
            {onAddSlidePrompt && (
              <button onClick={onAddSlidePrompt} className="btn-primary" style={{ borderRadius: '14px', padding: '0.75rem 1.4rem' }}>
                <Plus size={18} />
                <span>+ Add Slides / Songs</span>
              </button>
            )}
          </div>
        )}

        {/* Floating section title tag in presentation view (hidden for clean, distraction-free stage) */}

        {/* Floating Zoom Controls (+ / - / Reset) (Vanished by default, visible on screen click) */}
        {activeSlide && (
          <div className={`viewer-zoom-controls ${showControls ? 'visible' : 'vanished'}`} role="toolbar" aria-label="Zoom Controls">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                keepControlsAlive();
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
                keepControlsAlive();
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
                keepControlsAlive();
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

        {/* White Transparent Glassmorphism Circular Arrows on Left and Right sides */}
        {canNavigate && totalSlides > 0 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                keepControlsAlive();
                if (currentIndex > 0 && onPrevious) onPrevious();
              }}
              disabled={currentIndex <= 0}
              className={`canvas-nav-arrow canvas-nav-prev glass-nav-arrow ${showControls ? 'visible' : 'vanished'}`}
              aria-label="Previous Slide"
              title="Previous Slide (Left)"
              id="btn-canvas-prev-slide"
            >
              <ChevronLeft size={28} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                keepControlsAlive();
                if (currentIndex < totalSlides - 1 && onNext) onNext();
              }}
              disabled={currentIndex >= totalSlides - 1}
              className={`canvas-nav-arrow canvas-nav-next glass-nav-arrow ${showControls ? 'visible' : 'vanished'}`}
              aria-label="Next Slide"
              title="Next Slide (Right)"
              id="btn-canvas-next-slide"
            >
              <ChevronRight size={28} strokeWidth={2.5} />
            </button>
          </>
        )}

        {/* Minimalist Floating Glass Slide Counter Pill (Vanished by default, visible on screen click) */}
        {totalSlides > 0 && (
          <div className={`glass-slide-counter-badge ${showControls ? 'visible' : 'vanished'}`} title="Current Slide / Total Slides">
            <span>{currentIndex + 1}</span>
            <span style={{ opacity: 0.5, margin: '0 4px' }}>/</span>
            <span>{totalSlides}</span>
          </div>
        )}
      </div>
    </div>
  );
};
