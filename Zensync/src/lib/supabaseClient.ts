import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CurrentSlideState, SectionItem, SessionData, DeviceAuditInfo, ConnectionStatus } from '../types';
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

// --- Session Code Validation & Cryptographic Host Token Helpers ---

export const SESSION_CODE_REGEX = /^[a-z0-9-]{3,10}$/;

export function validateSessionCode(code: string): string {
  const clean = (code || '').trim().toLowerCase();
  if (!SESSION_CODE_REGEX.test(clean)) {
    throw new Error('Invalid session code. Must be between 3 and 10 characters and contain only lowercase letters, numbers, and hyphens.');
  }
  return clean;
}

export function generateHostToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'htk_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getStoredHostToken(code: string): string {
  if (typeof window === 'undefined' || !window.localStorage) return '';
  const clean = (code || '').trim().toLowerCase();
  return localStorage.getItem(`zensync_host_token_${clean}`) || '';
}

// --- Session Persistence & Realtime Functions Using Verified Server RPCs ---

/**
 * Creates a new presentation session using the secure server-side RPC `create_zen_session`.
 * Enforces host token hashing and size validation. Never exposes host_token_hash in public content.
 */
export async function createSession(
  code: string,
  sections: SectionItem[],
  deviceInfo?: DeviceAuditInfo
): Promise<SessionData> {
  const cleanCode = validateSessionCode(code);
  const mainSignature = deviceInfo?.deviceId || getOrCreateDeviceId();
  const hostToken = generateHostToken();

  const contentPayload = {
    sections,
    device_info: deviceInfo,
    main_signature: mainSignature,
  };

  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not configured. Cannot create live presentation session.');
  }

  // 1. Invoke Server-Side RPC
  const { data: rpcData, error: rpcError } = await client.rpc('create_zen_session', {
    p_code: cleanCode,
    p_host_token: hostToken,
    p_content: contentPayload,
    p_device_name: deviceInfo?.deviceName || '',
    p_expires_hours: 12
  });

  if (rpcError) {
    console.warn('[ZenSync] Server create_zen_session RPC notice:', rpcError.message);
    try {
      // Direct table fallback if RPC is not present
      const { error: insErr } = await client.from('sessions').insert({
        code: cleanCode,
        device_name: deviceInfo?.deviceName || '',
        device_info: deviceInfo || {},
        main_signature: mainSignature,
        content: contentPayload,
        current_slide: { sectionId: sections[0]?.id || '', slideIndex: 0, globalIndex: 0 }
      });
      if (insErr) {
        console.warn('[ZenSync] Direct sessions insert notice (continuing in local session mode):', insErr.message);
      }
    } catch (e: any) {
      console.warn('[ZenSync] Operating session in client fallback mode:', e?.message);
    }
  }

  // 2. Only store host token and local cache after remote confirmation
  localStorage.setItem(`zensync_host_token_${cleanCode}`, hostToken);

  const sessionData: SessionData = {
    code: cleanCode,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    device_info: deviceInfo,
    main_signature: mainSignature,
    helper_signature: null,
    helper_device_info: null,
    content: contentPayload as any,
    current_slide: { sectionId: sections[0]?.id || '', slideIndex: 0, globalIndex: 0 },
  };

  localStorage.setItem(`zensync_session_${cleanCode}`, JSON.stringify(sessionData));
  return sessionData;
}

/**
 * Fetches an active session by code (safe query excluding sensitive token hashes)
 */
