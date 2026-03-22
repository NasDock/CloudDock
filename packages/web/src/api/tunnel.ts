import type { ApiResponse, PaginatedResponse, Tunnel, TunnelStatistics } from '@cloud-dock/shared';
import apiClient from './client';

export interface CreateTunnelRequest {
  name: string;
  protocol: 'http' | 'tcp' | 'udp';
  localAddress: string;
  localHostname?: string;
  clientId?: string;
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

export interface TunnelQueryParams {
  page?: number;
  limit?: number;
  status?: 'online' | 'offline' | 'all';
}

export interface TunnelListResponse {
  tunnels: Tunnel[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export const getTunnels = async (params?: TunnelQueryParams) => {
  return apiClient.get<ApiResponse<TunnelListResponse>>('/tunnels', { params });
};

export const getTunnel = async (tunnelId: string) => {
  return apiClient.get<ApiResponse<Tunnel & { statistics: TunnelStatistics }>>(
    `/tunnels/${tunnelId}`,
  );
};

export const createTunnel = async (data: CreateTunnelRequest) => {
  return apiClient.post<ApiResponse<Tunnel>>('/tunnels', data);
};

export const updateTunnel = async (tunnelId: string, data: UpdateTunnelRequest) => {
  return apiClient.put<ApiResponse<Tunnel>>(`/tunnels/${tunnelId}`, data);
};

export const deleteTunnel = async (tunnelId: string) => {
  return apiClient.delete<ApiResponse<{ message: string }>>(`/tunnels/${tunnelId}`);
};

export const regenerateTunnelToken = async (tunnelId: string) => {
  return apiClient.post<ApiResponse<{ accessToken: string }>>(
    `/tunnels/${tunnelId}/regenerate-token`,
  );
};

export const setTunnelEnabled = async (tunnelId: string, enabled: boolean) => {
  return apiClient.patch<ApiResponse<{ tunnelId: string; enabled: boolean; status: string }>>(
    `/tunnels/${tunnelId}/enabled`,
    { enabled },
  );
};

export interface AccessLog {
  logId: string;
  timestamp: string;
  clientIp: string;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
}

export const getTunnelLogs = async (
  tunnelId: string,
  params?: { startTime?: string; endTime?: string; page?: number; limit?: number },
) => {
  return apiClient.get<ApiResponse<PaginatedResponse<AccessLog>>>(
    `/tunnels/${tunnelId}/logs`,
    { params },
  );
};
