import { createServer, Socket, Server as NetServer } from 'net';
import { logger } from '../utils/logger.js';

export interface ProxyServerConfig {
  // Called when a peer (desktop/mobile) wants to open a TCP connection to (host, port)
  onProxyConnect: (peerId: string, streamId: string, host: string, port: number) => void;
  // Called when data arrives from peer for a stream
  onProxyData: (peerId: string, streamId: string, data: Buffer) => void;
  // Called when peer closes a stream
  onProxyClose: (peerId: string, streamId: string) => void;
}

interface ProxyStream {
  streamId: string;
  peerId: string;
  socket: Socket;
  connected: boolean;
}

/**
 * ProxyServer runs on the NAS side.
 * It receives proxy commands from peers over WebRTC DataChannel,
 * opens local TCP connections, and forwards data bidirectionally.
 */
export class ProxyServer {
  private streams = new Map<string, ProxyStream>();

  constructor(private config: ProxyServerConfig) {}

  /**
   * Handle proxy_connect from a peer.
   * Opens a TCP connection to the target host:port.
   */
  async handleConnect(peerId: string, streamId: string, host: string, port: number): Promise<void> {
    if (this.streams.has(streamId)) {
      logger.warn('Proxy stream already exists', { streamId });
      return;
    }

    const socket = new Socket();

    socket.connect(port, host, () => {
      logger.debug('Proxy TCP connected', { streamId, host, port });
      this.streams.set(streamId, { streamId, peerId, socket, connected: true });
      this.config.onProxyConnect(peerId, streamId, host, port);
    });

    socket.on('data', (data: Buffer) => {
      this.config.onProxyData(peerId, streamId, data);
    });

    socket.on('close', () => {
      logger.debug('Proxy TCP closed', { streamId });
      this.streams.delete(streamId);
      this.config.onProxyClose(peerId, streamId);
    });

    socket.on('error', (err) => {
      logger.warn('Proxy TCP error', { streamId, error: err.message });
      this.streams.delete(streamId);
      this.config.onProxyClose(peerId, streamId);
    });
  }

  /**
   * Handle proxy_data from a peer.
   * Writes data to the local TCP socket.
   */
  handleData(peerId: string, streamId: string, data: Buffer): void {
    const stream = this.streams.get(streamId);
    if (!stream || !stream.connected) {
      logger.warn('Proxy stream not found or not connected', { streamId });
      return;
    }
    try {
      stream.socket.write(data);
    } catch (err: any) {
      logger.warn('Proxy TCP write failed', { streamId, error: err.message });
      this.closeStream(streamId);
    }
  }

  /**
   * Handle proxy_close from a peer.
   * Closes the local TCP socket.
   */
  handleClose(peerId: string, streamId: string): void {
    this.closeStream(streamId);
  }

  /**
   * Close a stream by streamId.
   */
  closeStream(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (stream) {
      try {
        stream.socket.destroy();
      } catch {
        // ignore
      }
      this.streams.delete(streamId);
    }
  }

  /**
   * Close all streams.
   */
  closeAll(): void {
    for (const stream of this.streams.values()) {
      try {
        stream.socket.destroy();
      } catch {
        // ignore
      }
    }
    this.streams.clear();
  }

  getStreamCount(): number {
    return this.streams.size;
  }
}
