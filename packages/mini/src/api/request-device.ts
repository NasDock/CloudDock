import { request } from './client';

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

export interface RequestDeviceFirewallSettings {
  autoApproveNewRequestDevices: boolean;
}

export interface RequestDeviceListResponse {
  devices: RequestDevice[];
  settings: RequestDeviceFirewallSettings;
}

export const requestDeviceApi = {
  list: async (): Promise<RequestDeviceListResponse> => {
    return request<RequestDeviceListResponse>({ url: '/request-devices' });
  },

  updateSettings: async (
    settings: RequestDeviceFirewallSettings
  ): Promise<RequestDeviceFirewallSettings> => {
    return request<RequestDeviceFirewallSettings>({
      url: '/request-devices/settings',
      method: 'PATCH',
      data: settings,
    });
  },

  updateStatus: async (
    deviceId: string,
    status: 'approved' | 'blocked'
  ): Promise<RequestDevice> => {
    return request<RequestDevice>({
      url: `/request-devices/${deviceId}`,
      method: 'PATCH',
      data: { status },
    });
  },

  remove: async (deviceId: string): Promise<{ deviceId: string }> => {
    return request<{ deviceId: string }>({
      url: `/request-devices/${deviceId}`,
      method: 'DELETE',
    });
  },
};
