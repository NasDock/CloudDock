import { tunnelApi, AccessLog } from '../../api/tunnel';
import { tunnelStore } from '../../stores/tunnel';
import type { Tunnel, TunnelStatistics } from '@cloud-dock/shared';
import { formatNumber, formatBytes } from '../../utils/formatters';

Page({
  data: {
    tunnel: null as Tunnel | null,
    stats: null as TunnelStatistics | null,
    logs: [] as AccessLog[],
    logPage: 1,
    logTotal: 0,
    logLimit: 20,
    loading: false,
    toastText: '',
    toastVisible: false,
    publicUrl: '',
    statusUpdated: false,
  },

  _pollTimer: number | null = null,
  _currentTunnelId: string = '',

  onLoad(query: { tunnelId?: string }) {
    if (!query.tunnelId) {
      wx.navigateBack();
      return;
    }
    this._currentTunnelId = query.tunnelId;
    this.loadData(query.tunnelId);
    this.startPolling();
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
    }, 30 * 1000) as unknown as number;
  },

  stopPolling() {
    if (this._pollTimer !== null) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
  },

  async pollStatus() {
    if (!this._currentTunnelId) return;
    try {
      const data = await tunnelApi.get(this._currentTunnelId);
      const prevTunnel: any = this.data.tunnel;
      const prevStatus = prevTunnel ? (prevTunnel.enabled === false ? 'offline' : prevTunnel.status) : '';
      const newStatus = data.enabled === false ? 'offline' : data.status;
      const statusChanged = prevStatus !== '' && prevStatus !== newStatus;
      this.setData({
        tunnel: data,
        stats: data.statistics,
        statusUpdated: statusChanged,
      });
      if (statusChanged) {
        // Status changed notification - auto-hide after 3s
        setTimeout(() => this.setData({ statusUpdated: false }), 3000);
      }
    } catch {
      // Silently fail polling
    } finally {
      this.startPolling();
    }
  },

  async loadData(tunnelId: string) {
    this.setData({ loading: true });
    try {
      const data = await tunnelApi.get(tunnelId);
      this.setData({
        tunnel: data,
        stats: data.statistics,
        publicUrl: tunnelApi.getPublicUrl(data.publicPath),
        loading: false,
      });
      this.loadLogs(tunnelId, 1);
    } catch {
      wx.showToast({ title: '获取隧道详情失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async loadLogs(tunnelId: string, page: number) {
    try {
      const res = await tunnelApi.getLogs(tunnelId, { page, limit: this.data.logLimit });
      this.setData({ logs: res.logs, logTotal: res.pagination.total, logPage: page });
    } catch {
      // Ignore log errors
    }
  },

  async handleCopy() {
    if (!this.data.publicUrl) return;
    await wx.setClipboardData({ data: this.data.publicUrl });
    this.showToast('已复制');
  },

  async handleToggle() {
    if (!this.data.tunnel) return;
    try {
      await tunnelStore.setTunnelEnabled(this.data.tunnel.tunnelId, this.data.tunnel.enabled === false);
      const updated = await tunnelApi.get(this.data.tunnel.tunnelId);
      this.setData({ tunnel: updated });
    } catch {
      this.showToast('操作失败');
    }
  },

  handleDelete() {
    if (!this.data.tunnel) return;
    wx.showModal({
      title: '删除隧道',
      content: `确定要删除 "${this.data.tunnel.name}" 吗？`,
      confirmText: '删除',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await tunnelStore.deleteTunnel(this.data.tunnel!.tunnelId);
          wx.navigateBack();
        } catch {
          this.showToast('删除失败');
        }
      },
    });
  },

  goToPrevPage() {
    if (!this.data.tunnel || this.data.logPage <= 1) return;
    this.loadLogs(this.data.tunnel.tunnelId, this.data.logPage - 1);
  },

  goToNextPage() {
    if (!this.data.tunnel) return;
    const totalPages = Math.ceil(this.data.logTotal / this.data.logLimit);
    if (this.data.logPage >= totalPages) return;
    this.loadLogs(this.data.tunnel.tunnelId, this.data.logPage + 1);
  },

  showToast(text: string) {
    this.setData({ toastText: text, toastVisible: true });
    setTimeout(() => this.setData({ toastVisible: false }), 1500);
  },

  formatNumber(num: number): string {
    return formatNumber(num);
  },

  formatBytes(bytes: number): string {
    return formatBytes(bytes);
  },

  getTotalPages(): number {
    return Math.ceil(this.data.logTotal / this.data.logLimit);
  },

  getEffectiveStatus(): string {
    const tunnel: any = this.data.tunnel;
    if (!tunnel) return '';
    return tunnel.enabled === false ? 'offline' : tunnel.status;
  },
});
