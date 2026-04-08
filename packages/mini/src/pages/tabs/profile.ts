import { authStore } from '../../stores/auth';
import { formatDate } from '../../utils/formatters';

Page({
  data: {
    user: null as any,
    loading: false,
    error: '',
  },

  onShow() {
    const app = getApp<IAppOption>();
    this.setData({ user: app.globalData.user });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await authStore.logout();
          wx.reLaunch({ url: '/pages/auth/login' });
        } catch {
          wx.showToast({ title: '登出失败', icon: 'none' });
        }
      },
    });
  },

  showDevAlert() {
    wx.showToast({ title: '该功能开发中', icon: 'none' });
  },

  formatDate(date: string): string {
    if (!date) return '-';
    return formatDate(date);
  },

  getPlanLabel(plan: string): string {
    const map: Record<string, string> = {
      free: '免费版',
      pro: '专业版',
      enterprise: '企业版',
    };
    return map[plan] || plan;
  },
});
