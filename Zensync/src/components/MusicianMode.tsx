import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Home,
  Music,
  Bell,
  X,
  Menu,
  Copy,
  Check,
  Upload,
  RotateCcw,
  Radio,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  Plus,
  Trash2,
  GripVertical,
} from 'lucide-react';
import type {
  SectionItem,
  SlideItem,
  ConnectionStatus,
  NoticeItem,
  NoteItem,
  DeviceAuditInfo,
  ChatParticipant,
  DirectNotification,
  FlatSlide,
} from '../types';
import { ImageViewer } from './ImageViewer';
import { NotesViewer } from './NotesViewer';
import { NoticePopup } from './NoticePopup';
import { NoticeBroadcaster } from './NoticeBroadcaster';
import { resolveSlideState, normalizeToSingleSection, flattenSections, optimizeSlideImageForUpload } from '../lib/presentationUtils';
import { getSession, subscribeToSession, broadcastParticipantPresence } from '../lib/supabaseClient';
import { getOrCreateDeviceId } from '../lib/deviceUtils';
import {
  getAllOverridesForSession,
  saveSlideOverride,
  removeSlideOverride,
  clearSessionOverrides,
  saveMusicianCustomSlides,
  getMusicianCustomSlides,
  saveMusicianSlideOrder,
  getMusicianSlideOrder,
  type MusicianSlideOverride,
} from '../lib/musicianStorage';

interface MusicianModeProps {
  sessionCode: string;
  initialDeviceInfo?: DeviceAuditInfo;
  onExit: () => void;
}

