import { request } from './client';

export interface Client {
  clientId: string;
  name: string;
  status: 'online' | 'offline';
  enabled?: boolean;
  lastSeen?: string | null;
  createdAt?: string;
}

export interface ClientListResponse {
  clients: Client[];
}

export const deviceApi = {
  list: async (): Promise<ClientListResponse> => {
    return request<ClientListResponse>({ url: '/clients' });
  },

  setEnabled: async (
    clientId: string,
    enabled: boolean
  ): Promise<{ clientId: string; enabled: boolean; status: string }> => {
    return request<{ clientId: string; enabled: boolean; status: string }>({
      url: `/clients/${clientId}/enabled`,
      method: 'PATCH',
      data: { enabled },
    });
  },

  bind: async (data: {
    bindToken: string;
    deviceName: string;
  }): Promise<{ name: string }> => {
    await request<{ clientKey: string }>({
      url: `/clients/${data.bindToken}/approve`,
      method: 'POST',
      data: { clientName: data.deviceName },
    });
    return { name: data.deviceName };
  },

  rename: async (
    clientId: string,
    name: string
  ): Promise<{ clientId: string; name: string }> => {
    return request<{ clientId: string; name: string }>({
      url: `/clients/${clientId}`,
      method: 'PATCH',
      data: { name },
    });
  },

  unbind: async (clientId: string): Promise<void> => {
    return request<void>({ url: `/clients/${clientId}`, method: 'DELETE' });
  },
};
