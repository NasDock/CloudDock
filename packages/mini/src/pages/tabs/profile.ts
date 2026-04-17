import { authStore } from '../../stores/auth';
import { formatDate } from '../../utils/formatters';
import { deviceApi } from '../../api/device';
import { tunnelApi } from '../../api/tunnel';

interface ProfileData {
  user: any;
  loading: boolean;
  stats: {
    deviceOnline: number;
    deviceTotal: number;
    tunnelOnline: number;
    tunnelTotal: number;
  };
  error: string;
}

Page({
  data: {
    user: null as any,
    loading: false,
    stats: {
      deviceOnline: 0,
      deviceTotal: 0,
      tunnelOnline: 0,
      tunnelTotal: 0,
    },
    error: '',
  } as ProfileData,

  onShow() {
    const app = getApp<IAppOption>();
    this.setData({ user: app.globalData.user });
    this.loadStats();
  },

  async loadStats() {
    this.setData({ loading: true });
    try {
      const [devicesRes, tunnelsRes] = await Promise.allSettled([
        deviceApi.list(),
        tunnelApi.list({ limit: 100 }),
      ]);

      let deviceOnline = 0;
      let deviceTotal = 0;
      let tunnelOnline = 0;
      let tunnelTotal = 0;

      if (devicesRes.status === 'fulfilled') {
        deviceTotal = devicesRes.value.clients.length;
        deviceOnline = devicesRes.value.clients.filter(
          (c: any) => c.status === 'online'
        ).length;
      }

      if (tunnelsRes.status === 'fulfilled') {
        tunnelTotal = tunnelsRes.value.tunnels.length;
        tunnelOnline = tunnelsRes.value.tunnels.filter(
          (t: any) => t.status === 'online'
        ).length;
      }

      this.setData({
        stats: { deviceOnline, deviceTotal, tunnelOnline, tunnelTotal },
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
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

  goToSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  goToDevices() {
    wx.switchTab({ url: '/pages/tabs/devices' });
  },

  goToTunnels() {
    wx.switchTab({ url: '/pages/tabs/tunnels' });
  },

  goToAbout() {
    wx.navigateTo({ url: '/pages/settings/about' });
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
