import { execSync } from 'child_process';
import { Tun } from 'tuntap2';
import { VPNConfig, VPNStats, VPNEngine } from './vpn-engine';

export class LinuxVPNEngine implements VPNEngine {
  private tun?: Tun | undefined;
  private stats: VPNStats = { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 };
  private running = false;

  onPacketReceived?: (packet: Buffer) => void;

  async start(config: VPNConfig): Promise<void> {
    if (this.running) return;

    this.tun = new Tun();
    this.tun.mtu = config.mtu;

    const prefix = this.prefixLength(config.subnetMask);
    this.tun.ipv4 = `${config.address}/${prefix}`;
    this.tun.isUp = true;
    this.running = true;

    // Add routes
    for (const route of config.routes) {
      try {
        execSync(`ip route add ${route} dev ${this.tun.name}`, { stdio: 'ignore' });
      } catch {
        // route may already exist
      }
    }

    // Set DNS if provided
    if (config.dnsServers && config.dnsServers.length > 0) {
      try {
        execSync(`systemd-resolve --interface=${this.tun.name} --set-dns=${config.dnsServers.join(' --set-dns=')}`, {
          stdio: 'ignore',
        });
      } catch {
        // ignore
      }
    }

    this.startReadingPackets();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.tun) {
      try {
        this.tun.release();
      } catch {
        // ignore
      }
      this.tun = undefined;
    }
  }

  sendPacket(packet: Buffer): void {
    if (!this.running || !this.tun) return;
    try {
      this.tun.write(packet);
      this.stats.bytesOut += packet.length;
      this.stats.packetsOut++;
    } catch {
      // ignore
    }
  }

  getStats(): VPNStats {
    return { ...this.stats };
  }

  private startReadingPackets(): void {
    if (!this.tun) return;
    this.tun.on('data', (buf: Buffer) => {
      if (!this.running) return;
      this.stats.bytesIn += buf.length;
      this.stats.packetsIn++;
      try {
        this.onPacketReceived?.(buf);
      } catch {
        // ignore
      }
    });
    this.tun.on('error', (err: Error) => {
      console.error('[vpn] TUN read error', err.message);
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
