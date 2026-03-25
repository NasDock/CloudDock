import api from './client';

export type RequestDeviceStatus = 'pending' | 'approved' | 'blocked';

export interface RequestDevice {
  requestDeviceId: string;
  deviceId: string;
  name: string | null;
  platform: string | null;
  status: RequestDeviceStatus;
  lastSeen: string | null;
  lastIp: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestDeviceListResponse {
  devices: RequestDevice[];
}

export const requestDeviceApi = {
  list: async (): Promise<RequestDeviceListResponse> => {
    const response = await api.get<{ success: true; data: RequestDeviceListResponse }>('/request-devices');
    return response.data.data!;
  },
  updateStatus: async (deviceId: string, status: 'approved' | 'blocked'): Promise<RequestDevice> => {
    const response = await api.patch<{ success: true; data: RequestDevice }>(`/request-devices/${deviceId}`, { status });
    return response.data.data!;
  },
  remove: async (deviceId: string): Promise<{ deviceId: string }> => {
    const response = await api.delete<{ success: true; data: { deviceId: string } }>(`/request-devices/${deviceId}`);
    return response.data.data!;
  },
};
