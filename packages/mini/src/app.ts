/// <reference path="../node_modules/minig-cli/types/wx.d.ts" />
import { initApiBaseUrl } from './api/client';
import type { UserPublic } from '@cloud-dock/shared';

declare global {
  interface IAppOption {
    globalData: {
      user: UserPublic | null;
      isAuthenticated: boolean;
      isLoading: boolean;
      error: string | null;
      apiBaseUrl: string;
      accessToken: string;
      refreshToken: string;
    };
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, username: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    updateUser: (user: UserPublic) => void;
    clearError: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
  }
}

App<IAppOption>({
  globalData: {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    apiBaseUrl: 'https://cloud.audiodock.cn',
    accessToken: '',
    refreshToken: '',
  },

  async onLaunch() {
    // Initialize API base URL from storage
    const stored = wx.getStorageSync('apiBaseUrl');
    if (stored) {
      this.globalData.apiBaseUrl = stored;
    }
    await initApiBaseUrl();
    // Check auth on launch
    await this.checkAuth();
  },

  async checkAuth() {
    this.setLoading(true);
    try {
      const token = wx.getStorageSync('accessToken');
      if (!token) {
        this.globalData.isAuthenticated = false;
        this.setLoading(false);
        return;
      }
      this.globalData.accessToken = token;
      this.globalData.refreshToken = wx.getStorageSync('refreshToken') || '';

      // Fetch user info
      const { authApi } = require('./api/auth');
      const user = await authApi.getMe();
      this.globalData.user = user;
      this.globalData.isAuthenticated = true;
    } catch {
      wx.removeStorageSync('accessToken');
      wx.removeStorageSync('refreshToken');
      this.globalData.user = null;
      this.globalData.isAuthenticated = false;
    } finally {
      this.setLoading(false);
    }
  },

  async login(email: string, password: string) {
    this.setLoading(true);
    this.clearError();
    try {
      const { authApi } = require('./api/auth');
      const { setApiBaseUrl } = require('./api/client');
      setApiBaseUrl(this.globalData.apiBaseUrl);
      const response = await authApi.login({ email, password });
      wx.setStorageSync('accessToken', response.accessToken);
      wx.setStorageSync('refreshToken', response.refreshToken);
      this.globalData.accessToken = response.accessToken;
      this.globalData.refreshToken = response.refreshToken;

      const user = await authApi.getMe();
      this.globalData.user = user;
      this.globalData.isAuthenticated = true;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '登录失败';
      this.setError(msg);
      throw err;
    } finally {
      this.setLoading(false);
    }
  },

  async register(email: string, password: string, username: string) {
    this.setLoading(true);
    this.clearError();
    try {
      const { authApi } = require('./api/auth');
      const { setApiBaseUrl } = require('./api/client');
      setApiBaseUrl(this.globalData.apiBaseUrl);
      await authApi.register({ email, password, username });
      // Auto login after register
      await this.login(email, password);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '注册失败';
      this.setError(msg);
      throw err;
    } finally {
      this.setLoading(false);
    }
  },

  async logout() {
    this.setLoading(true);
    try {
      const { authApi } = require('./api/auth');
      await authApi.logout();
    } catch {
      // Ignore
    } finally {
      wx.removeStorageSync('accessToken');
      wx.removeStorageSync('refreshToken');
      this.globalData.user = null;
      this.globalData.isAuthenticated = false;
      this.globalData.accessToken = '';
      this.globalData.refreshToken = '';
      this.setLoading(false);
    }
  },

  updateUser(user: UserPublic) {
    this.globalData.user = user;
  },

  clearError() {
    this.globalData.error = null;
  },

  setLoading(loading: boolean) {
    this.globalData.isLoading = loading;
  },

  setError(error: string | null) {
    this.globalData.error = error;
  },
});
