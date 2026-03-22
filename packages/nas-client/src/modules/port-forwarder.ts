import { HttpProxy, HttpProxyConfig } from './http-proxy.js';
import { TcpRelay, TcpRelayConfig } from './tcp-relay.js';
import { TunnelConfig } from '../utils/config-store.js';
import { logger } from '../utils/logger.js';
import { WSTunnelData } from '../types/ws.js';

export interface PortForwarderConfig {
  tunnel: TunnelConfig;
  onRequest: (data: WSTunnelData) => void;
  onResponse: (data: WSTunnelData) => void;
}

export interface ForwarderInstance {
  tunnelId: string;
  name: string;
  protocol: 'http' | 'tcp' | 'udp';
  localAddress: string;
  port: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  error?: string;
}

export class PortForwarder {
  private forwarders: Map<string, HttpProxy | TcpRelay> = new Map();
  private instances: Map<string, ForwarderInstance> = new Map();

  constructor() {}

  async startTunnel(config: PortForwarderConfig): Promise<ForwarderInstance> {
    const tunnelId = config.tunnel.tunnelId || `local_${Date.now().toString(36)}`;

    const instance: ForwarderInstance = {
      tunnelId,
      name: config.tunnel.name,
      protocol: config.tunnel.protocol,
      localAddress: config.tunnel.localAddress,
      port: 0,
      status: 'starting'
    };

    this.instances.set(tunnelId, instance);
    logger.info('Starting tunnel', { tunnelId, name: config.tunnel.name, protocol: config.tunnel.protocol });

    try {
      if (config.tunnel.protocol === 'http') {
        const httpConfig: HttpProxyConfig = {
          localAddress: config.tunnel.localAddress,
          localHostname: config.tunnel.localHostname,
          tunnelId,
          onRequest: config.onRequest,
          onResponse: config.onResponse
        };

        const proxy = new HttpProxy(httpConfig);
        instance.port = await proxy.start();
        this.forwarders.set(tunnelId, proxy);
      } else if (config.tunnel.protocol === 'tcp') {
        const tcpConfig: TcpRelayConfig = {
          localAddress: config.tunnel.localAddress,
          tunnelId,
          onData: config.onRequest
        };

        const relay = new TcpRelay(tcpConfig);
        instance.port = await relay.start();
        this.forwarders.set(tunnelId, relay);
      } else {
        throw new Error(`Unsupported protocol: ${config.tunnel.protocol}`);
      }

      instance.status = 'running';
      logger.info('Tunnel started successfully', { tunnelId, port: instance.port });
      return instance;
    } catch (error) {
      instance.status = 'error';
      instance.error = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to start tunnel', { tunnelId, error: instance.error });
      throw error;
    }
  }

  stopTunnel(tunnelId: string): void {
    const forwarder = this.forwarders.get(tunnelId);
    if (forwarder) {
      forwarder.stop();
      this.forwarders.delete(tunnelId);
    }

    const instance = this.instances.get(tunnelId);
    if (instance) {
      instance.status = 'stopped';
    }

    logger.info('Tunnel stopped', { tunnelId });
  }

  stopAll(): void {
    for (const tunnelId of this.forwarders.keys()) {
      this.stopTunnel(tunnelId);
    }
  }

  handleTunnelData(data: WSTunnelData): void {
    const forwarder = this.forwarders.get(data.tunnelId);

    if (forwarder instanceof HttpProxy) {
      forwarder.handleResponse(data);
    } else if (forwarder instanceof TcpRelay) {
      forwarder.handleRemoteData(data);
    }
  }

  getInstance(tunnelId: string): ForwarderInstance | undefined {
    return this.instances.get(tunnelId);
  }

  getAllInstances(): ForwarderInstance[] {
    return Array.from(this.instances.values());
  }

  getRunningCount(): number {
    return Array.from(this.instances.values()).filter(i => i.status === 'running').length;
  }
}
