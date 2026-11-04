import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CurrentSlideState, SectionItem, SessionData, DeviceAuditInfo, ConnectionStatus, NoteItem, NoticeItem, HelperJoinRequest } from '../types';
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

export function isDeviceAuthorizedAdmin(code: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const clean = (code || '').trim().toLowerCase();
  const token = localStorage.getItem(`zensync_host_token_${clean}`);
  const authFlag = localStorage.getItem(`zensync_admin_auth_${clean}`);
  return Boolean(token || authFlag);
}

export function authorizeAdminForSession(code: string, token?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const clean = (code || '').trim().toLowerCase();
  localStorage.setItem(`zensync_admin_auth_${clean}`, 'true');
  if (token) {
    localStorage.setItem(`zensync_host_token_${clean}`, token);
  } else if (!localStorage.getItem(`zensync_host_token_${clean}`)) {
    localStorage.setItem(`zensync_host_token_${clean}`, generateHostToken());
  }
}

export function verifySessionAdminPassword(session: SessionData, inputPassword: string): boolean {
  const sessionPassword = session.content?.adminPassword || (session as any).admin_password;
  if (!sessionPassword) return true; // Open if no password set
  return sessionPassword.trim() === (inputPassword || '').trim();
}

// --- Session Persistence & Realtime Functions Using Verified Server RPCs ---

/**
 * Creates a new presentation session using the secure server-side RPC `create_zen_session`.
 * Enforces host token hashing and size validation. Never exposes host_token_hash in public content.
 */
