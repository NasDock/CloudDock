Page({
  data: {},

  goToNotifications() {
    wx.navigateTo({ url: '/pages/settings/notifications' });
  },

  goToSecurity() {
    wx.navigateTo({ url: '/pages/settings/security' });
  },

  goToAbout() {
    wx.navigateTo({ url: '/pages/settings/about' });
  },

  showDevAlert() {
    wx.showToast({ title: '该功能开发中', icon: 'none' });
  },
});
