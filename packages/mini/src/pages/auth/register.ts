import { authStore } from '../../stores/auth';

Page({
  data: {
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    errors: {} as Record<string, string>,
    loading: false,
    globalError: '',
  },

  onUsernameInput(e: WechatMiniprogram.InputEvent) {
    this.setData({ username: e.detail.value, errors: { ...this.data.errors, username: '' } });
  },

  onEmailInput(e: WechatMiniprogram.InputEvent) {
    this.setData({ email: e.detail.value, errors: { ...this.data.errors, email: '' } });
  },

  onPasswordInput(e: WechatMiniprogram.InputEvent) {
    this.setData({ password: e.detail.value, errors: { ...this.data.errors, password: '' } });
  },

  onConfirmPasswordInput(e: WechatMiniprogram.InputEvent) {
    this.setData({ confirmPassword: e.detail.value, errors: { ...this.data.errors, confirmPassword: '' } });
  },

  validate(): boolean {
    const { email, password, confirmPassword, username } = this.data;
    const errors: Record<string, string> = {};

    if (!username.trim()) {
      errors.username = '请输入用户名';
    } else if (username.trim().length < 2) {
      errors.username = '用户名至少2个字符';
    }

    if (!email.trim()) {
      errors.email = '请输入邮箱';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = '请输入有效的邮箱地址';
    }

    if (!password) {
      errors.password = '请输入密码';
    } else if (password.length < 6) {
      errors.password = '密码至少6个字符';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = '两次密码输入不一致';
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  async handleRegister() {
    if (!this.validate()) return;

    const { email, password, username } = this.data;
    this.setData({ loading: true, globalError: '' });

    try {
      await authStore.register(email.trim(), password, username.trim());
      wx.switchTab({ url: '/pages/tabs/index' });
    } catch {
      const app = getApp<IAppOption>();
      this.setData({ globalError: app.globalData.error || '注册失败' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goToLogin() {
    wx.navigateBack();
  },
});
