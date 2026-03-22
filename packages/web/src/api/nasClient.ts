const NAS_API_URL = import.meta.env.VITE_NAS_API_URL || '/nas-api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${NAS_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data?.error || 'NAS client request failed');
  }
  return data as T;
}

export const nasClientApi = {
  status: () => request<{ connected: boolean; serverUrl: string; clientKeySet: boolean }>('/status'),
  configure: (input: { serverUrl?: string; clientKey?: string; deviceName?: string }) =>
    request<{ success: boolean }>('/config', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  connect: () => request<{ success: boolean }>('/connect', { method: 'POST' }),
  reconnect: () => request<{ success: boolean }>('/reconnect', { method: 'POST' }),
  disconnect: () => request<{ success: boolean }>('/disconnect', { method: 'POST' }),
};
