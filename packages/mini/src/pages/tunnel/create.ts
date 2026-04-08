import { tunnelStore } from '../../stores/tunnel';
import type { Protocol } from '@cloud-dock/shared';

Page({
  data: {
    name: '',
    protocol: 'http' as Protocol,
    localAddress: '',
    localHostname: '',
    errors: {} as Record<string, string>,
    loading: false,
    error: '',
  },

  onNameInput(e: any) {
    this.setData({ name: e.detail.value, errors: { ...this.data.errors, name: '' } });
  },

  onProtocolChange(e: any) {
    this.setData({ protocol: e.currentTarget.dataset.protocol as Protocol });
  },

  onLocalAddressInput(e: any) {
    this.setData({ localAddress: e.detail.value, errors: { ...this.data.errors, localAddress: '' } });
  },

  onLocalHostnameInput(e: any) {
    this.setData({ localHostname: e.detail.value });
  },

  validate(): boolean {
    const { name, localAddress } = this.data;
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = '请输入隧道名称';
    }

    if (!localAddress.trim()) {
      errors.localAddress = '请输入本地地址';
    }

    this.setData({ errors });
    return Object.keys(errors).length === 0;
  },

  async handleSubmit() {
    if (!this.validate()) return;

    this.setData({ loading: true, error: '' });

    try {
      const tunnel = await tunnelStore.createTunnel({
        name: this.data.name.trim(),
        protocol: this.data.protocol,
        localAddress: this.data.localAddress.trim(),
        localHostname: this.data.localHostname.trim() || undefined,
      });

      wx.showModal({
        title: '成功',
        content: '隧道创建成功',
        showCancel: true,
        confirmText: '查看详情',
        cancelText: '返回列表',
        success: (res) => {
          if (res.confirm) {
            wx.redirectTo({ url: `/pages/tunnel/detail?tunnelId=${tunnel.tunnelId}` });
          } else {
            wx.navigateBack();
          }
        },
      });
    } catch {
      const app = getApp<IAppOption>();
      this.setData({ error: app.globalData.error || '创建失败' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
