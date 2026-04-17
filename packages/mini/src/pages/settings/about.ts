Page({
  data: {
    version: '1.0.0',
    buildDate: '2024-04-01',
  },

  checkForUpdate() {
    wx.showToast({ title: '已是最新版本', icon: 'success' });
  },

  showTerms() {
    wx.showToast({ title: '该功能开发中', icon: 'none' });
  },

  showPrivacy() {
    wx.showToast({ title: '该功能开发中', icon: 'none' });
  },

  showLicenses() {
    wx.showToast({ title: '该功能开发中', icon: 'none' });
  },
});
