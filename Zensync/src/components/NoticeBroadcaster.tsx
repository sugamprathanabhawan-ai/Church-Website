import React, { useState } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import type { NoticeItem } from '../types';
import { broadcastSessionNotice, dismissSessionNotice } from '../lib/supabaseClient';

interface NoticeBroadcasterProps {
  sessionCode: string;
  senderName?: string;
  activeNotice?: NoticeItem | null;
  onNoticeSent?: (notice: NoticeItem) => void;
  className?: string;
}

export const NoticeBroadcaster: React.FC<NoticeBroadcasterProps> = ({
  sessionCode,
  senderName = 'Presenter',
  activeNotice = null,
  onNoticeSent,
  className = '',
}) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = message.trim();
    if (!cleanText || isSending) return;

    setIsSending(true);
    try {
      const noticeItem: NoticeItem = {
        id: `notice-${Date.now()}`,
        text: cleanText,
        timestamp: Date.now(),
        senderName: senderName || 'Presenter',
      };

      await broadcastSessionNotice(sessionCode, noticeItem);
      setMessage('');
      setSentSuccess(true);
      onNoticeSent?.(noticeItem);

      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(35);
        }
      } catch {}

      setTimeout(() => setSentSuccess(false), 2400);
    } catch (err: any) {
      console.error('Failed to broadcast notice:', err);
      alert(`Could not broadcast notice: ${err?.message || 'Network error'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleDismissLive = async () => {
    try {
      await dismissSessionNotice(sessionCode);
    } catch (err) {
      console.warn('Failed to dismiss live notice:', err);
    }
  };

  return (
    <div className={`notice-broadcaster-container ${className}`}>
      <form onSubmit={handleSubmit} className="notice-broadcaster-form">
        <div className="notice-broadcaster-input-pill">
          <Send size={15} className="notice-broadcaster-plane-icon" />
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Send Message"
            className="notice-broadcaster-input"
            disabled={isSending}
            aria-label="Send Message to all screens"
            id="notice-broadcaster-input"
          />
        </div>
        <button
          type="submit"
          disabled={!message.trim() || isSending}
          className="notice-broadcaster-send-btn"
          id="btn-notice-broadcaster-send"
          title="Broadcast notice to all connected devices"
        >
          {isSending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : sentSuccess ? (
            'SENT!'
          ) : (
            'SEND'
          )}
        </button>
      </form>

      {/* Live active broadcast indicator with quick dismiss */}
      {activeNotice && activeNotice.text && (
        <div className="notice-live-status-pill">
          <span className="notice-live-dot" />
          <span className="notice-live-text" title={activeNotice.text}>
            Live: &quot;{activeNotice.text}&quot;
          </span>
          <button
            type="button"
            onClick={handleDismissLive}
            className="notice-live-dismiss-btn"
            title="Clear live notice from all screens"
            aria-label="Clear live notice"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

