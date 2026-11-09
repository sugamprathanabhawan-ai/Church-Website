import type { DeviceAuditInfo } from '../types';

const DEVICE_ID_KEY = 'zensync_device_id';
const DEVICE_NAME_KEY = 'zensync_device_name';

/**
 * Returns or generates a persistent random non-fingerprinting ID for this session/browser
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_session';
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
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(DEVICE_NAME_KEY) || '';
}

/**
 * Saves user's friendly phone/device name for future sessions
 */
export function saveDeviceName(name: string): void {
  if (typeof window === 'undefined') return;
  if (name.trim()) {
    localStorage.setItem(DEVICE_NAME_KEY, name.trim());
  }
}

/**
 * Friendly device role detection without invasive hardware fingerprinting
 */
export function detectDeviceModel(): { model: string; platform: string } {
  if (typeof window === 'undefined') {
    return { model: 'Presenter Display', platform: 'Web' };
  }

  // Non-invasive check for mobile touch vs desktop
  const isTouch = Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  const platform = isTouch ? 'Mobile Web' : 'Desktop Web';
  const model = isTouch ? 'Mobile Device' : 'Display Console';

  return { model, platform };
}

/**
 * Generates an initial suggested friendly device name
 */
export function getInitialDeviceNameSuggestion(): string {
  const saved = getSavedDeviceName();
  if (saved) return saved;

  const detected = detectDeviceModel();
  return detected.model;
}

/**
 * Collects non-invasive friendly device info for session role coordination
 */
export async function collectDeviceAuditInfo(customName?: string): Promise<DeviceAuditInfo> {
  const deviceId = getOrCreateDeviceId();
  const detected = detectDeviceModel();
  const name = customName?.trim() || getSavedDeviceName() || detected.model;

  saveDeviceName(name);

  return {
    deviceId,
    deviceName: name,
    deviceModel: detected.model,
    platform: detected.platform,
    userAgent: '', // Redacted for privacy
    ip: undefined, // Redacted: no third-party IP leak
    screenResolution: undefined, // Redacted
    timestamp: new Date().toISOString(),
  };
}