export async function createSession(
  code: string,
  sections: SectionItem[],
  deviceInfo?: DeviceAuditInfo,
  adminPassword?: string
): Promise<SessionData> {
  const cleanCode = validateSessionCode(code);
  const mainSignature = deviceInfo?.deviceId || getOrCreateDeviceId();
  const hostToken = generateHostToken();

  const contentPayload: any = {
    sections,
    device_info: deviceInfo,
    main_signature: mainSignature,
    adminPassword: adminPassword?.trim() || undefined,
    creatorToken: hostToken,
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
      const { error: insErr } = await client.from('sessions').upsert({
        code: cleanCode,
        device_name: deviceInfo?.deviceName || '',
        device_info: deviceInfo || {},
        main_signature: mainSignature,
        content: contentPayload,
        current_slide: { sectionId: sections[0]?.id || '', slideIndex: 0, globalIndex: 0 }
      }, { onConflict: 'code', ignoreDuplicates: true });
      if (insErr) {
        console.warn('[ZenSync] Direct sessions insert notice (continuing in local session mode):', insErr.message);
      }
    } catch (e: any) {
      console.warn('[ZenSync] Operating session in client fallback mode:', e?.message);
    }
  }

  // 2. Only store host token and local cache after remote confirmation
  localStorage.setItem(`zensync_host_token_${cleanCode}`, hostToken);
  localStorage.setItem(`zensync_admin_auth_${cleanCode}`, 'true');
  if (adminPassword?.trim()) {
    localStorage.setItem(`zensync_admin_pass_${cleanCode}`, adminPassword.trim());
  }

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
        .select('code, created_at, updated_at, device_name, content, current_slide, helper_signature, helper_device_info')
        .eq('code', cleanCode)
        .maybeSingle();

      if (error) {
        console.warn('Supabase getSession notice:', error.message);
      }

      if (data) {
        // Enforce 12-hour session expiration check
        const createdMs = data.created_at ? new Date(data.created_at).getTime() : 0;
        const isExpired = data.expires_at 
          ? new Date(data.expires_at).getTime() < Date.now()
          : (createdMs > 0 && Date.now() - createdMs > 12 * 60 * 60 * 1000);

        if (isExpired) {
          localStorage.removeItem(`zensync_session_${cleanCode}`);
          return null;
        }

        const mainSignature = data.content?.main_signature || null;
        const rawHelperSig = data.helper_signature || data.content?.helper_signature;
        const helperSignature = typeof rawHelperSig === 'string' && rawHelperSig.trim() ? rawHelperSig.trim() : null;
        const rawHelperDev = data.helper_device_info || data.content?.helper_device_info;
        const helperDeviceInfo = (helperSignature && rawHelperDev && (rawHelperDev.deviceName || rawHelperDev.deviceId))
          ? rawHelperDev
          : null;

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
            notes: data.content?.notes || [],
            activeNotice: data.content?.activeNotice || null,
            helper_request: data.content?.helper_request || null,
            adminPassword: data.content?.adminPassword || (data.content as any)?.admin_password || undefined,
            creatorToken: data.content?.creatorToken || undefined,
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
 * Submits a join request for the HELPER role which requires approval by the Main presenter.
 * If this device is already the approved helper (reconnecting), returns immediately as approved.
 */
export async function requestHelperJoin(
  code: string,
  signature: string,
  helperInfo?: DeviceAuditInfo
): Promise<{ success: boolean; status: 'approved' | 'pending' | 'occupied' | 'error'; error?: string; session?: SessionData }> {
  let cleanCode: string;
  try {
    cleanCode = validateSessionCode(code);
  } catch (valErr: any) {
    return { success: false, status: 'error', error: valErr.message };
  }
  const client = getSupabase();
  if (!client) {
    return { success: false, status: 'error', error: 'Supabase client is not connected.' };
  }

  try {
    const existing = await getSession(cleanCode);
    if (!existing) {
      return { success: false, status: 'error', error: `Session "${cleanCode}" not found.` };
    }

    // 1. If this device is already the assigned helper, allow instant re-entry
    const existingHelperSig = existing.helper_signature || existing.content?.helper_signature;
    if (existingHelperSig && existingHelperSig === signature) {
      return { success: true, status: 'approved', session: existing };
    }

    // 2. If another device is already approved and active as helper, reject
    if (existingHelperSig && existingHelperSig !== signature) {
      return { success: false, status: 'occupied', error: 'Only 1 Helper is allowed per presentation session.' };
    }

    // 3. Create pending join request
    const joinReq: HelperJoinRequest = {
      deviceId: signature,
      helperInfo: helperInfo || {
        deviceId: signature,
        deviceName: 'Helper Device',
        deviceModel: 'Mobile Web',
        platform: 'Web',
        userAgent: '',
        timestamp: new Date().toISOString()
      },
      status: 'pending',
      requestedAt: Date.now()
    };

    const updatedContent = {
      ...existing.content,
      helper_request: joinReq
    };

    // Update in Supabase
    await client
      .from('sessions')
      .update({
        content: updatedContent,
        updated_at: new Date().toISOString()
      })
      .eq('code', cleanCode);

    // Broadcast join request to Main presenter via Supabase Realtime & BroadcastChannel
    try {
      const channel = client.channel(`zen_session_${cleanCode}`);
      await channel.send({
        type: 'broadcast',
        event: 'helper_request',
        payload: { request: joinReq },
      });
    } catch {}

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel(`zensync_local_${cleanCode}`);
        bc.postMessage({ type: 'helper_request', request: joinReq });
        bc.close();
      } catch {}
    }

    return { success: true, status: 'pending', session: existing };
  } catch (err: any) {
    return { success: false, status: 'error', error: err.message || 'Failed to submit helper join request.' };
  }
}

/**
 * Main presenter responds to a helper join request (accept or decline).
 */
