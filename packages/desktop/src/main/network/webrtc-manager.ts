import { SignalClient } from './signal-client';
import wrtc from '@roamhq/wrtc';
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = wrtc as any;

export interface WebRTCManagerOptions {
  serverUrl: string;
  deviceId: string;
  token: string;
}

export class WebRTCManager {
  private signalClient: SignalClient;
  private ready = false;
  private pc: any | null = null;
  private dataChannel: any | null = null;
  private deviceId: string;
  private connectTimer?: ReturnType<typeof setTimeout> | undefined;
  private readonly connectTimeoutMs = 15000;

  // VPN packet callbacks (legacy TUN mode — deprecated)
  onIPPacketReceived?: (packet: Buffer) => void;
  onVPNControlReceived?: (msg: any) => void;
  onConnectionStateChange?: (state: 'connected' | 'failed' | 'disconnected' | 'closed') => void;

  // Proxy stream callbacks (new mode: TCP over WebRTC)
  onProxyConnectReceived?: (msg: { streamId: string; host: string; port: number }) => void;
  onProxyDataReceived?: (msg: { streamId: string; data: Buffer }) => void;
  onProxyCloseReceived?: (msg: { streamId: string }) => void;
  onProxyErrorReceived?: (msg: { streamId: string; message: string }) => void;

  constructor(options: WebRTCManagerOptions) {
    this.signalClient = new SignalClient(options);
    this.deviceId = options.deviceId;
    this.signalClient.onMessage((msg) => this.handleSignal(msg));
  }

  start(): void {
    this.signalClient.connect();
    console.info('[webrtc] manager started (desktop)');
    this.startConnectTimer();
  }

  isReady(): boolean {
    return this.ready;
  }

  async sendLargePayload(data: Buffer): Promise<boolean> {
    if (!this.ready || !this.dataChannel) return false;
    try {
      this.dataChannel.send(data);
      return true;
    } catch (err) {
      console.warn('[webrtc] dataChannel send failed', err);
      return false;
    }
  }

  async sendIPPacket(data: Buffer): Promise<boolean> {
    if (!this.ready || !this.dataChannel) return false;
    try {
      const msg: any = {
        type: 'ip_packet',
        data: data.toString('base64'),
      };
      this.dataChannel.send(JSON.stringify(msg));
      return true;
    } catch (err) {
      console.warn('[webrtc] ip packet send failed', err);
      return false;
    }
  }

  // Proxy stream methods (new mode)
  async sendProxyConnect(streamId: string, host: string, port: number): Promise<boolean> {
    if (!this.ready || !this.dataChannel) return false;
    try {
      this.dataChannel.send(JSON.stringify({ type: 'proxy_connect', streamId, host, port }));
      return true;
    } catch (err) {
      console.warn('[webrtc] proxy connect send failed', err);
      return false;
    }
  }

  async sendProxyData(streamId: string, data: Buffer): Promise<boolean> {
    if (!this.ready || !this.dataChannel) return false;
    try {
      this.dataChannel.send(JSON.stringify({ type: 'proxy_data', streamId, data: data.toString('base64') }));
      return true;
    } catch (err) {
      console.warn('[webrtc] proxy data send failed', err);
      return false;
    }
  }

  async sendProxyClose(streamId: string): Promise<boolean> {
    if (!this.ready || !this.dataChannel) return false;
    try {
      this.dataChannel.send(JSON.stringify({ type: 'proxy_close', streamId }));
      return true;
    } catch (err) {
      console.warn('[webrtc] proxy close send failed', err);
      return false;
    }
  }

  async sendProxyError(streamId: string, message: string): Promise<boolean> {
    if (!this.ready || !this.dataChannel) return false;
    try {
      this.dataChannel.send(JSON.stringify({ type: 'proxy_error', streamId, message }));
      return true;
    } catch (err) {
      console.warn('[webrtc] proxy error send failed', err);
      return false;
    }
  }

  private handleSignal(msg: any): void {
    switch (msg.type) {
      case 'offer': {
        const payload = msg.data;
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
        const payload = msg.data;
        this.ensurePeerConnection();
        if (!this.pc) return;
        this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
        console.info('[webrtc] answer received', msg.deviceId);
        break;
      }
      case 'ice': {
        const payload = msg.data;
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
        const payload = msg.data;
        if (payload?.turnServers && payload.turnServers.length > 0) {
          (this as any).turnServers = payload.turnServers;
        }
        this.startAsCaller();
        break;
      }
      default:
        break;
    }
  }

  private ensurePeerConnection(): void {
    if (this.pc) return;
    const stunServers = [
      { urls: 'stun:stun.miwifi.com:3478' },
      { urls: 'stun:stun.qq.com:3478' },
      { urls: 'stun:stun.chat.bilibili.com:3478' },
    ];
    const turnServers = (this as any).turnServers || [];
    this.pc = new RTCPeerConnection({
      iceServers: [...stunServers, ...turnServers],
    });

    this.pc.onicecandidate = (event: any) => {
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

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === 'connected') {
        this.ready = true;
        this.clearConnectTimer();
        console.info('[webrtc] connected (desktop)');
        this.onConnectionStateChange?.('connected');
      } else if (state === 'failed') {
        this.ready = false;
        this.onConnectionStateChange?.('failed');
      } else if (state === 'disconnected') {
        this.ready = false;
        this.onConnectionStateChange?.('disconnected');
      } else if (state === 'closed') {
        this.ready = false;
        this.onConnectionStateChange?.('closed');
      }
    };

    this.dataChannel = this.pc.createDataChannel('data');
    this.dataChannel.onopen = () => {
      this.ready = true;
      this.clearConnectTimer();
      console.info('[webrtc] data channel open (desktop)');
    };
    this.dataChannel.onclose = () => {
      this.ready = false;
    };
    this.dataChannel.onmessage = (evt: any) => {
      const text = String(evt.data || '');
      if (!text) return;
      try {
        const msg = JSON.parse(text);
        switch (msg.type) {
          case 'ip_packet': {
            try {
              const packet = Buffer.from(msg.data, 'base64');
              this.onIPPacketReceived?.(packet);
            } catch {
              // ignore invalid ip packet
            }
            break;
          }
          case 'vpn_control': {
            this.onVPNControlReceived?.(msg);
            break;
          }
          case 'proxy_connect': {
            this.onProxyConnectReceived?.({ streamId: msg.streamId, host: msg.host, port: msg.port });
            break;
          }
          case 'proxy_data': {
            try {
              const data = Buffer.from(msg.data, 'base64');
              this.onProxyDataReceived?.({ streamId: msg.streamId, data });
            } catch {
              // ignore
            }
            break;
          }
          case 'proxy_close': {
            this.onProxyCloseReceived?.({ streamId: msg.streamId });
            break;
          }
          case 'proxy_error': {
            this.onProxyErrorReceived?.({ streamId: msg.streamId, message: msg.message });
            break;
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
