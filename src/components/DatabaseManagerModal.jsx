import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  ExternalLink, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  ShieldCheck, 
  Key,
  Calendar,
  FileText,
  Clock,
  Layers,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function DatabaseManagerModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [adminTokens, setAdminTokens] = useState([]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aiufpdabglxhojmmkedp.supabase.co';
  const supabaseConsoleUrl = 'https://supabase.com/dashboard/project/aiufpdabglxhojmmkedp/editor';

  // Fetch live sessions from Supabase
  const fetchLiveSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch sessions from database:', error);
      } else {
        setSessions(data || []);
      }
    } catch (err) {
      console.error('Error querying sessions table:', err);
    } finally {
      setLoading(false);
    }
  };

  // Inspect localStorage for any stored admin credentials
  const checkStoredAdminCredentials = () => {
    const keys = ['sugam_church_admin_session', 'sb-aiufpdabglxhojmmkedp-auth-token', 'sugam_admin_token'];
    const found = [];
    keys.forEach(k => {
      const val = localStorage.getItem(k);
      if (val) {
        found.push({ key: k, value: val });
      }
    });
    setAdminTokens(found);
  };

  useEffect(() => {
    if (isOpen) {
      fetchLiveSessions();
      checkStoredAdminCredentials();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Delete a single session from the database
  const handleDeleteSession = async (code) => {
    if (!confirm(`Are you sure you want to permanently delete session ${code} from the live database?`)) {
      return;
    }
    setIsDeleting(code);
    try {
      const { error } = await supabase.from('sessions').delete().eq('code', code);
      if (error) {
        alert(`Failed to delete session ${code}: ${error.message}`);
      } else {
        setSessions(prev => prev.filter(s => s.code !== code));
        showToast(`Session ${code} deleted from database.`);
      }
    } catch (e) {
      alert(`Delete error: ${e.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  // Delete all sessions from the database
  const handleDeleteAllSessions = async () => {
    if (!confirm(`CAUTION: Are you sure you want to delete ALL ${sessions.length} sessions from the live database? This action is permanent.`)) {
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('sessions').delete().neq('code', '____nonexistent____');
      if (error) {
        alert(`Failed to delete all sessions: ${error.message}`);
      } else {
        setSessions([]);
        showToast('All sessions deleted from database.');
      }
    } catch (e) {
      alert(`Delete error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Purge all stored admin credentials
  const handlePurgeAdminCredentials = async () => {
    localStorage.removeItem('sugam_church_admin_session');
    localStorage.removeItem('sb-aiufpdabglxhojmmkedp-auth-token');
    localStorage.removeItem('sugam_admin_token');
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    checkStoredAdminCredentials();
    showToast('All admin credentials and session tokens cleared.');
  };

  const filteredSessions = sessions.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const codeMatch = (s.code || '').toLowerCase().includes(q);
    const notesHeading = s.content?.notes?.[0]?.heading || '';
    const notesMatch = notesHeading.toLowerCase().includes(q);
    return codeMatch || notesMatch;
  });

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
      {/* Toast message */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[1000000] flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl shadow-xl font-medium text-xs sm:text-sm animate-bounce">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-[#1e3a47] to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  Live Database Manager
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5 font-mono">
                <span>{supabaseUrl}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={supabaseConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition"
              title="Open Supabase Cloud Console Editor"
            >
              <span>Supabase Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition"
              aria-label="Close"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 sm:px-6 pt-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 ${
                activeTab === 'sessions'
                  ? 'border-sky-600 text-sky-700 bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Sessions Table</span>
              <span className="px-1.5 py-0.2 rounded-full text-[11px] bg-sky-100 text-sky-700">
                {sessions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('credentials')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 ${
                activeTab === 'credentials'
                  ? 'border-sky-600 text-sky-700 bg-white shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>Admin Credentials</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[11px] ${adminTokens.length > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {adminTokens.length > 0 ? `${adminTokens.length} Stored` : 'Clean'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2 sm:pb-0">
            <button
              onClick={fetchLiveSessions}
              disabled={loading}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition"
              title="Refresh database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab 1: Sessions Table */}
        {activeTab === 'sessions' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
            {/* Search and Bulk Actions */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter sessions by code or note title..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-sky-500 font-medium"
                />
              </div>

              {sessions.length > 0 && (
                <button
                  onClick={handleDeleteAllSessions}
                  disabled={loading}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete All ({sessions.length})</span>
                </button>
              )}
            </div>

            {/* Sessions Table List */}
            {loading && sessions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-500" />
                <span>Loading records from Supabase database...</span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No records found in sessions table</p>
                <p className="text-xs text-slate-400 mt-1">The sessions table in the live database is empty.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Session Code</th>
                        <th className="py-3 px-4">Created</th>
                        <th className="py-3 px-4">Content Details</th>
                        <th className="py-3 px-4">Active Notice</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSessions.map((s) => {
                        const noteHeading = s.content?.notes?.[0]?.heading;
                        const notesCount = s.content?.notes?.length || 0;
                        const slidesCount = s.content?.sections?.reduce((acc, sec) => acc + (sec.slides?.length || 0), 0) || 0;
                        const activeNotice = s.content?.activeNotice?.text;

                        return (
                          <tr key={s.code} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-mono font-bold text-sky-700">
                              <span className="px-2.5 py-1 bg-sky-50 rounded-lg border border-sky-200 text-sm">
                                {s.code}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{new Date(s.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              <div className="flex flex-col gap-0.5">
                                {noteHeading ? (
                                  <span className="font-semibold text-slate-900 truncate max-w-[200px]" title={noteHeading}>
                                    📝 {noteHeading}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">No notes</span>
                                )}
                                <span className="text-[11px] text-slate-500">
                                  {notesCount} note{notesCount !== 1 ? 's' : ''} • {slidesCount} slide{slidesCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {activeNotice ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 max-w-[180px] truncate block" title={activeNotice}>
                                  📢 {activeNotice}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">None</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteSession(s.code)}
                                disabled={isDeleting === s.code}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition active:scale-95"
                                title="Permanently delete this session from database"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{isDeleting === s.code ? 'Deleting...' : 'Delete'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Admin Credentials Tab */}
        {activeTab === 'credentials' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-sky-700 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-sky-900">Admin Security Posture</h4>
                <p className="text-xs text-sky-800 mt-1 leading-relaxed">
                  All hardcoded passwords, test hashes, and public login links have been removed from the frontend client. 
                  Below are local storage sessions and tokens in this browser that can be purged with one click.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden p-4 bg-white flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">Stored Client Credentials &amp; Tokens</span>
                {adminTokens.length > 0 && (
                  <button
                    onClick={handlePurgeAdminCredentials}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge All Credentials</span>
                  </button>
                )}
              </div>

              {adminTokens.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                  <p className="font-semibold text-emerald-800">No admin credentials stored in browser!</p>
                  <p className="text-slate-400 mt-0.5">Your browser session is completely clean.</p>
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  {adminTokens.map(t => (
                    <div key={t.key} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-slate-800">{t.key}</span>
                        <p className="text-slate-400 font-mono text-[11px] truncate max-w-sm mt-0.5">
                          {t.value.slice(0, 60)}...
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                        ACTIVE TOKEN
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Connected to Supabase Project <strong>aiufpdabglxhojmmkedp</strong></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

