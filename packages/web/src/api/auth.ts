import { setTokens, clearTokens, getAccessToken } from './client';
import { getApiUrl } from '@/utils/runtimeConfig';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UserInfo {
  userId: string;
  email: string;
  username: string;
  plan: string;
  createdAt: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const BASE_URL = getApiUrl(import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
  const token = getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.error?.message || data.message)) || response.statusText || 'Request failed';
    throw new Error(message);
  }

  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) {
      throw new Error(data.error?.message || 'Request failed');
    }
    return (data.data ?? data.message ?? undefined) as T;
  }

  return (data ?? undefined) as T;
}

export const authLogin = async (input: LoginInput) => {
  const result = await request<{ accessToken: string; refreshToken: string; expiresIn: number }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  setAuthTokens(result.accessToken, result.refreshToken);
  return result;
};

export const authRegister = (input: RegisterInput) =>
  request<{ userId: string; email: string; username: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const authLogout = async (): Promise<void> => {
  try {
    await request('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore
  } finally {
    clearTokens();
  }
};

export const getUserInfo = () => request<UserInfo>('/users/me');

export const updateUserInfo = (data: Partial<Pick<UserInfo, 'username'>> & { oldPassword?: string; newPassword?: string }) =>
  request<UserInfo>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export function setAuthTokens(access: string, refresh: string): void {
  setTokens(access, refresh);
}
