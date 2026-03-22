import { createServer } from 'http';
import { NASClient } from './client.js';
import { loadConfig, updateConfig } from './utils/config-store.js';
import { logger } from './utils/logger.js';

export interface LocalApiConfig {
  host?: string;
  port?: number;
}

function readJson(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function startLocalApi(client: NASClient, config: LocalApiConfig = {}): void {
  const host = config.host || '127.0.0.1';
  const port = config.port || 5700;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/status') {
        const cfg = loadConfig();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            connected: client.isConnected(),
            serverUrl: cfg.serverUrl,
            clientKeySet: !!cfg.clientKey,
            deviceName: cfg.deviceName,
            tunnels: client.tunnelManager.getAllTunnels(),
          })
        );
        return;
      }

      if (req.method === 'POST' && url.pathname === '/config') {
        const body = await readJson(req);
        const updates: any = {};
        if (typeof body.serverUrl === 'string') updates.serverUrl = body.serverUrl;
        if (typeof body.clientKey === 'string') updates.clientKey = body.clientKey;
        if (typeof body.deviceName === 'string') updates.deviceName = body.deviceName;

        updateConfig(updates);
        client.updateConnectionConfig(updates);

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/connect') {
        if (!client.isConnected()) {
          await client.connect();
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/reconnect') {
        await client.reconnect();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/disconnect') {
        client.disconnect();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err: any) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
    }
  });

  server.listen(port, host, () => {
    logger.info('Local API listening', { host, port });
  });
}
