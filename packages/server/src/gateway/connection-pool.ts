import { WebSocket } from 'ws';

export interface ClientSession {
  ws: WebSocket;
  clientId: string;
  userId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  heartbeatTimer?: NodeJS.Timeout;
  isAlive: boolean;
}

export class ConnectionPool {
  private connections = new Map<string, ClientSession>();
  private userSessions = new Map<string, Set<string>>();
  private clientById = new Map<string, string>(); // clientId -> sessionId
  // Track which tunnels are being handled by which client
  private tunnelToClient = new Map<string, string>(); // tunnelId -> clientId

  addClient(
    sessionId: string,
    ws: WebSocket,
    clientId: string,
    userId: string
  ): void {
    const session: ClientSession = {
      ws,
      clientId,
      userId,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      isAlive: true,
    };

    this.connections.set(sessionId, session);

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);
    this.clientById.set(clientId, sessionId);

    session.heartbeatTimer = this.startHeartbeatTimer(sessionId);
  }

  registerTunnelForClient(sessionId: string, tunnelId: string): void {
    this.tunnelToClient.set(tunnelId, sessionId);
  }

  unregisterTunnel(tunnelId: string): void {
    this.tunnelToClient.delete(tunnelId);
  }

  isTunnelOnline(tunnelId: string): boolean {
    const sessionId = this.tunnelToClient.get(tunnelId);
    if (!sessionId) return false;
    const conn = this.connections.get(sessionId);
    return conn?.isAlive && conn?.ws?.readyState === WebSocket.OPEN;
  }

  removeConnection(sessionId: string): void {
    const conn = this.connections.get(sessionId);
    if (!conn) return;

    // Clean up tunnel mappings for this session
    for (const [tId, sId] of this.tunnelToClient) {
      if (sId === sessionId) {
        this.tunnelToClient.delete(tId);
      }
    }

    const userSessions = this.userSessions.get(conn.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(conn.userId);
      }
    }

    this.clientById.delete(conn.clientId);

    if (conn.heartbeatTimer) {
      clearInterval(conn.heartbeatTimer);
    }

    this.connections.delete(sessionId);
  }

  getConnection(sessionId: string): ClientSession | undefined {
    return this.connections.get(sessionId);
  }

  getConnectionByClient(clientId: string): ClientSession | undefined {
    const sessionId = this.clientById.get(clientId);
    return sessionId ? this.connections.get(sessionId) : undefined;
  }

  getConnectionByTunnel(tunnelId: string): ClientSession | undefined {
    const sessionId = this.tunnelToClient.get(tunnelId);
    return sessionId ? this.connections.get(sessionId) : undefined;
  }

  getSessionsByUser(userId: string): string[] {
    const sessions = this.userSessions.get(userId);
    return sessions ? Array.from(sessions) : [];
  }

  size(): number {
    return this.connections.size;
  }

  private startHeartbeatTimer(sessionId: string): NodeJS.Timeout {
    return setInterval(() => {
      const conn = this.connections.get(sessionId);
      if (!conn) return;

      if (!conn.isAlive) {
        this.removeConnection(sessionId);
        return;
      }

      conn.isAlive = false;
      conn.ws.ping();
    }, 30000);
  }
}

export const connectionPool = new ConnectionPool();
