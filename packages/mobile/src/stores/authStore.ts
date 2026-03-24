import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserPublic } from '@cloud-dock/shared';
import { authApi } from '../api/auth';
import { initApiBaseUrl } from '../api/client';

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email.slice(0, 1) + '***';
  const safeName = name.length <= 2 ? `${name[0] || ''}*` : `${name[0]}***${name[name.length - 1]}`;
  return `${safeName}@${domain}`;
}

interface AuthState {
  user: UserPublic | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: UserPublic) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    const safeEmail = maskEmail(email);
    console.info('[auth] login: start', {
      email: safeEmail,
      hasPassword: !!password,
      passwordLength: password?.length ?? 0,
    });
    try {
      await initApiBaseUrl();
      const response = await authApi.login({ email, password });
      await AsyncStorage.setItem('accessToken', response.accessToken);
      await AsyncStorage.setItem('refreshToken', response.refreshToken);

      // Fetch user info
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
      console.info('[auth] login: success', { email: safeEmail, userId: user.userId });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const message = err.response?.data?.error?.message || err.message || 'Login failed';
      set({ error: message, isLoading: false });
      console.error('[auth] login: failed', { email: safeEmail, message });
      throw error;
    }
  },

  register: async (email: string, password: string, username: string) => {
    set({ isLoading: true, error: null });
    try {
      await initApiBaseUrl();
      await authApi.register({ email, password, username });
      // After registration, login automatically
      await useAuthStore.getState().login(email, password);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const message = err.response?.data?.error?.message || err.message || 'Registration failed';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      await initApiBaseUrl();
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        set({ isAuthenticated: false, isLoading: false });
        return;
      }

      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateUser: (user: UserPublic) => {
    set({ user });
  },

  clearError: () => {
    set({ error: null });
  },
}));
