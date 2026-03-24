import { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import type { WebRTCSignalMessage } from '@cloud-dock/shared';

type SignalHandler = (msg: WebRTCSignalMessage) => void;

export interface SignalClientOptions {
  serverUrl: string; // base ws url, e.g. ws://host:3300/ws/device
  deviceId: string;
  clientKey: string;
}

export class SignalClient {
  private ws: WebSocket | null = null;
  private handlers: Set<SignalHandler> = new Set();
  private readonly signalUrl: string;

  constructor(options: SignalClientOptions) {
    const url = new URL(options.serverUrl);
    url.pathname = '/ws/signal';
    url.searchParams.set('deviceId', options.deviceId);
    url.searchParams.set('clientKey', options.clientKey);
    url.searchParams.set('role', 'nas');
    this.signalUrl = url.toString();
  }

  connect(): void {
    this.ws = new WebSocket(this.signalUrl);

    this.ws.on('open', () => {
      logger.info('Signal WS connected', { url: this.signalUrl });
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as WebRTCSignalMessage;
        this.handlers.forEach((h) => h(msg));
      } catch (err) {
        logger.warn('Failed to parse signal message', { err });
      }
    });

    this.ws.on('close', (code, reason) => {
      logger.info('Signal WS closed', { code, reason: reason.toString() });
    });

    this.ws.on('error', (err) => {
      logger.error('Signal WS error', { error: err.message });
    });
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
    this.ws?.close();
    this.ws = null;
    this.handlers.clear();
  }
}

