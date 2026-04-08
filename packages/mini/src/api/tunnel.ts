import { request, getApiBaseUrl } from './client';
import type { Tunnel, TunnelStatistics } from '@cloud-dock/shared';

export interface CreateTunnelRequest {
  name: string;
  protocol: 'http' | 'tcp' | 'udp';
  localAddress: string;
  localHostname?: string;
  ipWhitelist?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTunnelRequest {
  name?: string;
  localAddress?: string;
  localHostname?: string;
  ipWhitelist?: string[];
  metadata?: Record<string, unknown>;
}

export interface TunnelListResponse {
  tunnels: Tunnel[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface TunnelDetailResponse extends Tunnel {
  statistics: TunnelStatistics;
}

export interface AccessLog {
  logId: string;
  timestamp: string;
  clientIp: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
}

export interface AccessLogResponse {
  logs: AccessLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export const tunnelApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: 'online' | 'offline' | 'all';
  }): Promise<TunnelListResponse> => {
    return request<TunnelListResponse>({ url: '/tunnels', method: 'GET', params: params as any });
  },

  get: async (tunnelId: string): Promise<TunnelDetailResponse> => {
    return request<TunnelDetailResponse>({ url: `/tunnels/${tunnelId}` });
  },

  create: async (data: CreateTunnelRequest): Promise<Tunnel> => {
    return request<Tunnel>({ url: '/tunnels', method: 'POST', data });
  },

  update: async (tunnelId: string, data: UpdateTunnelRequest): Promise<Tunnel> => {
    return request<Tunnel>({ url: `/tunnels/${tunnelId}`, method: 'PUT', data });
  },

  delete: async (tunnelId: string): Promise<void> => {
    return request<void>({ url: `/tunnels/${tunnelId}`, method: 'DELETE' });
  },

  regenerateToken: async (
    tunnelId: string
  ): Promise<{ accessToken: string }> => {
    return request<{ accessToken: string }>({
      url: `/tunnels/${tunnelId}/regenerate-token`,
      method: 'POST',
    });
  },

  setEnabled: async (
    tunnelId: string,
    enabled: boolean
  ): Promise<{ tunnelId: string; enabled: boolean; status: string }> => {
    return request<{ tunnelId: string; enabled: boolean; status: string }>({
      url: `/tunnels/${tunnelId}/enabled`,
      method: 'PATCH',
      data: { enabled },
    });
  },

  getLogs: async (
    tunnelId: string,
    params?: {
      startTime?: string;
      endTime?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<AccessLogResponse> => {
    return request<AccessLogResponse>({
      url: `/tunnels/${tunnelId}/logs`,
      method: 'GET',
      params: params as any,
    });
  },

  getPublicUrl: (publicPath: string): string => {
    const base = getApiBaseUrl().replace('/api', '');
    return `${base.replace(/\/+$/, '')}${publicPath.replace(/\/$/, '')}`;
  },
};
