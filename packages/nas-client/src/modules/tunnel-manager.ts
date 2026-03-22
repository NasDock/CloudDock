import { NASClient, TunnelInfo } from '../client.js';
import { logger } from '../utils/logger.js';

export interface TunnelState extends TunnelInfo {
  localPort?: number;
  error?: string;
}

export class TunnelManager {
  private tunnels = new Map<string, TunnelState>();
  private client: NASClient;

  constructor(client: NASClient) {
    this.client = client;
  }

  updateTunnel(info: TunnelInfo): void {
    const existing = this.tunnels.get(info.tunnelId);
    this.tunnels.set(info.tunnelId, {
      ...info,
      localPort: existing?.localPort,
      error: existing?.error,
    });
    logger.info('Tunnel updated', { name: info.name, status: info.status });
  }

  handleTunnelUpdate(data: TunnelInfo): void {
    this.updateTunnel(data);
  }

  handleTunnelDeleted(tunnelId: string): void {
    this.tunnels.delete(tunnelId);
    logger.info('Tunnel removed', { tunnelId });
  }

  getTunnel(tunnelId: string): TunnelState | undefined {
    return this.tunnels.get(tunnelId);
  }

  getAllTunnels(): TunnelState[] {
    return Array.from(this.tunnels.values());
  }

  clearTunnels(): void {
    this.tunnels.clear();
  }
}
