App({
  globalData: {
    userInfo: null,
    baseUrl: 'https://example.com',
    cloudEnvId: null,
    adConfig: {
      indexBannerAdUnitId: '',
      detailBannerAdUnitId: '',
    },
  },

  async onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true,
      });
      console.log('✅ 云开发初始化完成');

      try {
        const envId = wx.cloud.ENV || 'default';
        console.log('☁️ 当前云环境 ID:', envId);
        this.globalData.cloudEnvId = envId;
      } catch (e) {}
    }

    this._initErrorReporter();

    const savedDark = wx.getStorageSync('darkMode');
    if (savedDark) {
      this._applyDarkMode(true);
    }

    this._initOpenId();
    this._watchTheme();

    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
  },

  async _initOpenId() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        timeout: 15000,
      });
      console.log('[login] 完整返回:', JSON.stringify(res));
      const openid =
        res.result?.openid ||
        res.result?.openId ||
        res.result?.data?.openid ||
        '';

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
    } catch (e) {}
  },

  _applyDarkMode(dark) {
    try {
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        try {
          pages[i].setData({ isDarkMode: dark });
        } catch (e) {}
      }

      if (dark) {
        wx.setStorageSync('darkMode', true);
      } else {
        wx.removeStorageSync('darkMode');
      }
    } catch (e) {}
  },

  onShow() {
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  },

  getAdConfig() {
    return this.globalData.adConfig || {};
  },

  _initErrorReporter() {
    const maxLogLen = 2000;

    function reportToCloud(level, message, extra = {}) {
      if (!wx.cloud) return;

      const pages = getCurrentPages();
      const currentPage = pages.length > 0 ? pages[pages.length - 1].route || '' : '';
      const openid = wx.getStorageSync('openId') || '';

      let safeMsg = String(message);
      if (safeMsg.length > maxLogLen) safeMsg = `${safeMsg.substring(0, maxLogLen)}...(截断)`;

      let safeStack = extra.stack ? String(extra.stack) : '';
      if (safeStack.length > maxLogLen) safeStack = `${safeStack.substring(0, maxLogLen)}...(截断)`;

      wx.cloud.database().collection('debug_logs').add({
        data: {
          level,
          message: safeMsg,
          stack: safeStack,
          page: currentPage,
          openid,
          systemInfo: wx.getSystemInfoSync(),
          time: new Date(),
          ...extra,
        },
      }).catch(() => {});
    }

    wx.onError((error) => {
      console.error('[全局捕获] JS Error:', error);
      reportToCloud('ERROR', error, { type: 'onError', stack: error });
    });

    wx.onUnhandledRejection((res) => {
      console.warn('[全局捕获] Unhandled Rejection:', res);
      const reason = res.reason instanceof Error
        ? (res.reason.message || res.reason.toString())
        : JSON.stringify(res.reason);

      reportToCloud('UNHANDLED_REJECTION', reason, {
        type: 'unhandledRejection',
        promise: String(res.promise),
        stack: res.reason?.stack || '',
      });
    });

    console.log('✅ 全局错误上报已初始化 → debug_logs');
  },
});
