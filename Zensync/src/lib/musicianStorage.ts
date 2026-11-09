/**
 * Musician Local Storage Service (IndexedDB with memory/localStorage fallback)
 * Stores musician chord charts, lead sheets, and custom slide overrides locally on device.
 * Never uploaded to Supabase or broadcast to other participants.
 */

const DB_NAME = 'zensync_musician_db';
const DB_VERSION = 1;
const STORE_NAME = 'slide_overrides';

export interface MusicianSlideOverride {
  sessionCode: string;
  slideId: string;
  dataUrl: string;
  fileName?: string;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('sessionCode', 'sessionCode', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
    } catch (e) {
      reject(e);
    }
  });

  return dbPromise;
}

function makeKey(sessionCode: string, slideId: string): string {
  return `${(sessionCode || '').trim().toLowerCase()}__${slideId}`;
}

/**
 * Saves a local slide replacement for this musician.
 */
export async function saveSlideOverride(
  sessionCode: string,
  slideId: string,
  dataUrl: string,
  fileName?: string
): Promise<void> {
  const cleanCode = (sessionCode || '').trim().toLowerCase();
  const key = makeKey(cleanCode, slideId);
  const record: MusicianSlideOverride & { key: string } = {
    key,
    sessionCode: cleanCode,
    slideId,
    dataUrl,
    fileName,
    timestamp: Date.now(),
  };

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[musicianStorage] IndexedDB put failed, attempting localStorage fallback:', err);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(`zensync_musician_override_${key}`, JSON.stringify(record));
      }
    } catch (lsErr) {
      console.error('[musicianStorage] Failed to save slide override to localStorage:', lsErr);
    }
  }
}

/**
 * Retrieves a single slide override for a specific slide ID.
 */
export async function getSlideOverride(
  sessionCode: string,
  slideId: string
): Promise<MusicianSlideOverride | null> {
  const cleanCode = (sessionCode || '').trim().toLowerCase();
  const key = makeKey(cleanCode, slideId);

  try {
    const db = await getDB();
    return await new Promise<MusicianSlideOverride | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(`zensync_musician_override_${key}`);
        if (raw) return JSON.parse(raw);
      }
    } catch {}
    return null;
  }
}

/**
 * Retrieves all slide overrides for a session as a map { [slideId]: MusicianSlideOverride }.
 */
export async function getAllOverridesForSession(
  sessionCode: string
): Promise<Record<string, MusicianSlideOverride>> {
  const cleanCode = (sessionCode || '').trim().toLowerCase();
  const result: Record<string, MusicianSlideOverride> = {};

  try {
    const db = await getDB();
    const records = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('sessionCode');
      const req = index.getAll(cleanCode);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    for (const r of records) {
      if (r && r.slideId) {
        result[r.slideId] = r;
      }
    }
  } catch {
    // Fallback search in localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const prefix = `zensync_musician_override_${cleanCode}__`;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const item = JSON.parse(raw);
              if (item && item.slideId) {
                result[item.slideId] = item;
              }
            }
          }
        }
      }
    } catch {}
  }

  return result;
}

/**
 * Removes a specific slide override (e.g. musician clicks "Revert to Admin Slide").
 */
export async function removeSlideOverride(
  sessionCode: string,
  slideId: string
): Promise<void> {
  const cleanCode = (sessionCode || '').trim().toLowerCase();
  const key = makeKey(cleanCode, slideId);

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(`zensync_musician_override_${key}`);
    }
  } catch {}
}

/**
 * Clears all local overrides for this presentation session.
 */
export async function clearSessionOverrides(sessionCode: string): Promise<void> {
  const cleanCode = (sessionCode || '').trim().toLowerCase();
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('sessionCode');
    const req = index.openCursor(cleanCode);
    req.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } catch {}

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const prefix = `zensync_musician_override_${cleanCode}__`;
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(prefix) || k === `zensync_musician_custom_slides_${cleanCode}` || k === `zensync_musician_order_${cleanCode}`)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch {}
}

/**
 * Saves musician's local custom slides (independent from admin).
 */
export async function saveMusicianCustomSlides(sessionCode: string, slides: any[]): Promise<void> {
  const cleanCode = (sessionCode || '').trim().toLowerCase();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(`zensync_musician_custom_slides_${cleanCode}`, JSON.stringify(slides));
    }
  } catch (err) {
    console.error('[musicianStorage] Failed to save musician custom slides:', err);
  }
}

/**
 * Loads musician's local custom slides.
 */
export async function getMusicianCustomSlides(sessionCode: string): Promise<any[]> {
  const cleanCode = (sessionCode || '').trim().toLowerCase();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(`zensync_musician_custom_slides_${cleanCode}`);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return [];
}

/**
 * Saves musician's local slide reordering sequence.
 */
export async function saveMusicianSlideOrder(sessionCode: string, order: string[]): Promise<void> {
  const cleanCode = (sessionCode || '').trim().toLowerCase();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(`zensync_musician_order_${cleanCode}`, JSON.stringify(order));
    }
  } catch (err) {
    console.error('[musicianStorage] Failed to save musician slide order:', err);
  }
}

/**
 * Loads musician's local slide reordering sequence.
 */
export async function getMusicianSlideOrder(sessionCode: string): Promise<string[]> {
  const cleanCode = (sessionCode || '').trim().toLowerCase();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(`zensync_musician_order_${cleanCode}`);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return [];
}