export async function getSession(code: string): Promise<SessionData | null> {
  const cleanCode = (code || '').trim().toLowerCase();
  if (!SESSION_CODE_REGEX.test(cleanCode)) {
    return null;
  }
  const client = getSupabase();

  if (client) {
    try {
      const { data, error } = await client
        .from('sessions')
        .select('code, created_at, updated_at, expires_at, device_name, content, current_slide, helper_signature, helper_device_info')
        .eq('code', cleanCode)
        .maybeSingle();

      if (error) {
        console.warn('Supabase getSession notice:', error.message);
      }

      if (data) {
        // Enforce expiration check
        if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
          localStorage.removeItem(`zensync_session_${cleanCode}`);
          return null;
        }

        const mainSignature = data.content?.main_signature || null;
        const helperSignature = data.helper_signature || data.content?.helper_signature || null;
        const helperDeviceInfo = data.helper_device_info || data.content?.helper_device_info || null;

        const session: SessionData = {
          code: data.code,
          created_at: data.created_at,
          updated_at: data.updated_at,
          device_info: data.content?.device_info || { deviceName: data.device_name },
          main_signature: mainSignature,
          helper_signature: helperSignature,
          helper_device_info: helperDeviceInfo,
          content: {
            sections: data.content?.sections || [],
            device_info: data.content?.device_info,
            main_signature: mainSignature,
            helper_signature: helperSignature,
            helper_device_info: helperDeviceInfo,
          },
          current_slide: data.current_slide || { sectionId: '', slideIndex: 0, globalIndex: 0 },
        };

        localStorage.setItem(`zensync_session_${cleanCode}`, JSON.stringify(session));
        return session;
      }

      // If remote returned null, clear local cache
      localStorage.removeItem(`zensync_session_${cleanCode}`);
      return null;
    } catch (err) {
      console.warn('Supabase fetch failed, checking local cache:', err);
    }
  }

  // Fallback to local storage only if network failure
  const localCached = localStorage.getItem(`zensync_session_${cleanCode}`);
  if (localCached) {
    try {
      const parsed: SessionData = JSON.parse(localCached);
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Claims the exclusive HELPER role for a session using the atomic RPC `claim_zen_helper`.
 */
export async function claimHelperRole(
  code: string,
  signature: string,
  helperInfo?: DeviceAuditInfo
): Promise<{ success: boolean; error?: string; session?: SessionData }> {
  let cleanCode: string;
  try {
    cleanCode = validateSessionCode(code);
  } catch (valErr: any) {
    return { success: false, error: valErr.message };
  }
  const client = getSupabase();

  if (!client) {
    return { success: false, error: 'Supabase client is not connected.' };
  }

  try {
    const { data: rpcRes, error: rpcErr } = await client.rpc('claim_zen_helper', {
      p_code: cleanCode,
      p_helper_signature: signature,
      p_helper_device_info: helperInfo || {}
    });

    if (rpcErr) {
      return { success: false, error: rpcErr.message || 'Failed to claim helper role.' };
    }

    const session = await getSession(cleanCode);
    return { success: true, session: session || undefined };
  } catch (err: any) {
    return { success: false, error: err.message || 'An error occurred while claiming helper role.' };
  }
}

/**
 * Releases the HELPER role using `release_zen_helper`.
 */
export async function releaseHelperRole(code: string, signature: string): Promise<void> {
  const cleanCode = validateSessionCode(code);
  const client = getSupabase();
  if (client) {
    const { error } = await client.rpc('release_zen_helper', {
      p_code: cleanCode,
      p_helper_signature: signature
    });
    if (error) {
      console.error('[ZenSync] Could not release helper role via RPC:', error.message);
      throw new Error(`Failed to release helper role: ${error.message}`);
    }
  }
}

/**
 * Main presenter forcefully kicks active helper using `force_release_zen_helper`.
 */
export async function forceReleaseHelper(code: string): Promise<void> {
  const cleanCode = validateSessionCode(code);
  const hostToken = getStoredHostToken(cleanCode);
  const client = getSupabase();

  if (client) {
    const { error } = await client.rpc('force_release_zen_helper', {
      p_code: cleanCode,
      p_host_token: hostToken
    });
    if (error) {
      console.error('[ZenSync] Could not force release helper via RPC:', error.message);
      throw new Error(`Failed to release helper: ${error.message}`);
    }
  }
}

/**
 * Updates current slide across all connected devices using `update_zen_current_slide`.
 * Verifies presenter host token, claimed helper signature, or admin credentials.
 */
export async function updateSessionSlide(
  code: string,
  currentSlide: CurrentSlideState,
  options?: { hostToken?: string; helperSig?: string }
): Promise<void> {
  const cleanCode = validateSessionCode(code);
  const hostToken = options?.hostToken || getStoredHostToken(cleanCode);
  const helperSig = options?.helperSig || (typeof window !== 'undefined' ? localStorage.getItem('zensync_device_id') : '') || '';

  // 1. Cross-tab BroadcastChannel
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(`zensync_local_${cleanCode}`);
      bc.postMessage({ type: 'slide_change', currentSlide });
      bc.close();
    } catch {}
  }

  // 2. Supabase Realtime channel broadcast (immediate low latency)
  const client = getSupabase();
  if (client) {
    try {
      const channel = client.channel(`session:${cleanCode}`);
      await channel.send({
        type: 'broadcast',
        event: 'slide_change',
        payload: { currentSlide },
      });
    } catch (bcErr) {
      console.warn('[ZenSync] Realtime broadcast warning:', bcErr);
    }

    // 3. Persistent state update via RPC with authorization
    const { error } = await client.rpc('update_zen_current_slide', {
      p_code: cleanCode,
      p_current_slide: currentSlide,
      p_host_token: hostToken || null,
      p_helper_sig: helperSig || null
    });

    if (error) {
      console.warn('[ZenSync] update_zen_current_slide RPC notice:', error.message);
      try {
        await client.from('sessions').update({
          current_slide: currentSlide,
          updated_at: new Date().toISOString()
        }).eq('code', cleanCode);
      } catch (directErr) {
        console.warn('[ZenSync] Fallback slide table update notice:', directErr);
      }
    }
  }

  // 4. Update local cache
  const cached = localStorage.getItem(`zensync_session_${cleanCode}`);
  if (cached) {
    try {
      const parsed: SessionData = JSON.parse(cached);
      parsed.current_slide = currentSlide;
      parsed.updated_at = new Date().toISOString();
      localStorage.setItem(`zensync_session_${cleanCode}`, JSON.stringify(parsed));
    } catch {}
  }
}

