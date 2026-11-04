import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Send,
  Check,
  X,
  Palette,
  Trash2,
  Plus,
  Bell,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  UploadCloud,
  Loader2,
  Zap,
} from 'lucide-react';
import type { NoteItem, NoticeItem } from '../types';
import { updateSessionNotes, broadcastSessionNotice, dismissSessionNotice } from '../lib/supabaseClient';

interface MainNotepadProps {
  sessionCode: string;
  initialNotes?: NoteItem[];
  activeNotice?: NoticeItem | null;
  presenterName?: string;
}

const COLOR_PRESETS = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Yellow', hex: '#fde047' },
  { name: 'Cyan', hex: '#38bdf8' },
  { name: 'Lime', hex: '#4ade80' },
  { name: 'Orange', hex: '#fb923c' },
  { name: 'Rose', hex: '#f472b6' },
];

interface QuickPreset {
  id: string;
  text: string;
  emoji: string;
}

const DEFAULT_QUICK_PRESETS: QuickPreset[] = [
  { id: 'chord', text: 'Chord has changed', emoji: '🎵' },
  { id: 'song', text: 'Song has changed', emoji: '📑' },
  { id: 'piano', text: 'Play the piano', emoji: '🎹' },
  { id: 'guitar', text: 'Play the guitar', emoji: '🎸' },
  { id: 'chorus', text: 'Repeat Chorus', emoji: '🔁' },
  { id: 'key', text: 'Key Change / Modulation', emoji: '🎼' },
  { id: 'bridge', text: 'Bridge / Solo', emoji: '⚡' },
  { id: 'stop', text: 'Soft Ending / Cut', emoji: '🛑' },
  { id: 'accapella', text: 'Singers Only / Accapella', emoji: '🎤' },
  { id: 'band', text: 'Full Band In', emoji: '🥁' },
];

