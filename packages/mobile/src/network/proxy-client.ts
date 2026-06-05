import { EventEmitter } from 'events';

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

/**
 * ProxyClient for Mobile.
 * Since mobile uses the OS VPN API, we intercept packets at the native layer
 * and route TCP connections through WebRTC proxy streams.
 *
 * This is a stub that coordinates with the native VPN module.
 * The actual socket handling happens in the native code.
 */
export class ProxyClient extends EventEmitter {
  private streams = new Map<string, ProxyStream>();

  constructor(private config: ProxyClientConfig) {
    super();
  }

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

  closeAll(): void {
    for (const streamId of this.streams.keys()) {
      this.config.onProxyClose(streamId);
    }
    this.streams.clear();
  }
}
