import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Database,
  Wifi,
  WifiOff,
  Play,
  Trophy,
  AlertCircle,
  FileText,
  Upload,
  ExternalLink,
  FileUp,
  Globe,
  Image as ImageIcon,
  Edit2,
  Camera,
  Layers,
  Link as LinkIcon,
  RotateCcw,
  Copy,
  Check,
  X,
  ShieldCheck
} from 'lucide-react';
import { 
  fetchQuizLeaderboard, 
  clearQuizLeaderboard, 
  uploadChurchDocumentFile,
  DEFAULT_WEBSITE_PICTURES 
} from '../services/supabaseService';

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
    documents,
    websitePictures,
    updateYouthData, 
    updateChoirData, 
    updateYouTubeData,
    addDocument,
    deleteDocument,
    updateWebsitePictures,
    uploadWebsiteImage,
    refreshData,
    loading: globalLoading,
    dbStatus
  } = useData();

  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem('sugam_admin_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');
  
  // URL tab support (e.g. /admin?tab=photos)
  const searchParams = new URLSearchParams(window.location.search);
  const paramTab = searchParams.get('tab');
  const validTabs = ['youth', 'choir', 'youtube', 'quiz', 'documents', 'photos'];
  const [activeTab, setActiveTab] = useState(validTabs.includes(paramTab) ? paramTab : 'youth');

  const [toastMessage, setToastMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  // Local state copies for live editing
  const [localYouth, setLocalYouth] = useState(youthData);
  const [localChoir, setLocalChoir] = useState(choirData);
  const [localYoutube, setLocalYoutube] = useState(youtubeData.songs || []);
  const [localPictures, setLocalPictures] = useState(websitePictures || DEFAULT_WEBSITE_PICTURES);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [previewVideoId, setPreviewVideoId] = useState(null);

  // PDF Documents state
  const [docFilter, setDocFilter] = useState('all'); // 'all', 'calendar', 'laws', 'choir'
  const [newDocSection, setNewDocSection] = useState('calendar');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocFile, setNewDocFile] = useState(null);
  const [docUploadMode, setDocUploadMode] = useState('file'); // 'file' or 'url'
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Website Pictures state
  const [photoCategory, setPhotoCategory] = useState('all'); // 'all', 'carousel', 'gallery', 'leaders'
  const [showAddPhotoModal, setShowAddPhotoModal] = useState(false);
  const [newPhotoCategory, setNewPhotoCategory] = useState('gallery'); // 'carousel', 'gallery', 'leaders'
  const [newPhotoTitle, setNewPhotoTitle] = useState('');
  const [newPhotoRole, setNewPhotoRole] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [photoUploadMode, setPhotoUploadMode] = useState('file'); // 'file' or 'url'
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const SQL_FIX_SCRIPT = `-- SUGAM PRATHANA BHAWAN & ZEN SYNC - DATABASE RLS & STORAGE FIX
-- 1. Upgrade sessions table for Zen Sync
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS device_name TEXT DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS main_signature TEXT DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS helper_signature TEXT DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS helper_device_info JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Public can insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Public can update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Public can delete sessions" ON public.sessions;
CREATE POLICY "Public can read sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Public can insert sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update sessions" ON public.sessions FOR UPDATE USING (true);
CREATE POLICY "Public can delete sessions" ON public.sessions FOR DELETE USING (true);

-- 2. Unlock all content tables for Admin updates
DO $$ 
DECLARE
    tbl text;
    content_tables text[] := ARRAY[
        'church_settings',
        'youth_notices', 
        'youth_schedules', 
        'youth_groups', 
        'choir_notices', 
        'choir_schedules', 
        'choir_layouts', 
        'youtube_songs', 
        'church_documents',
        'quiz_questions', 
        'quiz_leaderboard',
        'faq_items'
    ];
BEGIN
    FOREACH tbl IN ARRAY content_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Read Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Insert Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Update Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Public Delete Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Authenticated Insert Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Authenticated Update Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Authenticated Delete Access" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON public.%I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon" ON public.%I;', tbl);
            EXECUTE format('CREATE POLICY "Allow public read on %I" ON public.%I FOR SELECT USING (true);', tbl, tbl);
            EXECUTE format('CREATE POLICY "Allow public insert on %I" ON public.%I FOR INSERT WITH CHECK (true);', tbl, tbl);
            EXECUTE format('CREATE POLICY "Allow public update on %I" ON public.%I FOR UPDATE USING (true);', tbl, tbl);
            EXECUTE format('CREATE POLICY "Allow public delete on %I" ON public.%I FOR DELETE USING (true);', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- 3. Storage Buckets (church_documents and zen_sync_images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('church_documents', 'church_documents', true, 26214400, ARRAY['application/pdf', 'application/x-pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    ('zen_sync_images', 'zen_sync_images', true, 26214400, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 26214400;

DROP POLICY IF EXISTS "Public Read Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Documents" ON storage.objects;
CREATE POLICY "Public Read Documents" ON storage.objects FOR SELECT USING (bucket_id IN ('church_documents', 'zen_sync_images'));
CREATE POLICY "Public Upload Documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('church_documents', 'zen_sync_images'));
CREATE POLICY "Public Update Documents" ON storage.objects FOR UPDATE USING (bucket_id IN ('church_documents', 'zen_sync_images'));
CREATE POLICY "Public Delete Documents" ON storage.objects FOR DELETE USING (bucket_id IN ('church_documents', 'zen_sync_images'));

NOTIFY pgrst, 'reload schema';`;

  // Synchronize local states when context updates from Supabase
  useEffect(() => {
    setLocalYouth(youthData);
    setLocalChoir(choirData);
    setLocalYoutube(youtubeData.songs || []);
    if (websitePictures) {
      setLocalPictures(websitePictures);
    }
  }, [youthData, choirData, youtubeData, websitePictures]);

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

  // Support both 336676 and 2244 for admin authentication
  const handleLogin = (e) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();
    if (cleanPin === '336676' || cleanPin === '2244') {
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
        updateYouTubeData(localYoutube),
        updateWebsitePictures(localPictures)
      ]);
      showToast('All changes saved directly to Supabase database! Live across all devices.');
    } catch (err) {
      showToast(err.message || 'Failed to save changes to Supabase', 'error');
      if (err?.message && (err.message.includes('RLS') || err.message.includes('Permission') || err.message.includes('policy'))) {
        setShowSqlModal(true);
      }
    } finally {
      setSaving(false);
    }
  };

  // --- PHOTO & GALLERY ACTIONS ---
  const handleAddPhoto = async (e) => {
    if (e) e.preventDefault();
    setUploadingPhoto(true);
    try {
      let finalUrl = newPhotoUrl.trim();
      if (photoUploadMode === 'file' && newPhotoFile) {
        finalUrl = await uploadWebsiteImage(newPhotoFile);
      }
      if (!finalUrl) {
        showToast('Please upload an image file or enter an image URL', 'error');
        return;
      }

      const newId = 'pic_' + Date.now();
      const updated = { ...localPictures };

      if (newPhotoCategory === 'carousel') {
        const item = {
          id: newId,
          image: finalUrl,
          text: newPhotoTitle.trim() || 'Church Fellowship'
        };
        updated.carousel = [item, ...(updated.carousel || [])];
      } else if (newPhotoCategory === 'gallery') {
        const item = {
          id: newId,
          src: finalUrl,
          caption: newPhotoTitle.trim() || 'Church Moment'
        };
        updated.gallery = [item, ...(updated.gallery || [])];
      } else if (newPhotoCategory === 'leaders') {
        const item = {
          id: newId,
          name: newPhotoTitle.trim() || 'Leader Name',
          role: newPhotoRole.trim() || 'Servant Leader',
          image: finalUrl
        };
        updated.leaders = [...(updated.leaders || []), item];
      }

      setLocalPictures(updated);
      await updateWebsitePictures(updated);
      showToast('Picture added and saved to website successfully!');
      setShowAddPhotoModal(false);
      setNewPhotoTitle('');
      setNewPhotoRole('');
      setNewPhotoUrl('');
      setNewPhotoFile(null);
    } catch (err) {
      console.error('Error adding photo:', err);
      showToast(err.message || 'Failed to add photo', 'error');
      if (err?.message && (err.message.includes('RLS') || err.message.includes('Permission') || err.message.includes('policy'))) {
        setShowSqlModal(true);
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (category, id) => {
    if (!window.confirm('Are you sure you want to delete this picture from the website?')) return;
    try {
      const updated = { ...localPictures };
      if (category === 'carousel') {
        updated.carousel = (updated.carousel || []).filter(item => item.id !== id);
      } else if (category === 'gallery') {
        updated.gallery = (updated.gallery || []).filter(item => item.id !== id);
      } else if (category === 'leaders') {
        updated.leaders = (updated.leaders || []).filter(item => item.id !== id);
      }
      setLocalPictures(updated);
      await updateWebsitePictures(updated);
      showToast('Picture deleted successfully from website!');
    } catch (err) {
      showToast(err.message || 'Failed to delete picture', 'error');
    }
  };

  const handleUpdatePhoto = async (e) => {
    if (e) e.preventDefault();
    if (!editingPhoto) return;
    setUploadingPhoto(true);
    try {
      let finalUrl = editingPhoto.url.trim();
      if (editingPhoto.newFile) {
        finalUrl = await uploadWebsiteImage(editingPhoto.newFile);
      }

      const updated = { ...localPictures };
      if (editingPhoto.category === 'carousel') {
        updated.carousel = (updated.carousel || []).map(item =>
          item.id === editingPhoto.id ? { ...item, image: finalUrl, text: editingPhoto.title } : item
        );
      } else if (editingPhoto.category === 'gallery') {
        updated.gallery = (updated.gallery || []).map(item =>
          item.id === editingPhoto.id ? { ...item, src: finalUrl, caption: editingPhoto.title } : item
        );
      } else if (editingPhoto.category === 'leaders') {
        updated.leaders = (updated.leaders || []).map(item =>
          item.id === editingPhoto.id ? { ...item, image: finalUrl, name: editingPhoto.title, role: editingPhoto.role } : item
        );
      }

      setLocalPictures(updated);
      await updateWebsitePictures(updated);
      showToast('Picture updated successfully!');
      setEditingPhoto(null);
    } catch (err) {
      showToast(err.message || 'Failed to update picture', 'error');
      if (err?.message && (err.message.includes('RLS') || err.message.includes('Permission') || err.message.includes('policy'))) {
        setShowSqlModal(true);
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleResetPictures = async () => {
    if (!window.confirm('Reset all website pictures to default church photos? This will restore original slider, gallery, and leader photos.')) return;
    try {
      setLocalPictures(DEFAULT_WEBSITE_PICTURES);
      await updateWebsitePictures(DEFAULT_WEBSITE_PICTURES);
      showToast('All website pictures reset to default church photos!');
    } catch (err) {
      showToast(err.message || 'Failed to reset pictures', 'error');
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
      group: { ...prev.group, leader: val }
    }));
  };

  const addYouthTeam = () => {
    setLocalYouth(prev => ({
      ...prev,
      group: {
        ...prev.group,
        teams: [...(prev.group?.teams || []), { captain: 'New Captain', members: [] }]
      }
    }));
  };

  const updateYouthTeamCaptain = (tIdx, captain) => {
    setLocalYouth(prev => ({
      ...prev,
      group: {
        ...prev.group,
        teams: (prev.group?.teams || []).map((t, idx) => (idx === tIdx ? { ...t, captain } : t))
      }
    }));
  };

  const updateYouthTeamMembers = (tIdx, memStr) => {
    const members = memStr.split(',').map(m => m.trim()).filter(Boolean);
    setLocalYouth(prev => ({
      ...prev,
      group: {
        ...prev.group,
        teams: (prev.group?.teams || []).map((t, idx) => (idx === tIdx ? { ...t, members } : t))
      }
    }));
  };

  const removeYouthTeam = (tIdx) => {
    setLocalYouth(prev => ({
      ...prev,
      group: {
        ...prev.group,
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

  // --- PDF DOCUMENTS ACTIONS ---
  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!newDocTitle.trim()) {
      showToast('Please enter a document title', 'error');
      return;
    }

    setUploadingDoc(true);
    try {
      let finalUrl = newDocUrl.trim();
      let fileName = newDocTitle.trim() + '.pdf';
      let fileSize = 0;

      if (docUploadMode === 'file') {
        if (!newDocFile) {
          showToast('Please select a PDF file to upload', 'error');
          setUploadingDoc(false);
          return;
        }
        const uploadResult = await uploadChurchDocumentFile(newDocFile);
        finalUrl = uploadResult.fileUrl;
        fileName = uploadResult.fileName;
        fileSize = uploadResult.fileSize;
      } else {
        if (!finalUrl) {
          showToast('Please enter a valid file URL or path', 'error');
          setUploadingDoc(false);
          return;
        }
      }

      await addDocument({
        section: newDocSection,
        title: newDocTitle.trim(),
        fileUrl: finalUrl,
        fileName,
        fileSize
      });

      setNewDocTitle('');
      setNewDocUrl('');
      setNewDocFile(null);
      showToast(`Document "${newDocTitle.trim()}" added to ${newDocSection} successfully!`);
    } catch (err) {
      console.error('Failed to add document:', err);
      showToast('Failed to add document: ' + (err.message || 'Error occurred'), 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (id, section, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title || 'this document'}" from ${section}?`)) {
      return;
    }
    try {
      await deleteDocument(id, section);
      showToast(`Deleted "${title}" successfully`);
    } catch (err) {
      console.error('Failed to delete document:', err);
      showToast('Failed to delete document: ' + (err.message || 'Error occurred'), 'error');
    }
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

  const allDocsList = [
    ...(documents?.calendar || []).map(d => ({ ...d, section: 'calendar' })),
    ...(documents?.laws || []).map(d => ({ ...d, section: 'laws' })),
    ...(documents?.choir || []).map(d => ({ ...d, section: 'choir' }))
  ];
  const filteredDocsList = docFilter === 'all' 
    ? allDocsList 
    : allDocsList.filter(d => (d.section || '').toLowerCase() === docFilter);

  const carouselItems = (localPictures?.carousel || []).map(item => ({
    id: item.id,
    category: 'carousel',
    categoryLabel: 'Hero Slider',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    title: item.text || 'Hero Slide',
    image: item.image,
    role: null,
  }));

  const galleryItems = (localPictures?.gallery || []).map(item => ({
    id: item.id,
    category: 'gallery',
    categoryLabel: 'Photo Gallery',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    title: item.caption || 'Gallery Photo',
    image: item.src,
    role: null,
  }));

  const leaderItems = (localPictures?.leaders || []).map(item => ({
    id: item.id,
    category: 'leaders',
    categoryLabel: 'Leadership',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    title: item.name || 'Leader Name',
    image: item.image,
    role: item.role || 'Servant Leader',
  }));

  const allPhotosList = [...carouselItems, ...galleryItems, ...leaderItems];
  const filteredPhotosList = photoCategory === 'all'
    ? allPhotosList
    : photoCategory === 'carousel'
    ? carouselItems
    : photoCategory === 'gallery'
    ? galleryItems
    : leaderItems;

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
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-xl text-xs font-semibold transition"
            title="View live website"
          >
            <Globe className="w-3.5 h-3.5 text-sky-600" />
            <span className="hidden sm:inline">View Website</span>
          </Link>

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

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowSqlModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 hover:text-white rounded-xl text-xs font-semibold border border-sky-400/30 transition shadow-sm"
            title="View Supabase SQL database sync script"
          >
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span>Database SQL Script</span>
          </button>
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

        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
            activeTab === 'documents' ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 scale-[1.02]' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>PDF Documents</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === 'documents' ? 'bg-sky-500 text-white' : 'bg-sky-100 text-sky-700'
          }`}>
            {allDocsList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('photos')}
          className={`px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
            activeTab === 'photos' ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 scale-[1.02]' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Photos & Gallery</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === 'photos' ? 'bg-sky-500 text-white' : 'bg-sky-100 text-sky-700'
          }`}>
            {(localPictures?.carousel?.length || 0) + (localPictures?.gallery?.length || 0) + (localPictures?.leaders?.length || 0)}
          </span>
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

      {/* 5. PDF DOCUMENTS TAB */}
      {activeTab === 'documents' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Card & Section Filter Pills */}
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-sky-600" />
                  <span>Church PDF Documents Repository</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Upload, manage, and delete official church PDF files for Calendar, Laws, and Choir sections.
                </p>
              </div>

              {/* Section Filters */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60">
                {[
                  { id: 'all', label: 'All Documents', count: allDocsList.length },
                  { id: 'calendar', label: 'Church Calendar', count: (documents?.calendar || []).length },
                  { id: 'laws', label: 'Church Laws', count: (documents?.laws || []).length },
                  { id: 'choir', label: 'Choir Resources', count: (documents?.choir || []).length }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDocFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      docFilter === tab.id
                        ? 'bg-white text-sky-800 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-700">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Add New Document Card */}
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <FileUp className="w-4 h-4 text-sky-600" />
              <span>Add New PDF to Section</span>
            </h4>

            <form onSubmit={handleAddDocument} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Target Section */}
                <div>
                  <label htmlFor="doc-section-select" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Target Section:
                  </label>
                  <select
                    id="doc-section-select"
                    value={newDocSection}
                    onChange={(e) => setNewDocSection(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="calendar">Church Calendar (/calendar)</option>
                    <option value="laws">Church Laws & Governance (/laws)</option>
                    <option value="choir">Choir Songbook & Resources (/choir)</option>
                  </select>
                </div>

                {/* Document Title */}
                <div className="sm:col-span-2">
                  <label htmlFor="doc-title-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Document Title / Display Name:
                  </label>
                  <input
                    id="doc-title-input"
                    type="text"
                    value={newDocTitle}
                    onChange={(e) => setNewDocTitle(e.target.value)}
                    placeholder="e.g. Annual Church Calendar 2026, Choir Practice Guidelines"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              </div>

              {/* Upload Mode Selector */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs font-bold text-slate-700">Source:</span>
                <button
                  type="button"
                  onClick={() => setDocUploadMode('file')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    docUploadMode === 'file'
                      ? 'bg-sky-100 text-sky-800 border border-sky-300 font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Upload Local File (.pdf)
                </button>
                <button
                  type="button"
                  onClick={() => setDocUploadMode('url')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    docUploadMode === 'url'
                      ? 'bg-sky-100 text-sky-800 border border-sky-300 font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Enter File URL / Path
                </button>
              </div>

              {/* File Upload Box */}
              {docUploadMode === 'file' ? (
                <div className="border-2 border-dashed border-sky-200 hover:border-sky-400 bg-sky-50/40 rounded-2xl p-5 text-center transition-colors">
                  <input
                    type="file"
                    id="doc-file-input"
                    accept=".pdf,application/pdf,image/png,image/jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewDocFile(file);
                        if (!newDocTitle.trim()) {
                          setNewDocTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
                        }
                      }
                    }}
                    className="hidden"
                  />
                  <label htmlFor="doc-file-input" className="cursor-pointer block">
                    <Upload className="w-8 h-8 text-sky-500 mx-auto mb-2" />
                    {newDocFile ? (
                      <div>
                        <p className="text-sm font-bold text-sky-950">{newDocFile.name}</p>
                        <p className="text-xs text-sky-700 mt-0.5">
                          {(newDocFile.size / 1024).toFixed(1)} KB • Click to choose another file
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-slate-700">
                          Click to select a PDF document from your device
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">Supports PDF files (up to 25MB)</p>
                      </div>
                    )}
                  </label>
                </div>
              ) : (
                <div>
                  <label htmlFor="doc-url-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                    File URL or Path (e.g. /calender/calender.pdf or https://...):
                  </label>
                  <input
                    id="doc-url-input"
                    type="text"
                    value={newDocUrl}
                    onChange={(e) => setNewDocUrl(e.target.value)}
                    placeholder="https://... or /calender/calender.pdf"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={uploadingDoc || !newDocTitle.trim()}
                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-md flex items-center gap-2 hover:scale-[1.02]"
                >
                  <Plus className="w-4 h-4" />
                  <span>{uploadingDoc ? 'Uploading Document...' : 'Add Document to Section'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Current Documents List */}
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <span>Active Documents</span>
                <span className="text-xs bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-full">
                  {filteredDocsList.length}
                </span>
              </h4>
              <span className="text-xs text-slate-400">
                {docFilter === 'all' ? 'All Sections' : `Section: ${docFilter}`}
              </span>
            </div>

            {filteredDocsList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs sm:text-sm">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 text-sky-500" />
                <p>No documents uploaded in this section yet.</p>
                <p className="text-slate-400 text-xs mt-1">Use the form above to add your first PDF document.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDocsList.map((doc) => {
                  const sectionBadge = {
                    calendar: { label: 'Calendar', bg: 'bg-amber-100 text-amber-900 border-amber-200' },
                    laws: { label: 'Church Laws', bg: 'bg-sky-100 text-sky-900 border-sky-200' },
                    choir: { label: 'Choir Resource', bg: 'bg-purple-100 text-purple-900 border-purple-200' }
                  }[doc.section] || { label: doc.section, bg: 'bg-slate-100 text-slate-800 border-slate-200' };

                  return (
                    <div
                      key={doc.id}
                      className="p-4 rounded-2xl border border-sky-100 bg-slate-50/50 hover:bg-white hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${sectionBadge.bg}`}>
                            {sectionBadge.label}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                        <h5 className="font-bold text-sm text-slate-900 group-hover:text-sky-900 transition-colors">
                          {doc.title || doc.name}
                        </h5>
                        <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">
                          {doc.fileName || doc.file || doc.fileUrl}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200/60 pt-3 mt-1">
                        <a
                          href={doc.fileUrl || doc.file}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open / View</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id, doc.section, doc.title || doc.name)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition flex items-center gap-1 hover:scale-105"
                          title="Delete PDF document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 6. WEBSITE PHOTOS & GALLERY TAB */}
      {activeTab === 'photos' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Card & Category Filter Pills */}
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <Camera className="w-5 h-5 text-sky-600" />
                  <span>Website Pictures &amp; Gallery Manager</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Manage hero carousel slider photos, church photo gallery, and leadership profiles across the whole website.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResetPictures}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold transition flex items-center gap-1.5"
                  title="Restore default church website photos"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddPhotoModal(true)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-sky-600/20 transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Picture</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60">
              {[
                { id: 'all', label: 'All Pictures', count: allPhotosList.length },
                { id: 'carousel', label: 'Hero Home Slider', count: carouselItems.length },
                { id: 'gallery', label: 'Church Gallery', count: galleryItems.length },
                { id: 'leaders', label: 'Leadership Profiles', count: leaderItems.length }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPhotoCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    photoCategory === tab.id
                      ? 'bg-white text-sky-800 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-700 font-bold">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Picture Grid Display */}
          <div className="space-y-4">
            {filteredPhotosList.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-sky-200 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-base">No pictures found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  There are no photos currently added in this category. Click &quot;Add Picture&quot; above to upload or link an image.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddPhotoModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-500 shadow-md transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Picture</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredPhotosList.map((pic) => (
                  <div
                    key={pic.category + '-' + pic.id}
                    className="bg-white rounded-2xl border border-slate-200/80 hover:border-sky-300 hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                  >
                    {/* Image Thumbnail */}
                    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                      <img
                        src={pic.image}
                        alt={pic.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/pic/logos.webp';
                        }}
                      />
                      <span className={`absolute top-2 left-2 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border backdrop-blur-md bg-white/95 shadow-xs ${pic.badgeColor}`}>
                        {pic.categoryLabel}
                      </span>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h5 className="font-bold text-sm text-slate-900 line-clamp-1 group-hover:text-sky-700 transition-colors" title={pic.title}>
                          {pic.title}
                        </h5>
                        {pic.role && (
                          <p className="text-xs text-emerald-600 font-semibold truncate mt-0.5">
                            {pic.role}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 font-mono truncate mt-1" title={pic.image}>
                          {pic.image}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3">
                        <button
                          type="button"
                          onClick={() => setEditingPhoto({
                            id: pic.id,
                            category: pic.category,
                            title: pic.title,
                            role: pic.role || '',
                            url: pic.image,
                            newFile: null
                          })}
                          className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 hover:underline"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(pic.category, pic.id)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition flex items-center gap-1 hover:scale-105"
                          title="Delete picture from website"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ADD PHOTO MODAL */}
      {showAddPhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-sky-100 space-y-5 animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">Add New Website Picture</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPhotoModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPhoto} className="space-y-4">
              <div>
                <label htmlFor="new-photo-category-select" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Placement / Category:
                </label>
                <select
                  id="new-photo-category-select"
                  value={newPhotoCategory}
                  onChange={(e) => setNewPhotoCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  <option value="carousel">Hero Home Slider (Carousel)</option>
                  <option value="gallery">Church Photo Gallery (Home Grid)</option>
                  <option value="leaders">Church Leadership Profile</option>
                </select>
              </div>

              <div>
                <label htmlFor="new-photo-title-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                  {newPhotoCategory === 'leaders' ? 'Leader Full Name:' : 'Caption / Title Text:'}
                </label>
                <input
                  id="new-photo-title-input"
                  type="text"
                  value={newPhotoTitle}
                  onChange={(e) => setNewPhotoTitle(e.target.value)}
                  placeholder={newPhotoCategory === 'leaders' ? 'e.g. Aryan Rai, Pastor David...' : 'e.g. Fellowship Gathering, Youth Conference...'}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              {newPhotoCategory === 'leaders' && (
                <div>
                  <label htmlFor="new-photo-role-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Leader Ministry Role / Title:
                  </label>
                  <input
                    id="new-photo-role-input"
                    type="text"
                    value={newPhotoRole}
                    onChange={(e) => setNewPhotoRole(e.target.value)}
                    placeholder="e.g. Youth Leader, Senior Pastor, Choir Director"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              )}

              {/* Mode switch: File vs URL */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Image Source:</span>
                  <button
                    type="button"
                    onClick={() => setPhotoUploadMode('file')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      photoUploadMode === 'file'
                        ? 'bg-sky-100 text-sky-800 border border-sky-300 font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoUploadMode('url')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      photoUploadMode === 'url'
                        ? 'bg-sky-100 text-sky-800 border border-sky-300 font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Image URL / Path
                  </button>
                </div>

                {photoUploadMode === 'file' ? (
                  <div className="border-2 border-dashed border-sky-200 hover:border-sky-400 bg-sky-50/40 rounded-2xl p-5 text-center transition-colors">
                    <input
                      type="file"
                      id="photo-file-input"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewPhotoFile(file);
                          setNewPhotoUrl('');
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="photo-file-input" className="cursor-pointer block">
                      <Upload className="w-7 h-7 mx-auto text-sky-500 mb-2" />
                      {newPhotoFile ? (
                        <div>
                          <p className="text-xs font-bold text-sky-900">{newPhotoFile.name}</p>
                          <p className="text-[11px] text-slate-500">{(newPhotoFile.size / 1024).toFixed(1)} KB (Ready to upload)</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-slate-700">Click to select an image from your device</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WEBP supported (auto-syncs to cloud)</p>
                        </div>
                      )}
                    </label>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="new-photo-url-input" className="sr-only">Image URL or Local Path</label>
                    <input
                      id="new-photo-url-input"
                      type="text"
                      value={newPhotoUrl}
                      onChange={(e) => {
                        setNewPhotoUrl(e.target.value);
                        setNewPhotoFile(null);
                      }}
                      placeholder="https://... or /pic/you3.png"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPhotoModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingPhoto || (photoUploadMode === 'file' ? !newPhotoFile : !newPhotoUrl.trim())}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center gap-2"
                >
                  <Upload className={`w-4 h-4 ${uploadingPhoto ? 'animate-bounce' : ''}`} />
                  <span>{uploadingPhoto ? 'Saving Picture...' : 'Add Picture'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PHOTO MODAL */}
      {editingPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-sky-100 space-y-5 animate-fade-in-up my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  Edit {editingPhoto.category === 'carousel' ? 'Slider Image' : editingPhoto.category === 'leaders' ? 'Leader Profile' : 'Gallery Photo'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingPhoto(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePhoto} className="space-y-4">
              {/* Current preview */}
              <div className="relative aspect-video max-h-48 w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                <img
                  src={editingPhoto.url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.src = '/pic/logos.webp'; }}
                />
              </div>

              <div>
                <label htmlFor="edit-photo-title-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                  {editingPhoto.category === 'leaders' ? 'Leader Full Name:' : 'Caption / Title Text:'}
                </label>
                <input
                  id="edit-photo-title-input"
                  type="text"
                  value={editingPhoto.title}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, title: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              {editingPhoto.category === 'leaders' && (
                <div>
                  <label htmlFor="edit-photo-role-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Leader Ministry Role:
                  </label>
                  <input
                    id="edit-photo-role-input"
                    type="text"
                    value={editingPhoto.role}
                    onChange={(e) => setEditingPhoto({ ...editingPhoto, role: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              )}

              <div>
                <label htmlFor="edit-photo-url-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Image URL / Path (or upload replacement below):
                </label>
                <input
                  id="edit-photo-url-input"
                  type="text"
                  value={editingPhoto.url}
                  onChange={(e) => setEditingPhoto({ ...editingPhoto, url: e.target.value, newFile: null })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div>
                <label htmlFor="edit-photo-file-input" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Replace with local file:
                </label>
                <input
                  id="edit-photo-file-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const previewUrl = URL.createObjectURL(file);
                      setEditingPhoto({ ...editingPhoto, newFile: file, url: previewUrl });
                    }
                  }}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPhoto(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingPhoto}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center gap-2"
                >
                  <Save className={`w-4 h-4 ${uploadingPhoto ? 'animate-spin' : ''}`} />
                  <span>{uploadingPhoto ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supabase Database SQL Setup Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-slate-200 shadow-2xl max-h-[90vh] flex flex-col animate-scale-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-slate-900">
                    Supabase Database &amp; Storage Fix
                  </h3>
                  <p className="text-xs text-slate-500">
                    Run this SQL script in Supabase to enable Admin editing &amp; ZenSync
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2 mb-4 bg-sky-50/70 p-4 rounded-2xl border border-sky-100">
              <p className="font-semibold text-sky-900">Why is this required?</p>
              <p>
                By default, Supabase Row-Level Security (RLS) blocks anonymous client keys from inserting/updating church photos, routines, and documents. Running this script creates permissive policies so your admin console changes and ZenSync presentation sessions save directly to PostgreSQL in real time.
              </p>
            </div>

            <div className="relative flex-1 overflow-hidden flex flex-col mb-4">
              <div className="flex items-center justify-between bg-slate-900 text-slate-300 px-4 py-2 rounded-t-2xl text-xs font-mono">
                <span>fix_database_rls.sql</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(SQL_FIX_SCRIPT);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition text-xs font-sans font-semibold"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="flex-1 overflow-y-auto bg-slate-950 text-sky-300 font-mono text-[11px] p-4 rounded-b-2xl border border-slate-900 max-h-60 selection:bg-sky-700">
                {SQL_FIX_SCRIPT}
              </pre>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <a
                href="https://supabase.com/dashboard/project/aiufpdabglxhojmmkedp/sql/new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 rounded-xl text-xs font-semibold transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Supabase SQL Editor</span>
              </a>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