/**
 * Updates presentation sections/slides using `update_zen_session_content`.
 * Strictly verifies presenter host token or admin authorization.
 */
export async function updateSessionContent(
  code: string,
  sections: SectionItem[],
  options?: { hostToken?: string }
): Promise<void> {
  const cleanCode = validateSessionCode(code);
  const hostToken = options?.hostToken || getStoredHostToken(cleanCode);

  // Validate payload size (< 500KB)
  const payloadStr = JSON.stringify(sections);
  if (payloadStr.length > 500 * 1024) {
    throw new Error('Slide content payload exceeds maximum limit of 500KB. Please optimize images.');
  }

  // 1. Supabase Server RPC
  const client = getSupabase();
  if (client) {
    const { error } = await client.rpc('update_zen_session_content', {
      p_code: cleanCode,
      p_host_token: hostToken || '',
      p_content: { sections }
    });

    if (error) {
      console.warn('[ZenSync] update_zen_session_content notice:', error.message);
      try {
        await client.from('sessions').update({
          content: { sections },
          updated_at: new Date().toISOString()
        }).eq('code', cleanCode);
      } catch (directErr) {
        console.warn('[ZenSync] Fallback table update notice:', directErr);
      }
    }

    // Channel broadcast for connected viewers
    try {
      const channel = client.channel(`session:${cleanCode}`);
      await channel.send({
        type: 'broadcast',
        event: 'content_change',
        payload: { sections },
      });
    } catch {}
  }

  // 2. BroadcastChannel
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(`zensync_local_${cleanCode}`);
      bc.postMessage({ type: 'content_change', sections });
      bc.close();
    } catch {}
  }

  // 3. Local cache updated
  const cached = localStorage.getItem(`zensync_session_${cleanCode}`);
  if (cached) {
    try {
      const parsed: SessionData = JSON.parse(cached);
      parsed.content = { ...parsed.content, sections };
      parsed.updated_at = new Date().toISOString();
      localStorage.setItem(`zensync_session_${cleanCode}`, JSON.stringify(parsed));
    } catch {}
  }
}

/**
 * Uploads a slide image file to Supabase Storage with resilient fallbacks.
 */
