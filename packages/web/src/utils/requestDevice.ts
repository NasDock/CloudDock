const STORAGE_KEY = 'requestDeviceId';

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `rd_${crypto.randomUUID()}`;
  }
  return `rd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getRequestDeviceId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const next = generateId();
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}

export function getRequestDeviceHeaders(): Record<string, string> {
  const deviceId = getRequestDeviceId();
  const platform = localStorage.getItem('requestDevicePlatform') || navigator.platform || 'web';
  const name = localStorage.getItem('requestDeviceName') || `Web - ${platform}`;
  return {
    'x-request-device-id': deviceId,
    'x-request-device-name': name,
    'x-request-device-platform': platform,
  };
}
