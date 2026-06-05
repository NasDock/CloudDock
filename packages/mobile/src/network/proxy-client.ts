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
 *
 * In proxy mode the OS VPN API captures every TCP connection attempt as an
 * IP/TCP SYN packet. The native VpnService parses those packets and emits
 * per-stream events (`vpnProxyConnect`, `vpnProxyData`, `vpnProxyClose`).
 * This class wires those native events to the WebRTC proxy stream API:
 *   - "remote (NAS) → local (app)": onProxyData from WebRTC →
 *     sendProxyPacket to native → native frames the data into IP+TCP and
 *     writes to the TUN, completing the local TCP stream.
 *   - "local (app) → remote (NAS)": native emits a proxy data event →
 *     onProxyData to WebRTC → forwarded to the NAS.
 *
 * Note: Avoids Node's `events` module so Metro doesn't need polyfills.
 */
export class ProxyClient {
  private streams = new Map<string, ProxyStream>();
  private listeners = new Map<string, Set<ProxyClientListener>>();

  constructor(private config: ProxyClientConfig) {}

  /**
   * Called by the native VpnService when a new TCP connection is initiated
   * (SYN seen). The local 4-tuple is collapsed to a single streamId by the
   * native stack; we only see the destination (host:port) here.
   */
  handleNativeConnect(streamId: string, host: string, port: number): void {
    if (this.streams.has(streamId)) {
      console.warn('[proxy-client] stream already exists', streamId);
      return;
    }
    this.streams.set(streamId, { streamId, host, port });
    this.config.onProxyConnect(streamId, host, port);
  }

  /**
   * Called by the native VpnService with a TCP payload from the local app.
   * The data is base64-encoded by the native side.
   */
  handleNativeData(streamId: string, dataBase64: string): void {
    if (!this.streams.has(streamId)) {
      console.warn('[proxy-client] stream not found for native data', streamId);
      return;
    }
    const binary = atob(dataBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    this.config.onProxyData(streamId, bytes.buffer);
  }

  /**
   * Called by the native VpnService when the local app closes the TCP
   * stream (FIN/RST). The remote stream should be torn down.
   */
  handleNativeClose(streamId: string): void {
    this.streams.delete(streamId);
    this.config.onProxyClose(streamId);
  }

  /**
   * Handle data arriving from remote (NAS) for a stream. The remote payload
   * is forwarded to the native VpnService, which frames it into a TCP
   * segment and writes it to the TUN.
   */
  handleRemoteData(streamId: string, data: ArrayBuffer): void {
    if (!this.streams.has(streamId)) {
      console.warn('[proxy-client] stream not found for remote data', streamId);
      return;
    }
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i] ?? 0);
    }
    const base64 = btoa(binary);
    // Imported lazily to avoid a circular dependency in tests.
    import('../native/vpn').then(({ sendProxyPacket }) => {
      sendProxyPacket(streamId, base64).catch((err) => {
        console.warn('[proxy-client] sendProxyPacket failed', err);
      });
    });
    this.emit('data', streamId, data);
  }

  /**
   * Handle remote close for a stream. The local TCP stream is half-closed
   * (FIN) so the app sees EOF.
   */
  handleRemoteClose(streamId: string): void {
    this.streams.delete(streamId);
    import('../native/vpn').then(({ closeProxyStream }) => {
      closeProxyStream(streamId).catch(() => {});
    });
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
