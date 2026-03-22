import type { ApiResponse, Device, DeviceWithTunnels } from '@cloud-dock/shared';
import apiClient from './client';

export interface BindDeviceRequest {
  bindToken: string;
  deviceName: string;
}

export const getDevices = async () => {
  return apiClient.get<ApiResponse<{ devices: DeviceWithTunnels[] }>>('/devices');
};

export const getDevice = async (deviceId: string) => {
  return apiClient.get<ApiResponse<DeviceWithTunnels>>(`/devices/${deviceId}`);
};

export const bindDevice = async (data: BindDeviceRequest) => {
  return apiClient.post<ApiResponse<Device>>('/devices/bind', data);
};

export const unbindDevice = async (deviceId: string) => {
  return apiClient.delete<ApiResponse<{ message: string }>>(`/devices/${deviceId}`);
};
