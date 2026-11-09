import React, { useState } from 'react';
import { FileText, Bell, Clock, Sparkles } from 'lucide-react';
import type { NoteItem, NoticeItem } from '../types';

interface NotesViewerProps {
  notes?: NoteItem[];
  activeNotice?: NoticeItem | null;
}

export const NotesViewer: React.FC<NotesViewerProps> = ({
  notes = [],
  activeNotice = null,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  const displayNotes = notes.length > 0 ? notes : [
    {
      id: 'default',
      heading: 'Service & Hymn Notes',
      headingColor: '#ffffff',
      body: 'No notes have been added yet by the Main Presenter.\n\nSermon scriptures, hymn lyrics, and service announcements will appear here in real-time as the presenter writes them.',
      bodyColor: 'rgba(255, 255, 255, 0.7)',
      bgColor: '#000000',
      updatedAt: Date.now(),
    },
  ];

  const currentNote = displayNotes[activeTab] || displayNotes[0];

  return (
    <div className="notes-viewer-container">
      {/* Note Tabs if multiple notes exist */}
      {displayNotes.length > 1 && (
        <div className="notes-viewer-tabs">
          {displayNotes.map((note, idx) => (
            <button
              key={note.id || idx}
              onClick={() => setActiveTab(idx)}
              className={`notes-viewer-tab-btn ${activeTab === idx ? 'active' : ''}`}
            >
              <FileText size={14} />
              <span>{note.heading || `Note ${idx + 1}`}</span>
            </button>
          ))}
        </div>
      )}

      {/* Black Canvas Notepad Display */}
      <div
        className="notes-viewer-black-canvas"
        style={{
          backgroundColor: currentNote.bgColor || '#000000',
        }}
      >
        <div className="notes-viewer-note-card">
          <div className="notes-viewer-heading-wrap">
            <h1
              className="notes-viewer-heading"
              style={{
                color: currentNote.headingColor || '#ffffff',
              }}
            >
              {currentNote.heading || 'Untitled Note'}
            </h1>
            {currentNote.updatedAt && (
              <div className="notes-viewer-meta">
                <Clock size={12} />
                <span>
                  Updated {new Date(currentNote.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>

          <div
            className="notes-viewer-body"
            style={{
              color: currentNote.bodyColor || '#ffffff',
            }}
          >
            {currentNote.body ? (
              currentNote.body
            ) : (
              <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
                (Empty body text)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
