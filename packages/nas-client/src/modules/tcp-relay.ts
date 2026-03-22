import { createServer, Socket, Server as NetServer } from 'net';
import { logger } from '../utils/logger.js';
import { WSTunnelData } from '../types/ws.js';

export interface TcpRelayConfig {
  localAddress: string;
  tunnelId: string;
  onData: (data: WSTunnelData) => void;
}

interface TcpConnection {
  id: string;
  localSocket: Socket;
  remoteId: string;
  createdAt: number;
}

export class TcpRelay {
  private server: NetServer | null = null;
  private connections: Map<string, TcpConnection> = new Map();
  private localAddress: string;
  private localPort: number;

  constructor(private config: TcpRelayConfig) {
    const [host, port] = config.localAddress.split(':');
    this.localAddress = host || '127.0.0.1';
    this.localPort = parseInt(port || '', 10) || 0;
  }

  start(localListenPort: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = createServer((clientSocket) => {
        this.handleClientConnection(clientSocket);
      });

      this.server.on('error', (err) => {
        logger.error('TCP relay server error', { error: err.message });
        reject(err);
      });

      this.server.listen(localListenPort, '127.0.0.1', () => {
        const address = this.server!.address();
        const port = typeof address === 'object' ? address?.port : 0;
        logger.info('TCP relay started', { listenPort: port });
        resolve(port);
      });
    });
  }

  stop(): void {
    // Close all connections
    for (const conn of this.connections.values()) {
      conn.localSocket.destroy();
    }
    this.connections.clear();

    if (this.server) {
      this.server.close();
      this.server = null;
      logger.info('TCP relay stopped');
    }
  }

  private handleClientConnection(clientSocket: Socket): void {
    const connectionId = `tcp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    // Connect to local service
    const localSocket = new Socket();

    localSocket.connect(this.localPort, this.localAddress, () => {
      logger.debug('Connected to local service', { connectionId });

      // Notify about new connection
      const conn: TcpConnection = {
        id: connectionId,
        localSocket,
        remoteId: '',
        createdAt: Date.now()
      };
      this.connections.set(connectionId, conn);

      // Start bidirectional forwarding
      this.forwardLocalToRemote(clientSocket, localSocket);
      this.forwardRemoteToLocal(connectionId, clientSocket, localSocket);
    });

    localSocket.on('error', (err) => {
      logger.error('TCP relay local connection error', { connectionId, error: err.message });
      clientSocket.destroy();
      this.connections.delete(connectionId);
    });

    clientSocket.on('error', (err) => {
      logger.error('TCP relay client connection error', { connectionId, error: err.message });
      localSocket.destroy();
      this.connections.delete(connectionId);
    });

    clientSocket.on('close', () => {
      localSocket.destroy();
      this.connections.delete(connectionId);
    });

    localSocket.on('close', () => {
      clientSocket.destroy();
      this.connections.delete(connectionId);
    });
  }

  private forwardLocalToRemote(clientSocket: Socket, localSocket: Socket): void {
    localSocket.on('data', (data: Buffer) => {
      // Send data to remote via WebSocket
      const tunnelData: WSTunnelData = {
        tunnelId: this.config.tunnelId,
        requestId: clientSocket.remoteAddress || 'unknown',
        body: data.toString('base64'),
        timestamp: Date.now()
      };
      this.config.onData(tunnelData);

      // For actual TCP relay, we need to store the association
      // This is handled differently - in TCP mode, data goes directly
    });
  }

  private forwardRemoteToLocal(connectionId: string, clientSocket: Socket, localSocket: Socket): void {
    clientSocket.on('data', (data: Buffer) => {
      localSocket.write(data);
    });
  }

  // Handle incoming data from WebSocket (for active connections)
  handleRemoteData(data: WSTunnelData): void {
    if (data.body) {
      const buffer = Buffer.from(data.body, 'base64');
      // In TCP mode, we'd need to track which connection this belongs to
      // For now, this is a simplified implementation
      logger.debug('TCP relay received remote data', {
        tunnelId: data.tunnelId,
        size: buffer.length
      });
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}