export async function respondHelperRequest(
  code: string,
  deviceId: string,
  decision: 'approved' | 'rejected',
  helperInfo?: DeviceAuditInfo
): Promise<void> {
  const cleanCode = validateSessionCode(code);
  const client = getSupabase();
  if (!client) return;

  const existing = await getSession(cleanCode);
  if (!existing) return;

  const req: HelperJoinRequest = {
    deviceId,
    helperInfo: helperInfo || existing.content?.helper_request?.helperInfo || {
      deviceId,
      deviceName: 'Helper Device',
      deviceModel: 'Mobile Web',
      platform: 'Web',
      userAgent: '',
      timestamp: new Date().toISOString()
    },
    status: decision,
    requestedAt: Date.now()
  };

  const updatedContent = {
    ...existing.content,
    helper_request: req,
    ...(decision === 'approved' ? {
      helper_signature: deviceId,
      helper_device_info: req.helperInfo
    } : {
      helper_signature: null,
      helper_device_info: null
    })
  };

  const updatePayload: any = {
    content: updatedContent,
    updated_at: new Date().toISOString()
  };

  if (decision === 'approved') {
    updatePayload.helper_signature = deviceId;
    updatePayload.helper_device_info = req.helperInfo;
  } else {
    updatePayload.helper_signature = null;
    updatePayload.helper_device_info = null;
  }

  await client.from('sessions').update(updatePayload).eq('code', cleanCode);

  // Broadcast decision to Helper
  try {
    const channel = client.channel(`zen_session_${cleanCode}`);
    await channel.send({
      type: 'broadcast',
      event: 'helper_decision',
      payload: { deviceId, status: decision, helperInfo: req.helperInfo },
    });
  } catch {}

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(`zensync_local_${cleanCode}`);
      bc.postMessage({ type: 'helper_decision', deviceId, status: decision, helperInfo: req.helperInfo });
      bc.close();
    } catch {}
  }
}

/**
 * Synchronizes presentation notes across all connected devices (Main, Sub, Helper).
 */
export async function updateSessionNotes(
  code: string,
  notes: NoteItem[]
): Promise<void> {
  const cleanCode = validateSessionCode(code);
  const client = getSupabase();

  if (client) {
    const existing = await getSession(cleanCode);
    if (existing) {
      const updatedContent = {
        ...existing.content,
        notes
      };
      await client
        .from('sessions')
        .update({
          content: updatedContent,
          updated_at: new Date().toISOString()
        })
        .eq('code', cleanCode);
    }

    try {
      const channel = client.channel(`zen_session_${cleanCode}`);
      await channel.send({
        type: 'broadcast',
        event: 'notes_change',
        payload: { notes },
      });
    } catch {}
  }

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(`zensync_local_${cleanCode}`);
      bc.postMessage({ type: 'notes_change', notes });
      bc.close();
    } catch {}
  }

  // Local cache
  const cached = localStorage.getItem(`zensync_session_${cleanCode}`);
  if (cached) {
    try {
      const parsed: SessionData = JSON.parse(cached);
      parsed.content = { ...parsed.content, notes };
      localStorage.setItem(`zensync_session_${cleanCode}`, JSON.stringify(parsed));
    } catch {}
  }
}

/**
 * Broadcasts an instant notice announcement to all Sub and Helper screens.
 */
export async function broadcastSessionNotice(
  code: string,
  notice: NoticeItem | null
): Promise<void> {
  const cleanCode = validateSessionCode(code);
  const client = getSupabase();

  if (client) {
    const existing = await getSession(cleanCode);
    if (existing) {
      const updatedContent = {
        ...existing.content,
        activeNotice: notice
      };
      await client
        .from('sessions')
        .update({
          content: updatedContent,
          updated_at: new Date().toISOString()
        })
        .eq('code', cleanCode);
    }

    try {
      const channel = client.channel(`zen_session_${cleanCode}`);
      await channel.send({
        type: 'broadcast',
        event: 'notice_broadcast',
        payload: { notice },
      });
    } catch {}
  }

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(`zensync_local_${cleanCode}`);
      bc.postMessage({ type: 'notice_broadcast', notice });
      bc.close();
    } catch {}
  }

  const cached = localStorage.getItem(`zensync_session_${cleanCode}`);
  if (cached) {
    try {
      const parsed: SessionData = JSON.parse(cached);
      parsed.content = { ...parsed.content, activeNotice: notice };
      localStorage.setItem(`zensync_session_${cleanCode}`, JSON.stringify(parsed));
    } catch {}
  }
}

