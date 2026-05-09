import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import koffi from 'koffi';
import { VPNConfig, VPNStats, VPNEngine } from './vpn-engine';

export class WindowsVPNEngine implements VPNEngine {
  private lib?: koffi.IKoffiLib | undefined;
  private adapter?: any | undefined;
  private session?: any | undefined;
  private stats: VPNStats = { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 };
  private running = false;
  private readTimer?: ReturnType<typeof setInterval> | undefined;

  onPacketReceived?: (packet: Buffer) => void;

  async start(config: VPNConfig): Promise<void> {
    if (this.running) return;

    const dllPath = this.findWintunDll();
    this.lib = koffi.load(dllPath);

    const WintunCreateAdapter = this.lib.func('WintunCreateAdapter', 'void *', ['uint16_t *', 'uint16_t *', 'void *']);
    const WintunCloseAdapter = this.lib.func('WintunCloseAdapter', 'void', ['void *']);
    const WintunStartSession = this.lib.func('WintunStartSession', 'void *', ['void *', 'uint32']);
    const WintunEndSession = this.lib.func('WintunEndSession', 'void', ['void *']);
    const WintunReceivePacket = this.lib.func('WintunReceivePacket', 'void *', ['void *', 'uint32 *']);
    const WintunReleaseReceivePacket = this.lib.func('WintunReleaseReceivePacket', 'void', ['void *', 'void *']);
    const WintunAllocateSendPacket = this.lib.func('WintunAllocateSendPacket', 'void *', ['void *', 'uint32']);
    const WintunSendPacket = this.lib.func('WintunSendPacket', 'void', ['void *', 'void *']);

    const namePtr = this.toWchar('CloudDock');
    const typePtr = this.toWchar('CloudDock');
    this.adapter = WintunCreateAdapter(namePtr, typePtr, null);
    if (!this.adapter) {
      throw new Error('[vpn] WintunCreateAdapter failed');
    }

    this.session = WintunStartSession(this.adapter, 0x400000);
    if (!this.session) {
      WintunCloseAdapter(this.adapter);
      this.adapter = undefined;
      throw new Error('[vpn] WintunStartSession failed');
    }

    this.running = true;

    // Configure IP and MTU
    try {
      execSync(`netsh interface ip set address name="CloudDock" static ${config.address} ${config.subnetMask}`, { stdio: 'ignore' });
      execSync(`netsh interface ipv4 set subinterface "CloudDock" mtu=${config.mtu} store=persistent`, { stdio: 'ignore' });
    } catch {
      // ignore netsh errors
    }

    // Add routes
    for (const route of config.routes) {
      try {
        execSync(`route add ${route} mask ${config.subnetMask} ${config.address}`, { stdio: 'ignore' });
      } catch {
        // route may already exist
      }
    }

    // Start polling loop
    this.readTimer = setInterval(() => {
      if (!this.running || !this.session) return;
      const packetSizeBuf = Buffer.allocUnsafe(4);
      packetSizeBuf.writeUInt32LE(0, 0);

      let batch = 0;
      while (batch < 100) {
        const packetPtr = WintunReceivePacket(this.session, packetSizeBuf);
        if (!packetPtr) break;
        const packetSize = packetSizeBuf.readUInt32LE(0);
        if (packetSize > 0) {
          const ab = koffi.view(packetPtr, packetSize);
          const packet = Buffer.from(ab);
          const packetCopy = Buffer.alloc(packetSize);
          packet.copy(packetCopy);
          WintunReleaseReceivePacket(this.session, packetPtr);
          this.stats.bytesIn += packetSize;
          this.stats.packetsIn++;
          try {
            this.onPacketReceived?.(packetCopy);
          } catch {
            // ignore
          }
        } else {
          WintunReleaseReceivePacket(this.session, packetPtr);
        }
        batch++;
      }
    }, 1);
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.readTimer) {
      clearInterval(this.readTimer);
      this.readTimer = undefined;
    }

    if (this.session && this.lib) {
      const WintunEndSession = this.lib.func('WintunEndSession', 'void', ['void *']);
      WintunEndSession(this.session);
      this.session = undefined;
    }

    if (this.adapter && this.lib) {
      const WintunCloseAdapter = this.lib.func('WintunCloseAdapter', 'void', ['void *']);
      WintunCloseAdapter(this.adapter);
      this.adapter = undefined;
    }

    this.lib = undefined;
  }

  sendPacket(packet: Buffer): void {
    if (!this.running || !this.session || !this.lib) return;
    const WintunAllocateSendPacket = this.lib.func('WintunAllocateSendPacket', 'void *', ['void *', 'uint32']);
    const WintunSendPacket = this.lib.func('WintunSendPacket', 'void', ['void *', 'void *']);

    const packetPtr = WintunAllocateSendPacket(this.session, packet.length);
    if (!packetPtr) return;

    const ab = koffi.view(packetPtr, packet.length);
    const dest = Buffer.from(ab);
    packet.copy(dest);

    WintunSendPacket(this.session, packetPtr);
    this.stats.bytesOut += packet.length;
    this.stats.packetsOut++;
  }

  getStats(): VPNStats {
    return { ...this.stats };
  }

  private findWintunDll(): string {
    const candidates = [
      path.join(process.resourcesPath || '', 'wintun.dll'),
      path.join(__dirname, '..', '..', 'assets', 'wintun.dll'),
      path.join(__dirname, 'wintun.dll'),
      'wintun.dll',
    ];
    for (const p of candidates) {
      try {
        fs.accessSync(p);
        return p;
      } catch {
        // continue
      }
    }
    throw new Error(
      '[vpn] wintun.dll not found. Please download it from https://www.wintun.net/ and place it alongside the executable or in the assets/ directory.'
    );
  }

  private toWchar(str: string): Uint16Array {
    const arr = new Uint16Array(str.length + 1);
    for (let i = 0; i < str.length; i++) {
      arr[i] = str.charCodeAt(i);
    }
    return arr;
  }
}
