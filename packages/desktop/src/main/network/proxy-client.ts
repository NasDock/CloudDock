import { createServer, Socket, Server as NetServer } from 'net';

export interface ProxyClientConfig {
  // Called when a local SOCKS5/HTTP CONNECT request wants to open a connection
  onProxyConnect: (streamId: string, host: string, port: number) => void;
  // Called when data arrives from local socket
  onProxyData: (streamId: string, data: Buffer) => void;
  // Called when local socket closes
  onProxyClose: (streamId: string) => void;
}

interface ProxyStream {
  streamId: string;
  socket: Socket;
}

/**
 * ProxyClient runs on the Desktop side.
 * It listens for SOCKS5/HTTP CONNECT requests locally,
 * and forwards them over WebRTC DataChannel to the NAS ProxyServer.
 *
 * For simplicity, this initial implementation supports HTTP CONNECT tunneling.
 * SOCKS5 can be added later.
 */
export class ProxyClient {
  private server: NetServer | null = null;
  private streams = new Map<string, ProxyStream>();
  private listenPort: number;

  constructor(private config: ProxyClientConfig, port: number = 0) {
    this.listenPort = port;
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = createServer((clientSocket) => {
        this.handleClientConnection(clientSocket);
      });

      this.server.on('error', (err) => {
        console.error('[proxy-client] server error', err);
        reject(err);
      });

      this.server.listen(this.listenPort, '127.0.0.1', () => {
        const address = this.server!.address();
        const port = typeof address === 'object' ? (address?.port ?? 0) : 0;
        console.info('[proxy-client] listening on 127.0.0.1:' + port);
        resolve(port);
      });
    });
  }

  stop(): void {
    for (const stream of this.streams.values()) {
      try {
        stream.socket.destroy();
      } catch {
        // ignore
      }
    }
    this.streams.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private handleClientConnection(clientSocket: Socket): void {
    // HTTP CONNECT handshake
    clientSocket.once('data', (data: Buffer) => {
      const header = data.toString('utf8');
      const match = header.match(/^CONNECT\s+([^:]+):(\d+)\s+HTTP\/\d\.\d/i);

      if (!match) {
        // Not HTTP CONNECT — could be SOCKS5 or plain HTTP
        // For now, reject non-CONNECT
        clientSocket.write('HTTP/1.1 405 Method Not Allowed\r\n\r\n');
        clientSocket.destroy();
        return;
      }

      const host = match[1]!;
      const port = parseInt(match[2]!, 10);
      const streamId = `stream_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      // Store stream
      this.streams.set(streamId, { streamId, socket: clientSocket });

      // Setup data forwarding from local socket
      clientSocket.on('data', (chunk: Buffer) => {
        this.config.onProxyData(streamId, chunk);
      });

      clientSocket.on('close', () => {
        this.streams.delete(streamId);
        this.config.onProxyClose(streamId);
      });

      clientSocket.on('error', (err) => {
        console.warn('[proxy-client] socket error', err.message);
        this.streams.delete(streamId);
        this.config.onProxyClose(streamId);
      });

      // Send HTTP 200 to indicate tunnel established
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

      // Notify upstream to open connection
      this.config.onProxyConnect(streamId, host, port);
    });
  }

  /**
   * Handle data arriving from remote (NAS) for a stream.
   */
  handleRemoteData(streamId: string, data: Buffer): void {
    const stream = this.streams.get(streamId);
    if (!stream) {
      console.warn('[proxy-client] stream not found', streamId);
      return;
    }
    try {
      stream.socket.write(data);
    } catch (err) {
      console.warn('[proxy-client] write failed', err);
      this.closeStream(streamId);
    }
  }

  /**
   * Handle remote close for a stream.
   */
  handleRemoteClose(streamId: string): void {
    this.closeStream(streamId);
  }

  private closeStream(streamId: string): void {
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
}
