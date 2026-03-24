import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { loadConfig, saveConfig, type NASConfig } from './utils/config-store.js';
import { logger } from './utils/logger.js';
import { HealthCheck } from './modules/health-check.js';
import { TunnelManager } from './modules/tunnel-manager.js';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { URL } from 'url';
import { WebRTCManager } from './webrtc/webrtc-manager.js';

export interface ClientStatus {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
  latencyMs?: number;
}

export interface TunnelInfo {
  tunnelId: string;
  name: string;
  protocol: 'http' | 'tcp' | 'udp';
  localAddress: string;
  localHostname?: string;
  status: string;
  publicPath?: string;
  enabled?: boolean;
}

export class NASClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: NASConfig;
  private status: ClientStatus = {
    connected: false,
    reconnecting: false,
    reconnectAttempts: 0,
  };
  private reconnectTimer?: NodeJS.Timeout;
  private serverUrl: string;
  private sessionId?: string;
  private clientKey?: string;
  private deviceId?: string;
  private webrtcManager?: WebRTCManager;
  private pendingPairingResolve?: (key: string) => void;
  private pendingPairingReject?: (err: Error) => void;

  public readonly healthCheck: HealthCheck;
  public readonly tunnelManager: TunnelManager;

  constructor() {
    super();
    this.config = loadConfig();
    this.serverUrl = this.config.serverUrl;
    this.clientKey = this.config.clientKey || undefined;
    this.healthCheck = new HealthCheck(this.serverUrl);
    this.tunnelManager = new TunnelManager(this);
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const url = this.buildUrl();

      try {
        logger.info('Connecting to server', { serverUrl: url });
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          logger.info('WebSocket connected');
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('close', (code, reason) => {
          logger.info('WebSocket closed', { code, reason: reason.toString() });
          this.status.connected = false;
          this.emit('close', { code, reason });
          this.scheduleReconnect();
        });

        this.ws.on('error', (err) => {
          logger.error('WebSocket error', { error: err.message });
          if (this.listenerCount('error') > 0) {
            this.emit('error', err);
          }
          this.status.connected = false;
          this.scheduleReconnect();
        });

        // Resolve or reject based on auth
        this.once('auth_success', () => resolve());
        this.once('auth_failed', (err) => reject(err));

        // Timeout after 30s
        setTimeout(() => {
          if (!this.status.connected) {
            reject(new Error('Connection timeout'));
            this.ws?.close();
          }
        }, 30000);
      } catch (err) {
        reject(err);
      }
    });
  }

  private buildUrl(): string {
    const url = new URL(this.serverUrl);
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
    }
    if (this.clientKey) {
      url.searchParams.set('clientKey', this.clientKey);
    }
    return url.toString();
  }

  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case 'pairing_code':
          this.handlePairingCode(msg.data.pairingCode);
          break;

        case 'pairing_approved':
          this.handlePairingApproved(msg.data.clientKey, msg.data.clientId);
          break;

        case 'auth_success':
          this.handleAuthSuccess(msg.data);
          break;

        case 'auth_failed':
          this.emit('auth_failed', new Error(msg.reason || 'Auth failed'));
          this.ws?.close();
          break;

        case 'tunnels_sync':
          this.handleTunnelsSync(msg.data.tunnels);
          break;

        case 'tunnel_update':
          this.tunnelManager.handleTunnelUpdate(msg.data);
          if (msg.data?.enabled !== false) {
            this.openTunnel(msg.data?.tunnelId);
          }
          break;

        case 'tunnel_deleted':
          this.tunnelManager.handleTunnelDeleted(msg.data.tunnelId);
          break;

        case 'heartbeat':
          this.send({ type: 'pong', id: msg.id });
          break;

        case 'heartbeat_ack':
          if (msg.data?.ts) {
            this.status.latencyMs = Date.now() - msg.data.ts;
          }
          break;
        case 'tunnel_data':
          this.handleTunnelData(msg.data);
          break;

        default:
          logger.debug('Unknown message type', { type: msg.type });
      }
    } catch (err) {
      logger.error('Failed to parse message', { error: err });
    }
  }

  private handlePairingCode(code: string): void {
    logger.info('Pairing code received', { code });
    this.emit('pairing_code', code);
  }

  private async handlePairingApproved(clientKey: string, clientId: string): Promise<void> {
    logger.info('Pairing approved', { clientKey, clientId });

    // Save clientKey to config
    this.clientKey = clientKey;
    this.config.clientKey = clientKey;
    saveConfig(this.config);

    this.emit('pairing_approved', { clientKey, clientId });

    // Now reconnect with the clientKey
    this.ws?.close();
  }

  private handleAuthSuccess(data: {
    clientId: string;
    clientName: string;
    userId: string;
  }): void {
    logger.info('Auth success', data);
    this.status.connected = true;
    this.status.reconnectAttempts = 0;
    this.deviceId = data.clientId;
    this.startWebRTCSignal();
    this.emit('auth_success', data);
  }

  private startWebRTCSignal(): void {
    if (!this.deviceId || !this.clientKey) return;
    if (this.webrtcManager) return;
    this.webrtcManager = new WebRTCManager({
      serverUrl: this.serverUrl,
      deviceId: this.deviceId,
      clientKey: this.clientKey,
    });
    this.webrtcManager.start().catch((err) => {
      logger.warn('WebRTC manager failed to start, fallback to tunnel', { error: err?.message || err });
    });
  }

  private handleTunnelsSync(tunnels: TunnelInfo[]): void {
    logger.info('Tunnels sync received', { count: tunnels.length });
    for (const tunnel of tunnels) {
      this.tunnelManager.updateTunnel(tunnel);
      if (tunnel.enabled !== false) {
        this.openTunnel(tunnel.tunnelId);
      }
    }
    this.emit('tunnels_sync', tunnels);
  }

  private openTunnel(tunnelId?: string): void {
    if (!tunnelId) return;
    this.send({
      type: 'tunnel_open',
      id: `open_${Date.now()}_${tunnelId}`,
      data: { tunnelId },
    });
  }

  private async handleTunnelData(data: {
    tunnelId: string;
    requestId: string;
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<void> {
    const tunnel = this.tunnelManager.getTunnel(data.tunnelId);
    if (!tunnel) {
      this.send({
        type: 'tunnel_response',
        id: `resp_${data.requestId}`,
        data: {
          requestId: data.requestId,
          statusCode: 404,
          headers: { 'content-type': 'text/plain' },
          body: Buffer.from('Tunnel not found').toString('base64'),
        },
      });
      return;
    }

    if (tunnel.protocol !== 'http') {
      this.send({
        type: 'tunnel_response',
        id: `resp_${data.requestId}`,
        data: {
          requestId: data.requestId,
          statusCode: 502,
          headers: { 'content-type': 'text/plain' },
          body: Buffer.from('Unsupported protocol').toString('base64'),
        },
      });
      return;
    }

    try {
      const response = await this.forwardHttpToLocal(tunnel.localAddress, data);
      this.send({
        type: 'tunnel_response',
        id: `resp_${data.requestId}`,
        data: response,
      });
    } catch (err: any) {
      this.send({
        type: 'tunnel_response',
        id: `resp_${data.requestId}`,
        data: {
          requestId: data.requestId,
          statusCode: 502,
          headers: { 'content-type': 'text/plain' },
          body: Buffer.from(err?.message || 'Bad Gateway').toString('base64'),
        },
      });
    }
  }

  private forwardHttpToLocal(
    localAddress: string,
    data: {
      requestId: string;
      method?: string;
      path?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ): Promise<{ requestId: string; statusCode: number; headers: Record<string, string>; body: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(data.path || '/', `http://${localAddress}`);
      const isHttps = url.protocol === 'https:';
      const bodyBuffer = data.body ? Buffer.from(data.body, 'base64') : Buffer.alloc(0);
      const headers: Record<string, string> = { ...(data.headers || {}) };
      const host = localAddress.split(':')[0] || localAddress;
      headers['host'] = host;
      if (bodyBuffer.length > 0) {
        headers['content-length'] = String(bodyBuffer.length);
      } else {
        delete headers['content-length'];
      }
      const req = (isHttps ? httpsRequest : httpRequest)(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: data.method || 'GET',
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const body = Buffer.concat(chunks);
            resolve({
              requestId: data.requestId,
              statusCode: res.statusCode || 200,
              headers: res.headers as Record<string, string>,
              body: body.toString('base64'),
            });
          });
        }
      );

      req.on('error', (err) => reject(err));

      if (bodyBuffer.length > 0) {
        req.write(bodyBuffer);
      }
      req.end();
    });
  }

  send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // Large data path: prefer WebRTC, fallback to existing tunnel
  async sendLargeData(data: Buffer): Promise<boolean> {
    if (this.webrtcManager?.isReady()) {
      const ok = await this.webrtcManager.sendLargePayload(data);
      if (ok) return true;
    }
    logger.warn('WebRTC not ready, fallback to tunnel', { size: data.length });
    return false;
  }

  async sendLargeDataWithFallback(
    data: Buffer,
    fallback: () => Promise<boolean>
  ): Promise<boolean> {
    const ok = await this.sendLargeData(data);
    if (ok) return true;
    return fallback();
  }

  updateConnectionConfig(updates: Partial<NASConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.serverUrl) {
      this.serverUrl = updates.serverUrl;
      this.healthCheck.setServerUrl(this.serverUrl);
    }
    if (updates.clientKey !== undefined) this.clientKey = updates.clientKey || undefined;
    saveConfig(this.config);
  }

  async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }

  disconnect(): void {
    logger.info('Disconnecting');
    this.status.connected = false;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  getStatus(): ClientStatus {
    return { ...this.status };
  }

  isConnected(): boolean {
    return this.status.connected;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.status.reconnecting = true;
    this.status.reconnectAttempts++;

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.status.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    logger.info('Scheduling reconnect', {
      attempt: this.status.reconnectAttempts,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      try {
        await this.connect();
      } catch {
        // Will trigger reconnect loop
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  setConfig(newConfig: Partial<NASConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
