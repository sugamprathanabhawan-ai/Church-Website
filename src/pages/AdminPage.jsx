import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { 
  Lock, 
  LogOut, 
  Save, 
  RotateCw, 
  Plus, 
  Trash2, 
  Music, 
  Users, 
  CheckCircle2, 
  Sparkles,
  Database,
  Wifi,
  WifiOff,
  Play,
  Trophy,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';
import { fetchQuizLeaderboard, clearQuizLeaderboard } from '../services/supabaseService';

function YoutubeIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

export default function AdminPage() {
  const { 
    youthData, 
    choirData, 
    youtubeData, 
    updateYouthData, 
    updateChoirData, 
    updateYouTubeData,
    refreshData,
    loading: globalLoading,
    dbStatus
  } = useData();

  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem('sugam_admin_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('youth'); // 'youth', 'choir', 'youtube', 'quiz'
  const [toastMessage, setToastMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  // Local state copies for live editing
  const [localYouth, setLocalYouth] = useState(youthData);
  const [localChoir, setLocalChoir] = useState(choirData);
  const [localYoutube, setLocalYoutube] = useState(youtubeData.songs || []);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [previewVideoId, setPreviewVideoId] = useState(null);

  // Synchronize local states when context updates from Supabase
  useEffect(() => {
    setLocalYouth(youthData);
    setLocalChoir(choirData);
    setLocalYoutube(youtubeData.songs || []);
  }, [youthData, choirData, youtubeData]);

  // Fetch leaderboard when quiz tab is active
  useEffect(() => {
    if (activeTab === 'quiz' && authenticated) {
      loadLeaderboard();
    }
  }, [activeTab, authenticated]);

  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const data = await fetchQuizLeaderboard(20);
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleClearLeaderboard = async () => {
    if (window.confirm('Are you sure you want to reset all quiz high scores in Supabase database?')) {
      await clearQuizLeaderboard();
      setLeaderboard([]);
      showToast('Leaderboard reset successfully in Supabase database!');
    }
  };

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput.trim() === '336676') {
      setAuthenticated(true);
      sessionStorage.setItem('sugam_admin_auth', 'true');
      setAuthError('');
    } else {
      setAuthError('Incorrect Admin PIN. Please try again.');
    }
  };

  const handleLogout = () => {
    setAuthenticated(false);
    sessionStorage.removeItem('sugam_admin_auth');
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateYouthData(localYouth),
        updateChoirData(localChoir),
        updateYouTubeData(localYoutube)
      ]);
      showToast('All changes saved directly to Supabase database! Live across all devices.');
    } catch (err) {
      showToast(err.message || 'Failed to save changes to Supabase', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- YOUTH ACTIONS ---
  const addYouthNotice = () => {
    setLocalYouth(prev => ({
      ...prev,
      notices: [...(prev.notices || []), 'New youth notice item']
    }));
  };

  const updateYouthNotice = (index, val) => {
    setLocalYouth(prev => ({
      ...prev,
      notices: (prev.notices || []).map((n, i) => (i === index ? val : n))
    }));
  };

  const removeYouthNotice = (index) => {
    setLocalYouth(prev => ({
      ...prev,
      notices: (prev.notices || []).filter((_, i) => i !== index)
    }));
  };

  const addYouthMonth = () => {
    setLocalYouth(prev => ({
      ...prev,
      months: [...(prev.months || []), { title: 'New Month Routine', rows: [{ date: '1', activity: 'Youth Fellowship' }] }]
    }));
  };

  const updateYouthMonthTitle = (mIdx, title) => {
    setLocalYouth(prev => ({
      ...prev,
      months: (prev.months || []).map((m, idx) => (idx === mIdx ? { ...m, title } : m))
    }));
  };

  const removeYouthMonth = (mIdx) => {
    setLocalYouth(prev => ({
      ...prev,
      months: (prev.months || []).filter((_, idx) => idx !== mIdx)
    }));
  };

  const addYouthRow = (mIdx) => {
    setLocalYouth(prev => ({
      ...prev,
      months: (prev.months || []).map((m, idx) => {
        if (idx !== mIdx) return m;
        return {
          ...m,
          rows: [...(m.rows || []), { date: '', activity: '' }]
        };
      })
    }));
  };

  const updateYouthRow = (mIdx, rIdx, field, val) => {
    setLocalYouth(prev => ({
      ...prev,
      months: (prev.months || []).map((m, idx) => {
        if (idx !== mIdx) return m;
        return {
          ...m,
          rows: (m.rows || []).map((row, i) => {
            if (i !== rIdx) return row;
            return { ...row, [field]: val };
          })
        };
      })
    }));
  };

  const removeYouthRow = (mIdx, rIdx) => {
    setLocalYouth(prev => ({
      ...prev,
      months: (prev.months || []).map((m, idx) => {
        if (idx !== mIdx) return m;
        return {
          ...m,
          rows: (m.rows || []).filter((_, i) => i !== rIdx)
        };
      })
    }));
  };

  const updateYouthLeader = (val) => {
    setLocalYouth(prev => ({
      ...prev,
      group: { ...(prev.group || {}), leader: val }
    }));
  };

  const addYouthTeam = () => {
    setLocalYouth(prev => ({
      ...prev,
      group: {
        ...(prev.group || {}),
        teams: [...((prev.group && prev.group.teams) || []), { captain: 'New Captain', members: [] }]
      }
    }));
  };

  const updateYouthTeamCaptain = (tIdx, captain) => {
    setLocalYouth(prev => ({
      ...prev,
      group: {
        ...(prev.group || {}),
        teams: (prev.group?.teams || []).map((t, idx) => (idx === tIdx ? { ...t, captain } : t))
      }
    }));
  };

  const updateYouthTeamMembers = (tIdx, memStr) => {
    const members = memStr.split(',').map(m => m.trim()).filter(Boolean);
    setLocalYouth(prev => ({
      ...prev,
      group: {
        ...(prev.group || {}),
        teams: (prev.group?.teams || []).map((t, idx) => (idx === tIdx ? { ...t, members } : t))
      }
    }));
  };

  const removeYouthTeam = (tIdx) => {
    setLocalYouth(prev => ({
      ...prev,
      group: {
        ...(prev.group || {}),
        teams: (prev.group?.teams || []).filter((_, idx) => idx !== tIdx)
      }
    }));
  };

  // --- CHOIR ACTIONS ---
  const addChoirNotice = () => {
    setLocalChoir(prev => ({
      ...prev,
      notices: [...(prev.notices || []), 'Choir notice item']
    }));
  };

  const updateChoirNotice = (index, val) => {
    setLocalChoir(prev => ({
      ...prev,
      notices: (prev.notices || []).map((n, i) => (i === index ? val : n))
    }));
  };

  const removeChoirNotice = (index) => {
    setLocalChoir(prev => ({
      ...prev,
      notices: (prev.notices || []).filter((_, i) => i !== index)
    }));
  };

  const addChoirMonth = () => {
    setLocalChoir(prev => ({
      ...prev,
      months: [...(prev.months || []), { name: 'New Month', dates: [{ date: '1', items: [{ time: '9:40 - 10:40', work: 'Choir practice' }] }] }]
    }));
  };

  const updateChoirMonthName = (mIdx, name) => {
    setLocalChoir(prev => ({
      ...prev,
      months: (prev.months || []).map((m, idx) => (idx === mIdx ? { ...m, name } : m))
    }));
  };

  const removeChoirMonth = (mIdx) => {
    setLocalChoir(prev => ({
      ...prev,
      months: (prev.months || []).filter((_, idx) => idx !== mIdx)
    }));
  };

  const addChoirDate = (mIdx) => {
    setLocalChoir(prev => ({
      ...prev,
      months: (prev.months || []).map((m, idx) => {
        if (idx !== mIdx) return m;
        return {
          ...m,
          dates: [...(m.dates || []), { date: '', items: [{ time: '9:40 - 10:40', work: 'Choir practice' }] }]
        };
      })
    }));
  };

  const updateChoirDateStr = (mIdx, dIdx, date) => {
    setLocalChoir(prev => ({
      ...prev,
      months: (prev.months || []).map((m, idx) => {
        if (idx !== mIdx) return m;
        return {
          ...m,
          dates: (m.dates || []).map((d, i) => (i === dIdx ? { ...d, date } : d))
        };
      })
    }));
  };

  const updateChoirItem = (mIdx, dIdx, iIdx, field, val) => {
    setLocalChoir(prev => ({
      ...prev,
      months: (prev.months || []).map((m, idx) => {
        if (idx !== mIdx) return m;
        return {
          ...m,
          dates: (m.dates || []).map((d, i) => {
            if (i !== dIdx) return d;
            const items = (d.items || []).map((it, itemIndex) => {
              if (itemIndex !== iIdx) return it;
              return { ...it, [field]: val };
            });
            if (items.length === 0) {
              items.push({ time: '', work: '', [field]: val });
            }
            return { ...d, items };
          })
        };
      })
    }));
  };

  const removeChoirDate = (mIdx, dIdx) => {
    setLocalChoir(prev => ({
      ...prev,
      months: (prev.months || []).map((m, idx) => {
        if (idx !== mIdx) return m;
        return {
          ...m,
          dates: (m.dates || []).filter((_, i) => i !== dIdx)
        };
      })
    }));
  };

  // --- YOUTUBE SONGS ACTIONS ---
  const addSong = () => {
    setLocalYoutube(prev => [
      ...prev,
      { name: 'New Worship Song', link: 'https://youtu.be/' }
    ]);
  };

  const updateSongField = (index, field, val) => {
    setLocalYoutube(prev =>
      prev.map((s, i) => (i === index ? { ...s, [field]: val } : s))
    );
  };

  const removeSong = (index) => {
    setLocalYoutube(prev => prev.filter((_, i) => i !== index));
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 pt-28">
        <div className="w-full max-w-sm church-glass-dark rounded-3xl p-8 border border-white/10 shadow-2xl text-center animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-400/30 text-sky-400 flex items-center justify-center mx-auto mb-4 glow-primary">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-white mb-1">Admin Portal</h2>
          <p className="text-xs text-slate-400 mb-6">Sugam Prathana Bhawan Database Console</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter Admin PIN"
                className="w-full px-4 py-3.5 bg-white/5 border border-white/15 rounded-2xl text-center text-base font-semibold tracking-widest focus:outline-none focus:border-sky-400 text-white transition-all"
                autoFocus
              />
              {authError && <p className="text-xs text-rose-400 mt-2 font-medium">{authError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-sky-600/30 hover:scale-[1.02]"
            >
              Unlock Database Console
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col pt-28 pb-16 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-fade-in-up ${
          toastMessage.type === 'error' 
            ? 'bg-rose-950 text-white border-rose-500/40' 
            : 'bg-slate-900 text-white border-sky-500/40'
        }`}>
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-6 rounded-3xl border border-sky-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Supabase DB
            </span>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              {dbStatus?.online ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{dbStatus.latency}ms latency</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-rose-500">Offline</span>
                </>
              )}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 mt-1">
            Church Content &amp; Schedule Manager
          </h1>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <button
            onClick={refreshData}
            disabled={globalLoading}
            className="p-2.5 bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700 rounded-xl transition"
            title="Reload from Supabase"
          >
            <RotateCw className={`w-4 h-4 ${globalLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving to Supabase...' : 'Save Live Changes'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Database Realtime Notification Banner */}
      <div className="mb-6 p-4 bg-gradient-to-r from-sky-900 via-sky-950 to-slate-900 text-white rounded-3xl shadow-sm border border-sky-800/60 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-400/20">
            <Database className="w-5 h-5" />
          </div>
          <div className="text-xs sm:text-sm">
            <p className="font-semibold text-sky-200">
              Supabase Real-Time Database Mode
            </p>
            <p className="text-slate-300 text-xs">
              All CRUD operations sync directly with your PostgreSQL database in the cloud and reflect on all devices worldwide instantly.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200/80 pb-3">
        <button
          onClick={() => setActiveTab('youth')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
            activeTab === 'youth' ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 scale-[1.02]' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Youth Routine</span>
        </button>

        <button
          onClick={() => setActiveTab('choir')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
            activeTab === 'choir' ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 scale-[1.02]' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Choir Routine</span>
        </button>

        <button
          onClick={() => setActiveTab('youtube')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
            activeTab === 'youtube' ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 scale-[1.02]' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <YoutubeIcon className="w-4 h-4" />
          <span>YouTube Songs</span>
        </button>

        <button
          onClick={() => setActiveTab('quiz')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
            activeTab === 'quiz' ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 scale-[1.02]' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Quiz Leaderboard</span>
        </button>
      </div>

      {/* 1. YOUTH ROUTINE TAB */}
      {activeTab === 'youth' && (
        <div className="space-y-6 animate-fade-in">
          {/* Notices */}
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>Youth Notices</span>
                <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">
                  {(localYouth.notices || []).length}
                </span>
              </h3>
              <button
                onClick={addYouthNotice}
                className="text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Notice</span>
              </button>
            </div>

            <div className="space-y-2">
              {(localYouth.notices || []).map((notice, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={notice}
                    onChange={(e) => updateYouthNotice(idx, e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-sky-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => removeYouthNotice(idx)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                    title="Delete notice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule Months */}
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Youth Schedule (Months &amp; Dates)</h3>
              <button
                onClick={addYouthMonth}
                className="text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Month</span>
              </button>
            </div>

            <div className="space-y-6">
              {(localYouth.months || []).map((month, mIdx) => (
                <div key={mIdx} className="p-5 rounded-2xl bg-sky-50/40 border border-sky-100 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      value={month.title}
                      onChange={(e) => updateYouthMonthTitle(mIdx, e.target.value)}
                      className="font-bold text-sm sm:text-base text-sky-950 bg-white px-3.5 py-1.5 rounded-xl border border-sky-200 shadow-2xs"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addYouthRow(mIdx)}
                        className="text-xs bg-white hover:bg-sky-100 text-sky-700 font-semibold px-3 py-1.5 rounded-xl border border-sky-200 flex items-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Row</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeYouthMonth(mIdx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                        title="Delete entire month"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(month.rows || []).map((row, rIdx) => (
                      <div key={rIdx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={row.date}
                          placeholder="Date (e.g. 6)"
                          onChange={(e) => updateYouthRow(mIdx, rIdx, 'date', e.target.value)}
                          className="w-24 px-3 py-2 bg-white border border-sky-100 rounded-xl text-xs sm:text-sm font-bold text-sky-900"
                        />
                        <input
                          type="text"
                          value={row.activity}
                          placeholder="Activity / Program Details"
                          onChange={(e) => updateYouthRow(mIdx, rIdx, 'activity', e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-sky-100 rounded-xl text-xs sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeYouthRow(mIdx, rIdx)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                          title="Delete this row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Youth Groups & Teams */}
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Youth Leadership &amp; Teams</h3>
              <button
                onClick={addYouthTeam}
                className="text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Team</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-sky-100 space-y-2">
              <label className="block text-xs font-bold text-slate-700">Youth Overall Leader</label>
              <input
                type="text"
                value={localYouth.group?.leader || ''}
                onChange={(e) => updateYouthLeader(e.target.value)}
                placeholder="Overall Youth Leader (e.g. Aryan Rai)"
                className="w-full px-3.5 py-2 bg-white border border-sky-100 rounded-xl text-xs sm:text-sm font-semibold text-slate-900"
              />
            </div>

            <div className="space-y-4">
              {(localYouth.group?.teams || []).map((team, tIdx) => (
                <div key={tIdx} className="p-4 bg-sky-50/30 rounded-2xl border border-sky-100 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={team.captain}
                      placeholder="Captain (e.g. SaraPoudel(Patrus))"
                      onChange={(e) => updateYouthTeamCaptain(tIdx, e.target.value)}
                      className="font-bold text-xs sm:text-sm text-sky-950 bg-white px-3 py-1.5 rounded-xl border border-sky-200 w-full sm:w-1/2"
                    />
                    <button
                      type="button"
                      onClick={() => removeYouthTeam(tIdx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                      title="Delete this team"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Members (comma-separated):</label>
                    <input
                      type="text"
                      value={(team.members || []).join(', ')}
                      placeholder="Member 1, Member 2, Member 3..."
                      onChange={(e) => updateYouthTeamMembers(tIdx, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-sky-100 rounded-xl text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. CHOIR ROUTINE TAB */}
      {activeTab === 'choir' && (
        <div className="space-y-6 animate-fade-in">
          {/* Notices */}
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Choir Notices</h3>
              <button
                onClick={addChoirNotice}
                className="text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Notice</span>
              </button>
            </div>

            <div className="space-y-2">
              {(localChoir.notices || []).map((notice, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={notice}
                    onChange={(e) => updateChoirNotice(idx, e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeChoirNotice(idx)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Choir Months */}
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Choir Practice Schedule</h3>
              <button
                onClick={addChoirMonth}
                className="text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Month</span>
              </button>
            </div>

            <div className="space-y-6">
              {(localChoir.months || []).map((month, mIdx) => (
                <div key={mIdx} className="p-5 rounded-2xl bg-sky-50/40 border border-sky-100 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      value={month.name}
                      onChange={(e) => updateChoirMonthName(mIdx, e.target.value)}
                      className="font-bold text-sm sm:text-base text-sky-950 bg-white px-3.5 py-1.5 rounded-xl border border-sky-200"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addChoirDate(mIdx)}
                        className="text-xs bg-white hover:bg-sky-100 text-sky-700 font-semibold px-3 py-1.5 rounded-xl border border-sky-200 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Date</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeChoirMonth(mIdx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                        title="Delete entire month"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(month.dates || []).map((day, dIdx) => (
                      <div key={dIdx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-white p-3 rounded-xl border border-sky-100">
                        <input
                          type="text"
                          value={day.date}
                          placeholder="Date"
                          onChange={(e) => updateChoirDateStr(mIdx, dIdx, e.target.value)}
                          className="w-20 px-2.5 py-1.5 bg-slate-50 border border-sky-100 rounded-lg text-xs font-bold text-sky-900"
                        />
                        <input
                          type="text"
                          value={day.items?.[0]?.time || ''}
                          placeholder="Time (e.g. 9:40 - 10:40)"
                          onChange={(e) => updateChoirItem(mIdx, dIdx, 0, 'time', e.target.value)}
                          className="w-36 px-2.5 py-1.5 bg-slate-50 border border-sky-100 rounded-lg text-xs font-semibold"
                        />
                        <input
                          type="text"
                          value={day.items?.[0]?.work || ''}
                          placeholder="Practice Activity"
                          onChange={(e) => updateChoirItem(mIdx, dIdx, 0, 'work', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-sky-100 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => removeChoirDate(mIdx, dIdx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          title="Delete this date"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. YOUTUBE SONGS TAB */}
      {activeTab === 'youtube' && (
        <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Choir Worship Songs (YouTube)</h3>
              <p className="text-xs text-slate-500">Live playback preview and link management</p>
            </div>
            <button
              onClick={addSong}
              className="text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold px-3.5 py-2 rounded-xl transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Worship Song</span>
            </button>
          </div>

          {/* Embedded YouTube preview if active */}
          {previewVideoId && (
            <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 text-white space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400">Live YouTube Player Preview</span>
                <button
                  onClick={() => setPreviewVideoId(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close Player ✕
                </button>
              </div>
              <div className="aspect-video w-full max-w-md mx-auto rounded-xl overflow-hidden shadow-lg">
                <iframe
                  src={`https://www.youtube.com/embed/${previewVideoId}?autoplay=1`}
                  title="YouTube video player"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {localYoutube.map((song, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-50 p-4 rounded-2xl border border-sky-100 hover:border-sky-300 transition">
                <input
                  type="text"
                  value={song.name}
                  placeholder="Song Title"
                  onChange={(e) => updateSongField(idx, 'name', e.target.value)}
                  className="w-full sm:w-1/3 px-3.5 py-2 bg-white border border-sky-100 rounded-xl text-xs sm:text-sm font-semibold"
                />
                <input
                  type="text"
                  value={song.link || ''}
                  placeholder="YouTube URL (https://youtu.be/...)"
                  onChange={(e) => updateSongField(idx, 'link', e.target.value)}
                  className="w-full sm:flex-1 px-3.5 py-2 bg-white border border-sky-100 rounded-xl text-xs sm:text-sm text-sky-700 font-mono"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  {song.videoId && (
                    <button
                      type="button"
                      onClick={() => setPreviewVideoId(song.videoId)}
                      className="p-2 text-sky-600 hover:bg-sky-100 rounded-xl transition"
                      title="Preview Video"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeSong(idx)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                    title="Delete this song"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. QUIZ LEADERBOARD TAB */}
      {activeTab === 'quiz' && (
        <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Bible Quiz Community Leaderboard</h3>
              <p className="text-xs text-slate-500">Live high scores submitted by church members</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadLeaderboard}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loadingLeaderboard ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleClearLeaderboard}
                className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Leaderboard</span>
              </button>
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs sm:text-sm">
              <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30 text-sky-500" />
              <p>No high scores recorded yet in Supabase database.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-3 pl-3">Rank</th>
                    <th className="pb-3">Player Name</th>
                    <th className="pb-3">Score</th>
                    <th className="pb-3">Best Streak</th>
                    <th className="pb-3 pr-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaderboard.map((entry, idx) => (
                    <tr key={entry.id || idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 pl-3 font-bold text-sky-700">
                        {idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`}
                      </td>
                      <td className="py-3.5 font-semibold text-slate-900">{entry.player_name}</td>
                      <td className="py-3.5 font-bold text-sky-600">{entry.score} pts</td>
                      <td className="py-3.5 text-amber-600 font-semibold">🔥 {entry.streak}x</td>
                      <td className="py-3.5 pr-3 text-slate-400 text-xs">
                        {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'Today'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
