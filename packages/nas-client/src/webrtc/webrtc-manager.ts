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
import wrtc from '@roamhq/wrtc';
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = wrtc as any;

export interface WebRTCManagerOptions {
  serverUrl: string;
  deviceId: string;
  clientKey: string;
}

interface PeerState {
  pc: any;
  dataChannel: any | null;
  ready: boolean;
}

export class WebRTCManager {
  private signalClient: SignalClient;
  private peers = new Map<string, PeerState>();
  private deviceId: string;
  private readonly chunkSize = 32 * 1024;
  private connectTimer?: ReturnType<typeof setTimeout>;
  private readonly connectTimeoutMs = 15000;

  // VPN packet callbacks
  onIPPacketReceived?: (packet: Buffer) => void;
  onVPNControlReceived?: (msg: any) => void;

  constructor(options: WebRTCManagerOptions) {
    this.signalClient = new SignalClient(options);
    this.deviceId = options.deviceId;
    this.signalClient.onMessage((msg) => this.handleSignal(msg));
  }

  async start(): Promise<void> {
    this.signalClient.connect();
    logger.info('WebRTC manager started (NAS)', { mode: 'lazy' });
    this.startConnectTimer();
  }

  isReady(): boolean {
    for (const peer of this.peers.values()) {
      if (peer.ready) return true;
    }
    return false;
  }

  getReadyPeerCount(): number {
    let count = 0;
    for (const peer of this.peers.values()) {
      if (peer.ready) count++;
    }
    return count;
  }

  // Placeholder for large data transfer. Returns false to indicate fallback.
  async sendLargePayload(_data: Buffer): Promise<boolean> {
    let sent = false;
    for (const peer of this.peers.values()) {
      if (!peer.ready || !peer.dataChannel) continue;
      try {
        peer.dataChannel.send(_data);
        sent = true;
      } catch (err) {
        logger.warn('WebRTC dataChannel send failed', { err });
      }
    }
    return sent;
  }

  async sendIPPacket(data: Buffer): Promise<boolean> {
    let sent = false;
    for (const peer of this.peers.values()) {
      if (!peer.ready || !peer.dataChannel) continue;
      try {
        const msg: any = {
          type: 'ip_packet',
          data: data.toString('base64'),
        };
        peer.dataChannel.send(JSON.stringify(msg));
        sent = true;
      } catch (err) {
        logger.warn('WebRTC ip packet send failed', { err });
      }
    }
    return sent;
  }

