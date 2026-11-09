import React, { useEffect, useState, useRef } from 'react';
import { Bell, X, Check, MessageSquare } from 'lucide-react';
import type { NoticeItem, DirectNotification } from '../types';

interface NoticePopupProps {
  notice: NoticeItem | null;
  directNotification?: DirectNotification | null;
  onOpenNotes?: () => void;
  onDismiss?: () => void;
  onDismissDirect?: () => void;
}

export const NoticePopup: React.FC<NoticePopupProps> = ({
  notice,
  directNotification,
  onDismiss,
  onDismissDirect,
}) => {
  const [activeItem, setActiveItem] = useState<{
    type: 'group' | 'direct';
    id: string;
    text: string;
    sender: string;
    timestamp: number;
  } | null>(null);

  const lastNoticeIdRef = useRef<string | null>(null);
  const lastDirectIdRef = useRef<string | null>(null);
  const autoDismissTimerRef = useRef<any>(null);

  // Handle incoming Group Notices
  useEffect(() => {
    if (notice && notice.text?.trim()) {
      if (notice.id !== lastNoticeIdRef.current) {
        lastNoticeIdRef.current = notice.id;
        setActiveItem({
          type: 'group',
          id: notice.id,
          text: notice.text,
          sender: notice.senderName || 'Main Presenter',
          timestamp: notice.timestamp,
        });

        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([80, 40, 80]);
          }
        } catch {}
      }
    } else if (activeItem?.type === 'group') {
      setActiveItem(null);
    }
  }, [notice]);

  // Handle incoming Direct Personal Notifications
  useEffect(() => {
    if (directNotification && directNotification.text?.trim()) {
      if (directNotification.id !== lastDirectIdRef.current) {
        lastDirectIdRef.current = directNotification.id;
        setActiveItem({
          type: 'direct',
          id: directNotification.id,
          text: directNotification.text,
          sender: `${directNotification.senderName} (${directNotification.senderRole.toUpperCase()})`,
          timestamp: directNotification.timestamp,
        });

        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
          }
        } catch {}
      }
    }
  }, [directNotification]);

  // Keep notice on screen until the user acknowledges by pressing Okay (or close)
  useEffect(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }

    return () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
    };
  }, [activeItem]);

  if (!activeItem || !activeItem.text?.trim()) {
    return null;
  }

  const handleDismiss = () => {
    if (activeItem?.type === 'direct') {
      onDismissDirect?.();
    } else {
      onDismiss?.();
    }
    setActiveItem(null);
  };

  const isDirect = activeItem.type === 'direct';

  return (
    <div
      className={`notice-popup-overlay ${isDirect ? 'is-direct-alert' : 'is-group-notice'}`}
      role="alert"
      aria-live="polite"
    >
      <div
        className={`notice-popup-card ${isDirect ? 'direct-card' : ''}`}
        style={
          isDirect
            ? {
                borderColor: '#f59e0b',
                boxShadow: '0 12px 36px rgba(245, 158, 11, 0.35)',
              }
            : undefined
        }
      >
        <div className="notice-popup-header">
          <div className="notice-popup-tag">
            <span
              className="notice-popup-bell-icon"
              style={isDirect ? { backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' } : undefined}
            >
              {isDirect ? <MessageSquare size={16} /> : <Bell size={16} />}
            </span>
            <span
              className="notice-popup-title"
              style={isDirect ? { color: '#fbbf24' } : undefined}
            >
              {isDirect ? 'DIRECT ALERT' : 'LIVE NOTICE'}
            </span>
          </div>

          <button
            onClick={handleDismiss}
            className="btn-icon notice-popup-close-btn"
            title="Dismiss alert"
            aria-label="Dismiss alert"
          >
            <X size={15} />
          </button>
        </div>

        <div className="notice-popup-body">
          <p className="notice-popup-text">{activeItem.text}</p>
        </div>

        <div className="notice-popup-footer">
          <div className="notice-popup-meta">
            <span>By {activeItem.sender}</span>
            <span>•</span>
            <span>
              {new Date(activeItem.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <div className="notice-popup-actions">
            <button
              onClick={handleDismiss}
              className="notice-popup-btn-okay"
              style={isDirect ? { backgroundColor: '#f59e0b', color: '#000000' } : undefined}
              autoFocus
              title="Acknowledge alert"
            >
              <Check size={16} />
              <span>Okay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
