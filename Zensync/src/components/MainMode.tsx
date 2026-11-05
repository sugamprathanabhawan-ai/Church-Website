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
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Users,
  Lock,
} from 'lucide-react';
import type {
  SectionItem,
  SlideItem,
  ConnectionStatus,
  DeviceAuditInfo,
  NoteItem,
  NoticeItem,
  HelperJoinRequest,
} from '../types';
import { ImageViewer } from './ImageViewer';
import { MainNotepad } from './MainNotepad';
import {
  flattenSections,
  resolveSlideState,
  createDefaultSections,
  optimizeSlideImageForUpload,
} from '../lib/presentationUtils';
import {
  createSession,
  getSession,
  forceReleaseHelper,
  respondHelperRequest,
  updateSessionSlide,
  updateSessionContent,
  uploadSlideImage,
  subscribeToSession,
  deleteSlideImage,
  deleteSession,
  isDeviceAuthorizedAdmin,
  authorizeAdminForSession,
  verifySessionAdminPassword,
} from '../lib/supabaseClient';
import { collectDeviceAuditInfo, getOrCreateDeviceId } from '../lib/deviceUtils';

interface MainModeProps {
  sessionCode: string;
  initialDeviceInfo?: DeviceAuditInfo;
  initialAdminPassword?: string;
  onExit: () => void;
}

