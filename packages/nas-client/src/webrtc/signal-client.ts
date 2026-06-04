import { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import type { WebRTCSignalMessage } from '@cloud-dock/shared';

type SignalHandler = (msg: WebRTCSignalMessage) => void | Promise<void>;

export interface SignalClientOptions {
  serverUrl: string; // base ws url, e.g. ws://host:3300/ws/device
  deviceId: string;
  clientKey: string;
}

export class SignalClient {
  private ws: WebSocket | null = null;
  private handlers: Set<SignalHandler> = new Set();
  private readonly signalUrl: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private readonly maxReconnectDelayMs = 30000;
  private isManualClose = false;

  constructor(options: SignalClientOptions) {
    const url = new URL(options.serverUrl);
    url.pathname = '/ws/signal';
    url.searchParams.set('deviceId', options.deviceId);
    url.searchParams.set('clientKey', options.clientKey);
    url.searchParams.set('role', 'nas');
    this.signalUrl = url.toString();
  }

  connect(): void {
    this.isManualClose = false;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.ws = new WebSocket(this.signalUrl);

    this.ws.on('open', () => {
      this.reconnectAttempt = 0;
      logger.info('Signal WS connected', { url: this.signalUrl });
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as WebRTCSignalMessage;
        this.handlers.forEach((h) => {
          Promise.resolve(h(msg)).catch((err) => {
            logger.warn('Signal message handler failed', {
              type: msg.type,
              error: err?.message || String(err),
            });
          });
        });
      } catch (err) {
        logger.warn('Failed to parse signal message', { err });
      }
    });

    this.ws.on('close', (code, reason) => {
      logger.info('Signal WS closed', { code, reason: reason.toString() });
      this.ws = null;
      if (!this.isManualClose) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      logger.error('Signal WS error', { error: err.message });
      // on('error') is usually followed by on('close'), so reconnect is handled there
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // already scheduled
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelayMs);
    this.reconnectAttempt += 1;

    logger.info('Signal WS scheduling reconnect', { attempt: this.reconnectAttempt, delayMs: delay });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isManualClose) {
        this.doConnect();
      }
    }, delay);
  }

  onMessage(handler: SignalHandler): void {
    this.handlers.add(handler);
  }

  offMessage(handler: SignalHandler): void {
    this.handlers.delete(handler);
  }

  send(message: WebRTCSignalMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.isManualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }
}
