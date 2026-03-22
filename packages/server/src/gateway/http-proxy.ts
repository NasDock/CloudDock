import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { connectionPool } from './connection-pool.js';
import { prisma } from '../plugins/database.plugin.js';
import { generateLogId } from '@cloud-dock/shared';

export class HttpProxy {
  constructor(
    private request: FastifyRequest,
    private reply: FastifyReply,
    private tunnelManager: any,
    private fastify: FastifyInstance
  ) {}

  async handleRequest(): Promise<void> {
    const url = this.request.url;
    const match = url.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/);

    if (!match) {
      return;
    }

    const [, username, tunnelName, ...rest] = match;
    const path = rest.join('/') || '/';

    // Tunnel proxy request

    const user = await prisma.user.findUnique({
      where: { username },
      select: { userId: true },
    });

    if (!user) {
      this.reply.status(404).send({ error: 'User not found' });
      return;
    }

    const publicPath = `/${username}/${tunnelName}/`;
    const tunnel = await prisma.tunnel.findFirst({
      where: { userId: user.userId, publicPath },
    });

    if (!tunnel) {
      this.reply.status(404).send({ error: 'Tunnel not found' });
      return;
    }

    if (!tunnel.enabled) {
      this.reply.status(503).send({ error: 'Tunnel disabled' });
      return;
    }

    if (!connectionPool.isTunnelOnline(tunnel.tunnelId)) {
      this.reply.status(502).send({ error: 'Tunnel is offline' });
      return;
    }

    const startTime = Date.now();
    let bytesIn = 0;
    let bytesOut = 0;

    try {
      const body = await this.getBody();
      bytesIn = body.length + this.estimateHeaderBytes(this.request.headers as Record<string, string>, this.request.method, path);
      const response = await this.tunnelManager.forwardRequest(tunnel.tunnelId, {
        method: this.request.method,
        path,
        headers: this.sanitizeHeaders(this.request.headers as Record<string, string>, body),
        body: body.length > 0 ? body : undefined,
        clientIp: this.getClientIp(),
      });

      bytesOut = response.body.length + this.estimateHeaderBytes(response.headers, `${response.statusCode}`);
      await this.createAccessLog({
        tunnelId: tunnel.tunnelId,
        clientIp: this.getClientIp(),
        method: this.request.method,
        path,
        statusCode: response.statusCode,
        responseTime: Date.now() - startTime,
        bytesIn,
        bytesOut,
      });

      this.reply.status(response.statusCode).send(response.body);
    } catch (err: any) {
      await this.createAccessLog({
        tunnelId: tunnel.tunnelId,
        clientIp: this.getClientIp(),
        method: this.request.method,
        path,
        statusCode: 502,
        responseTime: Date.now() - startTime,
        bytesIn,
        bytesOut,
      });
      this.reply.status(502).send({ error: err.message || 'Tunnel unavailable' });
    }
  }

  private estimateHeaderBytes(
    headers: Record<string, string> | undefined,
    methodOrStatus: string,
    path?: string
  ): number {
    let total = 0;
    if (path) {
      total += methodOrStatus.length + 1 + path.length + 12; // "METHOD path HTTP/1.1"
    } else {
      total += methodOrStatus.length + 10; // "HTTP/1.1 XXX"
    }
    if (!headers) return total;
    for (const [key, value] of Object.entries(headers)) {
      if (!value) continue;
      total += key.length + String(value).length + 4; // "Key: Value\r\n"
    }
    return total;
  }

  private async createAccessLog(data: {
    tunnelId: string;
    clientIp: string;
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    bytesIn: number;
    bytesOut: number;
  }): Promise<void> {
    try {
      await prisma.accessLog.create({
        data: {
          logId: generateLogId(),
          tunnelId: data.tunnelId,
          clientIp: data.clientIp,
          method: data.method,
          path: data.path,
          statusCode: data.statusCode,
          responseTime: data.responseTime,
          bytesIn: data.bytesIn,
          bytesOut: data.bytesOut,
        },
      });
    } catch (err) {
      this.fastify.log.warn({ err }, 'Failed to write access log');
    }
  }

  private sanitizeHeaders(headers: Record<string, string>, body: Buffer): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!value) continue;
      const k = key.toLowerCase();
      if (k === 'content-length' || k === 'host' || k === 'connection') continue;
      normalized[k] = value;
    }
    if (body.length > 0 && !normalized['content-type']) {
      normalized['content-type'] = 'application/json';
    }
    return normalized;
  }

  private async getBody(): Promise<Buffer> {
    const existing = (this.request as any).body;
    if (existing !== undefined) {
      if (Buffer.isBuffer(existing)) return existing;
      if (typeof existing === 'string') return Buffer.from(existing);
      return Buffer.from(JSON.stringify(existing));
    }
    return this.readRawBody();
  }

  private readRawBody(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const req = this.request.raw;

      if (req.readableEnded) {
        resolve(Buffer.alloc(0));
        return;
      }

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      req.on('error', reject);
    });
  }

  private getClientIp(): string {
    return (
      (this.request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      this.request.ip ||
      '0.0.0.0'
    );
  }
}