export const MainMode: React.FC<MainModeProps> = ({ sessionCode, initialDeviceInfo, initialAdminPassword, onExit }) => {
  const [sections, setSections] = useState<SectionItem[]>(() => createDefaultSections());
  const [currentGlobalIndex, setCurrentGlobalIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const [isUploading, setIsUploading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceAuditInfo | undefined>(initialDeviceInfo);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isUnauthorizedMain, setIsUnauthorizedMain] = useState(false);
  const [claimedHostName, setClaimedHostName] = useState('');
  const [activeHelperInfo, setActiveHelperInfo] = useState<DeviceAuditInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'slides' | 'notes'>('slides');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNotice, setActiveNotice] = useState<NoticeItem | null>(null);
  const [pendingHelperRequest, setPendingHelperRequest] = useState<HelperJoinRequest | null>(null);

  // In-session admin password challenge for unauthorized devices accessing Main URL
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [gatePasswordInput, setGatePasswordInput] = useState('');
  const [gatePasswordError, setGatePasswordError] = useState('');
  const [isVerifyingGate, setIsVerifyingGate] = useState(false);

  // Section editing state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Bulk selection mode for slides in a section
  const [selectedSlideIds, setSelectedSlideIds] = useState<Record<string, string[]>>({});
  const [bulkModeSectionId, setBulkModeSectionId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetUploadSectionId = useRef<string | null>(null);

  const handleDisconnectHelper = async () => {
    try {
      await forceReleaseHelper(sessionCode);
      setActiveHelperInfo(null);
    } catch (e: any) {
      console.warn('Failed to release helper:', e);
      alert(`Could not disconnect helper: ${e.message || 'Unauthorized'}`);
    }
  };

  const handleUnlockGateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!gatePasswordInput.trim()) return;

    setIsVerifyingGate(true);
    setGatePasswordError('');
    try {
      const session = await getSession(sessionCode);
      if (!session) {
        setGatePasswordError('Session not found or has expired.');
        return;
      }
      const isValid = verifySessionAdminPassword(session, gatePasswordInput);
      if (isValid) {
        authorizeAdminForSession(sessionCode, session.content?.creatorToken);
        setShowPasswordGate(false);
        setIsUnauthorizedMain(false);

        if (session.content?.sections && session.content.sections.length > 0) {
          setSections(session.content.sections);
        }
        if (session.content?.notes) {
          setNotes(session.content.notes);
        }
        if (session.content?.activeNotice) {
          setActiveNotice(session.content.activeNotice);
        }
        if (session.current_slide) {
          setCurrentGlobalIndex(session.current_slide.globalIndex || 0);
        }
        const helperInfo = session.helper_device_info || session.content?.helper_device_info || null;
        if (helperInfo) {
          setActiveHelperInfo(helperInfo);
        }
      } else {
        setGatePasswordError('Incorrect admin password. You cannot access presenter controls.');
      }
    } catch (err: any) {
      setGatePasswordError(err.message || 'Verification failed');
    } finally {
      setIsVerifyingGate(false);
    }
  };

  // Initialize session in Supabase & subscribe
  useEffect(() => {
    let isMounted = true;

    async function init() {
      // 1. Verify exclusive Main role ownership & admin password protection
      const existing = await getSession(sessionCode);
      const myDeviceId = getOrCreateDeviceId();

      if (existing) {
        const isAuthorized = isDeviceAuthorizedAdmin(sessionCode);

        // If session has admin password set and this device is NOT yet authorized:
        if (existing.content?.adminPassword && !isAuthorized) {
          if (isMounted) {
            setShowPasswordGate(true);
            setClaimedHostName(
              existing.device_info?.deviceName ||
              existing.content?.device_info?.deviceName ||
              'Main Presenter'
            );
          }
          return;
        }

        const existingMainSig = existing.main_signature || existing.content?.main_signature;
        if (existingMainSig && existingMainSig !== myDeviceId && !isAuthorized) {
          if (isMounted) {
            setIsUnauthorizedMain(true);
            setClaimedHostName(
              existing.device_info?.deviceName ||
              existing.content?.device_info?.deviceName ||
              'another device'
            );
          }
          return;
        }

        const helperInfo = existing.helper_device_info || existing.content?.helper_device_info || null;
        if (isMounted && helperInfo) {
          setActiveHelperInfo(helperInfo);
        }

        if (isMounted) {
          if (existing.content?.sections && existing.content.sections.length > 0) {
            setSections(existing.content.sections);
          }
          if (existing.content?.notes) {
            setNotes(existing.content.notes);
          }
          if (existing.content?.activeNotice) {
            setActiveNotice(existing.content.activeNotice);
          }
          if (existing.content?.helper_request && existing.content.helper_request.status === 'pending') {
            setPendingHelperRequest(existing.content.helper_request);
          }
          if (existing.device_info) {
            setDeviceInfo(existing.device_info);
          }
          if (existing.current_slide) {
            setCurrentGlobalIndex(existing.current_slide.globalIndex || 0);
          }
        }
        return;
      }

      let activeDev = initialDeviceInfo;
      if (!activeDev) {
        activeDev = await collectDeviceAuditInfo();
        if (isMounted) setDeviceInfo(activeDev);
      }
      const createdPw = initialAdminPassword || (typeof window !== 'undefined' ? sessionStorage.getItem(`zensync_create_pw_${sessionCode}`) : '') || '';
      const initial = await createSession(sessionCode, sections, activeDev, createdPw);
      if (isMounted && initial) {
        if (initial.content?.sections && initial.content.sections.length > 0) {
          setSections(initial.content.sections);
        }
        if (initial.content?.notes) {
          setNotes(initial.content.notes);
        }
        if (initial.content?.activeNotice) {
          setActiveNotice(initial.content.activeNotice);
        }
        if (initial.device_info && !activeDev) {
          setDeviceInfo(initial.device_info);
        }
        if (initial.current_slide) {
          setCurrentGlobalIndex(initial.current_slide.globalIndex || 0);
        }
        const helperInfo = initial.helper_device_info || initial.content?.helper_device_info || null;
        if (helperInfo) {
          setActiveHelperInfo(helperInfo);
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
        // Refresh helper info
        getSession(sessionCode).then((s) => {
          if (isMounted && s) {
            setActiveHelperInfo(s.helper_device_info || s.content?.helper_device_info || null);
          }
        });
      },
      onNotesChange: (updatedNotes) => {
        setNotes(updatedNotes);
      },
      onNoticeReceived: (notice) => {
        setActiveNotice(notice);
      },
      onHelperRequest: (req) => {
        if (req && req.status === 'pending') {
          setPendingHelperRequest(req);
        } else if (req && (req.status === 'approved' || req.status === 'rejected')) {
          setPendingHelperRequest(null);
        }
      },
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onSessionDeleted: () => {
        setSessionEnded(true);
      },
    });

    // Helper heartbeat check every 5s
    const helperCheckInterval = setInterval(async () => {
      try {
        const s = await getSession(sessionCode);
        if (isMounted && s) {
          setActiveHelperInfo(s.helper_device_info || s.content?.helper_device_info || null);
          if (s.content?.helper_request && s.content.helper_request.status === 'pending') {
            setPendingHelperRequest(s.content.helper_request);
          } else if (s.content?.helper_request && s.content.helper_request.status !== 'pending') {
            setPendingHelperRequest(null);
          }
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(helperCheckInterval);
    };
  }, [sessionCode]);

  // Derived flat slide info
  const { currentSlide, activeFlatSlide, totalSlides } = resolveSlideState(sections, {
    globalIndex: currentGlobalIndex,
  });

  const handleAcceptHelper = async () => {
    if (!pendingHelperRequest) return;
    try {
      await respondHelperRequest(
        sessionCode,
        pendingHelperRequest.deviceId,
        'approved',
        pendingHelperRequest.helperInfo
      );
      if (pendingHelperRequest.helperInfo) {
        setActiveHelperInfo(pendingHelperRequest.helperInfo);
      }
      setPendingHelperRequest(null);
    } catch (err: any) {
      alert(`Failed to accept helper: ${err?.message || 'Error'}`);
    }
  };

  const handleDeclineHelper = async () => {
    if (!pendingHelperRequest) return;
    try {
      await respondHelperRequest(
        sessionCode,
        pendingHelperRequest.deviceId,
        'rejected',
        pendingHelperRequest.helperInfo
      );
      setPendingHelperRequest(null);
    } catch (err: any) {
      console.warn('Decline error:', err);
      setPendingHelperRequest(null);
    }
  };

  // Slide navigation
  const handleGoToSlide = async (globalIndex: number) => {
    const nextState = resolveSlideState(sections, { globalIndex });
    try {
      await updateSessionSlide(sessionCode, nextState.currentSlide);
      setCurrentGlobalIndex(nextState.currentSlide.globalIndex);
    } catch (err: any) {
      console.error('Failed to change slide:', err);
      alert(`Slide change rejected: ${err.message || 'Unauthorized or expired session.'}`);
    }
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
  const handleAddSection = async () => {
    const newSection: SectionItem = {
      id: `sec-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      slides: [],
    };
    const updated = [...sections, newSection];
    try {
      await updateSessionContent(sessionCode, updated);
      setSections(updated);
      // Immediately trigger rename for smooth UX
      setEditingSectionId(newSection.id);
      setEditingTitle(newSection.title);
    } catch (err: any) {
      console.error('Failed to add section:', err);
      alert(`Failed to add section: ${err.message || 'Unauthorized'}`);
    }
  };

  const handleRenameSection = async (id: string) => {
    if (!editingTitle.trim()) return;
    const updated = sections.map((sec) =>
      sec.id === id ? { ...sec, title: editingTitle.trim() } : sec
    );
    try {
      await updateSessionContent(sessionCode, updated);
      setSections(updated);
      setEditingSectionId(null);
    } catch (err: any) {
      console.error('Failed to rename section:', err);
      alert(`Failed to rename section: ${err.message || 'Unauthorized'}`);
    }
  };

  const handleDeleteSection = async (id: string) => {
    if (sections.length <= 1) {
      if (!confirm('This is the only section. Are you sure you want to delete it?')) return;
    }
    const secToDelete = sections.find((s) => s.id === id);
    if (secToDelete) {
      for (const sl of secToDelete.slides) {
        if (sl.url) {
          try {
            await deleteSlideImage(sessionCode, sl.url);
          } catch (e) {
            console.warn('Storage image deletion warning:', e);
          }
        }
      }
    }

    const updated = sections.filter((sec) => sec.id !== id);
    try {
      await updateSessionContent(sessionCode, updated);
      setSections(updated);
      // Reset index safely if needed
      if (currentSlide.sectionId === id) {
        handleGoToSlide(0);
      }
    } catch (err: any) {
      console.error('Failed to delete section:', err);
      alert(`Failed to delete section: ${err.message || 'Unauthorized'}`);
    }
  };

  const handleMoveSection = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    try {
      await updateSessionContent(sessionCode, updated);
      setSections(updated);
    } catch (err: any) {
      console.error('Failed to reorder sections:', err);
      alert(`Failed to reorder sections: ${err.message || 'Unauthorized'}`);
    }
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
        const rawFile = files[i];
        // Client-side downscaling for faster upload, sync, and crisp presentation display
        const optimizedFile = await optimizeSlideImageForUpload(rawFile);
        const url = await uploadSlideImage(sessionCode, optimizedFile);
        newSlides.push({
          id: `slide-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          name: rawFile.name.replace(/\.[^/.]+$/, ''),
          url,
          createdAt: Date.now() + i,
          uploadedBy: deviceInfo,
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

      await updateSessionContent(sessionCode, updated);
      setSections(updated);
    } catch (err: any) {
      console.error('Error uploading slides:', err);
      alert(`Failed to upload slides: ${err.message || 'Please check session authorization.'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteSlide = async (sectionId: string, slideId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetSlide = sections.find((s) => s.id === sectionId)?.slides.find((sl) => sl.id === slideId);
    if (targetSlide?.url) {
      try {
        await deleteSlideImage(sessionCode, targetSlide.url);
      } catch (err) {
        console.warn('Storage slide delete warning:', err);
      }
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

    try {
      await updateSessionContent(sessionCode, updated);
      setSections(updated);

      // Re-clamp current slide index if needed
      const flat = flattenSections(updated);
      if (currentGlobalIndex >= flat.length) {
        handleGoToSlide(Math.max(0, flat.length - 1));
      }
    } catch (err: any) {
      console.error('Failed to delete slide:', err);
      alert(`Failed to delete slide: ${err.message || 'Unauthorized'}`);
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

  const handleBulkDelete = async (sectionId: string) => {
    const toDelete = selectedSlideIds[sectionId] || [];
    if (toDelete.length === 0) return;

    if (!confirm(`Delete ${toDelete.length} selected slide(s)?`)) return;

    const targetSec = sections.find((s) => s.id === sectionId);
    if (targetSec) {
      for (const id of toDelete) {
        const sl = targetSec.slides.find((s) => s.id === id);
        if (sl?.url) {
          try {
            await deleteSlideImage(sessionCode, sl.url);
          } catch (e) {
            console.warn('Storage image deletion warning:', e);
          }
        }
      }
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

    try {
      await updateSessionContent(sessionCode, updated);
      setSections(updated);
      setSelectedSlideIds({ ...selectedSlideIds, [sectionId]: [] });
      setBulkModeSectionId(null);

      const flat = flattenSections(updated);
      if (currentGlobalIndex >= flat.length) {
        handleGoToSlide(Math.max(0, flat.length - 1));
      }
    } catch (err: any) {
      console.error('Failed to bulk delete slides:', err);
      alert(`Failed to bulk delete slides: ${err.message || 'Unauthorized'}`);
    }
  };

  const handleEndAndDeleteSession = async () => {
    if (
      confirm(
        'Are you sure you want to end and permanently delete this presentation? This will remove all slides, sections, and uploaded images from the Supabase database and disconnect all followers.'
      )
    ) {
      try {
        await deleteSession(sessionCode);
        onExit();
      } catch (err: any) {
        console.error('Failed to delete presentation session:', err);
        alert(`Failed to delete presentation: ${err.message || 'Unauthorized'}`);
      }
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (showPasswordGate) {
    return (
      <div className="fullscreen-container" style={{ backgroundColor: 'var(--bg-secondary)', flexDirection: 'column', padding: '1.25rem' }}>
        <div className="join-card" style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <Lock size={28} />
          </div>
          <h3 className="join-title" style={{ marginBottom: '0.5rem', fontSize: '1.35rem' }}>
            Admin Password Required
          </h3>
          <p className="join-subtitle" style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Presentation session <strong>#{sessionCode}</strong> is protected. Enter the password set by the creator ({claimedHostName || 'Session Admin'}) to unlock controls.
          </p>

          <form onSubmit={handleUnlockGateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label htmlFor="gate-password-input" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Session Admin Password:
              </label>
              <input
                id="gate-password-input"
                type="password"
                value={gatePasswordInput}
                onChange={(e) => {
                  setGatePasswordInput(e.target.value);
                  setGatePasswordError('');
                }}
                placeholder="Enter password"
                className="input-field"
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: gatePasswordError ? '1.5px solid var(--danger)' : '1.5px solid var(--border-color)',
                  fontSize: '1rem',
                }}
                autoFocus
                required
              />
            </div>

            {gatePasswordError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                {gatePasswordError}
              </p>
            )}

            <button
              type="submit"
              disabled={isVerifyingGate || !gatePasswordInput.trim()}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: '1.5px solid #0369a1',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                fontWeight: 700,
                cursor: (isVerifyingGate || !gatePasswordInput.trim()) ? 'not-allowed' : 'pointer',
              }}
              id="btn-gate-unlock"
            >
              {isVerifyingGate ? 'Verifying...' : 'Unlock Presenter Controls'}
            </button>

            <button
              type="button"
              onClick={onExit}
              className="btn-outline"
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.88rem' }}
            >
              Cancel &amp; Return Home
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isUnauthorizedMain) {
    return (
      <div className="fullscreen-container" style={{ backgroundColor: 'var(--bg-secondary)', flexDirection: 'column', padding: '1.25rem' }}>
        <div className="join-card" style={{ textAlign: 'center', maxWidth: '440px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <ShieldAlert size={28} />
          </div>
          <h3 className="join-title" style={{ marginBottom: '0.5rem', fontSize: '1.35rem' }}>
            Access Denied: Session Claimed
          </h3>
          <p className="join-subtitle" style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
            This presentation session (<strong>{sessionCode}</strong>) is locked to the original presenter device ({claimedHostName || 'Host Presenter'}).
            <br /><br />
            Only <strong>1 Main presenter</strong> is allowed per presentation session.
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
          <h3 className="join-title" style={{ marginBottom: '0.5rem' }}>Session Ended</h3>
          <p className="join-subtitle" style={{ marginBottom: '1.5rem' }}>
            This session was terminated and deleted by the administrator. All associated files have been cleared.
          </p>
          <button onClick={onExit} className="btn-primary" style={{ width: '100%', padding: '0.85rem', backgroundColor: '#0284c7', color: '#ffffff', border: '1.5px solid #0369a1', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)' }}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/png,image/jpeg,image/webp,image/jpg"
        style={{ display: 'none' }}
      />

      {/* Top Navbar */}
      <header className="app-navbar">
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

          <div className="app-brand" onClick={onExit} title="Return to Home">
            <span className="app-brand-title">ZEN SYNC</span>
          </div>

          <div className="code-badge" title="Share this 4-digit code with Sub & Helper devices">
            <span className="code-label">CODE:</span>
            <span>{sessionCode}</span>
            <button
              onClick={handleCopyCode}
              className="btn-icon"
              style={{ width: '22px', height: '22px', border: 'none', background: 'transparent', padding: 0 }}
              title="Copy Code"
            >
              {copied ? <Check size={14} color="var(--primary)" /> : <Copy size={14} color="var(--primary)" />}
            </button>
          </div>
        </div>

        {/* Mode Switcher: Slides vs Notepad & Notices */}
        <div className="main-view-switcher">
          <button
            type="button"
            onClick={() => setActiveTab('slides')}
            className={`main-view-tab-btn ${activeTab === 'slides' ? 'active' : ''}`}
            title="Slides presentation stage"
          >
            <span>🖼️ Slides ({totalSlides})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`main-view-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            title="Service notepad and instant notice broadcast"
          >
            <span>📝 Notes &amp; Notice</span>
            {activeNotice && <span className="view-tab-badge-dot" title="Active Notice Broadcasted" />}
          </button>
        </div>

        <div className="navbar-actions">
          {/* Active Helper Badge with Kick/Release button */}
          {activeHelperInfo && (activeHelperInfo.deviceName || activeHelperInfo.deviceId) && (
            <div className="helper-active-badge" title={`Active Helper: ${activeHelperInfo.deviceName || 'Device'}`}>
              <Users size={13} />
              <span className="helper-badge-name">Helper: {activeHelperInfo.deviceName || 'Device'}</span>
              <button
                onClick={handleDisconnectHelper}
                className="btn-icon helper-kick-btn"
                title="Disconnect Helper from session"
                aria-label="Disconnect Helper"
              >
                <X size={11} />
              </button>
            </div>
          )}

          {/* Host Device Audit Badge */}
          {deviceInfo && (
            <button
              onClick={() => setShowAuditModal(true)}
              className="device-host-badge"
              title={`Host Device: ${deviceInfo.deviceName} (${deviceInfo.deviceModel}) - Click to view security audit`}
              id="btn-device-audit"
            >
              <Smartphone size={14} />
              <span className="device-host-name">{deviceInfo.deviceName}</span>
            </button>
          )}

          <div className={`status-pill ${status === 'connected' ? 'connected' : 'demo'}`}>
            <span className={`status-dot ${status === 'connected' ? 'green' : 'blue'}`} />
            <span className="status-text-full">{status === 'connected' ? 'LIVE (Host)' : 'Local Host'}</span>
          </div>

          <button
            onClick={handleEndAndDeleteSession}
            className="btn-danger-outline btn-delete-session-desktop"
            title="Permanently delete presentation & storage files from Supabase"
            id="btn-delete-session"
          >
            <Trash2 size={15} />
            <span>Delete</span>
          </button>

          <button onClick={onExit} className="btn-outline btn-exit" title="Exit Presentation" id="btn-main-exit">
            <Home size={15} />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Main View Area: Notes vs Presentation Stage */}
      {activeTab === 'notes' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <MainNotepad
            sessionCode={sessionCode}
            initialNotes={notes}
            activeNotice={activeNotice}
            presenterName={deviceInfo?.deviceName || 'Main Presenter'}
          />
        </div>
      ) : (
        <>
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
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slide.name}</span>
                              {slide.uploadedBy?.deviceName && (
                                <span
                                  style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '2px' }}
                                  title={`Uploaded by: ${slide.uploadedBy.deviceName} (${slide.uploadedBy.deviceModel})`}
                                >
                                  <Smartphone size={10} /> {slide.uploadedBy.deviceName}
                                </span>
                              )}
                            </div>
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

          {/* Sidebar Bottom Action - Always accessible Exit and Delete on Mobile */}
          <div className="sidebar-footer">
            <button
              onClick={handleEndAndDeleteSession}
              className="btn-danger-outline btn-sidebar-delete"
              style={{ width: '100%', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', fontSize: '0.85rem' }}
              title="Delete session"
            >
              <Trash2 size={14} />
              <span>Delete Presentation</span>
            </button>
            <button
              onClick={onExit}
              className="btn-outline btn-sidebar-exit"
              style={{ width: '100%', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', fontSize: '0.85rem' }}
              title="Exit Presentation"
              id="btn-main-sidebar-exit"
            >
              <Home size={15} />
              <span>Exit to Home</span>
            </button>
          </div>
        </aside>

        {/* Center Presentation Stage */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
      </>
      )}

      {/* Host Device Audit Modal */}
      {showAuditModal && deviceInfo && (
        <div className="join-modal-overlay" onClick={() => setShowAuditModal(false)}>
          <div className="join-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} color="var(--primary)" />
                <h3 className="join-title" style={{ fontSize: '1.2rem', margin: 0 }}>
                  Presenter Device Audit
                </h3>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="btn-icon" style={{ width: '28px', height: '28px' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', textAlign: 'left' }}>
              <div className="audit-detail-item">
                <span className="audit-label">Phone / Device Name:</span>
                <span className="audit-value highlight">{deviceInfo.deviceName}</span>
              </div>
              <div className="audit-detail-item">
                <span className="audit-label">Hardware Model:</span>
                <span className="audit-value">{deviceInfo.deviceModel}</span>
              </div>
              <div className="audit-detail-item">
                <span className="audit-label">OS Platform:</span>
                <span className="audit-value">{deviceInfo.platform}</span>
              </div>
              {deviceInfo.ip && (
                <div className="audit-detail-item">
                  <span className="audit-label">IP Address:</span>
                  <span className="audit-value monospace">{deviceInfo.ip}</span>
                </div>
              )}
              <div className="audit-detail-item">
                <span className="audit-label">Device Fingerprint:</span>
                <span className="audit-value monospace">{deviceInfo.deviceId}</span>
              </div>
              <div className="audit-detail-item">
                <span className="audit-label">Session Started:</span>
                <span className="audit-value">{new Date(deviceInfo.timestamp).toLocaleTimeString()}</span>
              </div>

              {/* Active Helper Slot Status */}
              <div
                style={{
                  marginTop: '0.25rem',
                  padding: '0.65rem 0.75rem',
                  backgroundColor: activeHelperInfo ? '#f0fdf4' : 'var(--bg-tertiary)',
                  border: `1px solid ${activeHelperInfo ? '#bbf7d0' : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-light)' }}>
                    Helper Controller (Max 1):
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: activeHelperInfo ? '#166534' : 'var(--text-muted)' }}>
                    {activeHelperInfo ? `Active: ${activeHelperInfo.deviceName} (${activeHelperInfo.deviceModel})` : 'No helper connected (1 slot open)'}
                  </span>
                </div>
                {activeHelperInfo && (
                  <button
                    onClick={handleDisconnectHelper}
                    className="btn-danger-outline"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem' }}
                    title="Disconnect this helper to free up the slot"
                  >
                    Disconnect
                  </button>
                )}
              </div>

              <div style={{ marginTop: '0.4rem', padding: '0.65rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#166534', lineHeight: 1.4 }}>
                ✓ All slides and photos uploaded during this session are recorded with this device signature for accountability.
              </div>
            </div>

            <button
              onClick={() => setShowAuditModal(false)}
              className="btn-primary"
              style={{ width: '100%', marginTop: '1.25rem' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Helper Join Request Modal Prompt */}
      {pendingHelperRequest && pendingHelperRequest.status === 'pending' && (
        <div className="join-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="join-card" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                border: '1.5px solid rgba(2, 132, 199, 0.25)',
              }}
            >
              <Users size={28} />
            </div>

            <h3 className="join-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Helper Access Request
            </h3>

            <p className="join-subtitle" style={{ marginBottom: '1.25rem', lineHeight: 1.5 }}>
              A device is requesting to join as <strong>Helper Controller</strong>:
              <br /><br />
              <strong>{pendingHelperRequest.helperInfo?.deviceName || 'Remote Device'}</strong>
              <br />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-light)' }}>
                {pendingHelperRequest.helperInfo?.deviceModel || 'Mobile'} ({pendingHelperRequest.helperInfo?.platform || 'Web'})
              </span>
              <br /><br />
              Accepting will grant this device synchronized slide control. Only 1 Helper is permitted.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleDeclineHelper}
                className="btn-danger-outline"
                style={{ flex: 1, padding: '0.85rem', justifyContent: 'center' }}
              >
                <X size={16} />
                <span>Decline</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptHelper}
                className="btn-primary"
                style={{
                  flex: 1.2,
                  padding: '0.85rem',
                  justifyContent: 'center',
                  backgroundColor: '#16a34a',
                  borderColor: '#15803d',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)',
                }}
              >
                <Check size={16} />
                <span>Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
