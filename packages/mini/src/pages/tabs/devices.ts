import { deviceApi, Client } from '../../api/device';
import { requestDeviceApi, RequestDevice } from '../../api/request-device';
import { formatRelativeTime } from '../../utils/formatters';

Page({
  data: {
    clients: [] as Client[],
    requestDevices: [] as RequestDevice[],
    requestDeviceSettings: {
      autoApproveNewRequestDevices: true,
    },
    activeTab: 'access' as 'access' | 'clients',
    loading: false,
    refreshing: false,
    error: '',
    dialogVisible: false,
    renameValue: '',
    selectedClient: null as Client | null,
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true, error: '' });
    try {
      const [clientRes, requestRes] = await Promise.all([
        deviceApi.list(),
        requestDeviceApi.list(),
      ]);
      this.setData({
        clients: clientRes.clients,
        requestDevices: requestRes.devices,
        requestDeviceSettings: requestRes.settings,
        loading: false,
      });
    } catch (err: any) {
      this.setData({ error: err?.message || '获取设备列表失败', loading: false });
    }
  },

  switchTab(e: any) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  goToScan() {
    wx.navigateTo({ url: '/pages/device/scan' });
  },

  openRename(e: any) {
    const client: Client = e.currentTarget.dataset.client;
    this.setData({ selectedClient: client, renameValue: client.name, dialogVisible: true });
  },

  onRenameInput(e: any) {
    this.setData({ renameValue: e.detail.value });
  },

  closeDialog() {
    this.setData({ dialogVisible: false, selectedClient: null });
  },

  async confirmRename() {
    const { selectedClient, renameValue } = this.data;
    if (!selectedClient) return;
    const name = renameValue.trim();
    if (!name) return;

    try {
      const updated = await deviceApi.rename(selectedClient.clientId, name);
      this.setData((prev: any) => ({
        clients: prev.clients.map((c: Client) =>
          c.clientId === updated.clientId ? { ...c, name: updated.name } : c
        ),
        dialogVisible: false,
      }));
    } catch {
      wx.showToast({ title: '修改名称失败', icon: 'none' });
    }
  },

  async handleUnbind(e: any) {
    const client: Client = e.currentTarget.dataset.client;
    wx.showModal({
      title: '解绑设备',
      content: `确定要解绑 "${client.name}" 吗？`,
      confirmText: '解绑',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await deviceApi.unbind(client.clientId);
          this.setData((prev: any) => ({
            clients: prev.clients.filter((c: Client) => c.clientId !== client.clientId),
          }));
        } catch {
          wx.showToast({ title: '解绑失败', icon: 'none' });
        }
      },
    });
  },

  async handleToggleStatus(e: any) {
    const client: Client = e.currentTarget.dataset.client;
    try {
      const updated = await deviceApi.setEnabled(client.clientId, client.enabled === false);
      this.setData((prev: any) => ({
        clients: prev.clients.map((c: Client) =>
          c.clientId === updated.clientId
            ? { ...c, enabled: updated.enabled, status: updated.status as any }
            : c
        ),
      }));
    } catch {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  async handleRequestDevice(e: any) {
    const device: RequestDevice = e.currentTarget.dataset.device;
    const action: string = e.currentTarget.dataset.action;

    try {
      const updated = await requestDeviceApi.updateStatus(device.deviceId, action as 'approved' | 'blocked');
      this.setData((prev: any) => ({
        requestDevices: prev.requestDevices.map((d: RequestDevice) =>
          d.deviceId === updated.deviceId ? updated : d
        ),
      }));
    } catch {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  async handleRequestDeviceRemove(e: any) {
    const device: RequestDevice = e.currentTarget.dataset.device;
    try {
      await requestDeviceApi.remove(device.deviceId);
      this.setData((prev: any) => ({
        requestDevices: prev.requestDevices.filter((d: RequestDevice) => d.deviceId !== device.deviceId),
      }));
    } catch {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  async handleAutoApproveToggle(e: any) {
    const value = e.detail.value;
    try {
      const updated = await requestDeviceApi.updateSettings({ autoApproveNewRequestDevices: value });
      this.setData({ requestDeviceSettings: updated });
    } catch {
      wx.showToast({ title: '更新配置失败', icon: 'none' });
    }
  },

  formatRelativeTime(date: string | null): string {
    if (!date) return '-';
    return formatRelativeTime(date);
  },
});
