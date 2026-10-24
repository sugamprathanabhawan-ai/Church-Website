import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Upload, 
  FileAudio, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Link as LinkIcon, 
  ExternalLink, 
  Sparkles, 
  BookOpen, 
  User, 
  Calendar, 
  Clock, 
  Search, 
  Flame, 
  Save, 
  X,
  Volume2,
  Headphones,
  Check
} from 'lucide-react';
import { SERMON_CATEGORIES, CATEGORY_LABELS } from '../utils/defaultSermons';
import { normalizeAudioUrl } from '../utils/dataSyncEngine';

const PREACHER_SUGGESTIONS = [
  'पास्टर किरण थापा (Senior Pastor Kiran Thapa)',
  'सह पास्टर दीपक थापा (Co-Pastor Deepak Thapa)',
  'एल्डर नरेश राई (Elder Naresh Rai)',
  'आर्यन राई (Youth Leader Aryan Rai)',
  'डिकन खड्क चौधरी (Deacon Khadka)',
  'डिकन बिलास पोख्रेल (Deacon Bilas)',
  'डिकन नरेन राई (Deacon Naren)',
  'अतिथि वक्ता (Guest Speaker)'
];

export default function AdminAudioSermonsTab({
  sermons = [],
  onSaveSermon,
  onDeleteSermon,
  onUploadAudio,
  showToast
}) {
  const [activeView, setActiveView] = useState('list'); // 'list' | 'create'
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Preview Player in Admin
  const [previewTrackId, setPreviewTrackId] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef(null);

  // Form State for Create / Edit
  const [editingId, setEditingId] = useState(null);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'url'
  const [title, setTitle] = useState('');
  const [speaker, setSpeaker] = useState('पास्टर किरण थापा (Senior Pastor Kiran Thapa)');
  const [category, setCategory] = useState('Sermon');
  const [scripture, setScripture] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [duration, setDuration] = useState('04:00');
  const [coverImage, setCoverImage] = useState('/images/img1.webp');
  const [description, setDescription] = useState('');
  const [datePreached, setDatePreached] = useState(new Date().toISOString().split('T')[0]);
  const [isFeatured, setIsFeatured] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset Form
  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSpeaker('पास्टर किरण थापा (Senior Pastor Kiran Thapa)');
    setCategory('Sermon');
    setScripture('');
    setAudioUrl('');
    setAudioFile(null);
    setDuration('04:00');
    setCoverImage('/images/img1.webp');
    setDescription('');
    setDatePreached(new Date().toISOString().split('T')[0]);
    setIsFeatured(false);
    setUploadMode('file');
  };

  // Open Create Mode
  const handleOpenCreate = () => {
    resetForm();
    setActiveView('create');
  };

  // Open Edit Mode
  const handleStartEdit = (sermon) => {
    setEditingId(sermon.id);
    setTitle(sermon.title || '');
    setSpeaker(sermon.speaker || '');
    setCategory(sermon.category || 'Sermon');
    setScripture(sermon.scripture || '');
    setAudioUrl(sermon.audio_url || '');
    setAudioFile(null);
    setDuration(sermon.duration || '04:00');
    setCoverImage(sermon.cover_image || '/images/img1.webp');
    setDescription(sermon.description || '');
    setDatePreached(sermon.date_preached || new Date().toISOString().split('T')[0]);
    setIsFeatured(Boolean(sermon.is_featured));
    setUploadMode('url');
    setActiveView('create');
  };

  // Handle Audio File Selection + Auto-calculate Duration
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFile(file);
    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(cleanName);
    }

    // Attempt to calculate duration via HTML5 Audio object
    try {
      const tempAudio = new Audio();
      tempAudio.src = URL.createObjectURL(file);
      tempAudio.addEventListener('loadedmetadata', () => {
        const secs = tempAudio.duration;
        if (!isNaN(secs) && secs > 0) {
          const m = Math.floor(secs / 60);
          const s = Math.floor(secs % 60);
          setDuration(`${m}:${s.toString().padStart(2, '0')}`);
        }
      });
    } catch (err) {
      console.warn('Could not read audio duration preview:', err);
    }
  };

  // In-admin audio preview player
  const handleTogglePreview = (sermon) => {
    if (previewTrackId === sermon.id && isPlayingPreview) {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      setPreviewTrackId(sermon.id);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = sermon.audio_url;
        previewAudioRef.current.play().then(() => {
          setIsPlayingPreview(true);
        }).catch((err) => {
          console.warn('Preview play error:', err);
          showToast('Could not play audio preview directly: ' + err.message, 'error');
        });
      }
    }
  };

  // Save or Update Sermon
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please enter a sermon title', 'error');
      return;
    }

    setSubmitting(true);
    try {
      let finalAudioUrl = audioUrl.trim();
      let fileName = '';
      let fileSize = 0;

      // If uploading an audio file
      if (uploadMode === 'file' && audioFile) {
        showToast('Uploading audio file to Supabase Storage...');
        const res = await onUploadAudio(audioFile);
        finalAudioUrl = res.fileUrl;
        fileName = res.fileName;
        fileSize = res.fileSize;
      } else {
        finalAudioUrl = normalizeAudioUrl(finalAudioUrl);
      }

      if (!finalAudioUrl) {
        showToast('Please upload an audio file or provide a streaming URL', 'error');
        setSubmitting(false);
        return;
      }

      const payload = {
        title: title.trim(),
        speaker: speaker.trim() || 'पास्टर (Pastor)',
        category,
        scripture: scripture.trim(),
        audio_url: finalAudioUrl,
        file_name: fileName,
        file_size: fileSize,
        duration: duration || '04:00',
        cover_image: coverImage || '/images/img1.webp',
        description: description.trim(),
        date_preached: datePreached,
        is_featured: isFeatured
      };

      if (editingId) {
        payload.id = editingId;
      }

      await onSaveSermon(payload);
      showToast(editingId ? 'Sermon updated successfully!' : 'New audio sermon added to landing page!');
      resetForm();
      setActiveView('list');
    } catch (err) {
      console.error('Failed to save audio sermon:', err);
      showToast('Failed to save sermon: ' + (err.message || 'Error occurred'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Sermon
  const handleDelete = async (sermon) => {
    if (!window.confirm(`Are you sure you want to delete "${sermon.title}"?`)) {
      return;
    }
    try {
      if (previewTrackId === sermon.id && previewAudioRef.current) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      }
      await onDeleteSermon(sermon.id);
      showToast(`Deleted "${sermon.title}" successfully`);
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete sermon: ' + err.message, 'error');
    }
  };

  // Filtered List
  const filteredList = (sermons || []).filter((s) => {
    const matchCat = categoryFilter === 'All' || (s.category || '').toLowerCase() === categoryFilter.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchQ = 
      !q || 
      (s.title || '').toLowerCase().includes(q) || 
      (s.speaker || '').toLowerCase().includes(q) || 
      (s.scripture || '').toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Hidden Audio Element for Admin In-Place Preview */}
      <audio 
        ref={previewAudioRef} 
        onEnded={() => setIsPlayingPreview(false)}
        onPause={() => setIsPlayingPreview(false)}
      />

      {/* View Switcher & Action Header */}
      <div className="bg-white rounded-3xl p-6 border border-[#d4e8ee] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-2xl bg-[#dceef5] text-[#214b60]">
              <Headphones className="w-5 h-5 text-[#285c73]" />
            </span>
            <h3 className="font-serif font-bold text-xl text-[#214b60]">
              Audio Sermons &amp; Bible Streaming Manager
            </h3>
            <span className="text-xs bg-[#dceef5] text-[#214b60] font-bold px-2.5 py-0.5 rounded-full">
              {(sermons || []).length} Recorded
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Upload MP3/M4A sermons or link streamable audio recordings. Automatically published to the landing page audio section.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeView === 'create' ? (
            <button
              type="button"
              onClick={() => { resetForm(); setActiveView('list'); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Back to List</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-[#285c73] hover:bg-[#214b60] text-white font-semibold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Upload / Add Sermon</span>
            </button>
          )}
        </div>
      </div>

      {/* CREATE / EDIT FORM */}
      {activeView === 'create' && (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 border border-[#d4e8ee] shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <h4 className="font-bold text-base text-[#214b60] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{editingId ? 'Edit Audio Sermon' : 'Upload New Audio Sermon / Bible Chapter'}</span>
            </h4>
            <span className="text-xs text-slate-400">Step 1: Details &amp; Audio Stream</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Title */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>Sermon Title / शीर्षक</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., विश्‍वास र प्रार्थनाको शक्ति (The Power of Faith & Prayer)"
                className="w-full px-4 py-2.5 bg-slate-50 border border-[#d4e8ee] rounded-xl text-xs sm:text-sm text-[#214b60] focus:outline-none focus:bg-white focus:border-[#285c73]"
              />
            </div>

            {/* Preacher / Speaker */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Preacher / Speaker (प्रवचक)</span>
              </label>
              <input
                type="text"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                placeholder="पास्टर किरण थापा"
                className="w-full px-4 py-2.5 bg-slate-50 border border-[#d4e8ee] rounded-xl text-xs sm:text-sm text-[#214b60] focus:outline-none focus:bg-white focus:border-[#285c73]"
              />
              {/* Quick Speaker Selector Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PREACHER_SUGGESTIONS.slice(0, 4).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSpeaker(p)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-[#dceef5] text-slate-600 transition"
                  >
                    {p.split(' ')[0]} {p.split(' ')[1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Scripture Reference */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>Scripture Reference (धर्मशास्त्र खण्ड)</span>
              </label>
              <input
                type="text"
                value={scripture}
                onChange={(e) => setScripture(e.target.value)}
                placeholder="e.g., भजनसंग्रह २३ (Psalm 23) or मत्ती ५:१-१२"
                className="w-full px-4 py-2.5 bg-slate-50 border border-[#d4e8ee] rounded-xl text-xs sm:text-sm text-[#214b60] focus:outline-none focus:bg-white focus:border-[#285c73]"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Category (श्रेणी)</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-[#d4e8ee] rounded-xl text-xs sm:text-sm text-[#214b60] focus:outline-none focus:bg-white focus:border-[#285c73]"
              >
                {SERMON_CATEGORIES.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
                ))}
              </select>
            </div>

            {/* Date Preached */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date Preached (प्रवचन मिति)</span>
              </label>
              <input
                type="date"
                value={datePreached}
                onChange={(e) => setDatePreached(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-[#d4e8ee] rounded-xl text-xs sm:text-sm text-[#214b60] focus:outline-none focus:bg-white focus:border-[#285c73]"
              />
            </div>

            {/* Description / Sermon Notes */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">
                Sermon Notes / Key Spiritual Takeaways (प्रवचन विवरण वा सारांश)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="मुख्य पदहरू, सारांश, वा चर्च सदस्यहरूका निम्ति प्रेरणादायी सन्देश..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-[#d4e8ee] rounded-xl text-xs sm:text-sm text-[#214b60] focus:outline-none focus:bg-white focus:border-[#285c73]"
              />
            </div>

            {/* Audio Source Selector */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-[#dceef5]/30 border border-[#d4e8ee] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileAudio className="w-4 h-4 text-[#285c73]" />
                  <span className="text-xs font-bold text-[#214b60] uppercase tracking-wider">
                    Audio Source File or URL
                  </span>
                </div>
                
                {/* Upload Mode Pill Tabs */}
                <div className="flex items-center bg-white p-1 rounded-xl border border-[#d4e8ee]">
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      uploadMode === 'file' 
                        ? 'bg-[#285c73] text-white shadow-2xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Upload File (.mp3)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('url')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      uploadMode === 'url' 
                        ? 'bg-[#285c73] text-white shadow-2xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Direct Audio URL
                  </button>
                </div>
              </div>

              {uploadMode === 'file' ? (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-[#d4e8ee] hover:border-[#285c73] rounded-2xl p-6 text-center bg-white transition cursor-pointer">
                    <input
                      type="file"
                      id="audio-file-input"
                      accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.mp4"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label htmlFor="audio-file-input" className="cursor-pointer block space-y-2">
                      <div className="w-12 h-12 rounded-full bg-[#dceef5] text-[#285c73] mx-auto flex items-center justify-center">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-bold text-[#214b60]">
                        {audioFile ? audioFile.name : 'Click to select audio file from your device'}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Supports MP3, M4A, AAC, WAV up to 100MB • Auto-detects audio duration
                      </p>
                      {audioFile && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                          <Check className="w-3.5 h-3.5" />
                          <span>Ready: {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • Duration: {duration}</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#214b60] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Archive.org / Direct Streaming URL</span>
                    </label>
                    <a
                      href="https://archive.org/upload/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#285c73] hover:text-[#214b60] bg-white px-2.5 py-1 rounded-lg border border-[#d4e8ee] shadow-2xs hover:border-[#285c73] transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Upload to Archive.org (Free)</span>
                    </a>
                  </div>

                  <div className="relative">
                    <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={audioUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        const norm = normalizeAudioUrl(val);
                        setAudioUrl(norm);
                      }}
                      placeholder="e.g. https://archive.org/details/sugam-sermons-2026/sermon.mp3"
                      className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#d4e8ee] rounded-xl text-xs sm:text-sm text-[#214b60] focus:outline-none focus:border-[#285c73]"
                    />
                  </div>

                  {/* Archive.org Quick Guide Box */}
                  <div className="p-3.5 rounded-xl bg-white border border-[#d4e8ee] space-y-2 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5 font-bold text-[#214b60]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Archive.org Recommended Workflow (Free &amp; Unlimited Bandwidth):</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
                      <li>Upload your church audio MP3 to <a href="https://archive.org/upload/" target="_blank" rel="noopener noreferrer" className="text-[#285c73] underline font-semibold">archive.org/upload</a>.</li>
                      <li>Copy the item link (e.g. <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-slate-800">archive.org/details/your-sermon</code>) and paste it above.</li>
                      <li>Our system automatically converts it into a permanent, high-speed audio stream link for all congregation members.</li>
                    </ol>
                    <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-100 flex items-center justify-between">
                      <span>✓ Auto-converts Archive.org, Dropbox &amp; Direct links</span>
                      <span className="text-amber-600">⚠️ Avoid Google Drive (blocks streaming with quota errors)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Duration & Spotlight row */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-600 font-medium">Duration:</span>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="04:30"
                    className="w-20 px-2.5 py-1 bg-white border border-[#d4e8ee] rounded-lg text-xs font-mono text-center text-[#214b60]"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-[#285c73] focus:ring-[#285c73]"
                  />
                  <span className="text-xs font-bold text-[#214b60] flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    <span>Feature as Spotlight Sermon on Landing Page</span>
                  </span>
                </label>
              </div>

            </div>

          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { resetForm(); setActiveView('list'); }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#285c73] hover:bg-[#214b60] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Saving to Database...' : editingId ? 'Update Sermon' : 'Publish to Website'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SERMONS MANAGEMENT TABLE / LIST */}
      {activeView === 'list' && (
        <div className="bg-white rounded-3xl p-6 border border-[#d4e8ee] shadow-sm space-y-4">
          
          {/* Search & Filter Header */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {SERMON_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    categoryFilter === cat
                      ? 'bg-[#285c73] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sermons or preacher..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-[#d4e8ee] rounded-xl text-xs text-[#214b60] focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          {/* List Table */}
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No audio sermons found. Click &quot;Upload / Add Sermon&quot; to add your first recording.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredList.map((sermon) => {
                const isPlayingThis = previewTrackId === sermon.id && isPlayingPreview;
                return (
                  <div key={sermon.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/80 px-3 rounded-2xl transition">
                    
                    {/* Left: Play preview button + metadata */}
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleTogglePreview(sermon)}
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition shadow-2xs ${
                          isPlayingThis
                            ? 'bg-cyan-500 text-white animate-pulse'
                            : 'bg-[#dceef5] hover:bg-[#285c73] text-[#285c73] hover:text-white'
                        }`}
                        title={isPlayingThis ? 'Pause preview' : 'Play audio preview'}
                      >
                        {isPlayingThis ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-[#214b60]">
                            {sermon.title}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#dceef5] text-[#214b60]">
                            {CATEGORY_LABELS[sermon.category] || sermon.category}
                          </span>
                          {sermon.is_featured && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              <Flame className="w-3 h-3 text-amber-500" />
                              <span>Featured</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{sermon.speaker || 'Pastor'}</span>
                          </span>
                          {sermon.scripture && (
                            <span className="flex items-center gap-1 text-amber-700 font-medium">
                              <BookOpen className="w-3 h-3 text-amber-600" />
                              <span>{sermon.scripture}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>{sermon.duration || '04:00'}</span>
                          </span>
                          {sermon.date_preached && (
                            <span className="text-[11px] text-slate-400">
                              {sermon.date_preached}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 self-end md:self-center">
                      {sermon.audio_url && (
                        <a
                          href={sermon.audio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-[#285c73] hover:bg-[#dceef5]/50 rounded-xl transition"
                          title="Open audio link in new tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleStartEdit(sermon)}
                        className="p-2 text-slate-400 hover:text-[#285c73] hover:bg-[#dceef5]/50 rounded-xl transition"
                        title="Edit sermon details"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(sermon)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="Delete sermon"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
