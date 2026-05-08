import { WebSocket } from 'ws';
import { FastifyInstance } from 'fastify';
import { connectionPool, ClientSession } from './connection-pool.js';
import { HeartbeatManager } from './ws-heartbeat.js';
import { TunnelManager } from './ws-tunnel.js';

export interface WSClientMessage {
  type: string;
  id: string;
  data?: any;
}

export class WSMessageHandler {
  private fastify: FastifyInstance;
  private heartbeatManager: HeartbeatManager;
  private tunnelManager: TunnelManager;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.heartbeatManager = new HeartbeatManager(fastify);
    this.tunnelManager = new TunnelManager(fastify);
  }

  async handleMessage(sessionId: string, ws: WebSocket, message: WSClientMessage): Promise<void> {
    switch (message.type) {
      case 'heartbeat_ack':
        this.heartbeatManager.handleHeartbeatAck(sessionId, message.data);
        break;

      case 'tunnel_open':
        this.handleTunnelOpen(sessionId, ws, message);
        break;

      case 'tunnel_close':
        await this.handleTunnelClose(sessionId, message);
        break;

      case 'tunnel_data':
        await this.handleTunnelData(sessionId, message);
        break;

      case 'pong':
        this.handlePong(sessionId);
        break;

      case 'tunnel_response':
        await this.tunnelManager.handleTunnelResponse(sessionId, message.data);
        break;

      case 'tunnel_binary':
        await this.handleTunnelBinary(sessionId, message);
        break;

      case 'tunnel_binary_response':
        await this.tunnelManager.handleTunnelBinaryResponse(sessionId, message.data);
        break;

      default:
        this.fastify.log.warn({ type: message.type }, 'Unknown message type');
    }
  }

  private handleTunnelOpen(sessionId: string, ws: WebSocket, message: WSClientMessage): void {
    const result = this.tunnelManager.handleTunnelOpen(sessionId, message.data);

    ws.send(
      JSON.stringify({
        type: 'tunnel_open_ack',
        id: message.id,
        data: result,
      })
    );
  }

  private handleTunnelClose(sessionId: string, message: WSClientMessage): void {
    this.tunnelManager.handleTunnelClose(sessionId, message.data);
  }

  private handleTunnelData(sessionId: string, message: WSClientMessage): void {
    this.tunnelManager.handleTunnelData(sessionId, {
      tunnelId: message.data.tunnelId,
      requestId: message.data.requestId,
      method: message.data.method,
      path: message.data.path,
      headers: message.data.headers,
      body: message.data.body,
      timestamp: message.data.timestamp,
    });
  }

  private handleTunnelBinary(sessionId: string, message: WSClientMessage): void {
    this.tunnelManager.handleTunnelBinary(sessionId, {
      tunnelId: message.data.tunnelId,
      requestId: message.data.requestId,
      data: message.data.data,
      timestamp: message.data.timestamp,
    });
  }

  private handlePong(sessionId: string): void {
    const conn = connectionPool.getConnection(sessionId) as ClientSession | undefined;
    if (conn) {
      conn.isAlive = true;
      conn.lastHeartbeat = new Date();
    }
  }

  getTunnelManager(): TunnelManager {
    return this.tunnelManager;
  }
}
