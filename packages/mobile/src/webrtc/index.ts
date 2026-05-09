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

export async function sendIPPacket(data: ArrayBuffer): Promise<boolean> {
  if (manager?.isReady()) {
    return manager.sendIPPacket(data);
  }
  return false;
}

export function setIPPacketHandler(handler: (packet: ArrayBuffer) => void): void {
  if (manager) {
    manager.onIPPacketReceived = handler;
  }
}

export function setVPNControlHandler(handler: (msg: any) => void): void {
  if (manager) {
    manager.onVPNControlReceived = handler;
  }
}

export function setConnectionStateHandler(handler: (state: 'connected' | 'failed' | 'disconnected' | 'closed') => void): void {
  if (manager) {
    manager.onConnectionStateChange = handler;
  }
}

export function isWebRTCReady(): boolean {
  return manager?.isReady() ?? false;
}

export function stopWebRTC(): void {
  manager?.close();
  manager = null;
}
