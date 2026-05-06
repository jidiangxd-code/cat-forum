// miniprogram/pages/personal-settings/personal-settings.js - 个人设置页脚本
Page({
  data: {
    isDarkMode: wx.getStorageSync('darkMode') || false
  },

  onShow() {
    this._syncTheme();
  },

  _syncTheme() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
  },

  toggleTheme() {
    const newDark = !this.data.isDarkMode;
    this.setData({ isDarkMode: newDark });

    if (newDark) {
      wx.setStorageSync('darkMode', true);
    } else {
      wx.removeStorageSync('darkMode');
    }

    try {
      const app = getApp();
      if (app && typeof app._applyDarkMode === 'function') {
        app._applyDarkMode(newDark);
      }
    } catch (e) {}

    wx.showToast({
      title: newDark ? '已切换到夜晚' : '已切换到白天',
      icon: 'none'
    });
  }
});
