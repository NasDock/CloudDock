export interface ProxyClientConfig {
  onProxyConnect: (streamId: string, host: string, port: number) => void;
  onProxyData: (streamId: string, data: ArrayBuffer) => void;
  onProxyClose: (streamId: string) => void;
}

interface ProxyStream {
  streamId: string;
  host: string;
  port: number;
}

type ProxyClientListener = (streamId: string, data?: ArrayBuffer) => void;

/**
 * ProxyClient for Mobile.
 * Since mobile uses the OS VPN API, we intercept packets at the native layer
 * and route TCP connections through WebRTC proxy streams.
 *
 * This is a stub that coordinates with the native VPN module.
 * The actual socket handling happens in the native code.
 *
 * Note: Avoids Node's `events` module so Metro doesn't need polyfills.
 */
export class ProxyClient {
  private streams = new Map<string, ProxyStream>();
  private listeners = new Map<string, Set<ProxyClientListener>>();

  constructor(private config: ProxyClientConfig) {}

  /**
   * Called by the native VPN module when a TCP connection is initiated.
   */
  handleNativeConnect(streamId: string, host: string, port: number): void {
    this.streams.set(streamId, { streamId, host, port });
    this.config.onProxyConnect(streamId, host, port);
  }

  /**
   * Called by the native VPN module when data is received from the local app.
   */
  handleNativeData(streamId: string, data: ArrayBuffer): void {
    if (!this.streams.has(streamId)) {
      console.warn('[proxy-client] stream not found', streamId);
      return;
    }
    this.config.onProxyData(streamId, data);
  }

  /**
   * Called by the native VPN module when the local connection closes.
   */
  handleNativeClose(streamId: string): void {
    this.streams.delete(streamId);
    this.config.onProxyClose(streamId);
  }

  /**
   * Handle data arriving from remote (NAS) for a stream.
   */
  handleRemoteData(streamId: string, data: ArrayBuffer): void {
    if (!this.streams.has(streamId)) {
      console.warn('[proxy-client] stream not found for remote data', streamId);
      return;
    }
    this.emit('data', streamId, data);
  }

  /**
   * Handle remote close for a stream.
   */
  handleRemoteClose(streamId: string): void {
    this.streams.delete(streamId);
    this.emit('close', streamId);
  }

  on(event: string, listener: ProxyClientListener): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
  }

  off(event: string, listener: ProxyClientListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: string, streamId: string, data?: ArrayBuffer): void {
    this.listeners.get(event)?.forEach((listener) => listener(streamId, data));
  }

  closeAll(): void {
    for (const streamId of this.streams.keys()) {
      this.config.onProxyClose(streamId);
    }
    this.streams.clear();
    this.listeners.clear();
  }
}
