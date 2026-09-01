import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchYouthData,
  saveYouthData,
  fetchChoirData,
  saveChoirData,
  fetchYouTubeSongs,
  saveYouTubeSongs,
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [dbStatus, setDbStatus] = useState({ online: true, latency: 0 });

  // Load all live database records
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [youth, choir, youtube, diag] = await Promise.all([
        fetchYouthData(),
        fetchChoirData(),
        fetchYouTubeSongs(),
        testDatabaseConnection()
      ]);

      setYouthData(youth);
      setChoirData(choir);
      setYouTubeData(youtube);
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

  return (
    <DataContext.Provider
      value={{
        youthData,
        choirData,
        youtubeData,
        loading,
        error,
        lastSyncTime,
        dbStatus,
        refreshData: loadAll,
        updateYouthData,
        updateChoirData,
        updateYouTubeData
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