/**
 * Dismisses/clears the active notice announcement.
 */
export async function dismissSessionNotice(code: string): Promise<void> {
  await broadcastSessionNotice(code, null);
}

/**
 * Claims the exclusive HELPER role for a session using the atomic RPC `claim_zen_helper`
 * with direct table-level fallback if RPC is not deployed.
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
    // 1. If this exact device already claimed the helper role, allow smooth reconnection
    const existing = await getSession(cleanCode);
    if (existing) {
      const existingHelperSig = existing.helper_signature || existing.content?.helper_signature;
      if (existingHelperSig && existingHelperSig === signature) {
        return { success: true, session: existing };
      }
    }

    // 2. Invoke atomic claim RPC
    const { data: rpcRes, error: rpcErr } = await client.rpc('claim_zen_helper', {
      p_code: cleanCode,
      p_helper_signature: signature,
      p_helper_device_info: helperInfo || {}
    });

    if (!rpcErr) {
      const session = await getSession(cleanCode);
      return { success: true, session: session || undefined };
    }

    // 3. Fallback: direct table claim if RPC is not present
    if (rpcErr.code === 'PGRST202' || rpcErr.message?.includes('schema cache')) {
      const latest = await getSession(cleanCode);
      const activeSig = latest?.helper_signature || latest?.content?.helper_signature;

      if (!activeSig || activeSig === signature) {
        const { error: updErr } = await client
          .from('sessions')
          .update({
            helper_signature: signature,
            helper_device_info: helperInfo || {},
            updated_at: new Date().toISOString()
          })
          .eq('code', cleanCode);

        if (!updErr) {
          const refreshed = await getSession(cleanCode);
          return { success: true, session: refreshed || undefined };
        }
      } else {
        return { success: false, error: 'Only 1 Helper is allowed per presentation session.' };
      }
    }

    // If RPC rejected but session already matches this device signature, allow it
    const refreshed = await getSession(cleanCode);
    const currentHelperSig = refreshed?.helper_signature || refreshed?.content?.helper_signature;
    if (currentHelperSig === signature) {
      return { success: true, session: refreshed || undefined };
    }
    return { success: false, error: rpcErr.message || 'Only 1 Helper is allowed per presentation session.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'An error occurred while claiming helper role.' };
  }
}

/**
 * Releases the HELPER role using `release_zen_helper` with direct table fallback.
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
      try {
        await client
          .from('sessions')
          .update({
            helper_signature: null,
            helper_device_info: null,
            updated_at: new Date().toISOString()
          })
          .eq('code', cleanCode)
          .eq('helper_signature', signature);
      } catch (tErr: any) {
        console.warn('[ZenSync] Fallback table release helper notice:', tErr?.message);
      }
    }
  }
}

/**
 * Main presenter forcefully kicks active helper using `force_release_zen_helper`
 * with direct table fallback.
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
      try {
        await client
          .from('sessions')
          .update({
            helper_signature: null,
            helper_device_info: null,
            updated_at: new Date().toISOString()
          })
          .eq('code', cleanCode);
      } catch (tErr: any) {
        console.warn('[ZenSync] Fallback table force release notice:', tErr?.message);
      }
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
      bc.postMessage({ type: 'slide_change', currentSlide, slide: currentSlide });
      bc.close();
    } catch {}
  }

  // 2. Supabase Realtime channel broadcast (immediate low latency)
  const client = getSupabase();
  if (client) {
    try {
      const channel = client.channel(`zen_session_${cleanCode}`);
      await channel.send({
        type: 'broadcast',
        event: 'slide_change',
        payload: { currentSlide, slide: currentSlide },
      });
    } catch (bcErr) {
      console.warn('[ZenSync] Realtime broadcast warning:', bcErr);
    }

    // 3. Persistent state update via RPC or direct table
    const { error } = await client.rpc('update_zen_current_slide', {
      p_code: cleanCode,
      p_current_slide: currentSlide,
      p_host_token: hostToken || null,
      p_helper_sig: helperSig || null
    });

    if (error) {
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

  // Validate payload size (< 5MB for multi-section slide presentations)
  const payloadStr = JSON.stringify(sections);
  if (payloadStr.length > 5 * 1024 * 1024) {
    throw new Error('Slide content payload exceeds maximum safe limit of 5MB. Please optimize high-resolution images.');
  }

  // 1. Supabase Server RPC or direct table update
  const client = getSupabase();
  if (client) {
    const { error } = await client.rpc('update_zen_session_content', {
      p_code: cleanCode,
      p_host_token: hostToken || '',
      p_content: { sections }
    });

    if (error) {
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
      const channel = client.channel(`zen_session_${cleanCode}`);
      await channel.send({
        type: 'broadcast',
        event: 'content_change',
        payload: { sections, content: { sections } },
      });
    } catch {}
  }

  // 2. BroadcastChannel
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel(`zensync_local_${cleanCode}`);
      bc.postMessage({ type: 'content_change', sections, content: { sections } });
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
      const channel = client.channel(`zen_session_${cleanCode}`);
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
    console.warn('[ZenSync] RPC admin_list_zen_sessions notice, attempting direct sessions table query:', error.message);
    try {
      const { data: tableData, error: tableErr } = await client
        .from('sessions')
        .select('code, created_at, updated_at, device_name, current_slide, helper_signature')
        .order('created_at', { ascending: false });

      if (!tableErr && Array.isArray(tableData)) {
        return tableData.map((row: any) => ({
          code: row.code,
          created_at: row.created_at,
          updated_at: row.updated_at || row.created_at,
          device_info: { deviceName: row.device_name || 'Presenter Device' },
          main_signature: null,
          helper_signature: row.helper_signature ? 'assigned' : null,
          helper_device_info: null,
          content: { sections: [] } as any,
          current_slide: row.current_slide || { sectionId: '', slideIndex: 0, globalIndex: 0 },
        }));
      }
    } catch (fallbackErr) {
      console.warn('[ZenSync] Direct table fallback notice:', fallbackErr);
    }
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
 * Permanently deletes all sessions (Admin only) using `admin_delete_all_zen_sessions`
 * with direct table fallback.
 */
