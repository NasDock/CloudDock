import type { WebRTCSignalMessage } from '@cloud-dock/shared';

type SignalHandler = (msg: WebRTCSignalMessage) => void;

export interface SignalClientOptions {
  serverUrl: string; // base ws url, e.g. wss://host/ws/device
  deviceId: string;
  token: string;
}

export class SignalClient {
  private ws: WebSocket | null = null;
  private handlers: Set<SignalHandler> = new Set();
  private readonly signalUrl: string;

  constructor(options: SignalClientOptions) {
    const url = new URL(options.serverUrl);
    url.pathname = '/ws/signal';
    url.searchParams.set('deviceId', options.deviceId);
    url.searchParams.set('token', options.token);
    url.searchParams.set('role', 'mobile');
    this.signalUrl = url.toString();
  }

  connect(): void {
    this.ws = new WebSocket(this.signalUrl);

    this.ws.onopen = () => {
      console.info('[signal] connected', this.signalUrl);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as WebRTCSignalMessage;
        this.handlers.forEach((h) => h(msg));
      } catch (err) {
        console.warn('[signal] parse error', err);
      }
    };

    this.ws.onerror = () => {
      console.warn('[signal] error');
    };
  }

  onMessage(handler: SignalHandler): void {
    this.handlers.add(handler);
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

