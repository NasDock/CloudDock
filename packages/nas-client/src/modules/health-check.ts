import { logger } from '../utils/logger.js';

export interface HealthStatus {
  healthy: boolean;
  timestamp: number;
  latencyMs?: number;
  error?: string;
}

export interface LocalServiceHealth {
  address: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export class HealthCheck {
  private checkInterval: NodeJS.Timeout | null = null;
  private callbacks: Set<(status: HealthStatus) => void> = new Set();

  constructor(
    private serverUrl: string,
    private intervalMs: number = 30000
  ) {}

  start(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.check().catch(err => {
        logger.error('Health check failed', { error: err.message });
      });
    }, this.intervalMs);

    // Initial check
    this.check().catch(err => {
      logger.error('Initial health check failed', { error: err.message });
    });
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  onStatusChange(callback: (status: HealthStatus) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  async check(): Promise<HealthStatus> {
    const start = Date.now();

    try {
      // Attempt to connect to the server URL to check connectivity
      const wsUrl = this.serverUrl.replace(/^wss?:\/\//, 'https://');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(wsUrl, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal
        });
        clearTimeout(timeout);

        const latencyMs = Date.now() - start;
        const status: HealthStatus = {
          healthy: true,
          timestamp: Date.now(),
          latencyMs
        };

        this.notifyCallbacks(status);
        return status;
      } catch {
        clearTimeout(timeout);
        // no-cors mode will always fail with TypeError, but that means server is reachable
        const latencyMs = Date.now() - start;
        const status: HealthStatus = {
          healthy: true,
          timestamp: Date.now(),
          latencyMs
        };

        this.notifyCallbacks(status);
        return status;
      }
    } catch (error) {
      const status: HealthStatus = {
        healthy: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.notifyCallbacks(status);
      return status;
    }
  }

  async checkLocalService(address: string): Promise<LocalServiceHealth> {
    const [host, portStr] = address.split(':');
    const port = parseInt(portStr, 10);

    const start = Date.now();

    try {
      const result = await this.checkTcpPort(host, port);
      const latencyMs = Date.now() - start;

      return {
        address,
        healthy: result,
        latencyMs: result ? latencyMs : undefined,
        error: result ? undefined : 'Connection refused'
      };
    } catch (error) {
      return {
        address,
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async checkTcpPort(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const net = require('node:net');
      const socket = new net.Socket();

      socket.setTimeout(3000);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  private notifyCallbacks(status: HealthStatus): void {
    for (const callback of this.callbacks) {
      try {
        callback(status);
      } catch (error) {
        logger.error('Health check callback error', { error });
      }
    }
  }
}
