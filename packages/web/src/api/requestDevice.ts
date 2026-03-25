import { apiClient } from './client';
import type { RequestDevice } from '@cloud-dock/shared';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

export const requestDeviceApi = {
  list: async () => {
    const res = await apiClient.get<ApiResponse<{ devices: RequestDevice[] }>>('/request-devices');
    if (!res.data.success) throw new Error(res.data.error?.message || 'Request failed');
    return res.data.data!;
  },
  updateStatus: async (deviceId: string, status: 'approved' | 'blocked') => {
    const res = await apiClient.patch<ApiResponse<RequestDevice>>(`/request-devices/${deviceId}`, { status });
    if (!res.data.success) throw new Error(res.data.error?.message || 'Request failed');
    return res.data.data!;
  },
  remove: async (deviceId: string) => {
    const res = await apiClient.delete<ApiResponse<{ deviceId: string }>>(`/request-devices/${deviceId}`);
    if (!res.data.success) throw new Error(res.data.error?.message || 'Request failed');
    return res.data.data!;
  },
};