export const MainNotepad: React.FC<MainNotepadProps> = ({
  sessionCode,
  initialNotes = [],
  activeNotice = null,
  presenterName = 'Main Presenter',
}) => {
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    if (initialNotes && initialNotes.length > 0) return initialNotes;
    return [
      {
        id: `note-${Date.now()}`,
        heading: 'Service & Choir Notes',
        headingColor: '#ffffff',
        body: '',
        bodyColor: '#ffffff',
        bgColor: '#000000',
        updatedAt: Date.now(),
      },
    ];
  });

  const [activeNoteIndex, setActiveNoteIndex] = useState(0);
  const [targetColorField, setTargetColorField] = useState<'heading' | 'body'>('heading');
  const [customColor, setCustomColor] = useState('#ffffff');

  // Commit and sync states
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [committedToast, setCommittedToast] = useState(false);

  // Notice section states
  const [customNoticeText, setCustomNoticeText] = useState('');
  const [currentActiveNotice, setCurrentActiveNotice] = useState<NoticeItem | null>(activeNotice);
  const [isSendingNotice, setIsSendingNotice] = useState(false);
  const [noticeSentToast, setNoticeSentToast] = useState(false);

  // Quick Notice Presets (user can send with 1-click or add custom presets)
  const [quickPresets, setQuickPresets] = useState<QuickPreset[]>(() => {
    try {
      const saved = localStorage.getItem('zensync_quick_notices');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_QUICK_PRESETS;
  });

  const activeNote = notes[activeNoteIndex] || notes[0];

  // Sync external notice changes
  useEffect(() => {
    setCurrentActiveNotice(activeNotice);
  }, [activeNotice]);

  // Sync external notes updates if not dirty
  useEffect(() => {
    if (initialNotes && initialNotes.length > 0 && !hasUncommittedChanges) {
      setNotes(initialNotes);
    }
  }, [initialNotes, hasUncommittedChanges]);

  // Local-only note editing: do NOT stream to network on every keystroke
  const handleNoteChange = (field: 'heading' | 'body', value: string) => {
    const updatedNotes = notes.map((note, idx) => {
      if (idx === activeNoteIndex) {
        return {
          ...note,
          [field]: value,
          updatedAt: Date.now(),
        };
      }
      return note;
    });

    setNotes(updatedNotes);
    setHasUncommittedChanges(true);
  };

  const handleApplyColor = (colorHex: string) => {
    setCustomColor(colorHex);
    const updatedNotes = notes.map((note, idx) => {
      if (idx === activeNoteIndex) {
        return {
          ...note,
          [targetColorField === 'heading' ? 'headingColor' : 'bodyColor']: colorHex,
          updatedAt: Date.now(),
        };
      }
      return note;
    });

    setNotes(updatedNotes);
    setHasUncommittedChanges(true);
  };

  const handleAddNoteTab = () => {
    const newNote: NoteItem = {
      id: `note-${Date.now()}`,
      heading: `Note ${notes.length + 1}`,
      headingColor: '#ffffff',
      body: '',
      bodyColor: '#ffffff',
      bgColor: '#000000',
      updatedAt: Date.now(),
    };
    const updated = [...notes, newNote];
    setNotes(updated);
    setActiveNoteIndex(updated.length - 1);
    setHasUncommittedChanges(true);
  };

  const handleDeleteNoteTab = (index: number) => {
    if (notes.length <= 1) return;
    const updated = notes.filter((_, idx) => idx !== index);
    setNotes(updated);
    setActiveNoteIndex(Math.max(0, index - 1));
    setHasUncommittedChanges(true);
  };

  // Commit notes to Supabase & push live to Sub and Helper devices
  const handleCommitNotes = async () => {
    if (isCommitting) return;
    setIsCommitting(true);

    try {
      await updateSessionNotes(sessionCode, notes);
      setHasUncommittedChanges(false);
      setCommittedToast(true);
      setTimeout(() => setCommittedToast(false), 2800);
    } catch (err: any) {
      console.error('Failed to commit notes:', err);
      alert(`Could not sync notes: ${err.message || 'Network error'}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // Keyboard shortcut Ctrl+Enter / Cmd+Enter to commit notes
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCommitNotes();
    }
  };

  // 1-Click Instant Broadcast for Quick Notices
  const handleSendPresetNotice = async (text: string) => {
    if (!text.trim() || isSendingNotice) return;
    setIsSendingNotice(true);
    const noticeItem: NoticeItem = {
      id: `notice-${Date.now()}`,
      text: text.trim(),
      timestamp: Date.now(),
      senderName: presenterName,
    };

    try {
      await broadcastSessionNotice(sessionCode, noticeItem);
      setCurrentActiveNotice(noticeItem);
      setNoticeSentToast(true);
      setTimeout(() => setNoticeSentToast(false), 2500);
    } catch (e: any) {
      console.error('Failed to broadcast quick notice:', e);
      alert(`Could not broadcast notice: ${e.message}`);
    } finally {
      setIsSendingNotice(false);
    }
  };

  // Add custom typed notice to quick presets list for future 1-click use
  const handleAddCustomQuickPreset = () => {
    const clean = customNoticeText.trim();
    if (!clean) return;
    const exists = quickPresets.some(p => p.text.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      const newPreset: QuickPreset = {
        id: `qp-${Date.now()}`,
        text: clean,
        emoji: '⚡',
      };
      const updated = [...quickPresets, newPreset];
      setQuickPresets(updated);
      try {
        localStorage.setItem('zensync_quick_notices', JSON.stringify(updated));
      } catch {}
    }
  };

  // Send custom typed notice
  const handleSendCustomNotice = async () => {
    if (!customNoticeText.trim()) return;
    await handleSendPresetNotice(customNoticeText.trim());
    setCustomNoticeText('');
  };

  // Clear notice from all screens
  const handleDismissNotice = async () => {
    try {
      await dismissSessionNotice(sessionCode);
      setCurrentActiveNotice(null);
    } catch (e: any) {
      console.warn('Failed to dismiss notice:', e);
    }
  };

  return (
    <div className="main-notepad-container">
      {/* Toast Confirmation for Broadcast */}
      {noticeSentToast && (
        <div className="notice-broadcast-toast">
          <CheckCircle2 size={18} color="#10b981" />
          <span>Notice broadcasted live! Sub &amp; Helper screens received alert.</span>
        </div>
      )}

      {/* Toast Confirmation for Notes Commit */}
      {committedToast && (
        <div className="notice-broadcast-toast" style={{ backgroundColor: '#eff6ff', borderColor: '#93c5fd', color: '#1e40af' }}>
          <CheckCircle2 size={18} color="#2563eb" />
          <span>Notes committed! Live changes pushed to Sub and Helper devices.</span>
        </div>
      )}

      {/* Notepad Section */}
      <div className="notepad-card">
        {/* Top Bar: Tabs & Commit Actions */}
        <div className="notepad-header">
          <div className="notepad-tabs-scroll">
            {notes.map((note, idx) => (
              <div
                key={note.id}
                className={`notepad-tab ${idx === activeNoteIndex ? 'active' : ''}`}
                onClick={() => setActiveNoteIndex(idx)}
              >
                <FileText size={14} />
                <span className="notepad-tab-title">{note.heading || `Note ${idx + 1}`}</span>
                {notes.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNoteTab(idx);
                    }}
                    className="notepad-tab-delete"
                    title="Delete Note"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={handleAddNoteTab} className="notepad-add-tab-btn" title="Add New Note">
              <Plus size={14} />
              <span>Note</span>
            </button>
          </div>

          <div className="notepad-header-actions">
            {hasUncommittedChanges ? (
              <div className="notepad-unsaved-badge" title="Local edits not yet pushed to viewers">
                <AlertTriangle size={13} />
                <span>Uncommitted Edits</span>
              </div>
            ) : (
              <div className="notepad-synced-badge" title="All viewers see the latest note">
                <span className="status-dot green" />
                <span>Live Synced</span>
              </div>
            )}

            <button
              onClick={handleCommitNotes}
              disabled={isCommitting}
              className={`btn-commit-notes ${hasUncommittedChanges ? 'has-changes' : 'synced'}`}
              id="btn-commit-notes"
              title="Commit changes and push live to Sub and Helper devices (Ctrl+Enter)"
            >
              {isCommitting ? (
                <>
                  <Loader2 size={15} className="spin" />
                  <span>Committing...</span>
                </>
              ) : hasUncommittedChanges ? (
                <>
                  <UploadCloud size={15} />
                  <span>Commit Notes</span>
                  <span className="shortcut-pill">Ctrl+↵</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Committed</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Toolbar: Color Picker for Heading / Body */}
        <div className="notepad-toolbar">
          <div className="color-target-toggle">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)' }}>
              Color Target:
            </span>
            <button
              onClick={() => setTargetColorField('heading')}
              className={`color-target-btn ${targetColorField === 'heading' ? 'active' : ''}`}
            >
              Heading
            </button>
            <button
              onClick={() => setTargetColorField('body')}
              className={`color-target-btn ${targetColorField === 'body' ? 'active' : ''}`}
            >
              Body Text
            </button>
          </div>

          <div className="color-swatches-wrap">
            <Palette size={15} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                onClick={() => handleApplyColor(preset.hex)}
                className="color-swatch-circle"
                style={{ backgroundColor: preset.hex }}
                title={`${preset.name} (${preset.hex})`}
              />
            ))}
            <label className="custom-color-picker-label" title="Custom color picker">
              <input
                type="color"
                value={customColor}
                onChange={(e) => handleApplyColor(e.target.value)}
                className="custom-color-input"
              />
            </label>
          </div>
        </div>

        {/* The Long Black Canvas Notepad */}
        <div className="black-notepad-canvas" style={{ backgroundColor: activeNote.bgColor || '#000000' }}>
          <input
            type="text"
            value={activeNote.heading}
            onChange={(e) => handleNoteChange('heading', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Heading / Title (e.g. Key of G, Choir Verse 2 Repeat)..."
            style={{ color: activeNote.headingColor || '#ffffff' }}
            className="notepad-heading-input"
          />

          <textarea
            value={activeNote.body}
            onChange={(e) => handleNoteChange('body', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write long presentation notes here (singers' cues, order of prayer, full hymn lyrics, sermon scriptures)... Press Ctrl+Enter to commit notes live."
            style={{ color: activeNote.bodyColor || '#ffffff' }}
            className="notepad-body-textarea"
            rows={18}
          />
        </div>
      </div>

      {/* Notice Section with 1-Click Quick Notice Presets */}
      <div className="notice-section-card">
        <div className="notice-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="notice-icon-badge">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="notice-section-title">Notice Broadcast</h3>
              <p className="notice-section-subtitle">
                Instant 1-click alerts to Sub (viewers) &amp; Helper screens
              </p>
            </div>
          </div>

          {currentActiveNotice && (
            <button
              onClick={handleDismissNotice}
              className="btn-danger-outline"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
              title="Clear active notice from all viewer screens"
            >
              Clear Current Notice
            </button>
          )}
        </div>

        {/* Current Active Notice on screens */}
        {currentActiveNotice && (
          <div className="current-active-notice-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span className="status-dot green" />
              <strong>Active on Viewer Screens:</strong>
            </div>
            <p style={{ margin: '0.25rem 0 0 1.25rem', fontSize: '1.05rem', fontWeight: 600 }}>
              "{currentActiveNotice.text}"
            </p>
          </div>
        )}

        {/* 1-Click Quick Notice Presets Grid */}
        <div className="quick-notices-container">
          <div className="quick-notices-header">
            <span className="quick-notices-label">
              <Zap size={14} color="#f59e0b" />
              <span>Quick Notices (1-Click Instant Send):</span>
            </span>
            <span className="quick-notices-hint">
              Tap any preset to broadcast immediately
            </span>
          </div>

          <div className="quick-notices-grid">
            {quickPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSendPresetNotice(preset.text)}
                disabled={isSendingNotice}
                className="quick-notice-chip"
                title={`Instantly send "${preset.text}" to all screens`}
              >
                <span className="quick-chip-emoji">{preset.emoji}</span>
                <span className="quick-chip-text">{preset.text}</span>
                <Send size={12} className="quick-chip-send-icon" />
              </button>
            ))}
          </div>
        </div>

        {/* Manual Notice Input */}
        <div className="manual-notice-composer">
          <input
            type="text"
            value={customNoticeText}
            onChange={(e) => setCustomNoticeText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendCustomNotice()}
            placeholder="Or type a custom notice (e.g. Offering Prayer)..."
            className="manual-notice-input"
          />
          <button
            onClick={handleSendCustomNotice}
            disabled={isSendingNotice || !customNoticeText.trim()}
            className="btn-primary"
            style={{ padding: '0.65rem 1.1rem', fontSize: '0.88rem', flexShrink: 0 }}
          >
            <Send size={15} />
            <span>Send Notice</span>
          </button>
          {customNoticeText.trim() && (
            <button
              type="button"
              onClick={handleAddCustomQuickPreset}
              className="btn-secondary"
              style={{ padding: '0.65rem 0.85rem', fontSize: '0.8rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Save this alert as a permanent Quick Button for 1-click use"
            >
              <Plus size={14} />
              <span>Save as Quick Button</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
