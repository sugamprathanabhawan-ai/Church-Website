import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { CurrentSlideState, SectionItem, SessionData, ConnectionStatus, DeviceAuditInfo } from '../types';
import { getOrCreateDeviceId } from './deviceUtils';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string || 'https://aiufpdabglxhojmmkedp.supabase.co').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string || 'sb_publishable_qDJqr6BpPMTWLaL_C9n8Cw_TgKfgCBB').trim();

let supabaseInstance: SupabaseClient | null = null;

if (envUrl && envKey && envUrl.startsWith('http')) {
  try {
    supabaseInstance = createClient(envUrl, envKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase client from env:', err);
    supabaseInstance = null;
  }
}

export function getSupabase(): SupabaseClient | null {
  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(envUrl && envKey && envUrl.startsWith('http'));
}

// --- Session Persistence & Realtime Functions ---

/**
 * Creates a new presentation session with audit device information and exclusive main signature
 */
export async function createSession(
  code: string,
  sections: SectionItem[],
  deviceInfo?: DeviceAuditInfo
): Promise<SessionData> {
  const mainSignature = deviceInfo?.deviceId || getOrCreateDeviceId();

  const initialData: SessionData = {
    code,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    device_info: deviceInfo,
    main_signature: mainSignature,
    helper_signature: null,
    helper_device_info: null,
    content: {
      sections,
      device_info: deviceInfo,
      main_signature: mainSignature,
      helper_signature: null,
      helper_device_info: null,
    },
    current_slide: { sectionId: sections[0]?.id || '', slideIndex: 0, globalIndex: 0 },
  };

  // Always cache locally
  localStorage.setItem(`zensync_session_${code}`, JSON.stringify(initialData));

  const client = getSupabase();
  if (client) {
    try {
      // Standard payload guaranteed to succeed with zero schema mismatch errors
      // Device audit info & role signatures are safely stored in JSONB content
      const upsertPayload: Record<string, unknown> = {
        code,
        content: {
          sections,
          device_info: deviceInfo,
          main_signature: mainSignature,
          helper_signature: null,
          helper_device_info: null,
        },
        current_slide: initialData.current_slide,
        updated_at: new Date().toISOString(),
      };

      const { error } = await client.from('sessions').upsert(upsertPayload);
      if (error) {
        console.warn('Supabase createSession note:', error.message);
      }
    } catch (err) {
      console.warn('Could not write to Supabase remote DB, saved locally:', err);
    }
  }

  return initialData;
}

/**
 * Fetches an existing session by code
 */
export async function getSession(code: string): Promise<SessionData | null> {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('sessions')
        .select('*')
        .eq('code', code)
        .single();

      if (!error && data) {
        const mainSignature = data.main_signature || data.content?.main_signature;
        const helperSignature = data.helper_signature || data.content?.helper_signature || null;
        const helperDeviceInfo = data.helper_device_info || data.content?.helper_device_info || null;

        const session: SessionData = {
          code: data.code,
          created_at: data.created_at,
          updated_at: data.updated_at,
          device_info: data.device_info || data.content?.device_info,
          main_signature: mainSignature,
          helper_signature: helperSignature,
          helper_device_info: helperDeviceInfo,
          content: {
            sections: data.content?.sections || [],
            device_info: data.content?.device_info || data.device_info,
            main_signature: mainSignature,
            helper_signature: helperSignature,
            helper_device_info: helperDeviceInfo,
          },
          current_slide: data.current_slide || { sectionId: '', slideIndex: 0, globalIndex: 0 },
        };
        // Update local cache
        localStorage.setItem(`zensync_session_${code}`, JSON.stringify(session));
        return session;
      }

      // If Supabase confirms the session was deleted / does not exist, clean up local cache
      if (error && error.code === 'PGRST116') {
        localStorage.removeItem(`zensync_session_${code}`);
        return null;
      }
    } catch (err) {
      console.warn('Supabase fetch failed, checking local storage:', err);
    }
  }

  // Fallback to local storage only if offline/network error (not 404 row deletion)
  const localCached = localStorage.getItem(`zensync_session_${code}`);
  if (localCached) {
    try {
      const parsed: SessionData = JSON.parse(localCached);
      if (parsed) {
        if (!parsed.main_signature && parsed.content?.main_signature) {
          parsed.main_signature = parsed.content.main_signature;
        }
        if (!parsed.helper_signature && parsed.content?.helper_signature) {
          parsed.helper_signature = parsed.content.helper_signature;
        }
        return parsed;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Claims the exclusive HELPER role for a presentation session.
 * Only 1 helper is allowed at a time.
 */
export async function claimHelperRole(
  code: string,
  signature: string,
  helperInfo?: DeviceAuditInfo
): Promise<{ success: boolean; error?: string; session?: SessionData }> {
  const session = await getSession(code);
  if (!session) {
    return { success: false, error: 'Session code not found. Please verify the 4-digit code.' };
  }

  const existingHelperSig = session.helper_signature || session.content?.helper_signature;
  // If helper role is already occupied by a different device
  if (existingHelperSig && existingHelperSig !== signature) {
    const helperName =
      session.helper_device_info?.deviceName ||
      session.content?.helper_device_info?.deviceName ||
      'another device';
    return {
      success: false,
      error: `A Helper has already joined this session on ${helperName}. Only 1 Helper is allowed per presentation.`,
    };
  }

  const updatedContent = {
    ...session.content,
    helper_signature: signature,
    helper_device_info: helperInfo || null,
  };

  const client = getSupabase();
  if (client) {
    try {
      await client
        .from('sessions')
        .update({
          content: updatedContent,
          updated_at: new Date().toISOString(),
        })
        .eq('code', code);
    } catch (err) {
      console.warn('Could not register helper role in Supabase:', err);
    }
  }

  session.helper_signature = signature;
  session.helper_device_info = helperInfo || null;
  session.content = updatedContent;
  localStorage.setItem(`zensync_session_${code}`, JSON.stringify(session));

  return { success: true, session };
}

/**
 * Releases the exclusive HELPER role when a helper exits.
 */
export async function releaseHelperRole(code: string, signature: string): Promise<void> {
  const session = await getSession(code);
  if (!session) return;

  const currentHelperSig = session.helper_signature || session.content?.helper_signature;
  if (currentHelperSig && currentHelperSig !== signature) {
    // Not the active helper, ignore
    return;
  }

  const updatedContent = {
    ...session.content,
    helper_signature: null,
    helper_device_info: null,
  };

  const client = getSupabase();
  if (client) {
    try {
      await client
        .from('sessions')
        .update({
          content: updatedContent,
          updated_at: new Date().toISOString(),
        })
        .eq('code', code);
    } catch (err) {
      console.warn('Could not release helper role in Supabase:', err);
    }
  }

  session.helper_signature = null;
  session.helper_device_info = null;
  session.content = updatedContent;
  localStorage.setItem(`zensync_session_${code}`, JSON.stringify(session));
}

/**
 * Allows the Main presenter to forcefully disconnect / kick the active helper
 */
export async function forceReleaseHelper(code: string): Promise<void> {
  const session = await getSession(code);
  if (!session) return;

  const updatedContent = {
    ...session.content,
    helper_signature: null,
    helper_device_info: null,
  };

  const client = getSupabase();
  if (client) {
    try {
      await client
        .from('sessions')
        .update({
          content: updatedContent,
          updated_at: new Date().toISOString(),
        })
        .eq('code', code);
    } catch (err) {
      console.warn('Could not force release helper in Supabase:', err);
    }
  }

  session.helper_signature = null;
  session.helper_device_info = null;
  session.content = updatedContent;
  localStorage.setItem(`zensync_session_${code}`, JSON.stringify(session));
}

/**
 * Updates the current slide across all connected devices
 */
export async function updateSessionSlide(code: string, currentSlide: CurrentSlideState): Promise<void> {
  // 1. Update local cache
  const cached = localStorage.getItem(`zensync_session_${code}`);
  if (cached) {
    try {
      const parsed: SessionData = JSON.parse(cached);
      parsed.current_slide = currentSlide;
      parsed.updated_at = new Date().toISOString();
      localStorage.setItem(`zensync_session_${code}`, JSON.stringify(parsed));
    } catch (e) {
      console.error(e);
    }
  }

  // 2. Broadcast via Local BroadcastChannel (cross-tab instant sync)
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(`zensync_local_${code}`);
      bc.postMessage({ type: 'slide_change', currentSlide });
      bc.close();
    } catch {
      // ignore
    }
  }

  // 3. Supabase Realtime Broadcast & DB update
  const client = getSupabase();
  if (client) {
    try {
      // Fast channel broadcast
      const channel = client.channel(`session:${code}`);
      await channel.send({
        type: 'broadcast',
        event: 'slide_change',
        payload: { currentSlide },
      });

      // Update DB in background
      client
        .from('sessions')
        .update({
          current_slide: currentSlide,
          updated_at: new Date().toISOString(),
        })
        .eq('code', code)
        .then();
    } catch (err) {
      console.warn('Supabase updateSessionSlide error:', err);
    }
  }
}

/**
 * Updates presentation sections/slides (used in MAIN mode)
 */
export async function updateSessionContent(code: string, sections: SectionItem[]): Promise<void> {
  // 1. Local cache
  const cached = localStorage.getItem(`zensync_session_${code}`);
  let currentContent: any = { sections };
  if (cached) {
    try {
      const parsed: SessionData = JSON.parse(cached);
      currentContent = {
        ...parsed.content,
        sections,
      };
      parsed.content = currentContent;
      parsed.updated_at = new Date().toISOString();
      localStorage.setItem(`zensync_session_${code}`, JSON.stringify(parsed));
    } catch (e) {
      console.error(e);
    }
  }

  // 2. BroadcastChannel
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(`zensync_local_${code}`);
      bc.postMessage({ type: 'content_change', sections });
      bc.close();
    } catch {
      // ignore
    }
  }

  // 3. Supabase Realtime & DB
  const client = getSupabase();
  if (client) {
    try {
      const channel = client.channel(`session:${code}`);
      await channel.send({
        type: 'broadcast',
        event: 'content_change',
        payload: { sections },
      });

      // Fetch existing row content to merge signatures safely
      try {
        const { data: row } = await client.from('sessions').select('content').eq('code', code).maybeSingle();
        if (row?.content) {
          currentContent = {
            ...row.content,
            sections,
          };
        }
      } catch {
        // use local content if query fails
      }

      await client
        .from('sessions')
        .update({
          content: currentContent,
          updated_at: new Date().toISOString(),
        })
        .eq('code', code);
    } catch (err) {
      console.warn('Supabase updateSessionContent error:', err);
    }
  }
}

