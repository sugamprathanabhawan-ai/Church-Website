import React, { useState, useEffect, useRef } from 'react';
import {
  Trash2,
  Edit2,
  Upload,
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
  Presentation,
  GripVertical,
  MessageSquare,
  ChevronDown,
  Bell,
} from 'lucide-react';
import type {
  SectionItem,
  SlideItem,
  ConnectionStatus,
  DeviceAuditInfo,
  NoteItem,
  NoticeItem,
  DirectNotification,
  HelperJoinRequest,
  RejoinRequest,
  ChatParticipant,
} from '../types';
import { ImageViewer } from './ImageViewer';
import { MainNotepad } from './MainNotepad';
import { NoticePopup } from './NoticePopup';
import { NoticeBroadcaster } from './NoticeBroadcaster';
import {
  flattenSections,
  resolveSlideState,
  normalizeToSingleSection,
  optimizeSlideImageForUpload,
} from '../lib/presentationUtils';
import {
  createSession,
  getSession,
  forceReleaseHelper,
  respondHelperRequest,
  respondRejoinRequest,
  sendDirectNotification,
  updateSessionSlide,
  updateSessionContent,
  uploadSlideImage,
  subscribeToSession,
  deleteSlideImage,
  deleteSession,
  isDeviceAuthorizedAdmin,
  authorizeAdminForSession,
  verifySessionAdminPassword,
  claimAdminRole,
  releaseAdminRole,
  sendAdminHeartbeat,
  clearAdminAuth,
  broadcastParticipantPresence,
  kickMemberFromSession,
} from '../lib/supabaseClient';
import { collectDeviceAuditInfo, getOrCreateDeviceId } from '../lib/deviceUtils';

interface MainModeProps {
  sessionCode: string;
  initialDeviceInfo?: DeviceAuditInfo;
  initialAdminPassword?: string;
  onExit: () => void;
}

