// Default STUN servers for WebRTC NAT traversal
export const DEFAULT_STUN_SERVERS: IceServerConfig[] = [
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.chat.bilibili.com:3478' },
];

// Default TURN servers (placeholder - users should configure their own)
export const DEFAULT_TURN_SERVERS: IceServerConfig[] = [];

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Build full ICE server list from environment/config
export function buildIceServers(
  turnServers?: IceServerConfig[]
): IceServerConfig[] {
  const servers: IceServerConfig[] = [...DEFAULT_STUN_SERVERS];
  if (turnServers && turnServers.length > 0) {
    servers.push(...turnServers);
  }
  return servers;
}
