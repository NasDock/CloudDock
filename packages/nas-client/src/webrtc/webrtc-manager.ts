import { logger } from '../utils/logger.js';
import type {
  WebRTCSignalMessage,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIcePayload,
  WebRTCDataMessage,
  WebRTCFileMeta,
} from '@cloud-dock/shared';
import { SignalClient } from './signal-client.js';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'wrtc';

export interface WebRTCManagerOptions {
  serverUrl: string;
  deviceId: string;
  clientKey: string;
}

export class WebRTCManager {
  private signalClient: SignalClient;
  private ready = false;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: any | null = null;
  private deviceId: string;
  private readonly chunkSize = 32 * 1024;
  private connectTimer?: ReturnType<typeof setTimeout>;
  private readonly connectTimeoutMs = 15000;

  constructor(options: WebRTCManagerOptions) {
    this.signalClient = new SignalClient(options);
    this.deviceId = options.deviceId;
    this.signalClient.onMessage((msg) => this.handleSignal(msg));
  }

  async start(): Promise<void> {
    this.signalClient.connect();
    // WebRTC init happens on first offer/answer; we keep it lazy here.
    logger.info('WebRTC manager started (NAS)', { mode: 'lazy' });
    this.startConnectTimer();
  }

  isReady(): boolean {
    return this.ready;
  }

  // Placeholder for large data transfer. Returns false to indicate fallback.
  async sendLargePayload(_data: Buffer): Promise<boolean> {
    if (!this.ready || !this.dataChannel) return false;
    try {
      this.dataChannel.send(_data);
      return true;
    } catch (err) {
      logger.warn('WebRTC dataChannel send failed', { err });
      return false;
    }
  }

  async sendFile(buffer: Buffer, meta: Omit<WebRTCFileMeta, 'size' | 'chunkSize' | 'chunkCount'>): Promise<boolean> {
    if (!this.ready || !this.dataChannel) return false;
    const size = buffer.length;
    const chunkSize = this.chunkSize;
    const chunkCount = Math.ceil(size / chunkSize);
    const fullMeta: WebRTCFileMeta = { ...meta, size, chunkSize, chunkCount };
    try {
      for (let i = 0; i < chunkCount; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, size);
        const chunk = buffer.subarray(start, end);
        const msg: WebRTCDataMessage = {
          type: 'file_chunk',
          meta: fullMeta,
          index: i,
          data: chunk.toString('base64'),
        };
        this.dataChannel.send(JSON.stringify(msg));
      }
      this.dataChannel.send(JSON.stringify({ type: 'file_complete', meta: fullMeta } as WebRTCDataMessage));
      return true;
    } catch (err) {
      logger.warn('WebRTC file send failed', { err });
      return false;
    }
  }

  private async handleSignal(msg: WebRTCSignalMessage): Promise<void> {
    switch (msg.type) {
      case 'offer': {
        const payload = msg.data as WebRTCOfferPayload;
        await this.ensurePeerConnection();
        if (!this.pc) return;
        await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.signalClient.send({
          type: 'answer',
          id: `ans_${Date.now()}`,
          deviceId: msg.deviceId,
          data: { sdp: answer.sdp },
        });
        logger.info('Received WebRTC offer', { deviceId: msg.deviceId });
        break;
      }
      case 'answer': {
        const payload = msg.data as WebRTCAnswerPayload;
        await this.ensurePeerConnection();
        if (!this.pc) return;
        await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
        logger.info('Received WebRTC answer', { deviceId: msg.deviceId });
        break;
      }
      case 'ice': {
        const payload = msg.data as WebRTCIcePayload;
        await this.ensurePeerConnection();
        if (!this.pc) return;
        if (payload.candidate) {
          await this.pc.addIceCandidate(new RTCIceCandidate(payload));
        }
        break;
      }
      case 'bye': {
        this.ready = false;
        this.closePeerConnection();
        logger.info('WebRTC session closed', { deviceId: msg.deviceId });
        break;
      }
      default:
        break;
    }
  }

  private async ensurePeerConnection(): Promise<void> {
    if (this.pc) return;
    this.pc = new RTCPeerConnection({
      iceServers: [],
    });
    this.pc.onicecandidate = (event: any) => {
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
        logger.info('WebRTC connected (NAS)');
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.ready = false;
      }
    };
    this.pc.ondatachannel = (event: any) => {
      this.dataChannel = event.channel;
      this.dataChannel.onopen = () => {
        this.ready = true;
        this.clearConnectTimer();
        logger.info('WebRTC data channel open (NAS)');
      };
      this.dataChannel.onclose = () => {
        this.ready = false;
      };
      this.dataChannel.onmessage = (evt: any) => {
        const data = String(evt.data || '');
        if (!data) return;
        try {
          const msg = JSON.parse(data) as WebRTCDataMessage;
          if (msg.type === 'file_complete') {
            logger.info('WebRTC file received (NAS)', { transferId: msg.meta.transferId });
          }
        } catch {
          // ignore
        }
      };
    };
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

  private startConnectTimer(): void {
    if (this.connectTimer) return;
    this.connectTimer = setTimeout(() => {
      if (!this.ready) {
        logger.warn('WebRTC connection timeout, fallback to tunnel');
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
}
