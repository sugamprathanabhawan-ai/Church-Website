import type { DeviceAuditInfo } from '../types';

const DEVICE_ID_KEY = 'zensync_device_id';
const DEVICE_NAME_KEY = 'zensync_device_name';

/**
 * Returns or generates a persistent unique ID for this device/browser
 */
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const randomPart = Math.random().toString(36).substring(2, 10);
    const timestampPart = Date.now().toString(36);
    id = `dev_${timestampPart}_${randomPart}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Gets user's previously saved friendly phone/device name
 */
export function getSavedDeviceName(): string {
  return localStorage.getItem(DEVICE_NAME_KEY) || '';
}

/**
 * Saves user's friendly phone/device name for future sessions
 */
export function saveDeviceName(name: string): void {
  if (name.trim()) {
    localStorage.setItem(DEVICE_NAME_KEY, name.trim());
  }
}

/**
 * Auto-detects device hardware brand, phone model, and OS platform
 */
export function detectDeviceModel(): { model: string; platform: string } {
  if (typeof window === 'undefined') {
    return { model: 'Unknown Device', platform: 'Unknown' };
  }

  const ua = navigator.userAgent || '';
  let platform = 'Unknown';
  let model = 'Unknown Device';

  // 1. iOS detection
  const isIPhone = /iPhone/i.test(ua);
  const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIPod = /iPod/i.test(ua);

  if (isIPhone) {
    platform = 'iOS';
    const width = window.screen.width;
    const height = window.screen.height;
    if ((width === 430 && height === 932) || (width === 393 && height === 852)) {
      model = 'Apple iPhone (Pro / Max)';
    } else if ((width === 390 && height === 844) || (width === 428 && height === 926)) {
      model = 'Apple iPhone (12/13/14/15)';
    } else {
      model = 'Apple iPhone';
    }
  } else if (isIPad) {
    platform = 'iPadOS';
    model = 'Apple iPad';
  } else if (isIPod) {
    platform = 'iOS';
    model = 'Apple iPod Touch';
  } else if (/Android/i.test(ua)) {
    platform = 'Android';
    const match = ua.match(/;\s*([^;]+?)\s*Build/i);
    if (match && match[1]) {
      const rawModel = match[1].trim();
      if (/SM-|Samsung/i.test(rawModel)) {
        model = `Samsung (${rawModel})`;
      } else if (/Pixel/i.test(rawModel)) {
        model = `Google ${rawModel}`;
      } else if (/Redmi|POCO|Xiaomi/i.test(rawModel)) {
        model = `Xiaomi (${rawModel})`;
      } else if (/OnePlus/i.test(rawModel)) {
        model = `OnePlus (${rawModel})`;
      } else {
        model = `Android (${rawModel})`;
      }
    } else {
      model = 'Android Smartphone';
    }
  } else if (/Windows/i.test(ua)) {
    platform = 'Windows';
    model = 'Windows PC';
  } else if (/Macintosh|Mac OS/i.test(ua)) {
    platform = 'macOS';
    model = 'Apple Mac';
  } else if (/Linux/i.test(ua)) {
    platform = 'Linux';
    model = 'Linux Computer';
  }

  return { model, platform };
}

/**
 * Fetches client public IP address with a strict timeout fallback
 */
export async function fetchClientIp(): Promise<string | undefined> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1800);

  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return data.ip;
    }
  } catch {
    // Graceful fallback if offline, blocked, or slow
  } finally {
    clearTimeout(timeoutId);
  }

  return undefined;
}

/**
 * Generates an initial suggested device name (e.g. "Apple iPhone", "Samsung Galaxy", or previously saved)
 */
export function getInitialDeviceNameSuggestion(): string {
  const saved = getSavedDeviceName();
  if (saved) return saved;

  const detected = detectDeviceModel();
  return detected.model;
}

/**
 * Collects complete device audit record for accountability
 */
export async function collectDeviceAuditInfo(customName?: string): Promise<DeviceAuditInfo> {
  const deviceId = getOrCreateDeviceId();
  const detected = detectDeviceModel();
  const name = customName?.trim() || getSavedDeviceName() || detected.model;

  saveDeviceName(name);

  const ip = await fetchClientIp();

  const screenRes = typeof window !== 'undefined'
    ? `${window.screen.width}x${window.screen.height}`
    : undefined;

  return {
    deviceId,
    deviceName: name,
    deviceModel: detected.model,
    platform: detected.platform,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    ip,
    screenResolution: screenRes,
    timestamp: new Date().toISOString(),
  };
}
