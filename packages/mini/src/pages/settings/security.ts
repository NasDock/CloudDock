import { authApi } from '../../api/auth';
import { setApiBaseUrl } from '../../api/client';

interface SecurityData {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  loading: boolean;
  errors: Record<string, string>;
}

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    loading: false,
    errors: {} as Record<string, string>,
  } as SecurityData,

  onOldPasswordInput(e: any) {
    this.setData({ oldPassword: e.detail.value, errors: { ...this.data.errors, oldPassword: '' } });
  },

  onNewPasswordInput(e: any) {
    this.setData({ newPassword: e.detail.value, errors: { ...this.data.errors, newPassword: '' } });
  },

  onConfirmPasswordInput(e: any) {
    this.setData({ confirmPassword: e.detail.value, errors: { ...this.data.errors, confirmPassword: '' } });
  },

  validate(): boolean {
    const { oldPassword, newPassword, confirmPassword } = this.data;
    const errors: Record<string, string> = {};

    if (!oldPassword) {
      errors.oldPassword = '请输入当前密码';
    }

    if (!newPassword) {
      errors.newPassword = '请输入新密码';
    } else if (newPassword.length < 8) {
      errors.newPassword = '密码长度不能少于8位';
    }

    if (!confirmPassword) {
      errors.confirmPassword = '请确认新密码';
    } else if (confirmPassword !== newPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    if (oldPassword && newPassword && oldPassword === newPassword) {
      errors.newPassword = '新密码不能与当前密码相同';
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  async handleChangePassword() {
    if (!this.validate()) return;

    const { oldPassword, newPassword } = this.data;
    this.setData({ loading: true });

    try {
      await setApiBaseUrl(wx.getStorageSync('apiBaseUrl') || 'https://cloud.audiodock.cn');
      await authApi.updateMe({
        oldPassword,
        newPassword,
      });

      wx.showToast({ title: '密码修改成功', icon: 'success' });
      this.setData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
        loading: false,
      });

      // Redirect to login after 1.5s
      setTimeout(() => {
        const app = getApp<IAppOption>();
        app.logout?.().then(() => {
          wx.reLaunch({ url: '/pages/auth/login' });
        });
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '修改失败';
      wx.showToast({ title: msg, icon: 'none' });
      this.setData({ loading: false });
    }
  },
});
