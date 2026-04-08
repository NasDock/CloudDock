import type { UserPublic } from '@cloud-dock/shared';
import { authApi } from '../api/auth';
import { setApiBaseUrl, initApiBaseUrl } from '../api/client';

export interface AuthState {
  user: UserPublic | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export type AuthActions = {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (user: UserPublic) => void;
  clearError: () => void;
};

function getAuthState(): AuthState {
  const app = getApp<IAppOption>();
  return {
    user: app.globalData.user,
    isAuthenticated: app.globalData.isAuthenticated,
    isLoading: app.globalData.isLoading,
    error: app.globalData.error,
  };
}

function setAuthState(state: Partial<AuthState>) {
  const app = getApp<IAppOption>();
  if (state.user !== undefined) app.globalData.user = state.user;
  if (state.isAuthenticated !== undefined) app.globalData.isAuthenticated = state.isAuthenticated;
  if (state.isLoading !== undefined) app.globalData.isLoading = state.isLoading;
  if (state.error !== undefined) app.globalData.error = state.error;
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email.slice(0, 1) + '***';
  const safeName = name.length <= 2 ? `${name[0] || ''}*` : `${name[0]}***${name[name.length - 1]}`;
  return `${safeName}@${domain}`;
}

export const authStore: AuthState & AuthActions = {
  get user() { return getAuthState().user; },
  get isAuthenticated() { return getAuthState().isAuthenticated; },
  get isLoading() { return getAuthState().isLoading; },
  get error() { return getAuthState().error; },

  async login(email: string, password: string) {
    setAuthState({ isLoading: true, error: null });
    const safeEmail = maskEmail(email);
    console.info('[auth] login: start', { email: safeEmail });
    try {
      await initApiBaseUrl();
      const response = await authApi.login({ email, password });
      wx.setStorageSync('accessToken', response.accessToken);
      wx.setStorageSync('refreshToken', response.refreshToken);
      const user = await authApi.getMe();
      setAuthState({ user, isAuthenticated: true, isLoading: false });
      console.info('[auth] login: success', { email: safeEmail, userId: user.userId });
    } catch (err: any) {
      const msg = err?.message || '登录失败';
      setAuthState({ error: msg, isLoading: false });
      console.error('[auth] login: failed', { email: safeEmail, message: msg });
      throw err;
    }
  },

  async register(email: string, password: string, username: string) {
    setAuthState({ isLoading: true, error: null });
    try {
      await initApiBaseUrl();
      await authApi.register({ email, password, username });
      await this.login(email, password);
    } catch (err: any) {
      const msg = err?.message || '注册失败';
      setAuthState({ error: msg, isLoading: false });
      throw err;
    }
  },

  async logout() {
    setAuthState({ isLoading: true });
    try {
      await authApi.logout();
    } catch {
      // Ignore
    } finally {
      wx.removeStorageSync('accessToken');
      wx.removeStorageSync('refreshToken');
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  async checkAuth() {
    setAuthState({ isLoading: true });
    try {
      await initApiBaseUrl();
      const token = wx.getStorageSync('accessToken');
      if (!token) {
        setAuthState({ isAuthenticated: false, isLoading: false });
        return;
      }
      const user = await authApi.getMe();
      setAuthState({ user, isAuthenticated: true, isLoading: false });
    } catch {
      wx.removeStorageSync('accessToken');
      wx.removeStorageSync('refreshToken');
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateUser(user: UserPublic) {
    setAuthState({ user });
  },

  clearError() {
    setAuthState({ error: null });
  },
};
