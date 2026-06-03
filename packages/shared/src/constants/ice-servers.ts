// Default STUN servers for WebRTC NAT traversal
export const DEFAULT_STUN_SERVERS: IceServerConfig[] = [
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.chat.bilibili.com:3478' },
];

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Build full ICE server list from server-provided TURN credentials.
// TURN servers are now dynamically provided by the signal server via
// temporary credentials (TURN REST API), so clients no longer need
// to embed long-term credentials.
export function buildIceServers(
  turnServers?: IceServerConfig[]
): IceServerConfig[] {
  const servers: IceServerConfig[] = [...DEFAULT_STUN_SERVERS];
  if (turnServers && turnServers.length > 0) {
    servers.push(...turnServers);
  }
  return servers;
}
