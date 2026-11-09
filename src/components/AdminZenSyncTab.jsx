import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  RotateCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Eye,
  SlidersHorizontal,
  Layers,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  Unlock,
  Radio,
  FileText,
  Clock,
  Presentation
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  fetchZenSyncSessions,
  deleteZenSyncSession,
  deleteAllZenSyncSessions
} from '../services/supabaseService';

export default function AdminZenSyncTab({ showToast }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingCode, setDeletingCode] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');

  const loadSessions = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const data = await fetchZenSyncSessions();
      setSessions(data || []);
    } catch (err) {
      console.error('Failed to load ZenSync sessions:', err);
      if (!isSilent) {
        showToast(err.message || 'Failed to fetch sessions from Supabase', 'error');
      }
    } finally {
      setLoading(false);
      if (!isSilent) setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSessions();

    // Subscribe to real-time changes on public.sessions table
    const channel = supabase
      .channel('admin_zensync_sessions_watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => {
          loadSessions(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSessions]);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    showToast(`Session code "${code}" copied to clipboard!`);
  };

  const handleDeleteSingle = async (code) => {
    if (!window.confirm(`Are you sure you want to delete session "${code}"? All active presentations and uploaded slide images for this session will be permanently cleared.`)) {
      return;
    }

    setDeletingCode(code);
    try {
      await deleteZenSyncSession(code);
      setSessions((prev) => prev.filter((s) => s.code !== code));
      showToast(`Session "${code}" has been deleted from Supabase database.`);
    } catch (err) {
      showToast(err.message || `Failed to delete session "${code}"`, 'error');
    } finally {
      setDeletingCode(null);
    }
  };

  const handleConfirmDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      await deleteAllZenSyncSessions();
      setSessions([]);
      setShowDeleteAllModal(false);
      showToast('All active ZenSync sessions have been deleted from Supabase database!');
    } catch (err) {
      showToast(err.message || 'Failed to delete all sessions', 'error');
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Helper stats
  const totalSlides = sessions.reduce((acc, s) => {
    const sections = s.content?.sections || [];
    const count = sections.reduce((sum, sec) => sum + (sec.slides?.length || 0), 0);
    return acc + count;
  }, 0);

  const totalHelpers = sessions.filter(
    (s) => s.helper_signature || s.content?.helper_signature
  ).length;

  const totalNotes = sessions.reduce((acc, s) => {
    return acc + (s.content?.notes?.length || 0);
  }, 0);

  const filteredSessions = sessions.filter((s) => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return true;
    const devName = (s.device_name || s.content?.device_info?.deviceName || '').toLowerCase();
    const code = (s.code || '').toLowerCase();
    return code.includes(q) || devName.includes(q);
  });

  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Just now';
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-sky-100/40 via-teal-50/30 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-[#0284c7] text-xs font-semibold">
              <Radio className="w-3.5 h-3.5 animate-pulse text-sky-600" />
              <span>Realtime Choir Presentation Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#285c73] tracking-tight">
              ZenSync Sessions
            </h2>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              Monitor and manage all live synchronized hymn presentations. You can view connected devices, check session passwords, inspect slide counts, or immediately purge ended sessions from the Supabase database.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => loadSessions(false)}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 text-slate-700 font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2"
              title="Refresh session list from database"
            >
              <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#0284c7]' : ''}`} />
              <span>Refresh</span>
            </button>

            <a
              href="/zensync"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 rounded-2xl bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs sm:text-sm shadow-md shadow-sky-600/20 transition-all flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open ZenSync App</span>
            </a>

            {sessions.length > 0 && (
              <button
                onClick={() => setShowDeleteAllModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-sm"
                title="Delete all sessions from Supabase database"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Delete All Sessions ({sessions.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100">
          <div className="bg-sky-50/60 rounded-2xl p-4 border border-sky-100/80">
            <div className="text-xs font-semibold text-sky-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Presentation className="w-3.5 h-3.5 text-sky-600" />
              Active Sessions
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#285c73]">
              {sessions.length}
            </div>
          </div>

          <div className="bg-teal-50/60 rounded-2xl p-4 border border-teal-100/80">
            <div className="text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              Total Slides
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#1b6b55]">
              {totalSlides}
            </div>
          </div>

          <div className="bg-indigo-50/60 rounded-2xl p-4 border border-indigo-100/80">
            <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              Helpers Connected
            </div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-900">
              {totalHelpers}
            </div>
          </div>

          <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-100/80">
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              Active Notes
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-900">
              {totalNotes}
            </div>
          </div>
        </div>
      </div>

      {/* Sessions Content Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-800">
              Live Database Sessions ({filteredSessions.length})
            </h3>
            {refreshing && (
              <span className="text-xs font-medium text-sky-600 flex items-center gap-1">
                <RotateCw className="w-3 h-3 animate-spin" />
                Syncing...
              </span>
            )}
          </div>

          {/* Filter Input */}
          {sessions.length > 0 && (
            <div className="w-full sm:w-72">
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search by code or device..."
                className="w-full px-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
              />
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <RotateCw className="w-8 h-8 animate-spin mx-auto text-sky-500" />
            <p className="text-sm font-medium">Fetching active ZenSync sessions from Supabase...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && sessions.length === 0 && (
          <div className="py-16 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-sky-100 text-[#0284c7] mx-auto flex items-center justify-center">
              <Presentation className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-800">No Active Presentations</h4>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                There are currently no active ZenSync sessions in the database. Presentations started from the ZenSync app will automatically appear here in real-time.
              </p>
            </div>
            <a
              href="/zensync"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#0284c7] text-white text-xs sm:text-sm font-bold shadow-md hover:bg-[#0369a1] transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start New ZenSync Presentation</span>
            </a>
          </div>
        )}

        {/* Sessions List */}
        {!loading && filteredSessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSessions.map((session) => {
              const code = session.code;
              const sections = session.content?.sections || [];
              const slideCount = sections.reduce((sum, sec) => sum + (sec.slides?.length || 0), 0);
              const deviceName = session.device_name || session.content?.device_info?.deviceName || 'Unknown Presenter';
              const deviceModel = session.content?.device_info?.deviceModel || session.content?.device_info?.platform || '';
              const hasPassword = Boolean(session.content?.adminPassword || session.content?.admin_password);
              const helperSig = session.helper_signature || session.content?.helper_signature;
              const helperInfo = session.helper_device_info || session.content?.helper_device_info;
              const helperName = helperInfo?.deviceName || (helperSig ? '1 Connected' : null);
              const notesCount = session.content?.notes?.length || 0;
              const isDeleting = deletingCode === code;

              return (
                <div
                  key={code}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-sky-300 p-5 shadow-sm hover:shadow-md transition-all space-y-4 relative"
                >
                  {/* Top Bar of Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Code Badge */}
                      <button
                        onClick={() => handleCopyCode(code)}
                        className="px-3 py-1.5 rounded-xl bg-[#285c73] hover:bg-[#1f4a5c] text-white font-mono font-black text-lg sm:text-xl tracking-widest shadow-sm flex items-center gap-1.5 transition-all group"
                        title="Click to copy session code"
                      >
                        <span>{code}</span>
                        {copiedCode === code ? (
                          <Check className="w-4 h-4 text-emerald-300" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm font-bold text-slate-800 line-clamp-1">
                            {deviceName}
                          </span>
                        </div>
                        {deviceModel && (
                          <p className="text-[11px] text-slate-400">
                            {deviceModel}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Password Protection Badge */}
                    <div className="flex items-center gap-2">
                      {hasPassword ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                          title="Admin password is required to join this session as Main from another device"
                        >
                          <Lock className="w-3 h-3 text-amber-600" />
                          <span>Protected</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                          title="Open session without admin password"
                        >
                          <Unlock className="w-3 h-3 text-slate-400" />
                          <span>Open</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50/80 rounded-xl text-center border border-slate-100 text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">Sections / Slides</span>
                      <span className="font-bold text-slate-700">{sections.length} sec / {slideCount} slides</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">Helper</span>
                      <span className={`font-bold ${helperName ? 'text-indigo-600' : 'text-slate-500'}`}>
                        {helperName ? helperName : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-semibold">Created</span>
                      <span className="font-bold text-slate-700 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatTimeAgo(session.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Active Notice banner if present */}
                  {session.content?.activeNotice?.text && (
                    <div className="px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-100 text-sky-800 text-xs flex items-center gap-1.5">
                      <Radio className="w-3 h-3 text-sky-600 flex-shrink-0 animate-pulse" />
                      <span className="font-semibold">Notice:</span>
                      <span className="truncate">{session.content.activeNotice.text}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/zensync?role=main&code=${code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Presentation className="w-3.5 h-3.5" />
                        <span>Launch Admin</span>
                      </a>

                      <a
                        href={`/zensync?role=sub&code=${code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View (Sub)</span>
                      </a>
                    </div>

                    <button
                      onClick={() => handleDeleteSingle(code)}
                      disabled={isDeleting}
                      className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all"
                      title="Permanently delete this presentation session from Supabase"
                    >
                      <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete All Modal Confirmation */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-5 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-slate-800">
                Delete All ZenSync Sessions?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                This will immediately drop all <strong>{sessions.length}</strong> active presentation sessions from the Supabase database and purge their uploaded slide images.
              </p>
              <p className="text-xs text-rose-600 font-semibold bg-rose-50 py-2 px-3 rounded-xl border border-rose-100">
                Any connected choir members, helpers, or displays will be immediately disconnected. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isDeletingAll}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                disabled={isDeletingAll}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
              >
                {isDeletingAll ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Deleting All...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete All</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

