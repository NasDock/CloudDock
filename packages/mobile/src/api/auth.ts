import api from './client';
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
    const response = await api.post<{ success: true; data: LoginResponse }>('/auth/login', data);
    return response.data.data!;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<{ success: true; data: AuthResponse }>('/auth/register', data);
    return response.data.data!;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  refresh: async (refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> => {
    const response = await api.post<{ success: true; data: { accessToken: string; expiresIn: number } }>(
      '/auth/refresh',
      { refreshToken }
    );
    return response.data.data!;
  },

  getMe: async (): Promise<UserPublic> => {
    const response = await api.get<{ success: true; data: UserPublic }>('/users/me');
    return response.data.data!;
  },

  updateMe: async (data: { username?: string; oldPassword?: string; newPassword?: string }): Promise<UserPublic> => {
    const response = await api.put<{ success: true; data: UserPublic }>('/users/me', data);
    return response.data.data!;
  },
};
