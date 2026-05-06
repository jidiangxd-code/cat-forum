// app.js - 小程序全局入口与运行时配置
const api = require('./utils/api.js');
App({
  // 全局运行时状态和跨页面共享配置统一维护在这里。
  globalData: {
    // 全局运行时缓存：用户信息、云环境和广告位配置统一从这里读取。
    userInfo: null,
    baseUrl: "https://example.com",
    cloudEnvId: null, // 云环境ID，首次启动时自动获取
    adConfig: {
      // 在微信流量主后台申请后，把 adUnitId 填到这里
      indexBannerAdUnitId: "",
      detailBannerAdUnitId: "",
    },
  },

  // 小程序启动时完成云开发、主题、openid 和本地用户缓存的准备。
  async onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true,
      });
      console.log("✅ 云开发初始化完成");
    }

    this._initErrorReporter();

    const savedDark = wx.getStorageSync('darkMode');
    if (savedDark) {
      this._applyDarkMode(true);
    }

    this._initOpenId();
    this._watchTheme();

    // 检查本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }

    try {
      this.globalData.userInfo = await api.syncCurrentUserProfile();
    } catch (e) {}
  },

  // 在启动阶段提前获取并缓存当前用户的 openid。
  async _initOpenId() {
    try {
      // 通过 login 云函数统一拿到 openid，并兼容不同返回字段。
      const res = await wx.cloud.callFunction({
        name: "login",
        timeout: 15000,
      });
      console.log("[login] 完整返回:", JSON.stringify(res));
      // 兼容多种返回格式：openid / openId / result.data.openid
      const openid =
        res.result?.openid ||
        res.result?.openId ||
        res.result?.data?.openid ||
        "";
      if (openid) {
        wx.setStorageSync('openId', openid);
        console.log('✅ openid:', openid);
      } else {
        console.warn("⚠️ openid 为空，使用 guest");
        wx.setStorageSync("openId", "guest");
      }
    } catch (err) {
      console.warn("⚠️ login 调用失败，使用 guest:", err.message || err);
      wx.setStorageSync("openId", "guest");
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

  // 预留后台生命周期入口，便于后续补充资源释放或统计上报。
  onHide() {
    console.log("小程序隐藏");
  },

  // 对外提供广告位配置，供页面按需读取。
  getAdConfig() {
    // 页面通过这个入口读取广告配置，避免直接依赖 globalData 结构。
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
