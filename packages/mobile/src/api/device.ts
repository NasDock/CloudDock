import api from './client';

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
    const response = await api.get<{ success: true; data: ClientListResponse }>('/clients');
    return response.data.data!;
  },

  bind: async (data: { bindToken: string; deviceName: string }): Promise<{ name: string }> => {
    await api.post<{ success: true; data: { clientKey: string } }>(
      `/clients/${data.bindToken}/approve`,
      { clientName: data.deviceName }
    );
    return { name: data.deviceName };
  },

  rename: async (clientId: string, name: string): Promise<{ clientId: string; name: string }> => {
    const response = await api.patch<{ success: true; data: { clientId: string; name: string } }>(
      `/clients/${clientId}`,
      { name }
    );
    return response.data.data!;
  },

  unbind: async (clientId: string): Promise<void> => {
    await api.delete(`/clients/${clientId}`);
  },
};
