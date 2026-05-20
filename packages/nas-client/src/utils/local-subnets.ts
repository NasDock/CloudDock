import os from 'os';

function ipToInt(ip: string): number {
  const parts = ip.split('.').map((v) => parseInt(v, 10));
  return (((parts[0] ?? 0) << 24) >>> 0)
    + (((parts[1] ?? 0) << 16) >>> 0)
    + (((parts[2] ?? 0) << 8) >>> 0)
    + ((parts[3] ?? 0) >>> 0);
}

function maskToPrefix(mask: string): number {
  let count = 0;
  for (const part of mask.split('.')) {
    const n = parseInt(part, 10);
    count += Number.isNaN(n) ? 0 : n.toString(2).split('1').length - 1;
  }
  return count;
}

function networkCidr(ip: string, mask: string): string {
  const prefix = maskToPrefix(mask);
  const ipInt = ipToInt(ip);
  const maskInt = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const net = ipInt & maskInt;
  return `${(net >>> 24) & 255}.${(net >>> 16) & 255}.${(net >>> 8) & 255}.${net & 255}/${prefix}`;
}

function isPrivateIPv4(ip: string): boolean {
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  const second = parseInt(ip.split('.')[1] || '0', 10);
  return ip.startsWith('172.') && second >= 16 && second <= 31;
}

export function resolveLocalSubnets(): string[] {
  const env = (process.env.CLOUD_DOCK_LOCAL_SUBNETS || process.env.LOCAL_SUBNETS || '').trim();
  if (env) {
    return Array.from(new Set(env.split(',').map((v) => v.trim()).filter(Boolean)));
  }

  const ifaces = os.networkInterfaces();
  const subnets = new Set<string>();

  for (const entries of Object.values(ifaces)) {
    for (const entry of entries || []) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) continue;
      if (!isPrivateIPv4(entry.address)) continue;
      if (!entry.netmask) continue;
      subnets.add(networkCidr(entry.address, entry.netmask));
    }
  }

  if (subnets.size === 0) {
    subnets.add('192.168.0.0/16');
  }

  return Array.from(subnets);
}

