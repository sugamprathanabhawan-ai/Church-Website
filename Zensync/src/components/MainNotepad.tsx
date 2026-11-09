import React, { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  FileText,
  Check,
  X,
  UploadCloud,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { NoteItem, ChatParticipant, NoticeItem } from '../types';
import { updateSessionNotes } from '../lib/supabaseClient';

interface MainNotepadProps {
  sessionCode: string;
  initialNotes?: NoteItem[];
  activeNotice?: NoticeItem | null;
  presenterName?: string;
  participants?: ChatParticipant[];
}

export const MainNotepad: React.FC<MainNotepadProps> = ({
  sessionCode,
  initialNotes = [],
}) => {
  // Notes & Commit state
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
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [committedToast, setCommittedToast] = useState(false);

  const fallbackNote: NoteItem = {
    id: 'note-default',
    heading: 'Service & Choir Notes',
    headingColor: '#ffffff',
    body: '',
    bodyColor: '#ffffff',
    bgColor: '#000000',
    updatedAt: Date.now(),
  };

  const activeNote = (notes && notes[activeNoteIndex]) || (notes && notes[0]) || fallbackNote;

  // Sync external notes updates if not currently dirty
  useEffect(() => {
    if (initialNotes && initialNotes.length > 0 && !hasUncommittedChanges) {
      setNotes(initialNotes);
    }
  }, [initialNotes, hasUncommittedChanges]);

  // Local note editing
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

  return (
    <div className="main-notepad-container full-screen">
      {/* Toast Feedback for Notes Commit */}
      {committedToast && (
        <div
          className="notice-broadcast-toast"
          style={{
            position: 'absolute',
            top: 'calc(62px + env(safe-area-inset-top, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            borderColor: '#38bdf8',
            color: '#f0f9ff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          <CheckCircle2 size={16} color="#38bdf8" />
          <span>Notes synced live to all screens!</span>
        </div>
      )}

      {/* Fullscreen Edge-to-Edge Black Canvas Notepad */}
      <div className="notepad-fullscreen-canvas" style={{ backgroundColor: activeNote.bgColor || '#000000' }}>
        {/* Top Minimal Action Row: Heading + Just a Tick Logo */}
        <div className="notepad-canvas-topbar">
          <input
            type="text"
            value={activeNote.heading}
            onChange={(e) => handleNoteChange('heading', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Heading / Title (e.g. Service Order, Hymn Lyrics)..."
            style={{ color: activeNote.headingColor || '#ffffff' }}
            className="notepad-heading-input"
          />

          {/* Just a Tick Logo (Commits Notes Live) */}
          <button
            type="button"
            onClick={handleCommitNotes}
            disabled={isCommitting}
            className={`btn-tick-logo ${hasUncommittedChanges ? 'has-changes' : 'synced'}`}
            id="btn-commit-notes"
            title={hasUncommittedChanges ? "Uncommitted edits: Click tick to sync live (Ctrl+Enter)" : "Live Synced with all screens"}
            aria-label="Commit notes"
          >
            {isCommitting ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <Check size={18} strokeWidth={2.5} />
            )}
          </button>
        </div>

        {/* Full-Height Notepad Body Textarea */}
        <textarea
          value={activeNote.body}
          onChange={(e) => handleNoteChange('body', e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write presentation notes here (singers' cues, order of prayer, full hymn lyrics, sermon scriptures)... Click the green tick button below to commit live."
          style={{ color: activeNote.bodyColor || '#ffffff' }}
          className="notepad-body-textarea"
        />

        {/* Bottom Floating Green Tick Button to Commit Notes Live */}
        <button
          type="button"
          onClick={handleCommitNotes}
          disabled={isCommitting}
          className={`notepad-bottom-commit-btn ${hasUncommittedChanges ? 'has-changes' : 'synced'}`}
          id="btn-bottom-commit-notes"
          title={hasUncommittedChanges ? "Uncommitted edits: Click green tick to commit live (Ctrl+Enter)" : "Notes synced live with all screens"}
          aria-label="Commit notes live"
        >
          {isCommitting ? (
            <>
              <Loader2 size={18} className="spin" />
              <span>Committing...</span>
            </>
          ) : committedToast ? (
            <>
              <CheckCircle2 size={18} />
              <span>Committed Live!</span>
            </>
          ) : (
            <>
              <div className="green-tick-circle">
                <Check size={16} strokeWidth={3} />
              </div>
              <span>Commit Notes</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
