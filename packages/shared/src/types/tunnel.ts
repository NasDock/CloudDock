// Tunnel types
export type Protocol = 'http' | 'tcp' | 'udp';
export type Status = 'online' | 'offline';

export interface Tunnel {
  tunnelId: string;
  userId: string;
  clientId?: string;
  name: string;
  protocol: Protocol;
  localAddress: string;
  localHostname?: string;
  enabled?: boolean;
  status: Status;
  accessToken?: string;
  publicPath: string;
  ipWhitelist: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastHeartbeat?: Date;
}

export interface TunnelStatistics {
  totalRequests: number;
  bytesIn: number;
  bytesOut: number;
}