export const MainMode: React.FC<MainModeProps> = ({ sessionCode, initialDeviceInfo, initialAdminPassword, onExit }) => {
  const [sections, setSections] = useState<SectionItem[]>(() => normalizeToSingleSection());
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
  const [pendingRejoinRequests, setPendingRejoinRequests] = useState<RejoinRequest[]>([]);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [membersDropdownOpen, setMembersDropdownOpen] = useState(false);
  const [songsDropdownOpen, setSongsDropdownOpen] = useState(true);

  // In-session admin password challenge for unauthorized devices accessing Main URL
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [gatePasswordInput, setGatePasswordInput] = useState('');
  const [gatePasswordError, setGatePasswordError] = useState('');
  const [isVerifyingGate, setIsVerifyingGate] = useState(false);

  // Direct personal notification HUD state (replaces heavy chat modal)
  const [directNotification, setDirectNotification] = useState<DirectNotification | null>(null);

  // Drag-and-drop & reordering state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Bulk selection mode for slides
  const [selectedSlideIds, setSelectedSlideIds] = useState<string[]>([]);
  const [isBulkMode, setIsBulkMode] = useState(false);

  // Exit confirmation modal state
  const [showExitModal, setShowExitModal] = useState(false);
  // Track kicked devices to prevent re-addition from in-flight presences
  const [kickedDeviceIds, setKickedDeviceIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDisconnectHelper = async () => {
    try {
      await forceReleaseHelper(sessionCode, activeHelperInfo?.deviceId);
      setActiveHelperInfo(null);
    } catch (e: any) {
      console.warn('Failed to release helper:', e);
      alert(`Could not disconnect helper: ${e.message || 'Unauthorized'}`);
    }
  };

  const handleRemoveMember = async (member: { id: string; name: string; isHelper: boolean }) => {
    if (!window.confirm(`Are you sure you want to remove "${member.name}" from this session?`)) return;
    try {
      setKickedDeviceIds((prev) => new Set(prev).add(member.id));
      setParticipants((prev) => (prev || []).filter((p) => p.deviceId !== member.id));

      if (member.isHelper) {
        await forceReleaseHelper(sessionCode, member.id);
        setActiveHelperInfo(null);
      }

      await kickMemberFromSession(sessionCode, member.id, member.name);
    } catch (e: any) {
      console.warn('Failed to remove member:', e);
    }
  };

  const handleSafeExit = async () => {
    try {
      await releaseAdminRole(sessionCode, getOrCreateDeviceId());
    } catch (e) {
      console.warn('Error releasing admin role:', e);
    }
    clearAdminAuth(sessionCode);
    onExit();
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
        const myDeviceId = getOrCreateDeviceId();
        const claimRes = await claimAdminRole(sessionCode, myDeviceId, gatePasswordInput.trim());
        if (!claimRes.success) {
          setGatePasswordError(claimRes.error || 'Only 1 admin can be in the session at a time.');
          return;
        }

        authorizeAdminForSession(sessionCode, session.content?.creatorToken);
        setShowPasswordGate(false);
        setIsUnauthorizedMain(false);

        if (session.content?.sections) {
          setSections(normalizeToSingleSection(session.content.sections));
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

        // 1. Enforce rule: Only 1 admin can be active in the session at a time
        const now = Date.now();
        const isAnotherAdminOnline = Boolean(
          existing.content?.admin_is_online &&
          existing.content?.active_admin_signature &&
          existing.content.active_admin_signature !== myDeviceId &&
          now - (existing.content?.admin_heartbeat || 0) < 30000
        );

        if (isAnotherAdminOnline) {
          if (isMounted) {
            setIsUnauthorizedMain(true);
            setClaimedHostName(
              existing.content?.active_admin_device_name ||
              existing.device_info?.deviceName ||
              'Another Admin Presenter'
            );
          }
          return;
        }

        // 2. If session has admin password set and this device is NOT yet authorized:
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

        // Claim admin role in Supabase
        await claimAdminRole(sessionCode, myDeviceId, initialAdminPassword);

        const helperInfo = existing.helper_device_info || existing.content?.helper_device_info || null;
        if (isMounted && helperInfo) {
          setActiveHelperInfo(helperInfo);
        }

        if (isMounted) {
          if (existing.content?.sections) {
            setSections(normalizeToSingleSection(existing.content.sections));
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
          if (existing.content?.rejoin_requests) {
            const pendingRejoins = existing.content.rejoin_requests.filter((r: any) => r.status === 'pending');
            setPendingRejoinRequests(pendingRejoins);
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
        if (initial.content?.sections) {
          setSections(normalizeToSingleSection(initial.content.sections));
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
        setCurrentGlobalIndex((prev) => (prev !== newSlide.globalIndex ? newSlide.globalIndex : prev));
      },
      onContentChange: (newSections) => {
        setSections(normalizeToSingleSection(newSections));
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
      onDirectNotification: (notif) => {
        if (notif.recipientRole === 'main' || notif.recipientRole === 'all') {
          setDirectNotification(notif);
        }
      },
      onHelperRequest: (req) => {
        if (req && req.status === 'pending') {
          setPendingHelperRequest(req);
        } else if (req && (req.status === 'approved' || req.status === 'rejected')) {
          setPendingHelperRequest(null);
        }
      },
      onRejoinRequest: (req) => {
        if (req && req.status === 'pending') {
          setPendingRejoinRequests((prev) => [...prev.filter((r) => r.deviceId !== req.deviceId), req]);
        }
      },
      onRejoinDecision: (dec) => {
        setPendingRejoinRequests((prev) => prev.filter((r) => r.deviceId !== dec.deviceId));
      },
      onParticipantPresence: (part) => {
        setParticipants((prev) => {
          const filtered = prev.filter((p) => p.deviceId !== part.deviceId);
          return [...filtered, part];
        });
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
          if (s.content?.rejoin_requests) {
            const pendingRejoins = s.content.rejoin_requests.filter((r: any) => r.status === 'pending');
            setPendingRejoinRequests(pendingRejoins);
          }
        }
      } catch {
        // ignore
      }
    }, 5000);

    // Keep admin heartbeat fresh every 10s so the 1-admin slot stays active
    const myDeviceId = getOrCreateDeviceId();
    const adminHeartbeatInterval = setInterval(() => {
      sendAdminHeartbeat(sessionCode, myDeviceId);
    }, 10000);

    // Broadcast admin presence so team can see Admin in sliding combo box
    const adminPresence: ChatParticipant = {
      deviceId: myDeviceId,
      name: deviceInfo?.deviceName || 'Admin Presenter',
      role: 'main',
      lastSeen: Date.now(),
    };
    broadcastParticipantPresence(sessionCode, adminPresence).catch(() => {});

    const presenceInterval = setInterval(() => {
      broadcastParticipantPresence(sessionCode, {
        deviceId: myDeviceId,
        name: deviceInfo?.deviceName || 'Admin Presenter',
        role: 'main',
        lastSeen: Date.now(),
      }).catch(() => {});
    }, 15000);

    const handleBeforeUnload = () => {
      releaseAdminRole(sessionCode, myDeviceId);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(helperCheckInterval);
      clearInterval(adminHeartbeatInterval);
      clearInterval(presenceInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      releaseAdminRole(sessionCode, myDeviceId);
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

  const handleAcceptRejoin = async (req: RejoinRequest) => {
    try {
      await respondRejoinRequest(sessionCode, req.deviceId, 'approved', req.role, req.helperInfo);
      setPendingRejoinRequests((prev) => prev.filter((r) => r.deviceId !== req.deviceId));
      setKickedDeviceIds((prev) => {
        const next = new Set(prev);
        next.delete(req.deviceId);
        return next;
      });
      if (req.role === 'helper' && req.helperInfo) {
        setActiveHelperInfo(req.helperInfo);
      }
    } catch (err: any) {
      alert(`Failed to accept rejoin request: ${err?.message || 'Error'}`);
    }
  };

  const handleDeclineRejoin = async (req: RejoinRequest) => {
    try {
      await respondRejoinRequest(sessionCode, req.deviceId, 'rejected', req.role, req.helperInfo);
      setPendingRejoinRequests((prev) => prev.filter((r) => r.deviceId !== req.deviceId));
    } catch (err: any) {
      console.warn('Decline rejoin error:', err);
    }
  };

  const handleSendDirectAlertToHelper = async () => {
    const defaultText = 'Next slide ready';
    const text = window.prompt('Send direct alert notification to Helper:', defaultText);
    if (!text || !text.trim()) return;

    try {
      const notif: DirectNotification = {
        id: `dir-${Date.now()}`,
        senderName: deviceInfo?.deviceName || 'Admin',
        senderRole: 'main',
        recipientRole: 'helper',
        text: text.trim(),
        timestamp: Date.now(),
      };
      await sendDirectNotification(sessionCode, notif);
      alert('Direct notification sent to Helper!');
    } catch (e: any) {
      alert(`Could not send alert: ${e?.message || 'Error'}`);
    }
  };

  // Slide navigation (Optimistic instant update for zero-latency, zero-flicker UI)
  const handleGoToSlide = async (globalIndex: number) => {
    const nextState = resolveSlideState(sections, { globalIndex });
    const prevIndex = currentGlobalIndex;
    // 1. Instant local update for 0ms visual response
    setCurrentGlobalIndex(nextState.currentSlide.globalIndex);
    try {
      // 2. Persist & sync live in the background
      await updateSessionSlide(sessionCode, nextState.currentSlide);
    } catch (err: any) {
      console.error('Failed to change slide:', err);
      // Revert if rejected
      setCurrentGlobalIndex(prevIndex);
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

  // Single-section Slide Management & Drag-and-Drop Reordering
  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

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

      const currentSlides = sections[0]?.slides || [];
      const updatedSlides = [...currentSlides, ...newSlides];
      const updated: SectionItem[] = [{
        id: sections[0]?.id || 'main-presentation',
        title: 'Presentation Slides',
        slides: updatedSlides,
      }];

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

  const handleDeleteSlide = async (slideId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const currentSlides = sections[0]?.slides || [];
    const targetSlide = currentSlides.find((sl) => sl.id === slideId);
    if (targetSlide?.url) {
      try {
        await deleteSlideImage(sessionCode, targetSlide.url);
      } catch (err) {
        console.warn('Storage slide delete warning:', err);
      }
    }

    const updatedSlides = currentSlides.filter((s) => s.id !== slideId);
    const updated: SectionItem[] = [{
      id: sections[0]?.id || 'main-presentation',
      title: 'Presentation Slides',
      slides: updatedSlides,
    }];

    try {
      await updateSessionContent(sessionCode, updated);
      setSections(updated);

      // Re-clamp current slide index if needed
      if (currentGlobalIndex >= updatedSlides.length) {
        handleGoToSlide(Math.max(0, updatedSlides.length - 1));
      }
    } catch (err: any) {
      console.error('Failed to delete slide:', err);
      alert(`Failed to delete slide: ${err.message || 'Unauthorized'}`);
    }
  };

  // Core slide reordering function shared by desktop mouse and mobile touch drag-and-drop
  const executeReorder = async (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return;
    const currentSlides = sections[0]?.slides || [];
    if (sourceIndex < 0 || sourceIndex >= currentSlides.length) return;
    if (targetIndex < 0 || targetIndex >= currentSlides.length) return;

    const updatedSlides = [...currentSlides];
    const [moved] = updatedSlides.splice(sourceIndex, 1);
    updatedSlides.splice(targetIndex, 0, moved);

    const activeSlideId = currentSlides[currentGlobalIndex]?.id;
    const updated: SectionItem[] = [{
      id: sections[0]?.id || 'main-presentation',
      title: 'Presentation Slides',
      slides: updatedSlides,
    }];

    setSections(updated);

    // Keep active slide pointer consistent
    if (activeSlideId) {
      const newIdx = updatedSlides.findIndex((s) => s.id === activeSlideId);
      if (newIdx !== -1) {
        setCurrentGlobalIndex(newIdx);
        try {
          await updateSessionSlide(sessionCode, {
            sectionId: updated[0].id,
            slideIndex: newIdx,
            globalIndex: newIdx,
          });
        } catch {}
      }
    }

    try {
      await updateSessionContent(sessionCode, updated);
    } catch (err: any) {
      console.error('Failed to save reordered slides:', err);
    }
  };

  // Desktop Mouse Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const source = draggedIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (source !== null && source !== targetIndex) {
      await executeReorder(source, targetIndex);
    }
  };

  // Mobile Touch Drag and Drop Handlers (Enables smooth, native touch reordering on phones)
  const touchDragRef = useRef<{
    startIndex: number;
    currentTargetIndex: number | null;
  } | null>(null);

  const handleTouchDragStart = (e: React.TouchEvent, index: number) => {
    e.stopPropagation();
    touchDragRef.current = {
      startIndex: index,
      currentTargetIndex: index,
    };
    setDraggedIndex(index);
    setDragOverIndex(index);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(25); } catch {}
    }

    const onGlobalTouchMove = (moveEv: TouchEvent) => {
      const touch = moveEv.touches[0];
      if (!touch) return;
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const slideRow = el?.closest('[data-slide-index]');
      if (slideRow && touchDragRef.current) {
        const targetIdx = Number(slideRow.getAttribute('data-slide-index'));
        if (!isNaN(targetIdx) && targetIdx !== touchDragRef.current.currentTargetIndex) {
          touchDragRef.current.currentTargetIndex = targetIdx;
          setDragOverIndex(targetIdx);
        }
      }
    };

    const onGlobalTouchEnd = async () => {
      window.removeEventListener('touchmove', onGlobalTouchMove);
      window.removeEventListener('touchend', onGlobalTouchEnd);
      window.removeEventListener('touchcancel', onGlobalTouchEnd);

      if (!touchDragRef.current) return;
      const { startIndex, currentTargetIndex } = touchDragRef.current;
      touchDragRef.current = null;
      setDraggedIndex(null);
      setDragOverIndex(null);

      if (currentTargetIndex !== null && startIndex !== currentTargetIndex) {
        await executeReorder(startIndex, currentTargetIndex);
      }
    };

    window.addEventListener('touchmove', onGlobalTouchMove, { passive: true });
    window.addEventListener('touchend', onGlobalTouchEnd);
    window.addEventListener('touchcancel', onGlobalTouchEnd);
  };

  // Bulk Delete
  const toggleSelectSlide = (slideId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSlideIds((prev) =>
      prev.includes(slideId) ? prev.filter((id) => id !== slideId) : [...prev, slideId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedSlideIds.length === 0) return;
    if (!confirm(`Delete ${selectedSlideIds.length} selected slide(s)?`)) return;

    const currentSlides = sections[0]?.slides || [];
    for (const id of selectedSlideIds) {
      const sl = currentSlides.find((s) => s.id === id);
      if (sl?.url) {
        try {
          await deleteSlideImage(sessionCode, sl.url);
        } catch (e) {
          console.warn('Storage image deletion warning:', e);
        }
      }
    }

    const remainingSlides = currentSlides.filter((s) => !selectedSlideIds.includes(s.id));
    const updated: SectionItem[] = [{
      id: sections[0]?.id || 'main-presentation',
      title: 'Presentation Slides',
      slides: remainingSlides,
    }];

    try {
      await updateSessionContent(sessionCode, updated);
      setSections(updated);
      setSelectedSlideIds([]);
      setIsBulkMode(false);

      if (currentGlobalIndex >= remainingSlides.length) {
        handleGoToSlide(Math.max(0, remainingSlides.length - 1));
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
        handleSafeExit();
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
              onClick={handleSafeExit}
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
            This presentation session (<strong>{sessionCode}</strong>) is currently controlled by {claimedHostName || 'another Admin'}.
            <br /><br />
            Only <strong>1 Admin</strong> is allowed in the presentation session at a time.
          </p>
          <button onClick={handleSafeExit} className="btn-primary" style={{ width: '100%', padding: '0.85rem', backgroundColor: '#0284c7', color: '#ffffff', border: '1.5px solid #0369a1', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)' }}>
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
          <button onClick={handleSafeExit} className="btn-primary" style={{ width: '100%', padding: '0.85rem', backgroundColor: '#0284c7', color: '#ffffff', border: '1.5px solid #0369a1', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)' }}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // Compile active members list (helpers + sub members)
  const allMembers: Array<{
    id: string;
    name: string;
    isHelper: boolean;
    role: string;
  }> = [];

  // Active helper if connected
  if (
    activeHelperInfo &&
    (activeHelperInfo.deviceName || activeHelperInfo.deviceId) &&
    !kickedDeviceIds.has(activeHelperInfo.deviceId || '')
  ) {
    allMembers.push({
      id: activeHelperInfo.deviceId || 'helper-active',
      name: activeHelperInfo.deviceName || 'Connected Helper',
      isHelper: true,
      role: 'helper',
    });
  }

  // Active participants discovered via realtime presence
  const now = Date.now();
  (participants || []).forEach((p) => {
    if (!p) return;
    if (p.role === 'main') return; // Don't show admin presenter self in members list
    if (kickedDeviceIds.has(p.deviceId)) return; // Ignore removed members
    if (p.lastSeen && now - p.lastSeen > 120000) return; // Ignore stale presences

    if (p.role === 'helper') {
      if (!allMembers.some((m) => m.isHelper || m.id === p.deviceId)) {
        allMembers.push({
          id: p.deviceId,
          name: p.name || 'Connected Helper',
          isHelper: true,
          role: 'helper',
        });
      }
    } else {
      // Sub or Musician member
      if (!allMembers.some((m) => m.id === p.deviceId)) {
        allMembers.push({
          id: p.deviceId,
          name: p.name || (p.role === 'musician' ? 'Musician' : 'Member'),
          isHelper: false,
          role: p.role || 'sub',
        });
      }
    }
  });

  return (
    <div
      className="presentation-root"
      style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/png,image/jpeg,image/webp,image/jpg"
        style={{ display: 'none' }}
      />

      {/* Top Navbar: Ultra-Minimalist Front View */}
      <header className="app-navbar">
        <div className="navbar-left">
          <div className="menu-btn-wrap">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className={`btn-icon ${sidebarOpen ? 'active' : ''}`}
              style={{ display: 'flex', flexShrink: 0 }}
              title="Toggle Sidebar Menu (3 Lines)"
              aria-label="Toggle Sidebar Menu"
              id="btn-sidebar-toggle"
            >
              <Menu size={20} />
            </button>
            {(Boolean(pendingHelperRequest && pendingHelperRequest.status === 'pending') || pendingRejoinRequests.length > 0) && (
              <span className="menu-notification-dot" title="Join or re-entry request waiting in menu" />
            )}
          </div>
        </div>

        {/* Center: Slide & Notes Switcher (Safely centered so user won't click Exit mistakenly) */}
        <div className="navbar-center">
          <div className="header-view-switcher" role="tablist">
            <button
              type="button"
              onClick={() => setActiveTab('slides')}
              className={`header-tab-btn ${activeTab === 'slides' ? 'active' : ''}`}
              title={`Slides Stage (${totalSlides})`}
              aria-label="Slides Stage"
            >
              <span>🖼️</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('notes')}
              className={`header-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
              title="Service & Choir Notes Editor"
              aria-label="Notes"
            >
              <span>📝</span>
            </button>
          </div>
        </div>

        {/* Extreme Right Action: Red Cross Exit Button */}
        <div className="navbar-actions">
          <button
            type="button"
            onClick={() => setShowExitModal(true)}
            className="btn-exit-danger"
            title="Exit Presentation"
            aria-label="Exit Presentation"
            id="btn-main-exit"
          >
            <X size={15} strokeWidth={2.5} color="#dc2626" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Mobile Backdrop for 3-Lines Drawer */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Left Sidebar / 3-Lines Drawer (Matches Image 2) */}
      <aside className={`presentation-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-content">
            {/* 1. COMPACT SESSION CODE (CODE: 8888) */}
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

            {/* 2. MEMBERS COMBO BOX (Compact Collapsible List of Active Joined Members) */}
            <div className="sidebar-drawer-card sidebar-members-combobox-card">
              <div
                className="sidebar-members-header"
                onClick={() => setMembersDropdownOpen((prev) => !prev)}
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  className="sidebar-members-title"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: '#1e293b',
                  }}
                >
                  <Users size={15} color="var(--primary)" />
                  <span>MEMBERS:</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    className="sidebar-badge-pill active"
                    style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                  >
                    {allMembers.length} {allMembers.length === 1 ? 'Member' : 'Members'}
                  </span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: membersDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      color: '#64748b',
                    }}
                  />
                </div>
              </div>

              {/* Expandable Combo Box List */}
              {membersDropdownOpen && (
                <div
                  className="sidebar-members-list"
                  style={{ marginTop: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
                >
                  {/* Pending Helper Request (if someone asks to join as Helper) */}
                  {pendingHelperRequest && pendingHelperRequest.status === 'pending' && (
                    <div
                      className="sidebar-member-row pending"
                      style={{
                        padding: '0.45rem 0.6rem',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: '#92400e',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {pendingHelperRequest.helperInfo?.deviceName || 'Remote Device'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#b45309' }}>Wants to join as Helper</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={handleAcceptHelper}
                          className="btn-helper-action btn-accept"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                          title="Accept Helper"
                        >
                          <Check size={12} />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDeclineHelper}
                          className="btn-helper-action btn-decline"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                          title="Decline Helper"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pending Rejoin Requests from Kicked Members */}
                  {pendingRejoinRequests.map((r) => (
                    <div
                      key={r.deviceId}
                      className="sidebar-member-row pending"
                      style={{
                        padding: '0.45rem 0.6rem',
                        backgroundColor: '#fff7ed',
                        border: '1px solid #fed7aa',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: '#9a3412',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {r.name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#c2410c' }}>
                          Kicked {r.role.toUpperCase()} requesting re-entry
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleAcceptRejoin(r)}
                          className="btn-helper-action btn-accept"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                          title="Accept and Re-admit"
                        >
                          <Check size={12} />
                          <span>Accept</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeclineRejoin(r)}
                          className="btn-helper-action btn-decline"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                          title="Decline"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Joined Members List */}
                  {allMembers.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                        maxHeight: '180px',
                        overflowY: 'auto',
                      }}
                    >
                      {allMembers.map((member, idx) => (
                        <div
                          key={member.id || idx}
                          className="sidebar-member-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0.6rem',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: member.isHelper ? '#f59e0b' : member.role === 'musician' ? '#8b5cf6' : '#10b981',
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: '#0f172a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={member.name}
                            >
                              {member.name}
                            </span>
                          </div>

                          {/* Member Actions: Role badge + Remove Member button for Admin */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                            {member.isHelper && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: '#b45309',
                                  backgroundColor: '#fef3c7',
                                  border: '1px solid #fde68a',
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: '9999px',
                                }}
                              >
                                helper
                              </span>
                            )}
                            {member.role === 'musician' && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: '#7c3aed',
                                  backgroundColor: '#f3e8ff',
                                  border: '1px solid #e9d5ff',
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: '9999px',
                                }}
                              >
                                musician
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              className="btn-member-remove"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '3px 4px',
                                color: '#ef4444',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '4px',
                                transition: 'background-color 0.15s ease',
                              }}
                              title={`Remove ${member.name} from session`}
                              aria-label={`Remove ${member.name}`}
                            >
                              <X size={13} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !pendingHelperRequest && pendingRejoinRequests.length === 0 && (
                      <div
                        style={{
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontSize: '0.76rem',
                          color: '#64748b',
                        }}
                      >
                        <div>No members joined yet</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                          Share code {sessionCode} to join
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>



            {/* 3. NOTICE BROADCASTER CARD (Instant Alert Announcement) */}
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
                senderName={claimedHostName || 'Session Admin'}
                activeNotice={activeNotice}
                onNoticeSent={(notice) => setActiveNotice(notice)}
              />
            </div>

            {/* 4. SONGS / SLIDES LIST (Collapsible with down arrow on left of +) */}
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
                  <Presentation size={15} color="#0284c7" />
                  <span>Songs ({sections[0]?.slides?.length || 0})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {isBulkMode && selectedSlideIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkDelete}
                      className="btn-danger-outline"
                      style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                    >
                      Delete ({selectedSlideIds.length})
                    </button>
                  )}
                  {(sections[0]?.slides?.length || 0) > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsBulkMode(!isBulkMode);
                        setSelectedSlideIds([]);
                      }}
                      className="btn-outline"
                      style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                    >
                      {isBulkMode ? 'Cancel' : 'Bulk'}
                    </button>
                  )}

                  {/* Down Arrow in left side of + to toggle viewable/unviewable */}
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
                    title={songsDropdownOpen ? "Collapse songs list" : "Expand songs list"}
                    aria-label="Toggle Songs List (Viewable / Unviewable)"
                    id="btn-toggle-songs-list"
                  >
                    <ChevronDown
                      size={15}
                      style={{
                        transform: songsDropdownOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerUpload}
                    disabled={isUploading}
                    className="btn-icon"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Add songs / images (+)"
                    id="btn-add-slides-top"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Numbered Songs List (Toggled Viewable / Unviewable by Down Arrow) */}
              {songsDropdownOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: (sections[0]?.slides?.length || 0) > 0 ? '0.4rem' : '0' }}>
                  {(sections[0]?.slides?.length || 0) === 0 ? null : (
                    sections[0].slides.map((slide, slideIdx) => {
                      const isCurrent = currentGlobalIndex === slideIdx;
                      const isSelected = selectedSlideIds.includes(slide.id);
                      const isDragging = draggedIndex === slideIdx;
                      const isDragOver = dragOverIndex === slideIdx;

                      return (
                        <div
                          key={slide.id}
                          data-slide-index={slideIdx}
                          draggable={!isBulkMode}
                          onDragStart={(e) => handleDragStart(e, slideIdx)}
                          onDragOver={(e) => handleDragOver(e, slideIdx)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleDrop(e, slideIdx)}
                          className={`slide-row ${isCurrent ? 'active' : ''}`}
                          style={{
                            opacity: isDragging ? 0.35 : 1,
                            borderTop: isDragOver && !isDragging ? '2.5px solid #0284c7' : undefined,
                            backgroundColor: isDragOver && !isDragging ? '#f0f9ff' : undefined,
                            cursor: isBulkMode ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '8px',
                            border: isCurrent ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                            transition: 'all 0.15s ease',
                          }}
                          onClick={() => {
                            if (isBulkMode) {
                              toggleSelectSlide(slide.id, { stopPropagation: () => {} } as any);
                            } else {
                              handleGoToSlide(slideIdx);
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                            {isBulkMode ? (
                              <button
                                type="button"
                                onClick={(e) => toggleSelectSlide(slide.id, e)}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: isSelected ? 'var(--primary)' : 'var(--text-light)' }}
                              >
                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                            ) : (
                              <div
                                className="slide-drag-handle"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  color: isDragging ? '#0284c7' : '#94a3b8',
                                  cursor: 'grab',
                                  touchAction: 'none',
                                  padding: '0.2rem 0.15rem',
                                  userSelect: 'none',
                                }}
                                onTouchStart={(e) => handleTouchDragStart(e, slideIdx)}
                                title="Drag to reorder slide (works on phone & desktop)"
                              >
                                <GripVertical size={14} style={{ cursor: 'grab', flexShrink: 0 }} />
                                <div className="slide-num-pill">{slideIdx + 1}</div>
                              </div>
                            )}

                            {/* Song Thumbnail Preview */}
                            {slide.url && (
                              <img
                                src={slide.url}
                                alt={`Slide ${slideIdx + 1}`}
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  objectFit: 'cover',
                                  borderRadius: '6px',
                                  border: isCurrent ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                                  flexShrink: 0,
                                }}
                                loading="lazy"
                              />
                            )}

                            {/* Blank middle area for cleaner UI (no image file names) */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isCurrent && (
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
                                  ● Live
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Delete Button (Arrow up & down removed for a clean, spacious look) */}
                          {!isBulkMode && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSlide(slide.id, e)}
                              className="btn-icon btn-delete-slide"
                              style={{ width: '26px', height: '26px', border: 'none', flexShrink: 0 }}
                              title="Delete Song"
                              aria-label={`Delete Song ${slideIdx + 1}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Footer Controls */}
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
          </div>
        </aside>

        {/* Main Layout Area: Stage / Notes */}
        <div className="presentation-layout">
          {/* Center Presentation Stage OR Notes View */}
        {activeTab === 'notes' ? (
          <div style={{ flex: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <MainNotepad
              sessionCode={sessionCode}
              initialNotes={notes}
              activeNotice={activeNotice}
              participants={participants}
              presenterName={deviceInfo?.deviceName || 'Main Presenter'}
            />
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ImageViewer
              activeSlide={activeFlatSlide}
              currentIndex={currentGlobalIndex}
              totalSlides={totalSlides}
              allSlides={flattenSections(sections)}
              onPrevious={handlePrevious}
              onNext={handleNext}
              canNavigate={true}
              onAddSlidePrompt={handleTriggerUpload}
            />
          </div>
        )}
      </div>

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

      {/* Member Re-entry Request Modal Prompt */}
      {pendingRejoinRequests.length > 0 && (
        <div className="join-modal-overlay" style={{ zIndex: 1210 }}>
          <div className="join-card" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(217, 119, 6, 0.12)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                border: '1.5px solid rgba(217, 119, 6, 0.25)',
              }}
            >
              <ShieldAlert size={28} />
            </div>

            <h3 className="join-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#0f172a' }}>
              Member Re-entry Request
            </h3>

            <p className="join-subtitle" style={{ marginBottom: '1.25rem', lineHeight: 1.5, color: '#475569' }}>
              <strong>{pendingRejoinRequests[0].name}</strong> was previously removed from this session and is requesting to rejoin as <strong>{pendingRejoinRequests[0].role === 'helper' ? 'Helper Controller' : 'Sub Member'}</strong>:
              <br /><br />
              Do you want to accept this member back into the presentation?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleDeclineRejoin(pendingRejoinRequests[0])}
                className="btn-danger-outline"
                style={{ flex: 1, padding: '0.85rem', justifyContent: 'center' }}
                id="btn-decline-rejoin-modal"
              >
                <X size={16} />
                <span>Decline</span>
              </button>

              <button
                type="button"
                onClick={() => handleAcceptRejoin(pendingRejoinRequests[0])}
                className="btn-primary"
                style={{
                  flex: 1.2,
                  padding: '0.85rem',
                  justifyContent: 'center',
                  backgroundColor: '#16a34a',
                  borderColor: '#15803d',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)',
                }}
                id="btn-accept-rejoin-modal"
              >
                <Check size={16} />
                <span>Accept &amp; Re-admit</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
            padding: '1.5rem',
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div
            className="modal-card exit-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '360px',
              width: '90%',
              margin: 'auto',
              padding: '1.5rem',
              textAlign: 'center',
              borderRadius: '20px',
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
              border: '1.5px solid rgba(255, 255, 255, 0.18)',
            }}
          >
            <div
              className="exit-icon-badge"
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.18)',
                border: '1.5px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                color: '#f87171',
              }}
            >
              <X size={26} strokeWidth={2.5} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
              Are you sure you want to exit?
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.35rem', lineHeight: 1.5 }}>
              You will leave the live presentation session.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="btn-outline"
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
                id="btn-cancel-exit"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  handleSafeExit();
                }}
                className="btn-danger"
                style={{
                  flex: 1,
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                }}
                id="btn-confirm-exit"
              >
                Yes, Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimalist Live Notice & Direct Alert HUD Notification */}
      <NoticePopup
        notice={activeNotice}
        directNotification={directNotification}
        onDismiss={() => setActiveNotice(null)}
        onDismissDirect={() => setDirectNotification(null)}
      />
    </div>
  );
};
