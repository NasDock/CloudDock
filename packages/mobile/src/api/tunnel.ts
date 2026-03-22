import api, { getApiBaseUrl } from './client';
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
  list: async (params?: { page?: number; limit?: number; status?: 'online' | 'offline' | 'all' }): Promise<TunnelListResponse> => {
    const response = await api.get<{ success: true; data: TunnelListResponse }>('/tunnels', { params });
    return response.data.data!;
  },

  get: async (tunnelId: string): Promise<TunnelDetailResponse> => {
    const response = await api.get<{ success: true; data: TunnelDetailResponse }>(`/tunnels/${tunnelId}`);
    return response.data.data!;
  },

  create: async (data: CreateTunnelRequest): Promise<Tunnel> => {
    const response = await api.post<{ success: true; data: Tunnel }>('/tunnels', data);
    return response.data.data!;
  },

  update: async (tunnelId: string, data: UpdateTunnelRequest): Promise<Tunnel> => {
    const response = await api.put<{ success: true; data: Tunnel }>(`/tunnels/${tunnelId}`, data);
    return response.data.data!;
  },

  delete: async (tunnelId: string): Promise<void> => {
    await api.delete(`/tunnels/${tunnelId}`);
  },

  regenerateToken: async (tunnelId: string): Promise<{ accessToken: string }> => {
    const response = await api.post<{ success: true; data: { accessToken: string } }>(
      `/tunnels/${tunnelId}/regenerate-token`
    );
    return response.data.data!;
  },

  setEnabled: async (tunnelId: string, enabled: boolean): Promise<{ tunnelId: string; enabled: boolean; status: string }> => {
    const response = await api.patch<{ success: true; data: { tunnelId: string; enabled: boolean; status: string } }>(
      `/tunnels/${tunnelId}/enabled`,
      { enabled }
    );
    return response.data.data!;
  },

  getLogs: async (
    tunnelId: string,
    params?: { startTime?: string; endTime?: string; page?: number; limit?: number }
  ): Promise<AccessLogResponse> => {
    const response = await api.get<{ success: true; data: AccessLogResponse }>(`/tunnels/${tunnelId}/logs`, { params });
    return response.data.data!;
  },

  getPublicUrl: (publicPath: string): string => {
    const base = getApiBaseUrl().replace('/api', '');
    return `${base.replace(/\/+$/, '')}${publicPath.replace(/\/$/, '')}`;
  },
};
