import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import type { CurrentSlideState, SectionItem, SessionData, ConnectionStatus, DeviceAuditInfo } from '../types';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string || '').trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string || '').trim();

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
 * Creates a new presentation session with audit device information
 */
export async function createSession(
  code: string,
  sections: SectionItem[],
  deviceInfo?: DeviceAuditInfo
): Promise<SessionData> {
  const initialData: SessionData = {
    code,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    device_info: deviceInfo,
    content: {
      sections,
      device_info: deviceInfo,
    },
    current_slide: { sectionId: sections[0]?.id || '', slideIndex: 0, globalIndex: 0 },
  };

  // Always cache locally
  localStorage.setItem(`zensync_session_${code}`, JSON.stringify(initialData));

  const client = getSupabase();
  if (client) {
    try {
      const upsertPayload: Record<string, unknown> = {
        code,
        content: {
          sections,
          device_info: deviceInfo,
        },
        current_slide: initialData.current_slide,
        updated_at: new Date().toISOString(),
      };

      if (deviceInfo) {
        upsertPayload.device_info = deviceInfo;
        upsertPayload.device_name = deviceInfo.deviceName;
      }

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
        const session: SessionData = {
          code: data.code,
          created_at: data.created_at,
          updated_at: data.updated_at,
          device_info: data.device_info || data.content?.device_info,
          content: {
            sections: data.content?.sections || [],
            device_info: data.content?.device_info || data.device_info,
          },
          current_slide: data.current_slide || { sectionId: '', slideIndex: 0, globalIndex: 0 },
        };
        // Update local cache
        localStorage.setItem(`zensync_session_${code}`, JSON.stringify(session));
        return session;
      }
    } catch (err) {
      console.warn('Supabase fetch failed, checking local storage:', err);
    }
  }

  // Fallback to local storage
  const localCached = localStorage.getItem(`zensync_session_${code}`);
  if (localCached) {
    try {
      return JSON.parse(localCached);
    } catch {
      return null;
    }
  }

  return null;
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
  if (cached) {
    try {
      const parsed: SessionData = JSON.parse(cached);
      parsed.content = { sections };
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

  // 3. Supabase Realtime
  const client = getSupabase();
  if (client) {
    try {
      const channel = client.channel(`session:${code}`);
      await channel.send({
        type: 'broadcast',
        event: 'content_change',
        payload: { sections },
      });

      await client
        .from('sessions')
        .update({
          content: { sections },
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
      const channel = client.channel(`session:${code}`);
      await channel.send({
        type: 'broadcast',
        event: 'session_deleted',
        payload: { code },
      });

      // Delete from PostgreSQL sessions table
      await client.from('sessions').delete().eq('code', code);

      // Clean up uploaded files in storage folder
      const { data: files } = await client.storage.from('zen_sync_images').list(code);
      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${code}/${f.name}`);
        await client.storage.from('zen_sync_images').remove(filePaths);
      }
    } catch (err) {
      console.warn('Error deleting session from Supabase:', err);
    }
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
          handlers.onSessionDeleted?.();
        }
      };
    } catch {
      // ignore
    }
  }

  // Periodic safety check: fetch fresh slide from DB every 6s in case websocket dropped an event
  if (client) {
    pollInterval = setInterval(async () => {
      try {
        const latest = await getSession(code);
        if (latest) {
          handlers.onSlideChange(latest.current_slide);
        }
      } catch {
        // ignore
      }
    }, 6000);
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
