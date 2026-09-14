import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  testDatabaseConnection
} from '../services/supabaseService';

const DataContext = createContext(null);

export function DataProvider({ children }) {
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [dbStatus, setDbStatus] = useState({ online: true, latency: 0 });

  // Load all live database records
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [youth, choir, youtube, docs, diag] = await Promise.all([
        fetchYouthData(),
        fetchChoirData(),
        fetchYouTubeSongs(),
        fetchChurchDocuments(),
        testDatabaseConnection()
      ]);

      setYouthData(youth);
      setChoirData(choir);
      setYouTubeData(youtube);

      // Categorize docs by section
      const docsBySection = { calendar: [], laws: [], choir: [] };
      (docs || []).forEach(d => {
        const sec = (d.section || '').toLowerCase();
        if (docsBySection[sec]) {
          docsBySection[sec].push(d);
        }
      });
      setDocuments(docsBySection);

      setDbStatus(diag);
      setLastSyncTime(Date.now());
    } catch (err) {
      console.error('[DataContext] Failed to load data from Supabase:', err);
      setError(err.message || 'Failed to connect to Supabase database');
      setDbStatus({ online: false, latency: 0, error: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Real-time Supabase Subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'youth_notices' },
        () => loadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'youth_schedules' },
        () => loadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'youth_groups' },
        () => loadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'choir_notices' },
        () => loadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'choir_schedules' },
        () => loadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'choir_layouts' },
        () => loadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'youtube_songs' },
        () => loadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'church_documents' },
        () => loadAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll]);

  // Periodic latency / health check
  useEffect(() => {
    const interval = setInterval(async () => {
      const diag = await testDatabaseConnection();
      setDbStatus(diag);
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  // Update Youth Data directly in Supabase
  const updateYouthData = async (data) => {
    try {
      setLoading(true);
      await saveYouthData(data);
      setYouthData(data);
      setLastSyncTime(Date.now());
      return true;
    } catch (err) {
      console.error('[DataContext] Error saving youth data:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update Choir Data directly in Supabase
  const updateChoirData = async (data) => {
    try {
      setLoading(true);
      await saveChoirData(data);
      setChoirData(data);
      setLastSyncTime(Date.now());
      return true;
    } catch (err) {
      console.error('[DataContext] Error saving choir data:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update YouTube Songs directly in Supabase
  const updateYouTubeData = async (dataOrSongs) => {
    try {
      setLoading(true);
      const songs = Array.isArray(dataOrSongs) ? dataOrSongs : dataOrSongs.songs || [];
      await saveYouTubeSongs(songs);
      setYouTubeData({ songs });
      setLastSyncTime(Date.now());
      return true;
    } catch (err) {
      console.error('[DataContext] Error saving youtube songs:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Add a Church PDF Document
  const addDocument = async ({ section, title, fileUrl, fileName, fileSize }) => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  // Delete a Church PDF Document
  const deleteDocument = async (id, section) => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <DataContext.Provider
      value={{
        youthData,
        choirData,
        youtubeData,
        documents,
        loading,
        error,
        lastSyncTime,
        dbStatus,
        refreshData: loadAll,
        updateYouthData,
        updateChoirData,
        updateYouTubeData,
        addDocument,
        deleteDocument
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
