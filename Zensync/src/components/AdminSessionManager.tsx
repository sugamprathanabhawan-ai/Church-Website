import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Trash2,
  RotateCw,
  X,
  Plus,
  Eye,
  Presentation,
  Smartphone,
  Calendar,
  Layers,
  Check,
  Copy,
  AlertTriangle,
  Loader2,
  Search,
} from 'lucide-react';
import type { SessionData, UserRole } from '../types';
import { fetchAllSessions, deleteSession, deleteAllSessions } from '../lib/supabaseClient';

interface AdminSessionManagerProps {
  onClose: () => void;
  onJoinSession: (role: UserRole, code: string) => void;
  onCreateNewSession: () => void;
}

export const AdminSessionManager: React.FC<AdminSessionManagerProps> = ({
  onClose,
  onJoinSession,
  onCreateNewSession,
}) => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await fetchAllSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleDeleteOne = async (code: string) => {
    setDeletingCode(code);
    try {
      await deleteSession(code);
      setSessions((prev) => prev.filter((s) => s.code !== code));
      setConfirmDeleteCode(null);
    } catch (err) {
      console.error('Failed to delete session:', err);
    } finally {
      setDeletingCode(null);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      await deleteAllSessions();
      setSessions([]);
      setShowConfirmDeleteAll(false);
    } catch (err) {
      console.error('Failed to delete all sessions:', err);
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleCopy = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'Just now';
    try {
      const d = new Date(iso);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getSlideStats = (session: SessionData) => {
    const sections = session.content?.sections || [];
    let slideCount = 0;
    sections.forEach((sec) => {
      slideCount += sec.slides?.length || 0;
    });
    return {
      sectionsCount: sections.length,
      slideCount,
    };
  };

  const filteredSessions = sessions.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const devName = (s.device_info?.deviceName || '').toLowerCase();
    const devModel = (s.device_info?.deviceModel || '').toLowerCase();
    return s.code.includes(q) || devName.includes(q) || devModel.includes(q);
  });

  return (
    <div className="join-modal-overlay" style={{ zIndex: 9999, padding: '1rem' }}>
      <div className="admin-modal-card">
        {/* Modal Header */}
        <div className="admin-header">
          <div className="admin-header-title-wrap">
            <div className="admin-badge-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 className="admin-title">Zen Sync Admin Account</h2>
                <span className="admin-pill-badge">
                  Super Admin Mode
                </span>
              </div>
              <p className="admin-subtitle">
                Manage, inspect, and delete all live and cached presentation code sessions.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <a
              href="/admin?tab=photos"
              className="btn-outline admin-btn-refresh"
              style={{ textDecoration: 'none', color: 'var(--primary)', borderColor: 'var(--primary-border)' }}
              title="Manage all photos on church website"
            >
              <span>🖼️ Website Photos</span>
            </a>

            <button
              onClick={loadSessions}
              disabled={loading}
              className="btn-outline admin-btn-refresh"
              title="Refresh sessions list"
            >
              <RotateCw size={16} className={loading ? 'spin' : ''} />
              <span className="hide-mobile">Refresh</span>
            </button>

            <button
              onClick={onClose}
              className="btn-icon"
              style={{ width: '2.4rem', height: '2.4rem' }}
              aria-label="Close admin dashboard"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar Bar */}
        <div className="admin-toolbar">
          <div className="admin-search-wrap">
            <Search size={16} className="admin-search-icon" />
            <input
              type="text"
              placeholder="Search by code or device..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="admin-search-input"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {sessions.length > 0 && (
              <button
                onClick={() => setShowConfirmDeleteAll(true)}
                className="admin-btn-delete-all"
                title="Delete all sessions"
              >
                <Trash2 size={16} />
                <span>Delete All ({sessions.length})</span>
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onCreateNewSession();
              }}
              className="btn-primary admin-btn-new"
            >
              <Plus size={16} />
              <span>Start New Presentation</span>
            </button>
          </div>
        </div>

        {/* Modal Body / Sessions List */}
        <div className="admin-body">
          {loading ? (
            <div className="admin-loading-state">
              <Loader2 size={36} className="spin text-primary" />
              <p>Loading all presentation sessions...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="admin-empty-state">
              <div className="admin-empty-icon">
                <Layers size={36} />
              </div>
              <h3>No Presentation Sessions Found</h3>
              <p>
                {searchFilter
                  ? `No sessions match "${searchFilter}". Try clearing your filter.`
                  : 'There are currently no active presentation sessions in the database or local storage.'}
              </p>
              <button
                onClick={() => {
                  onClose();
                  onCreateNewSession();
                }}
                className="btn-primary"
                style={{ marginTop: '1rem' }}
              >
                <Plus size={16} />
                <span>Create First Presentation</span>
              </button>
            </div>
          ) : (
            <div className="admin-sessions-grid">
              {filteredSessions.map((session) => {
                const stats = getSlideStats(session);
                const isThisDeleting = deletingCode === session.code;
                const devName = session.device_info?.deviceName || 'Unnamed Presenter';
                const devModel = session.device_info?.deviceModel || 'Web Device';
                const platform = session.device_info?.platform || '';

                return (
                  <div key={session.code} className="admin-session-card">
                    {/* Top Row: Code & Timestamps */}
                    <div className="admin-session-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="admin-code-badge">
                          <span>#{session.code}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(session.code)}
                          className="btn-icon"
                          style={{ width: '1.8rem', height: '1.8rem' }}
                          title="Copy session code"
                        >
                          {copiedCode === session.code ? (
                            <Check size={14} style={{ color: 'var(--success)' }} />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>

                      <span className="admin-date-badge">
                        <Calendar size={13} />
                        <span>{formatDate(session.created_at || session.updated_at)}</span>
                      </span>
                    </div>

                    {/* Presenter Device Info */}
                    <div className="admin-device-info">
                      <Smartphone size={16} className="text-primary shrink-0" />
                      <div className="admin-device-text">
                        <span className="admin-device-name">{devName}</span>
                        <span className="admin-device-meta">
                          {devModel} {platform ? `(${platform})` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="admin-stats-row">
                      <div className="admin-stat-pill">
                        <Layers size={14} />
                        <span>
                          <strong>{stats.sectionsCount}</strong> sections
                        </span>
                      </div>
                      <div className="admin-stat-pill">
                        <Presentation size={14} />
                        <span>
                          <strong>{stats.slideCount}</strong> slides
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="admin-card-actions">
                      <div style={{ display: 'flex', gap: '0.4rem', flex: 1 }}>
                        <button
                          onClick={() => {
                            onClose();
                            onJoinSession('main', session.code);
                          }}
                          className="btn-outline admin-action-btn"
                          title="Resume as Main presenter"
                        >
                          <Presentation size={15} />
                          <span>Main</span>
                        </button>
                        <button
                          onClick={() => {
                            onClose();
                            onJoinSession('sub', session.code);
                          }}
                          className="btn-outline admin-action-btn"
                          title="View as Sub"
                        >
                          <Eye size={15} />
                          <span>Sub</span>
                        </button>
                      </div>

                      {confirmDeleteCode === session.code ? (
                        <div className="admin-confirm-delete-wrap">
                          <span style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600 }}>
                            Delete?
                          </span>
                          <button
                            onClick={() => handleDeleteOne(session.code)}
                            disabled={isThisDeleting}
                            className="admin-btn-delete-confirm"
                          >
                            {isThisDeleting ? <Loader2 size={13} className="spin" /> : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteCode(null)}
                            className="admin-btn-delete-cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteCode(session.code)}
                          disabled={isThisDeleting}
                          className="admin-btn-delete"
                          title="Delete this session"
                        >
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete All Confirmation Modal */}
        {showConfirmDeleteAll && (
          <div className="admin-confirm-overlay">
            <div className="admin-confirm-box">
              <div className="admin-confirm-icon">
                <AlertTriangle size={28} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.5rem 0' }}>
                Delete All Sessions?
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                This will permanently remove <strong>{sessions.length} sessions</strong> and their uploaded slide pictures from the database and storage. Connected screens will be disconnected.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowConfirmDeleteAll(false)}
                  className="btn-outline"
                  style={{ minWidth: '90px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={isDeletingAll}
                  className="admin-btn-delete-danger"
                  style={{ minWidth: '120px' }}
                >
                  {isDeletingAll ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Yes, Delete All</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
