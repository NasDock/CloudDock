Page({
  data: {
    pushEnabled: true,
    deviceAlertEnabled: true,
    tunnelAlertEnabled: true,
    emailEnabled: false,
  },

  onLoad() {
    const settings = wx.getStorageSync('notificationSettings');
    if (settings) {
      this.setData(settings);
    }
  },

  onPushEnabledChange(e: any) {
    const value = e.detail.value;
    this.setData({ pushEnabled: value });
    this.saveSettings();
    if (!value) {
      wx.showToast({ title: '已关闭推送通知', icon: 'none' });
    }
  },

  onDeviceAlertChange(e: any) {
    const value = e.detail.value;
    this.setData({ deviceAlertEnabled: value });
    this.saveSettings();
  },

  onTunnelAlertChange(e: any) {
    const value = e.detail.value;
    this.setData({ tunnelAlertEnabled: value });
    this.saveSettings();
  },

  onEmailChange(e: any) {
    const value = e.detail.value;
    this.setData({ emailEnabled: value });
    this.saveSettings();
  },

  saveSettings() {
    const { pushEnabled, deviceAlertEnabled, tunnelAlertEnabled, emailEnabled } = this.data;
    wx.setStorageSync('notificationSettings', {
      pushEnabled,
      deviceAlertEnabled,
      tunnelAlertEnabled,
      emailEnabled,
    });
  },
});
