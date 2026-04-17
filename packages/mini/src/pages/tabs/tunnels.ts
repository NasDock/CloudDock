import { tunnelStore } from '../../stores/tunnel';
import { deviceApi } from '../../api/device';
import { tunnelApi } from '../../api/tunnel';

const POLL_INTERVAL_MS = 30 * 1000; // 30s

Page({
  data: {
    tunnels: [] as any[],
    filteredTunnels: [] as any[],
    filter: 'all' as 'all' | 'online' | 'offline',
    searchQuery: '',
    clientNames: {} as Record<string, string>,
    loading: false,
    refreshing: false,
    toastText: '',
    toastVisible: false,
    onlineCount: 0,
    offlineCount: 0,
  },

  _pollTimer: number | null = null,

  onLoad() {
    this.loadData();
    this.startPolling();
  },

  onShow() {
    this.loadData();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  startPolling() {
    if (this._pollTimer !== null) return;
    this._pollTimer = setTimeout(() => {
      this.pollStatus();
    }, POLL_INTERVAL_MS) as unknown as number;
  },

  stopPolling() {
    if (this._pollTimer !== null) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
  },

  async pollStatus() {
    // Silent refresh without loading indicator
    try {
      const response = await tunnelApi.list({ status: 'all' });
      tunnelStore.fetchTunnels({ status: 'all' });
      this.setData({ tunnels: response.tunnels });
      this.applyFilter();
      this.updateCounts(response.tunnels);
    } catch {
      // Silently fail polling
    } finally {
      this.startPolling();
    }
  },

  onPullDownRefresh() {
    this.loadData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      await Promise.all([
        tunnelStore.fetchTunnels(),
        deviceApi.list().then((res) => {
          const map: Record<string, string> = {};
          res.clients.forEach((c: any) => { map[c.clientId] = c.name; });
          this.setData({ clientNames: map });
        }),
      ]);
      const tunnels = tunnelStore.tunnels;
      this.setData({ tunnels });
      this.applyFilter();
      this.updateCounts(tunnels);
    } catch {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  updateCounts(tunnels: any[]) {
    let online = 0, offline = 0;
    tunnels.forEach((t) => {
      const status = t.enabled === false ? 'offline' : t.status;
      if (status === 'online') online++;
      else offline++;
    });
    this.setData({ onlineCount: online, offlineCount: offline });
  },

  applyFilter() {
    const { tunnels, filter, searchQuery } = this.data;
    const filtered = tunnels.filter((t: any) => {
      const effectiveStatus = t.enabled === false ? 'offline' : t.status;
      const matchesFilter = filter === 'all' || effectiveStatus === filter;
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.localAddress.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
    this.setData({ filteredTunnels: filtered });
  },

  onSearchInput(e: any) {
    this.setData({ searchQuery: e.detail.value });
    this.applyFilter();
  },

  onFilterChange(e: any) {
    this.setData({ filter: e.currentTarget.dataset.filter });
    this.applyFilter();
  },

  goToCreate() {
    wx.navigateTo({ url: '/pages/tunnel/create' });
  },

  goToDetail(e: any) {
    const tunnelId = e.currentTarget.dataset.tunnelId;
    wx.navigateTo({ url: `/pages/tunnel/detail?tunnelId=${tunnelId}` });
  },

  async handleCopy(e: any) {
    const tunnel: any = e.currentTarget.dataset.tunnel;
    const url = tunnelApi.getPublicUrl(tunnel.publicPath);
    await wx.setClipboardData({ data: url });
    this.showToast('已复制');
  },

  async handleToggle(e: any) {
    const tunnel: any = e.currentTarget.dataset.tunnel;
    try {
      await tunnelStore.setTunnelEnabled(tunnel.tunnelId, tunnel.enabled === false);
      this.loadData();
    } catch {
      this.showToast('操作失败');
    }
  },

  handleDelete(e: any) {
    const tunnel: any = e.currentTarget.dataset.tunnel;
    wx.showModal({
      title: '删除隧道',
      content: `确定要删除 "${tunnel.name}" 吗？此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await tunnelStore.deleteTunnel(tunnel.tunnelId);
          this.applyFilter();
          this.showToast('已删除');
        } catch {
          this.showToast('删除失败');
        }
      },
    });
  },

  showToast(text: string) {
    this.setData({ toastText: text, toastVisible: true });
    setTimeout(() => this.setData({ toastVisible: false }), 1500);
  },

  getPublicUrl(publicPath: string): string {
    return tunnelApi.getPublicUrl(publicPath);
  },

  getEffectiveStatus(tunnel: any): string {
    return tunnel.enabled === false ? 'offline' : tunnel.status;
  },
});
