import React, { useState, useEffect, useRef } from 'react';
import {
  Trash2,
  Edit2,
  Upload,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Menu,
  X,
  Plus,
  Home,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { SectionItem, SlideItem, ConnectionStatus } from '../types';
import { ImageViewer } from './ImageViewer';
import {
  flattenSections,
  resolveSlideState,
  createDefaultSections,
} from '../lib/presentationUtils';
import {
  createSession,
  updateSessionSlide,
  updateSessionContent,
  uploadSlideImage,
  subscribeToSession,
  deleteSlideImage,
  deleteSession,
} from '../lib/supabaseClient';

interface MainModeProps {
  sessionCode: string;
  onExit: () => void;
}

export const MainMode: React.FC<MainModeProps> = ({ sessionCode, onExit }) => {
  const [sections, setSections] = useState<SectionItem[]>(() => createDefaultSections());
  const [currentGlobalIndex, setCurrentGlobalIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const [isUploading, setIsUploading] = useState(false);

  // Section editing state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Bulk selection mode for slides in a section
  const [selectedSlideIds, setSelectedSlideIds] = useState<Record<string, string[]>>({});
  const [bulkModeSectionId, setBulkModeSectionId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetUploadSectionId = useRef<string | null>(null);

  // Initialize session in Supabase & subscribe
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const initial = await createSession(sessionCode, sections);
      if (isMounted && initial) {
        if (initial.content?.sections && initial.content.sections.length > 0) {
          setSections(initial.content.sections);
        }
        if (initial.current_slide) {
          setCurrentGlobalIndex(initial.current_slide.globalIndex || 0);
        }
      }
    }
    init();

    const unsubscribe = subscribeToSession(sessionCode, {
      onSlideChange: (newSlide) => {
        setCurrentGlobalIndex(newSlide.globalIndex);
      },
      onContentChange: (newSections) => {
        setSections(newSections);
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
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

  // Slide navigation
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

  // Section CRUD
  const handleAddSection = () => {
    const newSection: SectionItem = {
      id: `sec-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      slides: [],
    };
    const updated = [...sections, newSection];
    setSections(updated);
    updateSessionContent(sessionCode, updated);

    // Immediately trigger rename for smooth UX
    setEditingSectionId(newSection.id);
    setEditingTitle(newSection.title);
  };

  const handleRenameSection = (id: string) => {
    if (!editingTitle.trim()) return;
    const updated = sections.map((sec) =>
      sec.id === id ? { ...sec, title: editingTitle.trim() } : sec
    );
    setSections(updated);
    updateSessionContent(sessionCode, updated);
    setEditingSectionId(null);
  };

  const handleDeleteSection = (id: string) => {
    if (sections.length <= 1) {
      if (!confirm('This is the only section. Are you sure you want to delete it?')) return;
    }
    const secToDelete = sections.find((s) => s.id === id);
    if (secToDelete) {
      secToDelete.slides.forEach((sl) => {
        if (sl.url) deleteSlideImage(sessionCode, sl.url);
      });
    }

    const updated = sections.filter((sec) => sec.id !== id);
    setSections(updated);
    updateSessionContent(sessionCode, updated);
    // Reset index safely if needed
    if (currentSlide.sectionId === id) {
      handleGoToSlide(0);
    }
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setSections(updated);
    updateSessionContent(sessionCode, updated);
  };

  // Slide management
  const handleTriggerUpload = (sectionId: string) => {
    targetUploadSectionId.current = sectionId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const secId = targetUploadSectionId.current;
    if (!files || files.length === 0 || !secId) return;

    setIsUploading(true);
    try {
      const newSlides: SlideItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = await uploadSlideImage(sessionCode, file);
        newSlides.push({
          id: `slide-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          url,
          createdAt: Date.now() + i,
        });
      }

      const updated = sections.map((sec) => {
        if (sec.id === secId) {
          return {
            ...sec,
            slides: [...sec.slides, ...newSlides],
          };
        }
        return sec;
      });

      setSections(updated);
      updateSessionContent(sessionCode, updated);
    } catch (err) {
      console.error('Error uploading slides:', err);
      alert('Failed to upload some images. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteSlide = (sectionId: string, slideId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetSlide = sections.find((s) => s.id === sectionId)?.slides.find((sl) => sl.id === slideId);
    if (targetSlide?.url) {
      deleteSlideImage(sessionCode, targetSlide.url);
    }

    const updated = sections.map((sec) => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          slides: sec.slides.filter((s) => s.id !== slideId),
        };
      }
      return sec;
    });

    setSections(updated);
    updateSessionContent(sessionCode, updated);

    // Re-clamp current slide index if needed
    const flat = flattenSections(updated);
    if (currentGlobalIndex >= flat.length) {
      handleGoToSlide(Math.max(0, flat.length - 1));
    }
  };

  // Bulk Delete
  const toggleSelectSlide = (sectionId: string, slideId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentList = selectedSlideIds[sectionId] || [];
    const exists = currentList.includes(slideId);
    const updatedList = exists
      ? currentList.filter((id) => id !== slideId)
      : [...currentList, slideId];

    setSelectedSlideIds({
      ...selectedSlideIds,
      [sectionId]: updatedList,
    });
  };

  const handleBulkDelete = (sectionId: string) => {
    const toDelete = selectedSlideIds[sectionId] || [];
    if (toDelete.length === 0) return;

    if (!confirm(`Delete ${toDelete.length} selected slide(s)?`)) return;

    const targetSec = sections.find((s) => s.id === sectionId);
    if (targetSec) {
      toDelete.forEach((id) => {
        const sl = targetSec.slides.find((s) => s.id === id);
        if (sl?.url) deleteSlideImage(sessionCode, sl.url);
      });
    }

    const updated = sections.map((sec) => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          slides: sec.slides.filter((s) => !toDelete.includes(s.id)),
        };
      }
      return sec;
    });

    setSections(updated);
    updateSessionContent(sessionCode, updated);
    setSelectedSlideIds({ ...selectedSlideIds, [sectionId]: [] });
    setBulkModeSectionId(null);

    const flat = flattenSections(updated);
    if (currentGlobalIndex >= flat.length) {
      handleGoToSlide(Math.max(0, flat.length - 1));
    }
  };

  const handleEndAndDeleteSession = async () => {
    if (
      confirm(
        'Are you sure you want to end and permanently delete this presentation? This will remove all slides, sections, and uploaded images from the Supabase database and disconnect all followers.'
      )
    ) {
      await deleteSession(sessionCode);
      onExit();
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*"
        style={{ display: 'none' }}
      />

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

          <div className="code-badge" title="Share this 4-digit code with Sub & Helper devices">
            CODE: <span>{sessionCode}</span>
            <button
              onClick={handleCopyCode}
              className="btn-icon"
              style={{ width: '26px', height: '26px', border: 'none', background: 'transparent' }}
              title="Copy Code"
            >
              {copied ? <Check size={16} color="var(--primary)" /> : <Copy size={16} color="var(--primary)" />}
            </button>
          </div>
        </div>

        <div className="navbar-actions">
          <div className={`status-pill ${status === 'connected' ? 'connected' : 'demo'}`}>
            <span className={`status-dot ${status === 'connected' ? 'green' : 'blue'}`} />
            <span>{status === 'connected' ? '● LIVE (Host)' : 'Local Sync Active'}</span>
          </div>

          <button
            onClick={handleEndAndDeleteSession}
            className="btn-danger-outline"
            title="Permanently delete presentation & storage files from Supabase"
            id="btn-delete-session"
          >
            <Trash2 size={15} />
            <span>Delete Session</span>
          </button>

          <button onClick={onExit} className="btn-outline" title="Exit Presentation">
            <Home size={16} />
            <span style={{ display: 'inline-block' }}>Exit</span>
          </button>
        </div>
      </header>

      {/* Mobile Backdrop */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Main Layout Area: Sidebar + Image Viewer */}
      <div className="presentation-layout">
        {/* Left Sidebar */}
        <aside className={`presentation-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <span className="sidebar-title">Sections ({sections.length})</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={handleAddSection}
                className="btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                id="btn-add-section"
              >
                <Plus size={16} />
                Add
              </button>
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
            {sections.map((section, sIndex) => {
              const isActiveSection = currentSlide.sectionId === section.id;
              const isBulk = bulkModeSectionId === section.id;
              const selectedInSec = selectedSlideIds[section.id] || [];

              return (
                <div
                  key={section.id}
                  className={`section-card ${isActiveSection ? 'active-section' : ''}`}
                >
                  {/* Section Header */}
                  <div className="section-header">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {editingSectionId === section.id ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleRenameSection(section.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameSection(section.id)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '0.2rem 0.4rem',
                            fontSize: '0.9rem',
                            border: '1px solid var(--primary)',
                            borderRadius: '4px',
                          }}
                        />
                      ) : (
                        <div className="section-header-title">
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {section.title}
                          </span>
                          <span className="section-count-badge">
                            {section.slides.length} slides
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="section-actions">
                      <button
                        onClick={() => handleMoveSection(sIndex, 'up')}
                        disabled={sIndex === 0}
                        className="btn-icon"
                        style={{ width: '24px', height: '24px' }}
                        title="Move Section Up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        onClick={() => handleMoveSection(sIndex, 'down')}
                        disabled={sIndex === sections.length - 1}
                        className="btn-icon"
                        style={{ width: '24px', height: '24px' }}
                        title="Move Section Down"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingSectionId(section.id);
                          setEditingTitle(section.title);
                        }}
                        className="btn-icon"
                        style={{ width: '24px', height: '24px' }}
                        title="Rename Section"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteSection(section.id)}
                        className="btn-icon"
                        style={{ width: '24px', height: '24px', color: 'var(--danger)' }}
                        title="Delete Section"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Section Slides List */}
                  <div className="section-slides-list">
                    {section.slides.map((slide, slideIdx) => {
                      const isCurrent =
                        currentSlide.sectionId === section.id &&
                        currentSlide.slideIndex === slideIdx;
                      const isSelected = selectedInSec.includes(slide.id);

                      // Calculate global index of this slide
                      const flat = flattenSections(sections);
                      const targetFlat = flat.find(
                        (f) => f.sectionId === section.id && f.slideIndex === slideIdx
                      );

                      return (
                        <div
                          key={slide.id}
                          className={`slide-row ${isCurrent ? 'active' : ''}`}
                          onClick={() => {
                            if (isBulk) {
                              toggleSelectSlide(section.id, slide.id, { stopPropagation: () => {} } as any);
                            } else if (targetFlat) {
                              handleGoToSlide(targetFlat.globalIndex);
                            }
                          }}
                        >
                          <div className="slide-row-info">
                            {isBulk ? (
                              <button
                                onClick={(e) => toggleSelectSlide(section.id, slide.id, e)}
                                style={{ color: isSelected ? 'var(--primary)' : 'var(--text-light)' }}
                              >
                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                            ) : (
                              <div className="slide-num-pill">{slideIdx + 1}</div>
                            )}
                            <span style={{ fontSize: '0.85rem' }}>{slide.name}</span>
                          </div>

                          {!isBulk && (
                            <button
                              onClick={(e) => handleDeleteSlide(section.id, slide.id, e)}
                              className="btn-icon"
                              style={{ width: '22px', height: '22px', border: 'none' }}
                              title="Delete Slide"
                            >
                              <Trash2 size={13} color="var(--text-light)" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Section Action Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px dashed var(--border-color)' }}>
                      <button
                        onClick={() => handleTriggerUpload(section.id)}
                        disabled={isUploading}
                        className="btn-secondary"
                        style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                      >
                        <Upload size={14} />
                        {isUploading ? 'Uploading...' : '+ Add Images'}
                      </button>

                      {section.slides.length > 1 && (
                        <button
                          onClick={() => {
                            if (isBulk) {
                              setBulkModeSectionId(null);
                            } else {
                              setBulkModeSectionId(section.id);
                            }
                          }}
                          className="btn-outline"
                          style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem' }}
                        >
                          {isBulk ? 'Cancel' : 'Bulk'}
                        </button>
                      )}

                      {isBulk && selectedInSec.length > 0 && (
                        <button
                          onClick={() => handleBulkDelete(section.id)}
                          className="btn-danger-outline"
                          style={{ padding: '0.35rem 0.55rem', fontSize: '0.75rem' }}
                        >
                          Delete ({selectedInSec.length})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center Presentation Stage */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          {/* Horizontal Section Track for Fast Mobile Access */}
          {sections.length > 0 && (
            <div className="mobile-section-bar">
              <button
                onClick={handleAddSection}
                className="mobile-section-chip"
                style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', borderColor: 'var(--primary-border)' }}
                title="Add New Section"
              >
                <Plus size={14} />
                <span>Section</span>
              </button>
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
            onAddSlidePrompt={() => {
              if (sections.length > 0) {
                handleTriggerUpload(sections[0].id);
              } else {
                handleAddSection();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