export const MusicianMode: React.FC<MusicianModeProps> = ({ sessionCode, initialDeviceInfo, onExit }) => {
  const [sections, setSections] = useState<SectionItem[]>(() => normalizeToSingleSection());
  const [localOverrides, setLocalOverrides] = useState<Record<string, MusicianSlideOverride>>({});
  const [customSlides, setCustomSlides] = useState<SlideItem[]>([]);
  const [slideOrder, setSlideOrder] = useState<string[]>([]);
  const [currentGlobalIndex, setCurrentGlobalIndex] = useState(0);
  const [liveAdminGlobalIndex, setLiveAdminGlobalIndex] = useState(0);
  const [status, setStatus] = useState<ConnectionStatus>('reconnecting');
  const [sessionEnded, setSessionEnded] = useState(false);

  // Songs list collapsible state & drag-and-drop
  const [songsDropdownOpen, setSongsDropdownOpen] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [targetReplaceSlideId, setTargetReplaceSlideId] = useState<string | null>(null);

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
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchDragRef = useRef<{ startIndex: number; startY: number } | null>(null);
  const myDeviceId = getOrCreateDeviceId();
  const myName =
    initialDeviceInfo?.deviceName ||
    (typeof window !== 'undefined' ? localStorage.getItem('zensync_user_name') : '') ||
    'Musician';

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sessionCode).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Initial load: Fetch session data from Supabase & load musician's local data from IndexedDB/localStorage
  useEffect(() => {
    let isMounted = true;

    async function load() {
      // 1. Fetch local overrides, custom slides, and custom slide order
      try {
        const [storedOverrides, storedCustom, storedOrder] = await Promise.all([
          getAllOverridesForSession(sessionCode),
          getMusicianCustomSlides(sessionCode),
          getMusicianSlideOrder(sessionCode),
        ]);
        if (isMounted) {
          setLocalOverrides(storedOverrides || {});
          setCustomSlides(storedCustom || []);
          setSlideOrder(storedOrder || []);
        }
      } catch (err) {
        console.warn('[MusicianMode] Could not load local musician data:', err);
      }

      // 2. Fetch presentation content from Supabase
      const data = await getSession(sessionCode);
      if (isMounted && data) {
        if (data.content?.kicked_devices?.includes(myDeviceId)) {
          setIsKicked(true);
          return;
        }
        setSections(normalizeToSingleSection(data.content?.sections));
        setNotes(data.content?.notes || []);
        setActiveNotice(data.content?.activeNotice || null);
        const adminIdx = data.current_slide?.globalIndex || 0;
        setLiveAdminGlobalIndex(adminIdx);
        // Start on current admin slide on initial join
        setCurrentGlobalIndex(adminIdx);
        setStatus('connected');
      }
    }
    load();

    // Broadcast Musician presence so team sees this musician
    broadcastParticipantPresence(sessionCode, {
      deviceId: myDeviceId,
      name: myName,
      role: 'musician',
      lastSeen: Date.now(),
    }).catch(() => {});

    const presenceInterval = setInterval(() => {
      broadcastParticipantPresence(sessionCode, {
        deviceId: myDeviceId,
        name: myName,
        role: 'musician',
        lastSeen: Date.now(),
      }).catch(() => {});
    }, 15000);

    const unsubscribe = subscribeToSession(sessionCode, {
      // Out of sync: Live slide changes do NOT hijack the musician's current slide!
      onSlideChange: (newSlide) => {
        setLiveAdminGlobalIndex(newSlide.globalIndex);
        setStatus('connected');
      },
      // When Admin uploads new songs or modifies slides, musician receives all database images
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
          notif.recipientRole === 'musician' ||
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

  // Combine Admin slides + Musician custom slides + Musician local overrides (chord sheets)
  const effectiveSlides = useMemo(() => {
    const adminSlides = sections.flatMap((sec) => sec.slides || []);
    const combined = [...adminSlides, ...customSlides];

    // Apply local overrides (musician replaced images)
    const mapped = combined.map((s) => {
      const override = localOverrides[s.id];
      if (override && override.dataUrl) {
        return {
          ...s,
          url: override.dataUrl,
          name: override.fileName || s.name,
        };
      }
      return s;
    });

    // Apply musician's custom local ordering if specified
    if (slideOrder.length > 0) {
      const orderMap = new Map(slideOrder.map((id, index) => [id, index]));
      const sorted = [...mapped].sort((a, b) => {
        const orderA = orderMap.has(a.id) ? orderMap.get(a.id)! : 99999;
        const orderB = orderMap.has(b.id) ? orderMap.get(b.id)! : 99999;
        return orderA - orderB;
      });
      return sorted;
    }

    return mapped;
  }, [sections, customSlides, localOverrides, slideOrder]);

  const effectiveSections = useMemo((): SectionItem[] => {
    return [{
      id: 'musician-setlist',
      title: 'Musician Setlist',
      slides: effectiveSlides,
    }];
  }, [effectiveSlides]);

  const allEffectiveFlatSlides = useMemo(() => {
    return flattenSections(effectiveSections);
  }, [effectiveSections]);

  const totalSlides = allEffectiveFlatSlides.length;

  // Ensure currentGlobalIndex is within valid bounds
  useEffect(() => {
    if (totalSlides > 0 && currentGlobalIndex >= totalSlides) {
      setCurrentGlobalIndex(Math.max(0, totalSlides - 1));
    }
  }, [totalSlides, currentGlobalIndex]);

  const activeFlatSlide = allEffectiveFlatSlides[currentGlobalIndex] || null;

  // Trigger file upload to replace a specific slide
  const handleTriggerReplaceSlide = (slideId: string) => {
    setTargetReplaceSlideId(slideId);
    fileInputRef.current?.click();
  };

  // Trigger file upload to add a new custom song for musician only
  const handleTriggerAddCustomSlide = () => {
    setTargetReplaceSlideId('__NEW_CUSTOM_SLIDE__');
    fileInputRef.current?.click();
  };

  // Process chosen image file (Downscale on canvas before saving to IndexedDB)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (e.g. JPG, PNG, WEBP) for your song sheet.');
      return;
    }

    setIsProcessingImage(true);
    try {
      const optimizedFile = await optimizeSlideImageForUpload(file, 1800, 0.85);
      const reader = new FileReader();
      reader.onload = async (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string;
        if (!dataUrl) {
          setIsProcessingImage(false);
          return;
        }

        if (targetReplaceSlideId === '__NEW_CUSTOM_SLIDE__') {
          // Add brand new custom slide for this musician only
          const newSlide: SlideItem = {
            id: `musician_custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            url: dataUrl,
            name: file.name,
            createdAt: Date.now(),
          };
          const nextCustom = [...customSlides, newSlide];
          setCustomSlides(nextCustom);
          await saveMusicianCustomSlides(sessionCode, nextCustom);
        } else if (targetReplaceSlideId) {
          // Replace specific existing slide with musician chord sheet (for musician only)
          const slideId = targetReplaceSlideId;
          await saveSlideOverride(sessionCode, slideId, dataUrl, file.name);

          setLocalOverrides((prev) => ({
            ...prev,
            [slideId]: {
              sessionCode,
              slideId,
              dataUrl,
              fileName: file.name,
              timestamp: Date.now(),
            },
          }));
        }

        setIsProcessingImage(false);
        setTargetReplaceSlideId(null);
      };

      reader.onerror = () => {
        alert('Failed to read selected image file.');
        setIsProcessingImage(false);
        setTargetReplaceSlideId(null);
      };

      reader.readAsDataURL(optimizedFile);
    } catch (err: any) {
      console.error('[MusicianMode] Error saving slide override:', err);
      alert(`Could not save override: ${err?.message || 'Error'}`);
      setIsProcessingImage(false);
      setTargetReplaceSlideId(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Revert a single slide back to Admin's original image
  const handleRevertSlideById = async (slideId: string) => {
    try {
      await removeSlideOverride(sessionCode, slideId);
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[slideId];
        return next;
      });
    } catch (err) {
      console.warn('[MusicianMode] Error reverting slide override:', err);
    }
  };

  // Revert ALL musician overrides back to Admin presentation
  const handleRevertAll = async () => {
    if (window.confirm('Revert all your song replacements back to the original Admin presentation slides?')) {
      await clearSessionOverrides(sessionCode);
      setLocalOverrides({});
      setCustomSlides([]);
      setSlideOrder([]);
    }
  };

  // Delete a musician-added custom slide
  const handleDeleteCustomSlide = async (slideId: string) => {
    const updated = customSlides.filter((s) => s.id !== slideId);
    setCustomSlides(updated);
    await saveMusicianCustomSlides(sessionCode, updated);
  };

  // Reorder slides locally for this musician
  const reorderSlides = (fromIndex: number, toIndex: number) => {
    const newSlides = [...allEffectiveFlatSlides];
    const [moved] = newSlides.splice(fromIndex, 1);
    newSlides.splice(toIndex, 0, moved);
    const newOrder = newSlides.map((s) => s.slide.id);
    setSlideOrder(newOrder);
    saveMusicianSlideOrder(sessionCode, newOrder);
  };

  // Drag and drop handlers for reordering songs
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    reorderSlides(draggedIndex, targetIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch drag reordering for mobile
  const handleTouchDragStart = (e: React.TouchEvent, index: number) => {
    touchDragRef.current = { startIndex: index, startY: e.touches[0].clientY };
  };

  // Navigate to slide on row click
  const handleGoToSlide = (index: number) => {
    if (index >= 0 && index < totalSlides) {
      setCurrentGlobalIndex(index);
    }
  };

  // Jump to live presenter slide
  const handleJumpToLive = () => {
    if (liveAdminGlobalIndex >= 0 && liveAdminGlobalIndex < totalSlides) {
      setCurrentGlobalIndex(liveAdminGlobalIndex);
    }
  };

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
              cursor: 'pointer',
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
      {/* Hidden file input for musician local slide override */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* Real-time Notice Pop-up Banner for Musician */}
      <NoticePopup
        notice={activeNotice}
        directNotification={directNotification}
        onDismiss={() => setActiveNotice(null)}
        onDismissDirect={() => setDirectNotification(null)}
        onOpenNotes={() => setActiveSectionView('notes')}
      />

      {/* Top Navbar matching exact interface (3-lines menu, center images/notice toggle, right exit) */}
      <header className="app-navbar sub-navbar">
        <div className="navbar-left" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className={`btn-icon ${sidebarOpen ? 'active' : ''}`}
            style={{ display: 'flex', flexShrink: 0 }}
            title="Toggle Menu (3 Lines)"
            aria-label="Toggle Sidebar Menu"
            id="btn-musician-sidebar-toggle"
          >
            <Menu size={18} />
          </button>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.55rem',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '1rem',
              color: '#8b5cf6',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            <Music size={12} />
            <span>MUSICIAN</span>
          </div>
        </div>

        {/* Center: Toggle between images and notice */}
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
            id="btn-musician-exit"
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

      {/* Left Sidebar Drawer for Musician (Code, Notice Broadcaster, and Down Exit only) */}
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

          {/* 2. Notice Broadcaster Feature */}
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

          {/* 3. SONGS / SLIDES LIST (The same song-managing feature of Admin, for Musician only) */}
          <div className="sidebar-drawer-card sidebar-songs-card">
            <div className="sidebar-songs-header">
              <div
                className="sidebar-songs-title"
                onClick={() => setSongsDropdownOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                title="Click to toggle songs list"
              >
                <Music size={15} color="#8b5cf6" />
                <span>Songs ({totalSlides})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {/* Revert All button if musician has any replacements */}
                {Object.keys(localOverrides).length > 0 && (
                  <button
                    type="button"
                    onClick={handleRevertAll}
                    className="btn-outline"
                    style={{
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.7rem',
                      color: '#dc2626',
                      borderColor: '#fecaca',
                      backgroundColor: '#fef2f2',
                      borderRadius: '5px',
                      cursor: 'pointer',
                    }}
                    title="Revert all your song replacements back to Admin slides"
                  >
                    Revert All
                  </button>
                )}

                {/* Down Arrow to toggle viewable/unviewable */}
                <button
                  type="button"
                  onClick={() => setSongsDropdownOpen((prev) => !prev)}
                  className="btn-icon"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title={songsDropdownOpen ? 'Collapse songs list' : 'Expand songs list'}
                  aria-label="Toggle Songs List (Viewable / Unviewable)"
                  id="btn-musician-toggle-songs-list"
                >
                  <ChevronDown
                    size={15}
                    style={{
                      transform: songsDropdownOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </button>

                {/* Add Custom Song (+) for Musician Only */}
                <button
                  type="button"
                  onClick={handleTriggerAddCustomSlide}
                  disabled={isProcessingImage}
                  className="btn-icon"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  title="Add custom song / chord sheet for yourself (+)"
                  id="btn-musician-add-slide-top"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Numbered Songs List (Toggled Viewable / Unviewable by Down Arrow) */}
            {songsDropdownOpen && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  marginTop: totalSlides > 0 ? '0.4rem' : '0',
                }}
              >
                {totalSlides === 0 ? (
                  <div
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                    }}
                  >
                    No songs in presentation yet.
                  </div>
                ) : (
                  allEffectiveFlatSlides.map((slide, slideIdx) => {
                    const isCurrent = currentGlobalIndex === slideIdx;
                    const isAdminLive = liveAdminGlobalIndex === slideIdx;
                    const isOverridden = Boolean(localOverrides[slide.slide.id]);
                    const isCustom = slide.slide.id.startsWith('musician_custom_');
                    const isDragging = draggedIndex === slideIdx;
                    const isDragOver = dragOverIndex === slideIdx;

                    return (
                      <div
                        key={slide.slide.id}
                        data-slide-index={slideIdx}
                        draggable
                        onDragStart={(e) => handleDragStart(e, slideIdx)}
                        onDragOver={(e) => handleDragOver(e, slideIdx)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, slideIdx)}
                        className={`slide-row ${isCurrent ? 'active' : ''}`}
                        style={{
                          opacity: isDragging ? 0.35 : 1,
                          borderTop: isDragOver && !isDragging ? '2.5px solid #8b5cf6' : undefined,
                          backgroundColor: isDragOver && !isDragging ? '#faf5ff' : undefined,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '8px',
                          border: isCurrent ? '1.5px solid #8b5cf6' : '1px solid #e2e8f0',
                          transition: 'all 0.15s ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleGoToSlide(slideIdx)}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          {/* Drag Handle & Number Pill */}
                          <div
                            className="slide-drag-handle"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              color: isDragging ? '#8b5cf6' : '#94a3b8',
                              cursor: 'grab',
                              touchAction: 'none',
                              padding: '0.2rem 0.15rem',
                              userSelect: 'none',
                            }}
                            onTouchStart={(e) => handleTouchDragStart(e, slideIdx)}
                            title="Drag to reorder songs for yourself"
                          >
                            <GripVertical size={14} style={{ cursor: 'grab', flexShrink: 0 }} />
                            <div
                              className="slide-num-pill"
                              style={{
                                backgroundColor: isCurrent
                                  ? '#8b5cf6'
                                  : isOverridden
                                  ? '#f3e8ff'
                                  : '#f1f5f9',
                                color: isCurrent
                                  ? '#ffffff'
                                  : isOverridden
                                  ? '#7c3aed'
                                  : '#475569',
                              }}
                            >
                              {slideIdx + 1}
                            </div>
                          </div>

                          {/* Song Thumbnail Preview */}
                          {slide.slide.url && (
                            <img
                              src={slide.slide.url}
                              alt={`Slide ${slideIdx + 1}`}
                              style={{
                                width: '38px',
                                height: '38px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                                border: isCurrent
                                  ? '1.5px solid #8b5cf6'
                                  : isOverridden
                                  ? '1.5px solid #a855f7'
                                  : '1px solid #e2e8f0',
                                flexShrink: 0,
                              }}
                              loading="lazy"
                            />
                          )}

                          {/* Status indicators */}
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.15rem',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                flexWrap: 'wrap',
                              }}
                            >
                              {isCurrent && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    color: '#8b5cf6',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  ● Viewing
                                </span>
                              )}
                              {isAdminLive && (
                                <span
                                  style={{
                                    fontSize: '0.66rem',
                                    fontWeight: 700,
                                    color: '#16a34a',
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase',
                                  }}
                                  title="Admin is currently live on this slide"
                                >
                                  ● Admin Live
                                </span>
                              )}
                              {isOverridden && (
                                <span
                                  style={{
                                    fontSize: '0.66rem',
                                    fontWeight: 700,
                                    color: '#7c3aed',
                                    backgroundColor: '#faf5ff',
                                    border: '1px solid #e9d5ff',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                  }}
                                  title="Custom sheet active on this slide (for you only)"
                                >
                                  <Music size={9} />
                                  <span>My Sheet</span>
                                </span>
                              )}
                              {isCustom && (
                                <span
                                  style={{
                                    fontSize: '0.66rem',
                                    fontWeight: 700,
                                    color: '#0284c7',
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bae6fd',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                  }}
                                >
                                  Custom
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons: Replace, Revert, Delete */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            flexShrink: 0,
                          }}
                        >
                          {/* Replace song for this musician */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTriggerReplaceSlide(slide.slide.id);
                            }}
                            className="btn-icon"
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#ffffff',
                              color: '#8b5cf6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            title="Replace this song with your chord sheet (Me Only)"
                            aria-label={`Replace Song ${slideIdx + 1}`}
                          >
                            <Upload size={13} />
                          </button>

                          {/* Revert back to Admin's original slide */}
                          {isOverridden && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRevertSlideById(slide.slide.id);
                              }}
                              className="btn-icon"
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                border: '1px solid #fecaca',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              title="Revert back to Admin's original slide"
                              aria-label={`Revert Song ${slideIdx + 1}`}
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}

                          {/* Delete custom song if created by musician */}
                          {isCustom && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomSlide(slide.slide.id);
                              }}
                              className="btn-icon btn-delete-slide"
                              style={{
                                width: '26px',
                                height: '26px',
                                border: 'none',
                                flexShrink: 0,
                                color: '#dc2626',
                                cursor: 'pointer',
                              }}
                              title="Delete custom song"
                              aria-label={`Delete Song ${slideIdx + 1}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Bottom Action - Down Exit */}
        <div className="sidebar-footer">
          <button
            onClick={() => setShowExitModal(true)}
            className="btn-outline btn-sidebar-exit"
            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem' }}
            title="Exit Presentation"
            id="btn-musician-sidebar-exit"
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
              allSlides={allEffectiveFlatSlides}
              onPrevious={() => setCurrentGlobalIndex((prev) => Math.max(0, prev - 1))}
              onNext={() => setCurrentGlobalIndex((prev) => Math.min(totalSlides - 1, prev + 1))}
              canNavigate={true}
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
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            margin: 0,
            padding: '1rem',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '380px',
              width: '100%',
              backgroundColor: '#111827',
              color: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #374151',
              boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
              padding: '1.75rem 1.5rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <X size={26} strokeWidth={2.5} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#ffffff' }}>
              Are you sure you want to exit?
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#9ca3af', margin: '0 0 1.5rem 0', lineHeight: 1.4 }}>
              You will leave the live presentation session.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="btn-outline"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#e5e7eb',
                  color: '#1f2937',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
              <button
                type="button"
                onClick={onExit}
                className="btn-primary"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                id="btn-confirm-musician-exit"
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
