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

    // 检查本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
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

  onShow() {
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  }
});