/**
 * Uploads a slide image file to Supabase Storage or creates an optimized Data/Blob URL
 */
export async function uploadSlideImage(code: string, file: File): Promise<string> {
  const client = getSupabase();
  if (client) {
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${code}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const { data, error } = await client.storage
        .from('zen_sync_images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (!error && data) {
        const { data: publicUrlData } = client.storage
          .from('zen_sync_images')
          .getPublicUrl(fileName);
        if (publicUrlData && publicUrlData.publicUrl) {
          return publicUrlData.publicUrl;
        }
      } else if (error) {
        console.warn('Supabase storage upload error, falling back to data URL:', error.message);
      }
    } catch (err) {
      console.warn('Storage exception, using FileReader fallback:', err);
    }
  }

  // Fallback: Read as base64 Data URL so images display reliably even without remote storage setup
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Deletes a slide image file from Supabase Storage if it's stored there
 */
export async function deleteSlideImage(_code: string, imageUrl: string): Promise<void> {
  const client = getSupabase();
  if (!client || !imageUrl || !imageUrl.includes('zen_sync_images')) return;

  try {
    const match = imageUrl.match(/zen_sync_images\/(.+)$/);
    if (match && match[1]) {
      const filePath = decodeURIComponent(match[1].split('?')[0]);
      await client.storage.from('zen_sync_images').remove([filePath]);
    }
  } catch (err) {
    console.warn('Could not delete image from Supabase Storage:', err);
  }
}

