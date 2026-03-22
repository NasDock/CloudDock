// Device types
export type DeviceStatus = 'online' | 'offline';

export interface Device {
  deviceId: string;
  userId: string;
  name: string;
  status: DeviceStatus;
  bindToken?: string;
  bindTokenExpiredAt?: Date;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeviceWithTunnels extends Device {
  tunnels: string[];
}
