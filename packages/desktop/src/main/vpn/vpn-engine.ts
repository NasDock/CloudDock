export interface VPNConfig {
  address: string;
  subnetMask: string;
  mtu: number;
  routes: string[];
  dnsServers?: string[];
}

export interface VPNStats {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

export interface VPNEngine {
  start(config: VPNConfig): Promise<void>;
  stop(): Promise<void>;
  sendPacket(packet: Buffer): void;
  onPacketReceived?: (packet: Buffer) => void;
  getStats(): VPNStats;
}

export function createVPNEngine(): VPNEngine {
  switch (process.platform) {
    case 'linux':
      return new (require('./tun-linux').LinuxVPNEngine)();
    case 'darwin':
      return new (require('./tun-darwin').DarwinVPNEngine)();
    case 'win32':
      return new (require('./tun-win32').WindowsVPNEngine)();
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}
