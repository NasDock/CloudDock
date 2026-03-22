import { createServer, IncomingMessage, ServerResponse, request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { URL } from 'url';
import { logger } from '../utils/logger.js';
import { WSTunnelData } from '../types/ws.js';

export interface HttpProxyConfig {
  localAddress: string;
  localHostname?: string;
  tunnelId: string;
  onRequest: (data: WSTunnelData) => void;
  onResponse: (data: WSTunnelData) => void;
}

export class HttpProxy {
  private server: ReturnType<typeof createServer> | null = null;
  private pendingRequests: Map<string, {
    resolve: (data: WSTunnelData) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(private config: HttpProxyConfig) {}

  start(localPort: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleLocalRequest(req, res);
      });

      this.server.on('error', (err) => {
        logger.error('HTTP proxy server error', { error: err.message });
        reject(err);
      });

      this.server.listen(localPort, '127.0.0.1', () => {
        const address = this.server!.address();
        const port = typeof address === 'object' ? (address?.port ?? 0) : 0;
        logger.info('HTTP proxy started', { port });
        resolve(port);
      });
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      logger.info('HTTP proxy stopped');
    }

    // Clear pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Proxy stopped'));
    }
    this.pendingRequests.clear();
  }

  handleLocalRequest(req: IncomingMessage, res: ServerResponse): void {
    const requestId = `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const headers: Record<string, string> = {};

    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(', ');
      }
    }

    // Override Host header for local service
    if (this.config.localHostname) {
      headers['host'] = this.config.localHostname;
    }

    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      const base64Body = body.length > 0 ? body.toString('base64') : '';

      // Send request to NAS client for tunneling
      const requestData: WSTunnelData = {
        tunnelId: this.config.tunnelId,
        requestId,
        method: req.method || 'GET',
        path: req.url || '/',
        headers,
        body: base64Body,
        timestamp: Date.now()
      };

      // Set up response handler
      const responsePromise = new Promise<WSTunnelData>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }, 30000); // 30s timeout

        this.pendingRequests.set(requestId, { resolve, reject, timeout });
      });

      this.config.onRequest(requestData);

      try {
        const response = await responsePromise;
        this.pendingRequests.delete(requestId);

        // Send response back to local client
        res.writeHead(
          response.statusCode || 200,
          response.responseHeaders || { 'content-type': 'text/plain' }
        );

        if (response.responseBody) {
          const bodyBuffer = Buffer.from(response.responseBody, 'base64');
          res.end(bodyBuffer);
        } else {
          res.end();
        }
      } catch (error) {
        this.pendingRequests.delete(requestId);
        logger.error('HTTP proxy request failed', { requestId, error });
        res.writeHead(502, { 'content-type': 'text/plain' });
        res.end('Bad Gateway');
      }
    });

    req.on('error', (err) => {
      logger.error('HTTP proxy request error', { requestId, error: err.message });
    });
  }

  // Handle response from remote client (via WebSocket)
  handleResponse(data: WSTunnelData): void {
    const pending = this.pendingRequests.get(data.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(data);
    }
  }

  // Send data to local service (for tunnel_data from server)
  async forwardToLocal(data: WSTunnelData): Promise<WSTunnelData> {
    return new Promise((resolve, reject) => {
      const url = new URL(data.path || '/', `http://${this.config.localAddress}`);

      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: data.method || 'GET',
        headers: {
          ...data.headers,
          'host': this.config.localAddress.split(':')[0]
        }
      };

      const req = httpRequest(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks);
          const responseData: WSTunnelData = {
            tunnelId: this.config.tunnelId,
            requestId: data.requestId,
            statusCode: res.statusCode ?? 200,
            responseHeaders: res.headers as Record<string, string>,
            responseBody: body.toString('base64'),
            timestamp: Date.now()
          };
          resolve(responseData);
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (data.body) {
        req.write(Buffer.from(data.body, 'base64'));
      }

      req.end();
    });
  }
}
