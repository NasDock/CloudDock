import { request } from './client';
import type { UserPublic } from '@cloud-dock/shared';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

export interface AuthResponse {
  user: UserPublic;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    return request<LoginResponse>({ url: '/auth/login', method: 'POST', data });
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    return request<AuthResponse>({ url: '/auth/register', method: 'POST', data });
  },

  logout: async (): Promise<void> => {
    return request<void>({ url: '/auth/logout', method: 'POST' });
  },

  refresh: async (refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> => {
    return request<{ accessToken: string; expiresIn: number }>({
      url: '/auth/refresh',
      method: 'POST',
      data: { refreshToken },
    });
  },

  getMe: async (): Promise<UserPublic> => {
    return request<UserPublic>({ url: '/users/me' });
  },

  updateMe: async (data: {
    username?: string;
    oldPassword?: string;
    newPassword?: string;
  }): Promise<UserPublic> => {
    return request<UserPublic>({ url: '/users/me', method: 'PUT', data });
  },
};
