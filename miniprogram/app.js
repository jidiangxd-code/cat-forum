App({
  globalData: {
    userInfo: null,
    baseUrl: 'https://example.com',
    cloudEnvId: null // 云环境ID，首次启动时自动获取
  },

  async onLaunch() {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true
      });
      console.log('✅ 云开发初始化完成');
    }

    // 获取用户 openid（有降级策略，不阻塞首页加载）
    this._initOpenId();

    // 检查本地存储的深色模式偏好（优先于系统设置）
    const savedDark = wx.getStorageSync('darkMode');
    if (savedDark) {
      this._applyDarkMode(true);
    }
  },
  },

  async _initOpenId() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        timeout: 15000
      });
      console.log('[login] 完整返回:', JSON.stringify(res));
      // 兼容多种返回格式：openid / openId / result.data.openid
      const openid = res.result?.openid || res.result?.openId || res.result?.data?.openid || '';
      if (openid) {
        wx.setStorageSync('openId', openid);
        console.log('✅ openid:', openid);
      } else {
        console.warn('⚠️ openid 为空，使用 guest');
        wx.setStorageSync('openId', 'guest');
      }
    } catch (err) {
      console.warn('⚠️ login 调用失败，使用 guest:', err.message || err);
      wx.setStorageSync('openId', 'guest');
    }
  },

  _watchTheme() {
    try {
      wx.onThemeChange((res) => {
        this._applyDarkMode(res.theme === 'dark');
      });
    } catch(e) {}
  },
  // 深色模式支持
  _applyDarkMode(dark) {
    try {
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        try {
          pages[i].setData({ isDarkMode: dark });
        } catch(e) {}
      }
      // 动态设置所有页面的 page 节点 class（触发 wxss 变量切换）
      if (dark) {
        wx.setStorageSync('darkMode', true);
      } else {
        wx.removeStorageSync('darkMode');
      }
    } catch(e) {}
  },
  onShow() {
    this._watchTheme();
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  }
});
