import type {
  WebRTCSignalMessage,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIcePayload,
  WebRTCDataMessage,
  WebRTCFileMeta,
} from '@cloud-dock/shared';
import { SignalClient } from './signal-client';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import { fromByteArray } from 'base64-js';

export interface WebRTCManagerOptions {
  serverUrl: string;
  deviceId: string;
  token: string;
}

export class WebRTCManager {
  private signalClient: SignalClient;
  private ready = false;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: any | null = null;
  private deviceId: string;
  private readonly chunkSize = 32 * 1024;
  private incomingFiles = new Map<string, { meta: WebRTCFileMeta; chunks: string[] }>();
  private connectTimer?: ReturnType<typeof setTimeout>;
  private readonly connectTimeoutMs = 15000;

  constructor(options: WebRTCManagerOptions) {
    this.signalClient = new SignalClient(options);
    this.deviceId = options.deviceId;
    this.signalClient.onMessage((msg) => this.handleSignal(msg));
  }

  start(): void {
    this.signalClient.connect();
    // WebRTC init happens on first offer/answer; keep lazy for now.
    console.info('[webrtc] manager started (mobile)');
    this.startConnectTimer();
  }

  isReady(): boolean {
    return this.ready;
  }

  async sendLargePayload(_data: ArrayBuffer): Promise<boolean> {
    if (!this.ready || !this.dataChannel) return false;
    try {
      this.dataChannel.send(_data);
      return true;
    } catch (err) {
      console.warn('[webrtc] dataChannel send failed', err);
      return false;
    }
  }

  async sendFile(_data: ArrayBuffer, _meta: Omit<WebRTCFileMeta, 'size' | 'chunkSize' | 'chunkCount'>): Promise<boolean> {
    if (!this.ready || !this.dataChannel) return false;
    const bytes = new Uint8Array(_data);
    const size = bytes.length;
    const chunkSize = this.chunkSize;
    const chunkCount = Math.ceil(size / chunkSize);
    const fullMeta: WebRTCFileMeta = { ..._meta, size, chunkSize, chunkCount };
    try {
      for (let i = 0; i < chunkCount; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, size);
        const chunk = bytes.subarray(start, end);
        const msg: WebRTCDataMessage = {
          type: 'file_chunk',
          meta: fullMeta,
          index: i,
          data: fromByteArray(chunk),
        };
        this.dataChannel.send(JSON.stringify(msg));
      }
      this.dataChannel.send(JSON.stringify({ type: 'file_complete', meta: fullMeta } as WebRTCDataMessage));
      return true;
    } catch (err) {
      console.warn('[webrtc] file send failed', err);
      return false;
    }
  }

  private handleSignal(msg: WebRTCSignalMessage): void {
    switch (msg.type) {
      case 'offer': {
        const payload = msg.data as WebRTCOfferPayload;
        this.ensurePeerConnection();
        if (!this.pc) return;
        this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp })).then(async () => {
          const answer = await this.pc!.createAnswer();
          await this.pc!.setLocalDescription(answer);
          this.signalClient.send({
            type: 'answer',
            id: `ans_${Date.now()}`,
            deviceId: msg.deviceId,
            data: { sdp: answer.sdp },
          });
        });
        console.info('[webrtc] offer received', msg.deviceId);
        break;
      }
      case 'answer': {
        const payload = msg.data as WebRTCAnswerPayload;
        this.ensurePeerConnection();
        if (!this.pc) return;
        this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
        console.info('[webrtc] answer received', msg.deviceId);
        break;
      }
      case 'ice': {
        const payload = msg.data as WebRTCIcePayload;
        this.ensurePeerConnection();
        if (!this.pc) return;
        if (payload.candidate) {
          this.pc.addIceCandidate(new RTCIceCandidate(payload));
        }
        break;
      }
      case 'bye': {
        this.ready = false;
        this.closePeerConnection();
        break;
      }
      case 'signal_ready': {
        // Mobile acts as caller by default: create offer
        this.startAsCaller();
        break;
      }
      default:
        break;
    }
  }

  private ensurePeerConnection(): void {
    if (this.pc) return;
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalClient.send({
          type: 'ice',
          id: `ice_${Date.now()}`,
          deviceId: this.deviceId,
          data: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid || undefined,
            sdpMLineIndex: event.candidate.sdpMLineIndex || undefined,
          },
        });
      }
    };
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === 'connected') {
        this.ready = true;
        this.clearConnectTimer();
        console.info('[webrtc] connected (mobile)');
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.ready = false;
      }
    };
    this.dataChannel = this.pc.createDataChannel('data');
    this.dataChannel.onopen = () => {
      this.ready = true;
      this.clearConnectTimer();
      console.info('[webrtc] data channel open (mobile)');
    };
    this.dataChannel.onclose = () => {
      this.ready = false;
    };
    this.dataChannel.onmessage = (evt: any) => {
      const text = String(evt.data || '');
      if (!text) return;
      try {
        const msg = JSON.parse(text) as WebRTCDataMessage;
        if (msg.type === 'file_chunk') {
          const entry = this.incomingFiles.get(msg.meta.transferId) || { meta: msg.meta, chunks: [] };
          entry.chunks[msg.index] = msg.data;
          this.incomingFiles.set(msg.meta.transferId, entry);
        } else if (msg.type === 'file_complete') {
          const entry = this.incomingFiles.get(msg.meta.transferId);
          if (entry) {
            console.info('[webrtc] file received', { transferId: msg.meta.transferId });
            this.incomingFiles.delete(msg.meta.transferId);
          }
        }
      } catch {}
    };
  }

  private async startAsCaller(): Promise<void> {
    this.ensurePeerConnection();
    if (!this.pc) return;
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.signalClient.send({
      type: 'offer',
      id: `off_${Date.now()}`,
      deviceId: this.deviceId,
      data: { sdp: offer.sdp },
    });
  }

  private startConnectTimer(): void {
    if (this.connectTimer) return;
    this.connectTimer = setTimeout(() => {
      if (!this.ready) {
        console.warn('[webrtc] connection timeout, fallback to tunnel');
        this.closePeerConnection();
      }
    }, this.connectTimeoutMs);
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = undefined;
    }
  }

  private closePeerConnection(): void {
    this.clearConnectTimer();
    try {
      this.dataChannel?.close();
    } catch {}
    this.dataChannel = null;
    try {
      this.pc?.close();
    } catch {}
    this.pc = null;
  }

  close(): void {
    this.closePeerConnection();
    this.signalClient.close();
  }
}