/**
 * Permanently deletes the session from PostgreSQL and removes its uploaded files from Storage
 */
export async function deleteSession(code: string): Promise<void> {
  // 1. Remove local storage cache
  localStorage.removeItem(`zensync_session_${code}`);

  // 2. Broadcast deletion via BroadcastChannel
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(`zensync_local_${code}`);
      bc.postMessage({ type: 'session_deleted' });
      bc.close();
    } catch {
      // ignore
    }
  }

  // 3. Supabase deletion (Database row + Storage folder)
  const client = getSupabase();
  if (client) {
    try {
      const storagePathsToDelete: string[] = [];

      // Query session content to extract any slide image paths
      try {
        const { data: sessionRow } = await client
          .from('sessions')
          .select('content')
          .eq('code', code)
          .maybeSingle();

        if (sessionRow?.content?.sections && Array.isArray(sessionRow.content.sections)) {
          for (const sec of sessionRow.content.sections) {
            if (Array.isArray(sec.slides)) {
              for (const sl of sec.slides) {
                if (sl?.url && sl.url.includes('zen_sync_images/')) {
                  const match = sl.url.match(/zen_sync_images\/(.+)$/);
                  if (match && match[1]) {
                    const cleaned = decodeURIComponent(match[1].split('?')[0]);
                    if (!storagePathsToDelete.includes(cleaned)) {
                      storagePathsToDelete.push(cleaned);
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }

      // Clean up uploaded files in storage folder
      try {
        const { data: files } = await client.storage
          .from('zen_sync_images')
          .list(code, { limit: 1000 });
        if (files && files.length > 0) {
          files.forEach((f) => {
            if (f.name) storagePathsToDelete.push(`${code}/${f.name}`);
          });
        }
      } catch {
        // ignore
      }

      if (storagePathsToDelete.length > 0) {
        await client.storage.from('zen_sync_images').remove(storagePathsToDelete);
      }

      // Broadcast termination event
      try {
        const channel = client.channel(`session:${code}`);
        await channel.send({
          type: 'broadcast',
          event: 'session_deleted',
          payload: { code },
        });
      } catch {
        // ignore
      }

      // Delete from PostgreSQL sessions table
      const { error: delError } = await client.from('sessions').delete().eq('code', code);
      if (delError) {
        console.warn('Supabase deleteSession database warning:', delError.message);
      }
    } catch (err) {
      console.warn('Error deleting session from Supabase:', err);
    }
  }
}

export function pruneLocalSessionCache(knownValidCodes?: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const validSet = knownValidCodes ? new Set(knownValidCodes) : null;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('zensync_session_')) {
      if (!validSet) {
        keysToRemove.push(key);
      } else {
        const code = key.replace('zensync_session_', '');
        if (!validSet.has(code)) {
          keysToRemove.push(key);
        }
      }
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

/**
 * Fetches all presentation sessions from Supabase and local storage (for Admin mode)
 */
export async function fetchAllSessions(): Promise<SessionData[]> {
  const sessionMap = new Map<string, SessionData>();
  let remoteFetchSucceeded = false;

  // 1. Fetch from Supabase Remote Database
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        remoteFetchSucceeded = true;
        const activeRemoteCodes: string[] = [];

        for (const row of data) {
          activeRemoteCodes.push(row.code);
          const mainSignature = row.main_signature || row.content?.main_signature;
          const helperSignature = row.helper_signature || row.content?.helper_signature || null;
          const helperDeviceInfo = row.helper_device_info || row.content?.helper_device_info || null;

          sessionMap.set(row.code, {
            code: row.code,
            created_at: row.created_at,
            updated_at: row.updated_at,
            device_info: row.device_info || row.content?.device_info,
            main_signature: mainSignature,
            helper_signature: helperSignature,
            helper_device_info: helperDeviceInfo,
            content: {
              sections: row.content?.sections || [],
              device_info: row.content?.device_info || row.device_info,
              main_signature: mainSignature,
              helper_signature: helperSignature,
              helper_device_info: helperDeviceInfo,
            },
            current_slide: row.current_slide || { sectionId: '', slideIndex: 0, globalIndex: 0 },
          });
        }

        // Auto-prune sessions that no longer exist in the remote database from local cache
        pruneLocalSessionCache(activeRemoteCodes);
      } else if (error) {
        console.warn('Supabase fetchAllSessions error:', error.message);
      }
    } catch (err) {
      console.warn('Could not query Supabase sessions table:', err);
    }
  }

  // 2. ONLY fallback to Local Storage if Supabase remote fetch failed or offline
  if (!remoteFetchSucceeded && typeof window !== 'undefined' && window.localStorage) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('zensync_session_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed: SessionData = JSON.parse(raw);
            if (parsed && parsed.code) {
              if (!sessionMap.has(parsed.code)) {
                sessionMap.set(parsed.code, parsed);
              }
            }
          }
        } catch {
          // ignore JSON parse errors
        }
      }
    }
  }

  // Return sorted by created_at descending
  return Array.from(sessionMap.values()).sort((a, b) => {
    const timeA = new Date(a.created_at || a.updated_at || 0).getTime();
    const timeB = new Date(b.created_at || b.updated_at || 0).getTime();
    return timeB - timeA;
  });
}

