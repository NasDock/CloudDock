import { WebSocket } from 'ws';
import { connectionPool, ClientSession } from './connection-pool.js';
import { config } from '../config/index.js';
import { FastifyInstance } from 'fastify';

const HEARTBEAT_TIMEOUT = config.WS_HEARTBEAT_TIMEOUT_MS;

export class HeartbeatManager {
  private fastify: FastifyInstance;
  private pendingHeartbeats = new Map<string, NodeJS.Timeout>();

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  handleHeartbeatAck(sessionId: string, ackData: { ts: number }): void {
    const timeout = this.pendingHeartbeats.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingHeartbeats.delete(sessionId);
    }

    const conn = connectionPool.getConnection(sessionId) as ClientSession | undefined;
    if (conn) {
      conn.isAlive = true;
      conn.lastHeartbeat = new Date();
    }

    this.fastify.log.debug({
      sessionId,
      latency: Date.now() - ackData.ts,
    }, 'Heartbeat acknowledged');
  }

  handleHeartbeatTimeout(sessionId: string): void {
    const conn = connectionPool.getConnection(sessionId) as ClientSession | undefined;
    if (!conn || conn.isAlive) return;

    this.fastify.log.warn({ sessionId, clientId: conn.clientId }, 'Heartbeat timeout');
    conn.ws.close(1006, 'Heartbeat timeout');
    connectionPool.removeConnection(sessionId);
  }

  sendHeartbeat(sessionId: string): void {
    const conn = connectionPool.getConnection(sessionId) as ClientSession | undefined;
    if (!conn) return;

    const timeout = setTimeout(() => {
      this.handleHeartbeatTimeout(sessionId);
    }, HEARTBEAT_TIMEOUT);

    this.pendingHeartbeats.set(sessionId, timeout);

    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.isAlive = false; // Mark as not alive until pong received
      conn.ws.send(
        JSON.stringify({
          type: 'heartbeat',
          id: `hb_${Date.now()}`,
          data: { ts: Date.now() },
        })
      );
    }
  }

  cleanup(): void {
    for (const timeout of this.pendingHeartbeats.values()) {
      clearTimeout(timeout);
    }
    this.pendingHeartbeats.clear();
  }
}
