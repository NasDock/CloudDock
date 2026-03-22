import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';
import { prisma } from '../plugins/database.plugin.js';
import { connectionPool } from './connection-pool.js';
import { WSMessageHandler, WSClientMessage } from './ws-handler.js';
import { TunnelService } from '../modules/tunnel/tunnel.service.js';
import { nanoid } from 'nanoid';
import type { Tunnel } from '@prisma/client';

const WS_PATH = '/ws/device';

// Pending pairing: pairingCode -> { sessionId, ws, createdAt }
const pendingPairings = new Map<string, { sessionId: string; ws: WebSocket; createdAt: Date }>();

// Generate a 6-digit pairing code
function generatePairingCode(): string {
  return Math.random().toString(10).slice(2, 8);
}

// Generate a permanent client key
function generateClientKey(): string {
  return `ck_${nanoid(32)}`;
}

export class WSServer {
  private fastify: FastifyInstance;
  private messageHandler: WSMessageHandler;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.messageHandler = new WSMessageHandler(fastify);
  }

  async start(httpServer: Server): Promise<void> {
    console.log(`[ws-server] start() called, httpServer type: ${httpServer.constructor.name}`);
    console.log(`[ws-server] server has upgrade listener count: ${httpServer.eventNames().filter(e => e === 'upgrade').length}`);

    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
      console.log(`[ws-server] upgrade event! path=${pathname}`);
      if (pathname === WS_PATH) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    });

    wss.on('connection', (ws: WebSocket, request) => {
      console.log(`[ws-server] WS connection!`);
      this.handleConnection(ws, request);
    });

    this.fastify.log.info(`WebSocket server started on path ${WS_PATH}`);
  }

  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const clientKey = url.searchParams.get('clientKey');
    const sessionId = `ses_${Date.now()}_${nanoid(8)}`;

    if (!clientKey) {
      // New client - enter pairing mode
      await this.handlePairing(ws, sessionId);
      return;
    }

    // Existing client - authenticate with clientKey
    await this.handleAuthenticatedConnection(ws, sessionId, clientKey);
  }

  // Pairing: generate code, wait for web UI approval
  private async handlePairing(ws: WebSocket, sessionId: string): Promise<void> {
    const pairingCode = generatePairingCode();

    // Store pending pairing
    pendingPairings.set(pairingCode, {
      sessionId,
      ws,
      createdAt: new Date(),
    });

    // Clean up old pairings (>10 min)
    for (const [code, data] of pendingPairings) {
      if (Date.now() - data.createdAt.getTime() > 10 * 60 * 1000) {
        pendingPairings.delete(code);
      }
    }

    this.fastify.log.info({ pairingCode, sessionId }, 'New client requesting pairing');

    // Send pairing code to client
    ws.send(JSON.stringify({
      type: 'pairing_code',
      id: `pair_${Date.now()}`,
      data: { pairingCode },
    }));

    // Store ws for later use after approval
    (ws as any).sessionId = sessionId;
    (ws as any).pairingCode = pairingCode;

    ws.on('close', () => {
      pendingPairings.delete(pairingCode);
    });
  }

  // Authenticated connection with clientKey
  private async handleAuthenticatedConnection(ws: WebSocket, sessionId: string, clientKey: string): Promise<void> {
    // Find client by key
    const client = await prisma.client.findUnique({
      where: { clientKey },
      include: {
        user: { select: { userId: true } },
      },
    });

    if (!client) {
      ws.close(4001, 'Invalid client key');
      return;
    }
    if (!client.enabled) {
      ws.close(4003, 'Client disabled');
      return;
    }

    // Add to connection pool
    connectionPool.addClient(sessionId, ws, client.clientId, client.user.userId);

    // Update client status
    await prisma.client.update({
      where: { clientId: client.clientId },
      data: { status: 'online', lastSeen: new Date() },
    });

    // Send auth success with client info
    ws.send(JSON.stringify({
      type: 'auth_success',
      id: `auth_${Date.now()}`,
      data: {
        clientId: client.clientId,
        clientName: client.name,
        userId: client.user.userId,
      },
    }));

    // Send tunnels for this client
    const tunnels = await prisma.tunnel.findMany({
      where: { userId: client.user.userId, clientId: client.clientId, enabled: true },
    });

    ws.send(JSON.stringify({
      type: 'tunnels_sync',
      id: `sync_${Date.now()}`,
      data: {
        tunnels: tunnels.map((t: Tunnel) => ({
          tunnelId: t.tunnelId,
          name: t.name,
          protocol: t.protocol,
          localAddress: t.localAddress,
          localHostname: t.localHostname,
          status: t.status,
          publicPath: t.publicPath,
          enabled: t.enabled,
        })),
      },
    }));

    this.fastify.log.info({ clientId: client.clientId, sessionId }, 'Client connected');

    // Handle messages
    ws.on('message', (data: Buffer) => {
      try {
        const message: WSClientMessage = JSON.parse(data.toString());
        this.messageHandler.handleMessage(sessionId, ws, message);
      } catch (err) {
        this.fastify.log.error({ err }, 'Failed to parse WS message');
      }
    });

    // WS ping/pong keepalive from connection pool
    ws.on('pong', () => {
      const conn = connectionPool.getConnection(sessionId);
      if (conn) {
        conn.isAlive = true;
        conn.lastHeartbeat = new Date();
      }
    });

    ws.on('close', async () => {
      connectionPool.removeConnection(sessionId);
      await prisma.client.update({
        where: { clientId: client.clientId },
        data: { status: 'offline' },
      });
      await prisma.tunnel.updateMany({
        where: { userId: client.user.userId, clientId: client.clientId },
        data: { status: 'offline' },
      });
      this.fastify.log.info({ clientId: client.clientId }, 'Client disconnected');
    });
  }

  // Called by web UI to approve pairing
  async approvePairing(pairingCode: string, userId: string, clientName: string): Promise<{ success: boolean; clientKey?: string; error?: string }> {
    const pending = pendingPairings.get(pairingCode);

    if (!pending) {
      return { success: false, error: 'Pairing code not found or expired' };
    }

    // Create client in DB
    const clientKey = generateClientKey();
    const client = await prisma.client.create({
      data: {
        clientKey,
        userId,
        name: clientName,
      },
    });

    // Send clientKey to the pending WS connection
    try {
      pending.ws.send(JSON.stringify({
        type: 'pairing_approved',
        id: `paired_${Date.now()}`,
        data: { clientKey, clientId: client.clientId },
      }));
    } catch {
      return { success: false, error: 'Client connection closed' };
    }

    // Clean up pending pairing
    pendingPairings.delete(pairingCode);

    this.fastify.log.info({ pairingCode, clientId: client.clientId, userId }, 'Pairing approved');

    return { success: true, clientKey };
  }

  // Get all pending pairings (for web UI)
  getPendingPairings(): Array<{ pairingCode: string; createdAt: Date }> {
    return Array.from(pendingPairings.entries()).map(([code, data]) => ({
      pairingCode: code,
      createdAt: data.createdAt,
    }));
  }

  // Broadcast tunnel update to all connected clients of a user
  async broadcastTunnelUpdate(userId: string, tunnel: Tunnel): Promise<void> {
    const sessionIds = connectionPool.getSessionsByUser(userId);

    for (const sessionId of sessionIds) {
      const conn = connectionPool.getConnection(sessionId);
      if (conn?.ws?.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({
          type: 'tunnel_update',
          id: `tun_${Date.now()}`,
          data: {
            tunnelId: tunnel.tunnelId,
            name: tunnel.name,
            protocol: tunnel.protocol,
            localAddress: tunnel.localAddress,
            localHostname: tunnel.localHostname,
            status: tunnel.status,
            publicPath: tunnel.publicPath,
            enabled: (tunnel as any).enabled ?? true,
          },
        }));
      }
    }
  }

  // Broadcast tunnel deleted
  async broadcastTunnelDeleted(userId: string, tunnelId: string): Promise<void> {
    const sessionIds = connectionPool.getSessionsByUser(userId);

    for (const sessionId of sessionIds) {
      const conn = connectionPool.getConnection(sessionId);
      if (conn?.ws?.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify({
          type: 'tunnel_deleted',
          id: `tun_${Date.now()}`,
          data: { tunnelId },
        }));
      }
    }
  }

  async disconnectClient(clientId: string): Promise<void> {
    const conn = connectionPool.getConnectionByClient(clientId);
    if (conn?.ws?.readyState === WebSocket.OPEN) {
      conn.ws.close(4003, 'Client disabled');
    }
  }

  getMessageHandler(): WSMessageHandler {
    return this.messageHandler;
  }

  getTunnelManager() {
    return this.messageHandler.getTunnelManager();
  }

  stop(): void {
    // Nothing needed for now
  }
}
