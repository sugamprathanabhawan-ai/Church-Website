import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  fetchYouthData,
  saveYouthData,
  fetchChoirData,
  saveChoirData,
  fetchYouTubeSongs,
  saveYouTubeSongs,
  fetchChurchDocuments,
  addChurchDocument,
  deleteChurchDocument,
  fetchWebsitePictures,
  saveWebsitePictures,
  uploadWebsiteImage,
  fetchLyricsSongs,
  saveLyricsSong,
  deleteLyricsSong,
  rollbackLyricsSong,
  fetchLyricsSongVersions,
  DEFAULT_WEBSITE_PICTURES,
  testDatabaseConnection,
  fetchAudioSermons,
  saveAudioSermon,
  deleteAudioSermon,
  uploadAudioSermonFile,
  DEFAULT_AUDIO_SERMONS
} from '../services/supabaseService';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const location = useLocation();
  const isZenSync = Boolean(
    location?.pathname?.startsWith('/zensync') ||
    location?.pathname?.startsWith('/sync')
  );

  const [youthData, setYouthData] = useState({
    notices: [],
    months: [],
    group: { leader: '', teams: [] }
  });
  const [choirData, setChoirData] = useState({
    notices: [],
    months: [],
    layoutGroups: []
  });
  const [youtubeData, setYouTubeData] = useState({
    songs: []
  });
  const [documents, setDocuments] = useState({
    calendar: [],
    laws: [],
    choir: []
  });
  const [websitePictures, setWebsitePictures] = useState(DEFAULT_WEBSITE_PICTURES);
  const [lyricsSongs, setLyricsSongs] = useState([]);
  const [audioSermons, setAudioSermons] = useState(DEFAULT_AUDIO_SERMONS);

  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [dbStatus, setDbStatus] = useState({ online: true, latency: 0 });

  // Sequence counters to prevent out-of-order race conditions
  const requestSeq = useRef(0);
  const granularSeqs = useRef({ youth: 0, choir: 0, youtube: 0, docs: 0, pics: 0, lyrics: 0, audio: 0 });
  const debounceTimers = useRef({});

  // Granular resource fetchers with sequence guards
  const refreshYouth = useCallback(async () => {
    const seq = ++granularSeqs.current.youth;
    try {
      const data = await fetchYouthData();
      if (seq === granularSeqs.current.youth) {
        setYouthData(data);
      }
    } catch (err) {
      console.warn('[DataContext] Failed to refresh youth data:', err.message);
    }
  }, []);

  const refreshChoir = useCallback(async () => {
    const seq = ++granularSeqs.current.choir;
    try {
      const data = await fetchChoirData();
      if (seq === granularSeqs.current.choir) {
        setChoirData(data);
      }
    } catch (err) {
      console.warn('[DataContext] Failed to refresh choir data:', err.message);
    }
  }, []);

  const refreshYouTube = useCallback(async () => {
    const seq = ++granularSeqs.current.youtube;
    try {
      const data = await fetchYouTubeSongs();
      if (seq === granularSeqs.current.youtube) {
        setYouTubeData(data);
      }
    } catch (err) {
      console.warn('[DataContext] Failed to refresh youtube songs:', err.message);
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    const seq = ++granularSeqs.current.docs;
    try {
      const docs = await fetchChurchDocuments();
      if (seq === granularSeqs.current.docs) {
        const docsBySection = { calendar: [], laws: [], choir: [] };
        (docs || []).forEach(d => {
          const sec = (d.section || '').toLowerCase();
          if (docsBySection[sec]) {
            docsBySection[sec].push(d);
          }
        });
        setDocuments(docsBySection);
      }
    } catch (err) {
      console.warn('[DataContext] Failed to refresh documents:', err.message);
    }
  }, []);

  const refreshPictures = useCallback(async () => {
    const seq = ++granularSeqs.current.pics;
    try {
      const pics = await fetchWebsitePictures();
      if (seq === granularSeqs.current.pics) {
        setWebsitePictures(pics);
      }
    } catch (err) {
      console.warn('[DataContext] Failed to refresh pictures:', err.message);
    }
  }, []);

  const refreshLyrics = useCallback(async (includeDrafts = true) => {
    const seq = ++granularSeqs.current.lyrics;
    try {
      const songs = await fetchLyricsSongs(includeDrafts);
      if (seq === granularSeqs.current.lyrics) {
        setLyricsSongs(songs || []);
      }
    } catch (err) {
      console.warn('[DataContext] Failed to refresh lyrics songs:', err.message);
    }
  }, []);

  const refreshAudio = useCallback(async () => {
    const seq = ++granularSeqs.current.audio;
    try {
      const sermons = await fetchAudioSermons();
      if (seq === granularSeqs.current.audio) {
        setAudioSermons(sermons || DEFAULT_AUDIO_SERMONS);
      }
    } catch (err) {
      console.warn('[DataContext] Failed to refresh audio sermons:', err.message);
    }
  }, []);

  // Coalesced & debounced table refresh trigger
  const triggerDebouncedRefresh = useCallback((key, fetcherFn, delayMs = 350) => {
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(async () => {
      delete debounceTimers.current[key];
      await fetcherFn();
      setLastSyncTime(Date.now());
    }, delayMs);
  }, []);

  // Load all live database records with exponential retry
  const loadAll = useCallback(async (retryCount = 0) => {
    const currentSeq = ++requestSeq.current;
    setLoading(true);
    setIsSyncing(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        fetchYouthData(),
        fetchChoirData(),
        fetchYouTubeSongs(),
        fetchChurchDocuments(),
        fetchWebsitePictures(),
        fetchLyricsSongs(true),
        fetchAudioSermons(),
        testDatabaseConnection()
      ]);

      // Guard against out-of-order stale responses
      if (currentSeq !== requestSeq.current) {
        return;
      }

      const [youthRes, choirRes, youtubeRes, docsRes, picsRes, lyricsRes, audioRes, diagRes] = results;

      if (youthRes.status === 'fulfilled' && youthRes.value) {
        setYouthData(youthRes.value);
      } else if (youthRes.status === 'rejected') {
        console.warn('[DataContext] Youth data fetch error:', youthRes.reason?.message);
      }

      if (choirRes.status === 'fulfilled' && choirRes.value) {
        setChoirData(choirRes.value);
      } else if (choirRes.status === 'rejected') {
        console.warn('[DataContext] Choir data fetch error:', choirRes.reason?.message);
      }

      if (youtubeRes.status === 'fulfilled' && youtubeRes.value) {
        setYouTubeData(youtubeRes.value);
      } else if (youtubeRes.status === 'rejected') {
        console.warn('[DataContext] YouTube songs fetch error:', youtubeRes.reason?.message);
      }

      if (picsRes.status === 'fulfilled' && picsRes.value) {
        setWebsitePictures(picsRes.value);
      } else if (picsRes.status === 'rejected') {
        console.warn('[DataContext] Website pictures fetch error:', picsRes.reason?.message);
      }

      if (lyricsRes.status === 'fulfilled' && lyricsRes.value) {
        setLyricsSongs(lyricsRes.value);
      } else if (lyricsRes.status === 'rejected') {
        console.warn('[DataContext] Lyrics songs fetch error:', lyricsRes.reason?.message);
      }

      if (audioRes.status === 'fulfilled' && audioRes.value) {
        setAudioSermons(audioRes.value);
      } else if (audioRes.status === 'rejected') {
        console.warn('[DataContext] Audio sermons fetch error:', audioRes.reason?.message);
      }

      if (docsRes.status === 'fulfilled' && docsRes.value) {
        const docs = docsRes.value;
        const docsBySection = { calendar: [], laws: [], choir: [] };
        (docs || []).forEach(d => {
          const sec = (d.section || '').toLowerCase();
          if (docsBySection[sec]) {
            docsBySection[sec].push(d);
          }
        });
        setDocuments(docsBySection);
      } else if (docsRes.status === 'rejected') {
        console.warn('[DataContext] Church documents fetch error:', docsRes.reason?.message);
      }

      const diag = diagRes.status === 'fulfilled' ? diagRes.value : { online: false, latency: 0 };
      setDbStatus(diag);
      setIsLive(diag.online);
      setIsStale(false);
      setLastSyncTime(Date.now());
    } catch (err) {
      console.error('[DataContext] Failed to load data from Supabase:', err);

      if (retryCount < 2) {
        // Exponential backoff retry for transient network glitch
        const backoff = Math.pow(2, retryCount) * 1000;
        setTimeout(() => loadAll(retryCount + 1), backoff);
        return;
      }

      setError(err.message || 'Failed to connect to Supabase database');
      setIsStale(true);
      setIsLive(false);
      setDbStatus({ online: false, latency: 0, error: err.message });
    } finally {
      if (currentSeq === requestSeq.current) {
        setLoading(false);
        setIsSyncing(false);
      }
    }
  }, []);

  // Initial load (skipped on ZenSync routes to reduce unnecessary work)
  useEffect(() => {
    if (!isZenSync) {
      loadAll();
    }
  }, [loadAll, isZenSync]);

  // Real-time Supabase Subscriptions with Granular Coalesced Debouncing (skipped on ZenSync)
  useEffect(() => {
    if (isZenSync) return;

    const channel = supabase
      .channel('church-granular-realtime')
      // Youth tables
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youth_notices' }, () => {
        triggerDebouncedRefresh('youth', refreshYouth);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youth_schedules' }, () => {
        triggerDebouncedRefresh('youth', refreshYouth);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youth_groups' }, () => {
        triggerDebouncedRefresh('youth', refreshYouth);
      })
      // Choir tables
      .on('postgres_changes', { event: '*', schema: 'public', table: 'choir_notices' }, () => {
        triggerDebouncedRefresh('choir', refreshChoir);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'choir_schedules' }, () => {
        triggerDebouncedRefresh('choir', refreshChoir);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'choir_layouts' }, () => {
        triggerDebouncedRefresh('choir', refreshChoir);
      })
      // Worship songs
      .on('postgres_changes', { event: '*', schema: 'public', table: 'youtube_songs' }, () => {
        triggerDebouncedRefresh('youtube', refreshYouTube);
      })
      // Documents
      .on('postgres_changes', { event: '*', schema: 'public', table: 'church_documents' }, () => {
        triggerDebouncedRefresh('docs', refreshDocuments);
      })
      // Lyrics Songs
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lyrics_songs' }, () => {
        triggerDebouncedRefresh('lyrics', refreshLyrics);
      })
      // Audio Sermons
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audio_sermons' }, () => {
        triggerDebouncedRefresh('audio', refreshAudio);
      })
      // Settings (Specific key filtering to avoid reloading pictures when unrelated settings change)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'church_settings' }, (payload) => {
        const changedKey = payload.new?.key || payload.old?.key;
        if (!changedKey || changedKey === 'website_pictures') {
          triggerDebouncedRefresh('settings_pictures', refreshPictures);
        } else if (changedKey === 'church_documents') {
          triggerDebouncedRefresh('docs', refreshDocuments);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, [isZenSync, triggerDebouncedRefresh, refreshYouth, refreshChoir, refreshYouTube, refreshDocuments, refreshPictures, refreshLyrics, refreshAudio]);

  // Periodic latency / health check (skipped on ZenSync)
  useEffect(() => {
    if (isZenSync) return;

    const interval = setInterval(async () => {
      const diag = await testDatabaseConnection();
      setDbStatus(diag);
      setIsLive(diag.online);
    }, 45000);
    return () => clearInterval(interval);
  }, [isZenSync]);

  // Update Youth Data directly in Supabase
  const updateYouthData = async (data) => {
    setIsSyncing(true);
    try {
      await saveYouthData(data);
      setYouthData(data);
      setLastSyncTime(Date.now());
      return true;
    } catch (err) {
      console.error('[DataContext] Error saving youth data:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Update Choir Data directly in Supabase
  const updateChoirData = async (data) => {
    setIsSyncing(true);
    try {
      await saveChoirData(data);
      setChoirData(data);
      setLastSyncTime(Date.now());
      return true;
    } catch (err) {
      console.error('[DataContext] Error saving choir data:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Update YouTube Songs directly in Supabase
  const updateYouTubeData = async (dataOrSongs) => {
    setIsSyncing(true);
    try {
      const songs = Array.isArray(dataOrSongs) ? dataOrSongs : dataOrSongs.songs || [];
      await saveYouTubeSongs(songs);
      setYouTubeData({ songs });
      setLastSyncTime(Date.now());
      return true;
    } catch (err) {
      console.error('[DataContext] Error saving youtube songs:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Add a Church PDF Document
  const addDocument = async ({ section, title, fileUrl, fileName, fileSize }) => {
    setIsSyncing(true);
    try {
      const newDoc = await addChurchDocument({ section, title, fileUrl, fileName, fileSize });
      setDocuments(prev => ({
        ...prev,
        [section]: [newDoc, ...(prev[section] || [])]
      }));
      setLastSyncTime(Date.now());
      return newDoc;
    } catch (err) {
      console.error('[DataContext] Error adding church document:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete a Church PDF Document
  const deleteDocument = async (id, section) => {
    setIsSyncing(true);
    try {
      await deleteChurchDocument(id);
      setDocuments(prev => {
        if (section) {
          return {
            ...prev,
            [section]: (prev[section] || []).filter(d => d.id !== id)
          };
        }
        const next = {};
        for (const key of Object.keys(prev)) {
          next[key] = (prev[key] || []).filter(d => d.id !== id);
        }
        return next;
      });
      setLastSyncTime(Date.now());
      return true;
    } catch (err) {
      console.error('[DataContext] Error deleting church document:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Update Website Pictures directly in Supabase
  const updateWebsitePictures = async (data) => {
    setIsSyncing(true);
    try {
      await saveWebsitePictures(data);
      setWebsitePictures(data);
      setLastSyncTime(Date.now());
      return true;
    } catch (err) {
      console.error('[DataContext] Error saving website pictures:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // --- SUGAM LYRICS BOOK ACTIONS ---
  const saveLyricsSongData = async (songData) => {
    setIsSyncing(true);
    try {
      const saved = await saveLyricsSong(songData);
      setLyricsSongs(prev => {
        const exists = prev.some(s => s.id === saved.id);
        if (exists) {
          return prev.map(s => s.id === saved.id ? saved : s);
        }
        return [saved, ...prev];
      });
      setLastSyncTime(Date.now());
      return saved;
    } catch (err) {
      console.error('[DataContext] Error saving lyrics song:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteLyricsSongData = async (songId) => {
    setIsSyncing(true);
    try {
      await deleteLyricsSong(songId);
      setLyricsSongs(prev => prev.filter(s => s.id !== songId));
      setLastSyncTime(Date.now());
      return true;
    } catch (err) {
      console.error('[DataContext] Error deleting lyrics song:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const rollbackLyricsSongData = async (songId, targetVersion) => {
    setIsSyncing(true);
    try {
      const restored = await rollbackLyricsSong(songId, targetVersion);
      setLyricsSongs(prev => prev.map(s => s.id === restored.id ? restored : s));
      setLastSyncTime(Date.now());
      return restored;
    } catch (err) {
      console.error('[DataContext] Error rolling back lyrics song:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // --- AUDIO SERMONS & BIBLE STREAMING ACTIONS ---
  const saveAudioSermonData = async (sermonData) => {
    setIsSyncing(true);
    try {
      const saved = await saveAudioSermon(sermonData);
      setAudioSermons(prev => {
        const exists = prev.some(s => s.id === saved.id);
        if (exists) {
          return prev.map(s => s.id === saved.id ? saved : s);
        }
        return [saved, ...prev];
      });
      setLastSyncTime(Date.now());
      return saved;
    } catch (err) {
      console.error('[DataContext] Error saving audio sermon:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteAudioSermonData = async (sermonId) => {
    setIsSyncing(true);
    try {
      await deleteAudioSermon(sermonId);
      setAudioSermons(prev => prev.filter(s => s.id !== sermonId));
      setLastSyncTime(Date.now());
      return true;
    } catch (err) {
      console.error('[DataContext] Error deleting audio sermon:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <DataContext.Provider
      value={{
        youthData,
        choirData,
        youtubeData,
        documents,
        websitePictures,
        lyricsSongs,
        audioSermons,
        loading,
        isSyncing,
        isLive,
        isStale,
        error,
        lastSyncTime,
        dbStatus,
        refreshData: loadAll,
        retryConnection: () => loadAll(0),
        updateYouthData,
        updateChoirData,
        updateYouTubeData,
        addDocument,
        deleteDocument,
        updateWebsitePictures,
        uploadWebsiteImage,
        refreshLyricsSongs: refreshLyrics,
        saveLyricsSong: saveLyricsSongData,
        deleteLyricsSong: deleteLyricsSongData,
        rollbackLyricsSong: rollbackLyricsSongData,
        fetchLyricsSongVersions,
        refreshAudioSermons: refreshAudio,
        saveAudioSermon: saveAudioSermonData,
        deleteAudioSermon: deleteAudioSermonData,
        uploadAudioSermon: uploadAudioSermonFile
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

export default DataContext;
