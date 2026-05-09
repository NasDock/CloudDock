import { execSync } from 'child_process';
import * as fs from 'fs';
import koffi from 'koffi';
import { VPNConfig, VPNStats, VPNEngine } from './vpn-engine';

const PF_SYSTEM = 32;
const AF_SYSTEM = 32;
const SOCK_DGRAM = 2;
const SYSPROTO_CONTROL = 2;
const AF_SYS_KERNCONTROL = 2;
const CTLIOCGINFO = 0xc0644e03;
const UTUN_OPT_IFNAME = 2;
const SOL_SOCKET = 0xffff;
const SO_SNDBUF = 0x1001;
const SO_RCVBUF = 0x1002;

const AF_INET = 2;

export class DarwinVPNEngine implements VPNEngine {
  private fd = -1;
  private stats: VPNStats = { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 };
  private running = false;
  private utunName?: string | undefined;
  private readBuffer = Buffer.alloc(65536);
  private sendBuffer = Buffer.alloc(65536);
  private readInProgress = false;

  onPacketReceived?: (packet: Buffer) => void;

  async start(config: VPNConfig): Promise<void> {
    if (this.running) return;

    this.sendBuffer[0] = 0;
    this.sendBuffer[1] = 0;
    this.sendBuffer[2] = 0;
    this.sendBuffer[3] = AF_INET;

    const lib = koffi.load('/usr/lib/libSystem.B.dylib');

    const socket = lib.func('socket', 'int', ['int', 'int', 'int']);
    const ioctl = lib.func('ioctl', 'int', ['int', 'unsigned long', '...']);
    const connect = lib.func('connect', 'int', ['int', 'void *', 'unsigned int']);
    const getsockopt = lib.func('getsockopt', 'int', ['int', 'int', 'int', 'void *', 'unsigned int *']);
    const setsockopt = lib.func('setsockopt', 'int', ['int', 'int', 'int', 'void *', 'unsigned int']);
    const closeFn = lib.func('close', 'int', ['int']);
    const __error = lib.func('__error', 'int *', []);

    const getErrno = (): number => {
      const ptr = __error();
      return koffi.decode(ptr, 'int');
    };

    // 1. Create system control socket
    const fd = socket(PF_SYSTEM, SOCK_DGRAM, SYSPROTO_CONTROL);
    if (fd < 0) {
      throw new Error(`[vpn] Failed to create system control socket, errno=${getErrno()}`);
    }

    try {
      // 2. Get control ID for utun
      koffi.struct('ctl_info', {
        ctl_id: 'uint32',
        ctl_name: koffi.array('char', 96),
      });

      const ctlInfoBuf = Buffer.from(koffi.alloc('ctl_info', 1));
      ctlInfoBuf.writeUInt32LE(0, 0);
      ctlInfoBuf.write('com.apple.net.utun_control', 4, 'utf8');

      const ret1 = ioctl(fd, BigInt(CTLIOCGINFO), 'void *', ctlInfoBuf);
      if (ret1 < 0) {
        throw new Error(`[vpn] ioctl CTLIOCGINFO failed, errno=${getErrno()}`);
      }

      const ctlId = ctlInfoBuf.readUInt32LE(0);

      // 3. Connect to utun (unit 0 = auto-assign)
      koffi.struct('sockaddr_ctl', {
        sc_len: 'uint8',
        sc_family: 'uint8',
        sc_sysaddr: 'uint16',
        sc_id: 'uint32',
        sc_unit: 'uint32',
        sc_reserved: koffi.array('uint32', 5),
      });

      const scBuf = Buffer.from(koffi.alloc('sockaddr_ctl', 1));
      scBuf.writeUInt8(32, 0);
      scBuf.writeUInt8(AF_SYSTEM, 1);
      scBuf.writeUInt16LE(AF_SYS_KERNCONTROL, 2);
      scBuf.writeUInt32LE(ctlId, 4);
      scBuf.writeUInt32LE(0, 8);

      const ret2 = connect(fd, scBuf, 32);
      if (ret2 < 0) {
        throw new Error(`[vpn] connect to utun failed, errno=${getErrno()}`);
      }

      // 4. Get interface name
      const ifnameBuf = Buffer.alloc(16);
      const optlenBuf = Buffer.from(koffi.alloc('unsigned int', 1));
      optlenBuf.writeUInt32LE(16, 0);

      const ret3 = getsockopt(fd, SYSPROTO_CONTROL, UTUN_OPT_IFNAME, ifnameBuf, optlenBuf);
      if (ret3 < 0) {
        throw new Error(`[vpn] getsockopt UTUN_OPT_IFNAME failed, errno=${getErrno()}`);
      }
      const ifnameLen = optlenBuf.readUInt32LE(0);
      this.utunName = ifnameBuf.toString('utf8', 0, Math.min(ifnameLen, 16)).replace(/\0/g, '');

      // 5. Set socket buffer sizes
      const sndbuf = Buffer.from(koffi.alloc('int', 1));
      sndbuf.writeInt32LE(65536, 0);
      setsockopt(fd, SOL_SOCKET, SO_SNDBUF, sndbuf, 4);
      const rcvbuf = Buffer.from(koffi.alloc('int', 1));
      rcvbuf.writeInt32LE(65536, 0);
      setsockopt(fd, SOL_SOCKET, SO_RCVBUF, rcvbuf, 4);

      this.fd = fd;

      // 6. Configure interface
      const prefix = this.prefixLength(config.subnetMask);
      execSync(`ifconfig ${this.utunName} inet ${config.address}/${prefix} ${config.address}`, { stdio: 'ignore' });
      execSync(`ifconfig ${this.utunName} mtu ${config.mtu} up`, { stdio: 'ignore' });

      // 7. Add routes
      for (const route of config.routes) {
        try {
          execSync(`route add -net ${route} -interface ${this.utunName}`, { stdio: 'ignore' });
        } catch {
          // route may already exist
        }
      }

      this.running = true;
      this.startReading();
    } catch (err) {
      closeFn(fd);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;

    if (this.fd >= 0) {
      const lib = koffi.load('/usr/lib/libSystem.B.dylib');
      const closeFn = lib.func('close', 'int', ['int']);
      closeFn(this.fd);
      this.fd = -1;
    }
    this.utunName = undefined;
  }

  sendPacket(packet: Buffer): void {
    if (!this.running || this.fd < 0) return;
    if (packet.length + 4 > this.sendBuffer.length) return;

    packet.copy(this.sendBuffer, 4);
    try {
      fs.writeSync(this.fd, this.sendBuffer, 0, packet.length + 4);
      this.stats.bytesOut += packet.length;
      this.stats.packetsOut++;
    } catch {
      // ignore
    }
  }

  getStats(): VPNStats {
    return { ...this.stats };
  }

  private startReading(): void {
    if (this.readInProgress) return;
    this.readInProgress = true;

    const doRead = () => {
      if (!this.running || this.fd < 0) {
        this.readInProgress = false;
        return;
      }
      fs.read(this.fd, this.readBuffer, 0, this.readBuffer.length, null, (err, bytesRead) => {
        if (!this.running) {
          this.readInProgress = false;
          return;
        }
        if (err || !bytesRead) {
          setTimeout(doRead, 10);
          return;
        }
        this.stats.bytesIn += bytesRead;
        this.stats.packetsIn++;
        if (bytesRead > 4) {
          try {
            this.onPacketReceived?.(this.readBuffer.subarray(4, bytesRead));
          } catch {
            // ignore
          }
        }
        doRead();
      });
    };

    doRead();
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
