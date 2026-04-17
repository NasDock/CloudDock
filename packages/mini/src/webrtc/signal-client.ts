/**
 * SignalClient — WebSocket signaling for WeChat Mini Program.
 * Mirrors the mobile SignalClient interface but uses wx.connectSocket.
 */

export interface SignalMessage {
  type: string;
  id: string;
  deviceId: string;
  data: Record<string, unknown>;
}

type SignalHandler = (msg: SignalMessage) => void;

export interface SignalClientOptions {
  serverUrl: string; // base URL, e.g. wss://host
  deviceId: string;
  token: string;
  role?: string;
}

export class SignalClient {
  private socket: ReturnType<typeof wx.connectSocket> | null = null;
  private handlers: Set<SignalHandler> = new Set();
  private readonly signalUrl: string;
  private closed = false;

  constructor(options: SignalClientOptions) {
    const url = new URL(options.serverUrl);
    url.pathname = '/ws/signal';
    url.searchParams.set('deviceId', options.deviceId);
    url.searchParams.set('token', options.token);
    url.searchParams.set('role', options.role || 'mini');
    this.signalUrl = url.toString();
  }

  connect(): void {
    if (this.closed) return;

    this.socket = wx.connectSocket({ url: this.signalUrl });

    this.socket.onOpen(() => {
      console.info('[signal] connected', this.signalUrl);
    });

    this.socket.onMessage((event: { data: string }) => {
      try {
        const msg = JSON.parse(String(event.data)) as SignalMessage;
        this.handlers.forEach((h) => h(msg));
      } catch (err) {
        console.warn('[signal] parse error', err);
      }
    });

    this.socket.onError(() => {
      console.warn('[signal] socket error');
    });

    this.socket.onClose(() => {
      if (!this.closed) {
        console.warn('[signal] socket closed unexpectedly, reconnecting...');
        setTimeout(() => this.connect(), 3000);
      }
    });
  }

  onMessage(handler: SignalHandler): void {
    this.handlers.add(handler);
  }

  removeHandler(handler: SignalHandler): void {
    this.handlers.delete(handler);
  }

  send(message: SignalMessage): void {
    if (this.socket && this.socket.readyState === 0 /* OPEN */) {
      this.socket.send({ data: JSON.stringify(message) });
    }
  }

  close(): void {
    this.closed = true;
    this.socket?.close();
    this.socket = null;
    this.handlers.clear();
  }

  isConnected(): boolean {
    return this.socket !== null && !this.closed;
  }
}