  async sendFile(buffer: Buffer, meta: Omit<WebRTCFileMeta, 'size' | 'chunkSize' | 'chunkCount'>): Promise<boolean> {
    let sent = false;
    const size = buffer.length;
    const chunkSize = this.chunkSize;
    const chunkCount = Math.ceil(size / chunkSize);
    const fullMeta: WebRTCFileMeta = { ...meta, size, chunkSize, chunkCount };

    for (const peer of this.peers.values()) {
      if (!peer.ready || !peer.dataChannel) continue;
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
          peer.dataChannel.send(JSON.stringify(msg));
        }
        peer.dataChannel.send(JSON.stringify({ type: 'file_complete', meta: fullMeta } as WebRTCDataMessage));
        sent = true;
      } catch (err) {
        logger.warn('WebRTC file send failed', { err });
      }
    }
    return sent;
  }

  private async handleSignal(msg: WebRTCSignalMessage): Promise<void> {
    const peerId = (msg as any).from || 'unknown';

    try {
      switch (msg.type) {
      case 'offer': {
        const payload = msg.data as WebRTCOfferPayload;
        const peer = await this.ensurePeerConnection(peerId);
        if (!peer) return;
        await peer.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        this.signalClient.send({
          type: 'answer',
          id: `ans_${Date.now()}`,
          deviceId: msg.deviceId,
          data: { sdp: answer.sdp },
        });
        logger.info('Received WebRTC offer', { deviceId: msg.deviceId, peerId });
        break;
      }
      case 'answer': {
        const payload = msg.data as WebRTCAnswerPayload;
        const peer = this.peers.get(peerId);
        if (!peer) return;
        await peer.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
        logger.info('Received WebRTC answer', { deviceId: msg.deviceId, peerId });
        break;
      }
      case 'ice': {
        const payload = msg.data as WebRTCIcePayload;
        const peer = this.peers.get(peerId);
        if (!peer) return;
        await this.addIceCandidate(peer, payload, peerId);
        break;
      }
      case 'bye': {
        this.closePeerConnection(peerId);
        logger.info('WebRTC session closed', { deviceId: msg.deviceId, peerId });
        break;
      }
      default:
        break;
      }
    } catch (err: any) {
      logger.warn('Failed to handle WebRTC signal', {
        peerId,
        type: msg.type,
        error: err?.message || String(err),
      });
    }
  }

  private async addIceCandidate(peer: PeerState, payload: WebRTCIcePayload, peerId: string): Promise<void> {
    const candidate = this.normalizeIceCandidate(payload);
    if (!candidate) return;

    try {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err: any) {
      logger.warn('Ignoring invalid WebRTC ICE candidate', {
        peerId,
        error: err?.message || String(err),
      });
    }
  }

  private normalizeIceCandidate(payload: WebRTCIcePayload | undefined): WebRTCIcePayload | undefined {
    if (!payload?.candidate || typeof payload.candidate !== 'string') return undefined;

    const candidate: WebRTCIcePayload = {
      candidate: payload.candidate,
    };

    if (typeof payload.sdpMid === 'string' && payload.sdpMid.length > 0) {
      candidate.sdpMid = payload.sdpMid;
    }

    const rawMLineIndex = payload.sdpMLineIndex;
    if (rawMLineIndex !== undefined && rawMLineIndex !== null) {
      const mLineIndex = Number(rawMLineIndex);
      if (Number.isInteger(mLineIndex) && mLineIndex >= 0 && mLineIndex <= 2147483647) {
        candidate.sdpMLineIndex = mLineIndex;
      }
    }

    if (candidate.sdpMid === undefined && candidate.sdpMLineIndex === undefined) {
      candidate.sdpMLineIndex = 0;
    }

    return candidate;
  }

  private async ensurePeerConnection(peerId: string): Promise<PeerState | undefined> {
    const existing = this.peers.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: [],
    });

    const peer: PeerState = { pc, dataChannel: null, ready: false };
    this.peers.set(peerId, peer);

    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        this.signalClient.send({
          type: 'ice',
          id: `ice_${Date.now()}`,
          deviceId: this.deviceId,
          data: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid ?? undefined,
            sdpMLineIndex: event.candidate.sdpMLineIndex ?? undefined,
          },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        peer.ready = true;
        this.clearConnectTimer();
        logger.info('WebRTC connected (NAS)', { peerId });
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        peer.ready = false;
        if (state === 'failed' || state === 'closed') {
          this.peers.delete(peerId);
        }
      }
    };

    pc.ondatachannel = (event: any) => {
      peer.dataChannel = event.channel;
      peer.dataChannel.onopen = () => {
        peer.ready = true;
        this.clearConnectTimer();
        logger.info('WebRTC data channel open (NAS)', { peerId });
      };
      peer.dataChannel.onclose = () => {
        peer.ready = false;
      };
      peer.dataChannel.onmessage = (evt: any) => {
        const data = String(evt.data || '');
        if (!data) return;
        try {
          const msg = JSON.parse(data) as any;
          const msgType = msg?.type as string;
          if (msgType === 'file_complete') {
            logger.info('WebRTC file received (NAS)', { transferId: msg.meta?.transferId });
          } else if (msgType === 'ip_packet' && msg.data) {
            try {
              const packet = Buffer.from(msg.data, 'base64');
              this.onIPPacketReceived?.(packet);
            } catch {
              // ignore invalid ip packet
            }
          } else if (msgType === 'vpn_control') {
            this.onVPNControlReceived?.(msg);
          }
        } catch {
          // ignore
        }
      };
    };

    return peer;
  }

  private closePeerConnection(peerId?: string): void {
    if (peerId) {
      const peer = this.peers.get(peerId);
      if (peer) {
        try {
          peer.dataChannel?.close();
        } catch {}
        try {
          peer.pc?.close();
        } catch {}
        this.peers.delete(peerId);
      }
    } else {
      for (const [id, peer] of this.peers) {
        try {
          peer.dataChannel?.close();
        } catch {}
        try {
          peer.pc?.close();
        } catch {}
      }
      this.peers.clear();
    }
  }

  close(): void {
    this.closePeerConnection();
    this.signalClient.close();
  }

  private startConnectTimer(): void {
    if (this.connectTimer) return;
    this.connectTimer = setTimeout(() => {
      if (!this.isReady()) {
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