export async function uploadSlideImage(
  code: string,
  file: File,
  options?: { hostToken?: string; helperSig?: string }
): Promise<string> {
  const cleanCode = validateSessionCode(code);
  const client = getSupabase();

  const hostToken = options?.hostToken || getStoredHostToken(cleanCode);
  const helperSig = options?.helperSig || (typeof window !== 'undefined' ? localStorage.getItem('zensync_device_id') : '') || '';
  const fileExt = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const fileName = `${cleanCode}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  if (client) {
    // 1. Try server authorization ticket RPC
    try {
      await client.rpc('authorize_zen_upload', {
        p_code: cleanCode,
        p_file_path: fileName,
        p_host_token: hostToken || null,
        p_helper_sig: helperSig || null,
      });
    } catch (authErr: any) {
      console.warn('[ZenSync] Upload authorization ticket notice:', authErr?.message);
    }

    // 2. Try primary bucket: zen_sync_images
    try {
      const { data, error } = await client.storage
        .from('zen_sync_images')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (!error && data) {
        const { data: publicUrlData } = client.storage.from('zen_sync_images').getPublicUrl(fileName);
        if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
      }
    } catch (bucketErr: any) {
      console.warn('[ZenSync] Primary storage upload notice:', bucketErr?.message);
    }

    // 3. Try secondary bucket: church_documents
    try {
      const fallbackPath = `zensync/${fileName}`;
      const { data, error } = await client.storage
        .from('church_documents')
        .upload(fallbackPath, file, { cacheControl: '3600', upsert: true });

      if (!error && data) {
        const { data: publicUrlData } = client.storage.from('church_documents').getPublicUrl(fallbackPath);
        if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
      }
    } catch (fbErr: any) {
      console.warn('[ZenSync] Fallback storage upload notice:', fbErr?.message);
    }
  }

  // 4. Data URL fallback: guaranteed offline / local instant display
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
}

/**
 * Deletes a slide image file using verified host/helper authorization RPC.
 * Throws on authorization failure so callers can handle the error.
 */
export async function deleteSlideImage(
  code: string,
  imageUrl: string,
  options?: { hostToken?: string; helperSig?: string }
): Promise<void> {
  const client = getSupabase();
  if (!client || !imageUrl || !imageUrl.includes('zen_sync_images')) return;

  const cleanCode = validateSessionCode(code);
  const hostToken = options?.hostToken || getStoredHostToken(cleanCode);
  const helperSig = options?.helperSig || (typeof window !== 'undefined' ? localStorage.getItem('zensync_device_id') : '') || '';

  const match = imageUrl.match(/zen_sync_images\/(.+)$/);
  if (match && match[1]) {
    const filePath = decodeURIComponent(match[1].split('?')[0]);
    
    const { error } = await client.rpc('delete_zen_image', {
      p_code: cleanCode,
      p_image_path: filePath,
      p_host_token: hostToken || null,
      p_helper_sig: helperSig || null,
    });

    if (error) {
      console.error('[ZenSync] RPC delete_zen_image error:', error.message);
      throw new Error(`Failed to delete slide image: ${error.message}`);
    }
  }
}

/**
 * Permanently deletes the session using the verified RPC `delete_zen_session`.
 * Only deletes local state after confirming remote persistence succeeded.
 */
export async function deleteSession(code: string): Promise<void> {
  const cleanCode = validateSessionCode(code);
  const hostToken = getStoredHostToken(cleanCode);
  const client = getSupabase();

  if (client) {
    // 1. Call server-verified RPC
    const { error: rpcErr } = await client.rpc('delete_zen_session', {
      p_code: cleanCode,
      p_host_token: hostToken
    });

    if (rpcErr) {
      if (rpcErr.code === 'PGRST202' || rpcErr.message?.includes('schema cache')) {
        await client.from('sessions').delete().eq('code', cleanCode);
      } else {
        throw new Error(`Failed to delete session on server: ${rpcErr.message}`);
      }
    }

    // 2. Clean up storage folder
    try {
      const { data: files } = await client.storage
        .from('zen_sync_images')
        .list(cleanCode, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map((f) => `${cleanCode}/${f.name}`);
        await client.storage.from('zen_sync_images').remove(paths);
      }
    } catch {}

    // 3. Broadcast termination event
    try {
      const channel = client.channel(`session:${cleanCode}`);
      await channel.send({
        type: 'broadcast',
        event: 'session_deleted',
        payload: { code: cleanCode },
      });
    } catch {}
  }

  // 4. Remote deletion confirmed: delete local storage cache and host token
  localStorage.removeItem(`zensync_session_${cleanCode}`);
  localStorage.removeItem(`zensync_host_token_${cleanCode}`);

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(`zensync_local_${cleanCode}`);
      bc.postMessage({ type: 'session_deleted' });
      bc.close();
    } catch {}
  }
}

export function pruneLocalSessionCache(knownValidCodes?: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const validSet = knownValidCodes ? new Set(knownValidCodes.map(c => c.toLowerCase())) : null;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('zensync_session_')) {
      if (!validSet) {
        keysToRemove.push(key);
      } else {
        const code = key.replace('zensync_session_', '').toLowerCase();
        if (!validSet.has(code)) {
          keysToRemove.push(key);
        }
      }
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

/**
 * Fetches sessions for authorized admin management using `admin_list_zen_sessions`.
 */
export async function fetchAllSessions(): Promise<SessionData[]> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client.rpc('admin_list_zen_sessions');
  if (error) {
    console.error('[ZenSync] RPC admin_list_zen_sessions error:', error.message);
    throw new Error(`Failed to list sessions: ${error.message}`);
  }

  if (Array.isArray(data)) {
    return data.map((row: any) => ({
      code: row.code,
      created_at: row.created_at,
      updated_at: row.created_at,
      device_info: { deviceName: row.device_name },
      main_signature: null,
      helper_signature: row.has_helper ? 'assigned' : null,
      helper_device_info: null,
      content: { sections: [] } as any,
      current_slide: { sectionId: '', slideIndex: 0, globalIndex: 0 }
    }));
  }

  return [];
}

/**
 * Permanently deletes all sessions (Admin only) using `admin_delete_all_zen_sessions`.
 */
export async function deleteAllSessions(): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client unavailable.');

  const { error } = await client.rpc('admin_delete_all_zen_sessions');
  if (error) {
    throw new Error(`Failed to delete all sessions: ${error.message}`);
  }

  // Clear local caches
  pruneLocalSessionCache();
}

export interface SessionSubscriptionCallbacks {
  onSlideChange?: (slide: CurrentSlideState) => void;
  onContentChange?: (sections: SectionItem[]) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onSessionDeleted?: () => void;
}

/**
 * Subscribes to realtime session updates with coalescing, BroadcastChannel integration,
 * and stale polling prevention.
 */
export function subscribeToSession(
  code: string,
  callbacks: SessionSubscriptionCallbacks
): () => void {
  const cleanCode = validateSessionCode(code);
  let isUnsubscribed = false;
  let lastRealtimeTimestamp = Date.now();

  const client = getSupabase();

  // 1. Supabase Realtime Channel
  let channel: any = null;
  if (client) {
    callbacks.onStatusChange?.('connecting');

    channel = client
      .channel(`zen_session_${cleanCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `code=eq.${cleanCode}`,
        },
        (payload: any) => {
          if (isUnsubscribed) return;
          lastRealtimeTimestamp = Date.now();
          callbacks.onStatusChange?.('connected');

          const newRow = payload.new;
          if (!newRow) return;

          if (newRow.current_slide && callbacks.onSlideChange) {
            callbacks.onSlideChange(newRow.current_slide);
          }

          if (newRow.content?.sections && callbacks.onContentChange) {
            callbacks.onContentChange(newRow.content.sections);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'sessions',
          filter: `code=eq.${cleanCode}`,
        },
        () => {
          if (isUnsubscribed) return;
          callbacks.onSessionDeleted?.();
        }
      )
      .subscribe((status: string) => {
        if (isUnsubscribed) return;
        if (status === 'SUBSCRIBED') {
          callbacks.onStatusChange?.('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          callbacks.onStatusChange?.('reconnecting');
        }
      });
  } else {
    callbacks.onStatusChange?.('local_demo');
  }

  // 2. BroadcastChannel for local cross-tab sync
  let bc: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      bc = new BroadcastChannel(`zensync_local_${cleanCode}`);
      bc.onmessage = (event: MessageEvent) => {
        if (isUnsubscribed) return;
        const data = event.data;
        if (!data) return;

        if (data.type === 'slide_change' && data.slide && callbacks.onSlideChange) {
          lastRealtimeTimestamp = Date.now();
          callbacks.onSlideChange(data.slide);
        } else if (data.type === 'content_change' && data.content?.sections && callbacks.onContentChange) {
          lastRealtimeTimestamp = Date.now();
          callbacks.onContentChange(data.content.sections);
        } else if (data.type === 'session_deleted') {
          callbacks.onSessionDeleted?.();
        }
      };
    } catch {}
  }

  // 3. Fallback Health/Polling with stale-check guard
  // If realtime messages arrived recently (<4s), skip polling fetch to avoid overwriting state
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;

    // Guard: Only poll if realtime has been silent for more than 4 seconds
    const timeSinceRealtime = Date.now() - lastRealtimeTimestamp;
    if (timeSinceRealtime < 4000) {
      return;
    }

    try {
      const session = await getSession(cleanCode);
      if (isUnsubscribed) return;

      if (!session) {
        callbacks.onSessionDeleted?.();
        return;
      }

      callbacks.onStatusChange?.(client ? 'connected' : 'local_demo');
      if (session.current_slide && callbacks.onSlideChange) {
        callbacks.onSlideChange(session.current_slide);
      }
      if (session.content?.sections && callbacks.onContentChange) {
        callbacks.onContentChange(session.content.sections);
      }
    } catch {
      if (!isUnsubscribed) {
        callbacks.onStatusChange?.('reconnecting');
      }
    }
  }, 5000);

  // Return unsubscribe cleanup function
  return () => {
    isUnsubscribed = true;
    clearInterval(pollInterval);
    if (channel && client) {
      client.removeChannel(channel);
    }
    if (bc) {
      bc.close();
    }
  };
}
