import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { FastifyInstance } from 'fastify';
import { prisma } from '../plugins/database.plugin.js';

const SIGNAL_WS_PATH = '/ws/signal';

type Role = 'nas' | 'mobile';

type SignalConnection = {
  nas?: WebSocket;
  mobile?: WebSocket;
  userId: string;
  deviceId: string;
};

const connections = new Map<string, SignalConnection>(); // deviceId -> conn

function getRoleFromParams(roleParam: string | null, clientKey: string | null, token: string | null): Role | null {
  if (roleParam === 'nas' || roleParam === 'mobile') return roleParam;
  if (clientKey) return 'nas';
  if (token) return 'mobile';
  return null;
}

export class SignalServer {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async start(httpServer: Server): Promise<void> {
    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
      if (pathname === SIGNAL_WS_PATH) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    });

    wss.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });

    this.fastify.log.info(`Signal WebSocket started on path ${SIGNAL_WS_PATH}`);
  }

  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const deviceId = url.searchParams.get('deviceId')?.trim();
    const roleParam = url.searchParams.get('role');
    const clientKey = url.searchParams.get('clientKey');
    const token = url.searchParams.get('token');

    if (!deviceId) {
      ws.close(1008, 'deviceId required');
      return;
    }

    const role = getRoleFromParams(roleParam, clientKey, token);
    if (!role) {
      ws.close(1008, 'role required');
      return;
    }

    try {
      let userId: string | null = null;

      if (role === 'nas') {
        if (!clientKey) {
          ws.close(1008, 'clientKey required for nas');
          return;
        }
        const client = await prisma.client.findUnique({
          where: { clientId: deviceId },
          select: { clientId: true, clientKey: true, userId: true, enabled: true },
        });
        if (!client || client.clientKey !== clientKey) {
          ws.close(4001, 'Invalid clientKey');
          return;
        }
        if (!client.enabled) {
          ws.close(4003, 'Client disabled');
          return;
        }
        userId = client.userId;
      } else {
        if (!token) {
          ws.close(1008, 'token required for mobile');
          return;
        }
        const decoded = this.fastify.jwt.verify(token) as { userId?: string; sub?: string };
        userId = decoded.userId || decoded.sub || null;
        if (!userId) {
          ws.close(4001, 'Invalid token');
          return;
        }
        const client = await prisma.client.findUnique({
          where: { clientId: deviceId },
          select: { clientId: true, userId: true, enabled: true },
        });
        if (!client || client.userId !== userId) {
          ws.close(4003, 'Device not owned by user');
          return;
        }
        if (!client.enabled) {
          ws.close(4003, 'Client disabled');
          return;
        }
      }

      const conn = connections.get(deviceId) || { userId, deviceId };
      if (role === 'nas') {
        conn.nas = ws;
      } else {
        conn.mobile = ws;
      }
      connections.set(deviceId, conn);

      (ws as any).deviceId = deviceId;
      (ws as any).role = role;

      ws.send(JSON.stringify({
        type: 'signal_ready',
        id: `sig_${Date.now()}`,
        data: { deviceId, role },
      }));

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.forwardMessage(deviceId, role, message);
        } catch (err) {
          this.fastify.log.error({ err }, 'Failed to parse signal message');
        }
      });

      ws.on('close', () => {
        const existing = connections.get(deviceId);
        if (!existing) return;
        if (role === 'nas' && existing.nas === ws) existing.nas = undefined;
        if (role === 'mobile' && existing.mobile === ws) existing.mobile = undefined;
        if (!existing.nas && !existing.mobile) {
          connections.delete(deviceId);
        }
      });
    } catch (err) {
      this.fastify.log.error({ err }, 'Signal auth error');
      ws.close(4001, 'Auth error');
    }
  }

  private forwardMessage(deviceId: string, from: Role, message: any): void {
    const conn = connections.get(deviceId);
    if (!conn) return;
    const target = from === 'nas' ? conn.mobile : conn.nas;
    if (!target || target.readyState !== WebSocket.OPEN) {
      return;
    }
    target.send(JSON.stringify({
      ...message,
      from,
    }));
  }
}

