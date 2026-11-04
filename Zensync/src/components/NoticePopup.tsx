import React, { useEffect, useState, useRef } from 'react';
import { Bell, X, Check } from 'lucide-react';
import type { NoticeItem } from '../types';

interface NoticePopupProps {
  notice: NoticeItem | null;
  onOpenNotes?: () => void;
  onDismiss?: () => void;
}

export const NoticePopup: React.FC<NoticePopupProps> = ({ notice, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [currentNotice, setCurrentNotice] = useState<NoticeItem | null>(notice);
  const lastNoticeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (notice && notice.text?.trim()) {
      // Trigger strictly once when a new notice is received
      if (notice.id !== lastNoticeIdRef.current) {
        lastNoticeIdRef.current = notice.id;
        setCurrentNotice(notice);
        setVisible(true);
      }
    } else {
      setVisible(false);
    }
  }, [notice]);

  if (!visible || !currentNotice || !currentNotice.text?.trim()) {
    return null;
  }

  const handleOkay = () => {
    setVisible(false);
    setCurrentNotice(null);
    onDismiss?.();
  };

  return (
    <div className="notice-popup-overlay" role="alert" aria-live="polite">
      <div className="notice-popup-card">
        <div className="notice-popup-header">
          <div className="notice-popup-tag">
            <span className="notice-popup-bell-icon">
              <Bell size={16} />
            </span>
            <span className="notice-popup-title">LIVE NOTICE</span>
          </div>

          <button
            onClick={handleOkay}
            className="btn-icon notice-popup-close-btn"
            title="Dismiss notice"
            aria-label="Dismiss notice"
          >
            <X size={15} />
          </button>
        </div>

        <div className="notice-popup-body">
          <p className="notice-popup-text">{currentNotice.text}</p>
        </div>

        <div className="notice-popup-footer">
          <div className="notice-popup-meta">
            <span>By {currentNotice.senderName || 'Main Presenter'}</span>
            <span>•</span>
            <span>{new Date(currentNotice.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="notice-popup-actions">
            <button
              onClick={handleOkay}
              className="notice-popup-btn-okay"
              autoFocus
              title="Acknowledge and dismiss notice"
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
