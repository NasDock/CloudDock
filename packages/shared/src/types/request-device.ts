export type RequestDeviceStatus = 'pending' | 'approved' | 'blocked';

export interface RequestDevice {
  requestDeviceId: string;
  userId: string;
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
