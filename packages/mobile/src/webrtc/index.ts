import { WebRTCManager } from './webrtc-manager';

let manager: WebRTCManager | null = null;

export function startWebRTC(options: { serverUrl: string; deviceId: string; token: string }): WebRTCManager {
  manager?.close();
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

// Proxy stream methods (new mode)
export async function sendProxyConnect(streamId: string, host: string, port: number): Promise<boolean> {
  if (manager?.isReady()) {
    return manager.sendProxyConnect(streamId, host, port);
  }
  return false;
}

export async function sendProxyData(streamId: string, data: ArrayBuffer): Promise<boolean> {
  if (manager?.isReady()) {
    return manager.sendProxyData(streamId, data);
  }
  return false;
}

export async function sendProxyClose(streamId: string): Promise<boolean> {
  if (manager?.isReady()) {
    return manager.sendProxyClose(streamId);
  }
  return false;
}

export async function sendProxyError(streamId: string, message: string): Promise<boolean> {
  if (manager?.isReady()) {
    return manager.sendProxyError(streamId, message);
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

// Proxy stream handlers (new mode)
export function setProxyConnectHandler(handler: (msg: { streamId: string; host: string; port: number }) => void): void {
  if (manager) {
    manager.onProxyConnectReceived = handler;
  }
}

export function setProxyDataHandler(handler: (msg: { streamId: string; data: ArrayBuffer }) => void): void {
  if (manager) {
    manager.onProxyDataReceived = handler;
  }
}

export function setProxyCloseHandler(handler: (msg: { streamId: string }) => void): void {
  if (manager) {
    manager.onProxyCloseReceived = handler;
  }
}

export function setProxyErrorHandler(handler: (msg: { streamId: string; message: string }) => void): void {
  if (manager) {
    manager.onProxyErrorReceived = handler;
  }
}

export function isWebRTCReady(): boolean {
  return manager?.isReady() ?? false;
}

export function stopWebRTC(): void {
  manager?.close();
  manager = null;
}
