import axios, { AxiosInstance } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Axios instance for API calls
const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
  http.defaults.headers.common['Authorization'] = `Bearer ${access}`;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  delete http.defaults.headers.common['Authorization'];
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      http.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    }
  }
  return accessToken;
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

getAccessToken();

// Request interceptor
http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle 401
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && refreshToken) {
      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        if (res.data.success) {
          const { accessToken: newAccess, refreshToken: newRefresh } = res.data.data;
          setTokens(newAccess, newRefresh);
          error.config.headers.Authorization = `Bearer ${newAccess}`;
          return axios(error.config);
        }
      } catch {
        clearTokens();
      }
    }
    return Promise.reject(error);
  }
);

export { http as apiClient };
export default http;

// ─────────────────────────────────────────────
// Client (NAS device) API
// ─────────────────────────────────────────────
export interface Client {
  clientId: string;
  name: string;
  status: string;
  enabled?: boolean;
  lastSeen: string | null;
  createdAt: string;
}

export interface PendingPairing {
  pairingCode: string;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function requestData<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await http(path, options);
  const data: ApiResponse<T> = response.data;
  if (!response.status || !data.success) {
    throw new Error(data.error?.message || 'Request failed');
  }
  return data.data as T;
}

export const clientApi = {
  list: () => requestData<{ clients: Client[] }>('/clients'),
  listPending: () => requestData<{ pending: PendingPairing[] }>('/clients/pending'),
  getDefault: () => requestData<{ clientId: string; clientKey: string; name: string; status: string; isDefault: boolean }>('/clients/default', { method: 'POST' }),
  setEnabled: (clientId: string, enabled: boolean) =>
    requestData<{ clientId: string; enabled: boolean; status: string }>(
      `/clients/${clientId}/enabled`,
      { method: 'PATCH', data: { enabled } }
    ),
  approve: (pairingCode: string, clientName?: string) =>
    requestData<{ clientKey: string }>(
      `/clients/${pairingCode}/approve`,
      { method: 'POST', data: { clientName } }
    ),
  rename: (clientId: string, name: string) =>
    requestData<{ clientId: string; name: string }>(
      `/clients/${clientId}`,
      { method: 'PATCH', data: { name } }
    ),
  delete: (clientId: string) =>
    requestData<{ success: boolean }>(`/clients/${clientId}`, { method: 'DELETE' }),
};
