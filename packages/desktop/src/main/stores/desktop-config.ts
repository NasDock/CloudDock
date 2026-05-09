import Store from 'electron-store';

import { randomUUID } from 'crypto';

interface DesktopConfig {
  serverUrl: string;
  accessToken: string;
  refreshToken: string;
  lastDeviceId: string;
  autoStartVPN: boolean;
  deviceId: string;
}

function ensureDeviceId(): string {
  const existing = configStore.get('deviceId');
  if (existing) return existing;
  const id = `rd_${randomUUID()}`;
  configStore.set('deviceId', id);
  return id;
}

export const configStore = new Store<DesktopConfig>({
  name: 'clouddock-desktop',
  defaults: {
    serverUrl: 'https://cloud.audiodock.cn',
    accessToken: '',
    refreshToken: '',
    lastDeviceId: '',
    autoStartVPN: false,
    deviceId: '',
  },
});

// Ensure a stable desktop device ID exists
export const desktopDeviceId = ensureDeviceId();
export const desktopDeviceName = `CloudDock Desktop - ${process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux'}`;
export const desktopDevicePlatform = `desktop-${process.platform}`;