/**
 * Permanently deletes all sessions from PostgreSQL and clears local storage
 */
export async function deleteAllSessions(): Promise<void> {
  const client = getSupabase();
  if (client) {
    try {
      // Query all session codes first to clean up their storage
      const { data: allSessions } = await client.from('sessions').select('code');
      const allPaths: string[] = [];

      if (allSessions && allSessions.length > 0) {
        for (const s of allSessions) {
          try {
            const { data: files } = await client.storage
              .from('zen_sync_images')
              .list(s.code, { limit: 1000 });
            if (files && files.length > 0) {
              files.forEach((f) => allPaths.push(`${s.code}/${f.name}`));
            }
          } catch {
            // ignore
          }

          // Broadcast to listening clients
          try {
            const channel = client.channel(`session:${s.code}`);
            channel.send({
              type: 'broadcast',
              event: 'session_deleted',
              payload: { code: s.code },
            }).then();
          } catch {
            // ignore
          }
        }
      }

      // Also clean any root files in zen_sync_images
      try {
        const { data: rootItems } = await client.storage
          .from('zen_sync_images')
          .list('', { limit: 1000 });
        if (rootItems && rootItems.length > 0) {
          rootItems.forEach((item) => {
            if (item.name && item.id && !item.id.includes('/')) {
              allPaths.push(item.name);
            }
          });
        }
      } catch {
        // ignore
      }

      if (allPaths.length > 0) {
        await client.storage.from('zen_sync_images').remove(allPaths);
      }

      await client.from('sessions').delete().not('code', 'is', null);
    } catch (err) {
      console.warn('Error deleting all sessions in Supabase:', err);
    }
  }

  // Clean localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('zensync_session_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }
}

