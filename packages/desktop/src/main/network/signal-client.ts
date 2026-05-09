import { WebSocket } from 'ws';

export interface SignalClientOptions {
  serverUrl: string;
  deviceId: string;
  token: string;
}

export class SignalClient {
  private ws: WebSocket | null = null;
  private options: SignalClientOptions;
  private onMessageCallback?: (msg: any) => void;
  private reconnectTimer?: ReturnType<typeof setTimeout> | undefined;
  private readonly reconnectIntervalMs = 5000;

  constructor(options: SignalClientOptions) {
    this.options = options;
  }

  connect(): void {
    if (this.ws) return;
    const url = this.buildUrl();
    try {
      this.ws = new WebSocket(url);
      this.ws.on('open', () => {
        console.info('[signal] connected', this.options.deviceId);
      });
      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          this.onMessageCallback?.(msg);
        } catch {
          // ignore
        }
      });
      this.ws.on('close', () => {
        this.ws = null;
        this.scheduleReconnect();
      });
      this.ws.on('error', (err) => {
        console.warn('[signal] error', err.message);
        this.ws?.close();
        this.ws = null;
      });
    } catch (err) {
      console.warn('[signal] connect failed', err);
      this.scheduleReconnect();
    }
  }

  send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(callback: (msg: any) => void): void {
    this.onMessageCallback = callback;
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.ws?.close();
    this.ws = null;
  }

  private buildUrl(): string {
    const base = this.options.serverUrl.replace(/\/$/, '');
    return `${base}/ws/signal?deviceId=${encodeURIComponent(this.options.deviceId)}&role=desktop&token=${encodeURIComponent(this.options.token)}`;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, this.reconnectIntervalMs);
  }
}
