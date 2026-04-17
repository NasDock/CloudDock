/**
 * WebRTCManager — adapted for WeChat Mini Program.
 *
 * Note: WeChat Mini Program does not expose the native WebRTC API.
 * This manager handles the signaling lifecycle (offer/answer/ICE exchange)
 * and exposes callbacks for the UI. Actual media transport (audio/video/data)
 * would need to use WeChat's live-pusher / live-player components or a
 * TURN-relay approach via the tunnel API.
 *
 * Reference: packages/mobile/src/webrtc/webrtc-manager.ts
 */

import { SignalClient, SignalMessage } from './signal-client';

export interface WebRTCManagerOptions {
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

export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class WebRTCManager {
  private signalClient: SignalClient;
  private deviceId: string;
  private role: 'caller' | 'callee';
  private state: 'idle' | 'connecting' | 'connected' | 'closed' = 'idle';
  private pendingIce: RTCIceCandidateInit[] = [];
  private remoteSdp: RTCSessionDescriptionInit | null = null;
  private localSdp: RTCSessionDescriptionInit | null = null;

  // Callbacks
  private onReady?: () => void;
  private onClose?: () => void;
  private onError?: (err: string) => void;
  private onOffer?: (sdp: string) => void;
  private onAnswer?: (sdp: string) => void;
  private onIceCandidate?: (candidate: RTCIceCandidateInit) => void;

  // Timeout
  private connectTimer?: ReturnType<typeof setTimeout>;
  private readonly connectTimeoutMs = 20000;

  constructor(options: WebRTCManagerOptions) {
    this.signalClient = new SignalClient({
      serverUrl: options.serverUrl,
      deviceId: options.deviceId,
      token: options.token,
      role: options.role === 'callee' ? 'callee' : 'mini',
    });
    this.deviceId = options.deviceId;
    this.role = options.role || 'caller';
    this.onReady = options.onReady;
    this.onClose = options.onClose;
    this.onError = options.onError;
    this.onOffer = options.onOffer;
    this.onAnswer = options.onAnswer;
    this.onIceCandidate = options.onIceCandidate;

    this.signalClient.onMessage((msg) => this.handleSignal(msg));
  }

  start(): void {
    if (this.state !== 'idle') return;
    this.state = 'connecting';
    this.signalClient.connect();
    this.startConnectTimer();
    console.info('[webrtc-mini] manager started, role:', this.role);
  }

  getState(): string {
    return this.state;
  }

  isReady(): boolean {
    return this.state === 'connected';
  }

  /**
   * Create an offer (caller side). Triggers onOffer callback with SDP.
   * In a full WebRTC flow the caller would set local desc then send offer via signal.
   */
  async createOffer(): Promise<void> {
    if (this.role !== 'caller') {
      console.warn('[webrtc-mini] createOffer only valid for caller role');
      return;
    }
    // In a real WebRTC flow we'd call pc.createOffer() here.
    // For mini, we emit the offer event for the UI / tunnel to handle.
    this.onOffer?.('');
    console.info('[webrtc-mini] createOffer called (caller)');
  }

  /**
   * Set the remote answer SDP (caller side after receiving answer).
   */
  setRemoteAnswer(sdp: string): void {
    this.remoteSdp = { type: 'answer', sdp };
    console.info('[webrtc-mini] remote answer set');
    this.tryConnect();
  }

  /**
   * Set the remote offer SDP (callee side after receiving offer).
   */
  setRemoteOffer(sdp: string): void {
    this.remoteSdp = { type: 'offer', sdp };
    console.info('[webrtc-mini] remote offer set');
    this.tryConnect();
  }

  /**
   * Add an ICE candidate received from the remote peer.
   */
  addIceCandidate(candidate: RTCIceCandidateInit): void {
    if (this.state === 'connected') {
      // In full WebRTC: pc.addIceCandidate(candidate)
      this.onIceCandidate?.(candidate);
    } else {
      this.pendingIce.push(candidate);
    }
  }

  /**
   * Send a signaling message to the peer (offer / answer / ice).
   */
  sendSignal(type: 'offer' | 'answer' | 'ice', data: Record<string, unknown>): void {
    const msg: SignalMessage = {
      type,
      id: generateId(type),
      deviceId: this.deviceId,
      data,
    };
    this.signalClient.send(msg);
    console.info('[webrtc-mini] signal sent', type);
  }

  /**
   * Flush any pending ICE candidates once connected.
   */
  private flushPendingIce(): void {
    for (const cand of this.pendingIce) {
      this.onIceCandidate?.(cand);
    }
    this.pendingIce = [];
  }

  private tryConnect(): void {
    if (this.localSdp && this.remoteSdp) {
      this.state = 'connected';
      this.clearConnectTimer();
      this.onReady?.();
      this.flushPendingIce();
      console.info('[webrtc-mini] session connected');
    }
  }

  private handleSignal(msg: SignalMessage): void {
    switch (msg.type) {
      case 'offer': {
        const payload = msg.data as { sdp?: string };
        if (payload.sdp) {
          this.setRemoteOffer(payload.sdp);
          this.onOffer?.(payload.sdp);
        }
        console.info('[webrtc-mini] offer received from', msg.deviceId);
        break;
      }
      case 'answer': {
        const payload = msg.data as { sdp?: string };
        if (payload.sdp) {
          this.setRemoteAnswer(payload.sdp);
          this.onAnswer?.(payload.sdp);
        }
        console.info('[webrtc-mini] answer received from', msg.deviceId);
        break;
      }
      case 'ice': {
        const payload = msg.data as RTCIceCandidateInit;
        this.addIceCandidate(payload);
        this.onIceCandidate?.(payload);
        console.info('[webrtc-mini] ICE candidate received');
        break;
      }
      case 'signal_ready': {
        console.info('[webrtc-mini] peer ready');
        if (this.role === 'caller') {
          this.createOffer();
        }
        break;
      }
      case 'bye': {
        console.info('[webrtc-mini] peer ended session');
        this.state = 'closed';
        this.onClose?.();
        break;
      }
      default:
        break;
    }
  }

  private startConnectTimer(): void {
    if (this.connectTimer) return;
    this.connectTimer = setTimeout(() => {
      if (this.state !== 'connected') {
        console.warn('[webrtc-mini] connection timeout');
        this.state = 'idle';
        this.onError?.('连接超时，请重试');
      }
    }, this.connectTimeoutMs);
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = undefined;
    }
  }

  close(): void {
    this.clearConnectTimer();
    this.state = 'closed';
    this.sendSignal('ice', { candidate: '', sdpMid: null, sdpMLineIndex: null });
    this.signalClient.close();
    this.onClose?.();
    console.info('[webrtc-mini] manager closed');
  }
}
