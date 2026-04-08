import { deviceApi } from '../../api/device';

Page({
  data: {
    hasCameraPermission: false,
    permissionLoading: false,
    scanned: false,
    binding: false,
    error: '',
    toastVisible: false,
    toastText: '',
  },

  onLoad() {
    this.checkPermission();
  },

  checkPermission() {
    this.setData({ permissionLoading: true });
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.camera']) {
          this.setData({ hasCameraPermission: true, permissionLoading: false });
        } else {
          this.setData({ hasCameraPermission: false, permissionLoading: false });
        }
      },
      fail: () => {
        this.setData({ hasCameraPermission: false, permissionLoading: false });
      },
    });
  },

  requestPermission() {
    wx.openSetting({
      success: (res) => {
        if (res.authSetting['scope.camera']) {
          this.setData({ hasCameraPermission: true });
        }
      },
    });
  },

  onScanSuccess(e: any) {
    const result = e.detail;
    if (this.data.scanned || this.data.binding) return;
    this.setData({ scanned: true });

    const bindToken = result.result?.trim();

    if (!bindToken || !bindToken.includes('.')) {
      this.showToast('无效的二维码');
      this.setData({ scanned: false });
      return;
    }

    this.handleBind(bindToken);
  },

  async handleBind(bindToken: string) {
    this.setData({ binding: true, error: '' });

    try {
      const device = await deviceApi.bind({
        bindToken,
        deviceName: `手机 ${Date.now()}`,
      });

      wx.showModal({
        title: '绑定成功',
        content: `设备 "${device.name}" 已绑定`,
        showCancel: false,
        confirmText: '确定',
        success: () => {
          wx.navigateBack();
        },
      });
    } catch (err: any) {
      const msg = err?.message || '绑定失败';
      this.showToast(msg);
      this.setData({ scanned: false });
    } finally {
      this.setData({ binding: false });
    }
  },

  handleRescan() {
    this.setData({ scanned: false });
  },

  showToast(text: string) {
    this.setData({ toastText: text, toastVisible: true });
    setTimeout(() => this.setData({ toastVisible: false }), 2000);
  },
});
