/**
 * WebRTC module for CloudDock Mini.
 *
 * Exports signaling-based utilities for peer-to-peer communication.
 * Note: WeChat Mini Program does not support native WebRTC APIs.
 * This module handles the signaling lifecycle; actual media transport
 * should use the tunnel API as fallback.
 */

import { SignalClient } from './signal-client';
import { WebRTCManager } from './webrtc-manager';

export { SignalClient } from './signal-client';
export { WebRTCManager } from './webrtc-manager';

export interface WebRTCStartOptions {
  serverUrl: string;
  deviceId: string;
  token: string;
  role?: 'caller' | 'callee';
  onReady?: () => void;
  onClose?: () => void;
  onError?: (err: string) => void;
  onOffer?: (sdp: string) => void;
  onAnswer?: (sdp: string) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
}

let manager: WebRTCManager | null = null;

export function startWebRTC(options: WebRTCStartOptions): WebRTCManager {
  manager = new WebRTCManager(options);
  manager.start();
  return manager;
}

export function stopWebRTC(): void {
  manager?.close();
  manager = null;
}

export function getWebRTCManager(): WebRTCManager | null {
  return manager;
}
