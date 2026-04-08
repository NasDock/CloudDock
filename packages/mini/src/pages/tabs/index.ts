import { tunnelStore } from '../../stores/tunnel';
import { authStore } from '../../stores/auth';
import { deviceApi } from '../../api/device';
import { requestDeviceApi } from '../../api/request-device';
import { tunnelApi } from '../../api/tunnel';
import type { RequestDevice } from '../../api/request-device';

Page({
  data: {
    user: null as any,
    onlineCount: 0,
    offlineCount: 0,
    totalCount: 0,
    tunnels: [] as any[],
    recentTunnels: [] as any[],
    pendingDevices: [] as RequestDevice[],
    clientNames: {} as Record<string, string>,
    loading: false,
    refreshing: false,
    error: '',
  },

  onLoad() {
    const app = getApp<IAppOption>();
    if (!app.globalData.isAuthenticated) {
      wx.navigateTo({ url: '/pages/auth/login' });
    }
  },

  onShow() {
    const app = getApp<IAppOption>();
    this.setData({ user: app.globalData.user });
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    this.setData({ loading: true, error: '' });
    try {
      await Promise.all([
        tunnelStore.fetchTunnels(),
        deviceApi.list().then((res) => {
          const map: Record<string, string> = {};
          res.clients.forEach((c: any) => { map[c.clientId] = c.name || '默认设备'; });
          this.setData({ clientNames: map });
        }),
        requestDeviceApi.list().then((res) => {
          this.setData({ pendingDevices: res.devices.filter((d) => d.status === 'pending') });
        }),
      ]);

      const state = tunnelStore;
      this.setData({
        tunnels: state.tunnels,
        recentTunnels: state.tunnels.slice(0, 3),
        onlineCount: state.onlineTunnels.length,
        offlineCount: state.offlineTunnels.length,
        totalCount: state.tunnels.length,
        loading: false,
      });
    } catch (err: any) {
      this.setData({ error: err?.message || '加载失败', loading: false });
    }
  },

  goToTunnelCreate() {
    wx.navigateTo({ url: '/pages/tunnel/create' });
  },

  goToTunnelDetail(e: any) {
    const tunnelId = e.currentTarget.dataset.tunnelId;
    wx.navigateTo({ url: `/pages/tunnel/detail?tunnelId=${tunnelId}` });
  },

  goToTunnels() {
    wx.switchTab({ url: '/pages/tabs/tunnels' });
  },

  goToDevices() {
    wx.switchTab({ url: '/pages/tabs/devices' });
  },

  async handleLogout() {
    try {
      await authStore.logout();
      wx.navigateTo({ url: '/pages/auth/login' });
    } catch {
      wx.showToast({ title: '登出失败', icon: 'none' });
    }
  },

  getPublicUrl(publicPath: string): string {
    return tunnelApi.getPublicUrl(publicPath);
  },
});
