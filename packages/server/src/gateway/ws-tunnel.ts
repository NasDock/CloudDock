import { WebSocket } from 'ws';
import { connectionPool } from './connection-pool.js';
import { prisma } from '../plugins/database.plugin.js';
import { FastifyInstance } from 'fastify';

export class TunnelManager {
  private fastify: FastifyInstance;
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timer: NodeJS.Timeout }>();

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async handleTunnelOpen(
    sessionId: string,
    data: { tunnelId: string }
  ): Promise<{ status: 'open' | 'error'; publicPath?: string; reason?: string }> {
    const conn = connectionPool.getConnection(sessionId);
    if (!conn) {
      return { status: 'error', reason: 'Connection not found' };
    }

    const tunnel = await prisma.tunnel.findUnique({
      where: { tunnelId: data.tunnelId },
    });

    if (!tunnel) {
      return { status: 'error', reason: 'Tunnel not found' };
    }

    if (tunnel.userId !== conn.userId) {
      return { status: 'error', reason: 'Tunnel not authorized' };
    }
    if (!tunnel.enabled) {
      return { status: 'error', reason: 'Tunnel disabled' };
    }

    connectionPool.registerTunnelForClient(sessionId, data.tunnelId);
    await prisma.tunnel.update({
      where: { tunnelId: data.tunnelId },
      data: { status: 'online', lastHeartbeat: new Date() },
    });
    this.fastify.log.info({ tunnelId: data.tunnelId }, 'Tunnel opened');

    return {
      status: 'open',
      publicPath: tunnel.publicPath,
    };
  }

  async handleTunnelClose(sessionId: string, data: { tunnelId: string }): Promise<void> {
    this.fastify.log.info({ tunnelId: data.tunnelId }, 'Tunnel closed');
    connectionPool.unregisterTunnel(data.tunnelId);
    await prisma.tunnel.update({
      where: { tunnelId: data.tunnelId },
      data: { status: 'offline' },
    });
  }

  async handleTunnelData(sessionId: string, data: any): Promise<void> {
    const conn = connectionPool.getConnection(sessionId);
    if (!conn) return;

    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(
        JSON.stringify({
          type: 'tunnel_data',
          id: `data_${Date.now()}`,
          data,
        })
      );
    }
  }

  async handleTunnelBinary(sessionId: string, data: { tunnelId: string; requestId: string; data: string; timestamp: number }): Promise<void> {
    const conn = connectionPool.getConnection(sessionId);
    if (!conn) return;

    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(
        JSON.stringify({
          type: 'tunnel_binary',
          id: `bin_${Date.now()}`,
          data,
        })
      );
    }
  }

  async handleTunnelResponse(sessionId: string, data: {
    requestId: string;
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }): Promise<void> {
    const pending = this.pendingRequests.get(data.requestId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(data.requestId);

    pending.resolve({
      statusCode: data.statusCode,
      headers: data.headers,
      body: Buffer.from(data.body, 'base64'),
    });
  }

  async forwardBinary(
    tunnelId: string,
    data: Buffer,
    timeoutMs = 30000
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const tunnel = await prisma.tunnel.findUnique({
        where: { tunnelId },
      });

      if (!tunnel) {
        reject(new Error('Tunnel not found'));
        return;
      }

      const conn = connectionPool.getConnectionByTunnel(tunnelId);
      if (!conn || !conn.isAlive) {
        reject(new Error('Tunnel not online'));
        return;
      }

      const requestId = `bin_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const timer = setTimeout(() => {
        this.pendingBinaryRequests.delete(requestId);
        reject(new Error('Binary request timeout'));
      }, timeoutMs);

      this.pendingBinaryRequests.set(requestId, { resolve, reject, timer });

      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(
          JSON.stringify({
            type: 'tunnel_binary',
            id: requestId,
            data: {
              tunnelId,
              requestId,
              data: data.toString('base64'),
              timestamp: Date.now(),
            },
          })
        );
      }
    });
  }

  async handleTunnelBinaryResponse(sessionId: string, data: {
    requestId: string;
    data: string;
  }): Promise<void> {
    const pending = this.pendingBinaryRequests.get(data.requestId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingBinaryRequests.delete(data.requestId);

    pending.resolve(Buffer.from(data.data, 'base64'));
  }

  async forwardRequest(
    tunnelId: string,
    request: {
      method: string;
      path: string;
      headers: Record<string, string>;
      body?: Buffer;
      clientIp: string;
    }
  ): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: Buffer;
  }> {
    return new Promise(async (resolve, reject) => {
      const tunnel = await prisma.tunnel.findUnique({
        where: { tunnelId },
      });

      if (!tunnel) {
        reject(new Error('Tunnel not found'));
        return;
      }

      const conn = connectionPool.getConnectionByTunnel(tunnelId);
      if (!conn || !conn.isAlive) {
        reject(new Error('Tunnel not online'));
        return;
      }

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(
          JSON.stringify({
            type: 'tunnel_data',
            id: requestId,
            data: {
              tunnelId,
              requestId,
              method: request.method,
              path: request.path,
              headers: request.headers,
              body: request.body?.toString('base64') || '',
              timestamp: Date.now(),
            },
          })
        );
      }
    });
  }

  private pendingBinaryRequests = new Map<string, { resolve: Function; reject: Function; timer: NodeJS.Timeout }>();
}
