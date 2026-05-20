// Default STUN servers for WebRTC NAT traversal
export const DEFAULT_STUN_SERVERS: IceServerConfig[] = [
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.chat.bilibili.com:3478' },
];

// Default TURN servers (load from env if available in Node environment)
const getEnvTurnServers = (): IceServerConfig[] => {
  const globalEnv = (globalThis as any).process?.env;
  if (globalEnv && globalEnv.CLOUD_DOCK_TURN_SERVERS) {
    try {
      return JSON.parse(globalEnv.CLOUD_DOCK_TURN_SERVERS);
    } catch {
      // ignore
    }
  }
  return [];
};

export const DEFAULT_TURN_SERVERS: IceServerConfig[] = getEnvTurnServers();

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
  } else if (DEFAULT_TURN_SERVERS.length > 0) {
    servers.push(...DEFAULT_TURN_SERVERS);
  }
  return servers;
}