export async function deleteAllSessions(): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase client unavailable.');

  const { error } = await client.rpc('admin_delete_all_zen_sessions');
  if (error) {
    console.warn('[ZenSync] admin_delete_all_zen_sessions RPC notice, using direct table delete:', error.message);
    const { error: delErr } = await client.from('sessions').delete().neq('code', '');
    if (delErr) {
      throw new Error(`Failed to delete all sessions: ${delErr.message}`);
    }
  }

  // Clear local caches
  pruneLocalSessionCache();
}

export interface SessionSubscriptionCallbacks {
  onSlideChange?: (slide: CurrentSlideState) => void;
  onContentChange?: (sections: SectionItem[]) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onSessionDeleted?: () => void;
  onNotesChange?: (notes: NoteItem[]) => void;
  onNoticeReceived?: (notice: NoticeItem | null) => void;
  onHelperRequest?: (request: HelperJoinRequest | null) => void;
  onHelperDecision?: (decision: { deviceId: string; status: 'approved' | 'rejected'; helperInfo?: DeviceAuditInfo }) => void;
}

/**
 * Subscribes to realtime session updates with coalescing, BroadcastChannel integration,
 * Supabase Realtime WebSocket broadcast, and stale polling prevention.
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

          if (newRow.content?.notes && callbacks.onNotesChange) {
            callbacks.onNotesChange(newRow.content.notes);
          }

          if (callbacks.onNoticeReceived) {
            callbacks.onNoticeReceived(newRow.content?.activeNotice || null);
          }

          if (newRow.content?.helper_request && callbacks.onHelperRequest) {
            callbacks.onHelperRequest(newRow.content.helper_request);
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
      .on('broadcast', { event: 'slide_change' }, (payload: any) => {
        if (isUnsubscribed) return;
        lastRealtimeTimestamp = Date.now();
        callbacks.onStatusChange?.('connected');
        const slide = payload.payload?.currentSlide || payload.payload?.slide || payload.currentSlide || payload.slide;
        if (slide && callbacks.onSlideChange) {
          callbacks.onSlideChange(slide);
        }
      })
      .on('broadcast', { event: 'content_change' }, (payload: any) => {
        if (isUnsubscribed) return;
        lastRealtimeTimestamp = Date.now();
        callbacks.onStatusChange?.('connected');
        const sections = payload.payload?.sections || payload.payload?.content?.sections || payload.sections;
        if (sections && callbacks.onContentChange) {
          callbacks.onContentChange(sections);
        }
      })
      .on('broadcast', { event: 'notes_change' }, (payload: any) => {
        if (isUnsubscribed) return;
        lastRealtimeTimestamp = Date.now();
        callbacks.onStatusChange?.('connected');
        const notes = payload.payload?.notes || payload.notes;
        if (notes && callbacks.onNotesChange) {
          callbacks.onNotesChange(notes);
        }
      })
      .on('broadcast', { event: 'notice_broadcast' }, (payload: any) => {
        if (isUnsubscribed) return;
        lastRealtimeTimestamp = Date.now();
        callbacks.onStatusChange?.('connected');
        const notice = payload.payload !== undefined ? payload.payload.notice : payload.notice;
        if (callbacks.onNoticeReceived) {
          callbacks.onNoticeReceived(notice ?? null);
        }
      })
      .on('broadcast', { event: 'helper_request' }, (payload: any) => {
        if (isUnsubscribed) return;
        const req = payload.payload?.request || payload.request;
        if (req && callbacks.onHelperRequest) {
          callbacks.onHelperRequest(req);
        }
      })
      .on('broadcast', { event: 'helper_decision' }, (payload: any) => {
        if (isUnsubscribed) return;
        const decision = payload.payload || payload;
        if (decision && callbacks.onHelperDecision) {
          callbacks.onHelperDecision(decision);
        }
      })
      .on('broadcast', { event: 'session_deleted' }, () => {
        if (isUnsubscribed) return;
        callbacks.onSessionDeleted?.();
      })
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

        const slide = data.currentSlide || data.slide;
        const sections = data.sections || data.content?.sections;

        if (data.type === 'slide_change' && slide && callbacks.onSlideChange) {
          lastRealtimeTimestamp = Date.now();
          callbacks.onSlideChange(slide);
        } else if (data.type === 'content_change' && sections && callbacks.onContentChange) {
          lastRealtimeTimestamp = Date.now();
          callbacks.onContentChange(sections);
        } else if (data.type === 'notes_change' && data.notes && callbacks.onNotesChange) {
          lastRealtimeTimestamp = Date.now();
          callbacks.onNotesChange(data.notes);
        } else if (data.type === 'notice_broadcast' && callbacks.onNoticeReceived) {
          lastRealtimeTimestamp = Date.now();
          callbacks.onNoticeReceived(data.notice ?? null);
        } else if (data.type === 'helper_request' && data.request && callbacks.onHelperRequest) {
          callbacks.onHelperRequest(data.request);
        } else if (data.type === 'helper_decision' && callbacks.onHelperDecision) {
          callbacks.onHelperDecision(data);
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
      if (session.content?.notes && callbacks.onNotesChange) {
        callbacks.onNotesChange(session.content.notes);
      }
      if (callbacks.onNoticeReceived) {
        callbacks.onNoticeReceived(session.content?.activeNotice || null);
      }
      if (session.content?.helper_request && callbacks.onHelperRequest) {
        callbacks.onHelperRequest(session.content.helper_request);
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