/**
 * Subscribes to realtime updates for a session
 */
export function subscribeToSession(
  code: string,
  handlers: {
    onSlideChange: (slide: CurrentSlideState) => void;
    onContentChange: (sections: SectionItem[]) => void;
    onStatusChange: (status: ConnectionStatus) => void;
    onSessionDeleted?: () => void;
  }
): () => void {
  let supabaseChannel: RealtimeChannel | null = null;
  let localBc: BroadcastChannel | null = null;
  let pollInterval: any = null;

  const client = getSupabase();

  if (client) {
    try {
      handlers.onStatusChange('reconnecting');
      supabaseChannel = client.channel(`session:${code}`, {
        config: {
          broadcast: { self: false },
        },
      });

      // Listen to broadcast events
      supabaseChannel
        .on('broadcast', { event: 'slide_change' }, (payload) => {
          if (payload?.payload?.currentSlide) {
            handlers.onSlideChange(payload.payload.currentSlide);
          }
        })
        .on('broadcast', { event: 'content_change' }, (payload) => {
          if (payload?.payload?.sections) {
            handlers.onContentChange(payload.payload.sections);
          }
        })
        .on('broadcast', { event: 'session_deleted' }, () => {
          localStorage.removeItem(`zensync_session_${code}`);
          handlers.onSessionDeleted?.();
        })
        // Also listen to Postgres table changes as backup
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sessions',
            filter: `code=eq.${code}`,
          },
          (payload: any) => {
            if (payload?.new) {
              if (payload.new.current_slide) {
                handlers.onSlideChange(payload.new.current_slide);
              }
              if (payload.new.content?.sections) {
                handlers.onContentChange(payload.new.content.sections);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'sessions',
            filter: `code=eq.${code}`,
          },
          () => {
            localStorage.removeItem(`zensync_session_${code}`);
            handlers.onSessionDeleted?.();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            handlers.onStatusChange('connected');
          } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            handlers.onStatusChange('reconnecting');
          } else if (status === 'CLOSED') {
            handlers.onStatusChange('disconnected');
          }
        });
    } catch (err) {
      console.warn('Error subscribing to Supabase channel:', err);
      handlers.onStatusChange('local_demo');
    }
  } else {
    // If Supabase is not configured yet, indicate local mode
    handlers.onStatusChange('local_demo');
  }

  // Cross-tab broadcast channel for instant synchronization on local browser
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      localBc = new BroadcastChannel(`zensync_local_${code}`);
      localBc.onmessage = (event) => {
        if (event.data?.type === 'slide_change' && event.data.currentSlide) {
          handlers.onSlideChange(event.data.currentSlide);
        } else if (event.data?.type === 'content_change' && event.data.sections) {
          handlers.onContentChange(event.data.sections);
        } else if (event.data?.type === 'session_deleted') {
          localStorage.removeItem(`zensync_session_${code}`);
          handlers.onSessionDeleted?.();
        }
      };
    } catch {
      // ignore
    }
  }

  // Periodic safety check: fetch fresh slide & content every 4s and detect remote deletion
  if (client) {
    pollInterval = setInterval(async () => {
      try {
        const latest = await getSession(code);
        if (latest) {
          handlers.onSlideChange(latest.current_slide);
          if (latest.content?.sections) {
            handlers.onContentChange(latest.content.sections);
          }
        } else {
          // Session was deleted remotely!
          localStorage.removeItem(`zensync_session_${code}`);
          handlers.onSessionDeleted?.();
        }
      } catch {
        // ignore
      }
    }, 4000);
  }

  return () => {
    if (supabaseChannel && client) {
      client.removeChannel(supabaseChannel);
    }
    if (localBc) {
      localBc.close();
    }
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  };
}
