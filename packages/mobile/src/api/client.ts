import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEFAULT_API_BASE_URL = 'https://cloud.audiodock.cn';
const API_BASE_URL_KEY = 'apiBaseUrl';
const REQUEST_DEVICE_ID_KEY = 'requestDeviceId';
let apiBaseUrl = DEFAULT_API_BASE_URL;

function normalizeApiBaseUrl(input: string): string {
  let url = input.trim();
  if (!url) return DEFAULT_API_BASE_URL;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, '');
  if (!/\/api$/i.test(url)) {
    url = `${url}/api`;
  }
  return url;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function initApiBaseUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem(API_BASE_URL_KEY);
  if (stored) {
    setApiBaseUrl(stored, false);
  } else {
    setApiBaseUrl(apiBaseUrl, false);
  }
  return apiBaseUrl;
}

export function setApiBaseUrl(input: string, persist = true): string {
  apiBaseUrl = normalizeApiBaseUrl(input);
  api.defaults.baseURL = apiBaseUrl;
  if (persist) {
    AsyncStorage.setItem(API_BASE_URL_KEY, apiBaseUrl).catch(() => {});
  }
  return apiBaseUrl;
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

function generateRequestDeviceId(): string {
  return `rd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getRequestDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(REQUEST_DEVICE_ID_KEY);
  if (existing) return existing;
  const next = generateRequestDeviceId();
  await AsyncStorage.setItem(REQUEST_DEVICE_ID_KEY, next);
  return next;
}

async function getRequestDeviceHeaders(): Promise<Record<string, string>> {
  const deviceId = await getRequestDeviceId();
  const platform = Platform.OS || 'mobile';
  const name = `Mobile - ${platform}`;
  return {
    'x-request-device-id': deviceId,
    'x-request-device-name': name,
    'x-request-device-platform': platform,
  };
}

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.headers) {
      const deviceHeaders = await getRequestDeviceHeaders();
      config.headers['x-request-device-id'] = deviceHeaders['x-request-device-id'];
      config.headers['x-request-device-name'] = deviceHeaders['x-request-device-name'];
      config.headers['x-request-device-platform'] = deviceHeaders['x-request-device-platform'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post<{ data: { accessToken: string } }>(
            `${getApiBaseUrl()}/auth/refresh`,
            { refreshToken }
          );
          const { accessToken } = response.data.data!;
          await AsyncStorage.setItem('accessToken', accessToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { DEFAULT_API_BASE_URL };
