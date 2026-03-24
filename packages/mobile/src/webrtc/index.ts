import { WebRTCManager } from './webrtc-manager';

let manager: WebRTCManager | null = null;

export function startWebRTC(options: { serverUrl: string; deviceId: string; token: string }): WebRTCManager {
  manager = new WebRTCManager(options);
  manager.start();
  return manager;
}

export async function sendLargeData(data: ArrayBuffer, fallback?: () => Promise<boolean>): Promise<boolean> {
  if (manager?.isReady()) {
    const ok = await manager.sendLargePayload(data);
    if (ok) return true;
  }
  console.warn('[webrtc] not ready, fallback to tunnel');
  return fallback ? fallback() : false;
}

export function stopWebRTC(): void {
  manager?.close();
  manager = null;
}
