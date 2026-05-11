import type { Tun as TunType } from 'tuntap2';
import { logger } from '../utils/logger.js';
import { setupLinuxNetworking, teardownLinuxNetworking } from '../utils/network-setup.js';

export interface VPNGatewayConfig {
  tunAddress: string;
  subnetMask: string;
  mtu?: number;
  localSubnet?: string;
}

export interface VPNGateway {
  start(): Promise<void>;
  stop(): void;
  sendPacket(packet: Buffer): void;
  onPacketReceived?: (packet: Buffer) => void;
  isRunning(): boolean;
  getTunName(): string | undefined;
}

type TunConstructor = new () => TunType;

async function loadTunConstructor(): Promise<TunConstructor> {
  const mod = await import('tuntap2').catch((err: any) => {
    throw new Error(
      `tuntap2 native addon is unavailable: ${err?.message || String(err)}`
    );
  });
  return mod.Tun as TunConstructor;
}

class VPNGatewayImpl implements VPNGateway {
  private tun?: TunType;
  private config: VPNGatewayConfig;
  private running = false;

  onPacketReceived?: (packet: Buffer) => void;

  constructor(config: VPNGatewayConfig) {
    this.config = {
      mtu: 1280,
      localSubnet: '192.168.0.0/16',
      ...config,
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('VPN gateway already running');
      return;
    }

    try {
      const Tun = await loadTunConstructor();
      this.tun = new Tun();
      this.tun.mtu = this.config.mtu!;

      // Calculate CIDR from subnet mask
      const prefix = this.prefixLength(this.config.subnetMask);
      this.tun.ipv4 = `${this.config.tunAddress}/${prefix}`;
      this.tun.isUp = true;

      this.running = true;
      logger.info('TUN interface created', {
        name: this.tun.name,
        address: this.tun.ipv4,
        mtu: this.tun.mtu,
      });

      // Setup networking (NAT, forwarding)
      setupLinuxNetworking({
        tunName: this.tun.name,
        tunAddress: `${this.config.tunAddress}/${prefix}`,
        localSubnet: this.config.localSubnet!,
        enableForwarding: true,
      });

      // Start reading packets from TUN
      this.startReadingPackets();
    } catch (err: any) {
      logger.error('Failed to start VPN gateway', { error: err.message });
      this.stop();
      throw err;
    }
  }

  stop(): void {
    if (!this.running && !this.tun) return;
    this.running = false;

    if (this.tun) {
      try {
        teardownLinuxNetworking({
          tunName: this.tun.name,
          tunAddress: this.tun.ipv4 || this.config.tunAddress,
          localSubnet: this.config.localSubnet!,
          enableForwarding: true,
        });
      } catch {
        // ignore
      }

      try {
        this.tun.release();
      } catch {
        // ignore
      }
      this.tun = undefined;
    }

    logger.info('VPN gateway stopped');
  }

  sendPacket(packet: Buffer): void {
    if (!this.running || !this.tun) return;
    try {
      this.tun.write(packet);
    } catch (err: any) {
      logger.warn('Failed to write packet to TUN', { error: err.message });
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getTunName(): string | undefined {
    return this.tun?.name;
  }

  private startReadingPackets(): void {
    if (!this.tun) return;

    this.tun.on('data', (buf: Buffer) => {
      if (!this.running) return;
      try {
        this.onPacketReceived?.(buf);
      } catch (err: any) {
        logger.warn('Error handling received packet', { error: err.message });
      }
    });

    this.tun.on('error', (err: Error) => {
      logger.error('TUN read error', { error: err.message });
    });
  }

  private prefixLength(mask: string): number {
    const parts = mask.split('.');
    let count = 0;
    for (const part of parts) {
      const num = parseInt(part, 10);
      for (let i = 7; i >= 0; i--) {
        if (num & (1 << i)) count++;
        else if (count > 0) break;
      }
    }
    return count;
  }
}

export function createVPNGateway(config: VPNGatewayConfig): VPNGateway {
  return new VPNGatewayImpl(config);
}
