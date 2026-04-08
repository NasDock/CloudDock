import { authStore } from '../../stores/auth';
import { setApiBaseUrl, initApiBaseUrl } from '../../api/client';

Page({
  data: {
    email: '',
    password: '',
    serverUrl: 'https://cloud.audiodock.cn',
    errors: {} as Record<string, string>,
    loading: false,
    globalError: '',
  },

  onLoad() {
    initApiBaseUrl().then((base) => {
      const trimmed = base.replace(/\/api$/i, '');
      this.setData({ serverUrl: trimmed || 'https://cloud.audiodock.cn' });
    });
    // Check if already authenticated
    const app = getApp<IAppOption>();
    if (app.globalData.isAuthenticated) {
      wx.switchTab({ url: '/pages/tabs/index' });
    }
  },

  onEmailInput(e: WechatMiniprogram.InputEvent) {
    this.setData({ email: e.detail.value, errors: { ...this.data.errors, email: '' } });
  },

  onPasswordInput(e: WechatMiniprogram.InputEvent) {
    this.setData({ password: e.detail.value, errors: { ...this.data.errors, password: '' } });
  },

  onServerUrlInput(e: WechatMiniprogram.InputEvent) {
    this.setData({ serverUrl: e.detail.value, errors: { ...this.data.errors, serverUrl: '' } });
  },

  validate(): boolean {
    const { email, password, serverUrl } = this.data;
    const errors: Record<string, string> = {};

    if (!email.trim()) {
      errors.email = '请输入邮箱';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = '请输入有效的邮箱地址';
    }

    if (!password) {
      errors.password = '请输入密码';
    }

    if (!serverUrl.trim()) {
      errors.serverUrl = '请输入服务器地址';
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  async handleLogin() {
    if (!this.validate()) return;

    const { email, password, serverUrl } = this.data;
    this.setData({ loading: true, globalError: '' });

    try {
      setApiBaseUrl(serverUrl.trim());
      await authStore.login(email.trim(), password);
      wx.switchTab({ url: '/pages/tabs/index' });
    } catch {
      const app = getApp<IAppOption>();
      this.setData({ globalError: app.globalData.error || '登录失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goToRegister() {
    wx.navigateTo({ url: '/pages/auth/register' });
  },
});
