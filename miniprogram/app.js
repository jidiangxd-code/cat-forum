App({
  globalData: {
    userInfo: null,
    baseUrl: 'https://example.com',
    cloudEnvId: null
  },

  async onLaunch() {
    // 初始化云开发环境
    if (wx.cloud) {
      wx.cloud.init({
        traceUser: true
      });
      console.log('✅ 云开发初始化完成');
      
      // 打印当前云环境 ID（方案四：用于后续远程查 debug_logs）
      try {
        const envId = wx.cloud.ENV || 'default';
        console.log('☁️ 当前云环境 ID:', envId);
        this.globalData.cloudEnvId = envId;
      } catch(e) {}
    }

    // 初始化全局错误上报（方案四：写入云数据库 debug_logs 集合）
    this._initErrorReporter();

    // 检查本地存储的深色模式偏好
    const savedDark = wx.getStorageSync('darkMode');
    if (savedDark) {
      this._applyDarkMode(true);
    }

    // 获取用户 openid
    this._initOpenId();
  },

  async _initOpenId() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login',
        timeout: 15000
      });
      console.log('[login] 完整返回:', JSON.stringify(res));
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
    this._watchTheme();
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  },

  // ==================== 全局错误上报（写入云数据库 debug_logs）====================

  _initErrorReporter() {
    const self = this;
    const MAX_LOG_LEN = 2000; // 单条日志最大长度，防止超长字符串写不进去

    /**
     * 上报一条错误/警告到 debug_logs 集合
     * @param {string} level - 'ERROR' | 'UNHANDLED_REJECTION' | 'WARN' | 'LOG'
     * @param {string} message - 错误信息
     * @param {object} [extra] - 附加信息（堆栈、页面路径等）
     */
    function reportToCloud(level, message, extra = {}) {
      if (!wx.cloud) return;
      const pages = getCurrentPages();
      const currentPage = pages.length > 0 ? pages[pages.length - 1].route || '' : '';
      const openid = wx.getStorageSync('openId') || '';

      // 截断过长的信息
      let safeMsg = String(message);
      if (safeMsg.length > MAX_LOG_LEN) safeMsg = safeMsg.substring(0, MAX_LOG_LEN) + '...(截断)';
      let safeStack = extra.stack ? String(extra.stack) : '';
      if (safeStack.length > MAX_LOG_LEN) safeStack = safeStack.substring(0, MAX_LOG_LEN) + '...(截断)';

      wx.cloud.database().collection('debug_logs').add({
        data: {
          level,
          message: safeMsg,
          stack: safeStack,
          page: currentPage,
          openid: openid,
          systemInfo: wx.getSystemInfoSync(),
          time: new Date(),
          ...extra
        }
      }).catch(() => { /* 上报失败静默处理 */ });
    }

    // 1. 捕获 JS 运行时错误（语法错误、引用错误等）
    wx.onError((error) => {
      console.error('[全局捕获] JS Error:', error);
      reportToCloud('ERROR', error, { type: 'onError', stack: error });
    });

    // 2. 捕获未处理的 Promise 拒绝（网络超时、异步异常等）
    wx.onUnhandledRejection((res) => {
      console.warn('[全局捕获] Unhandled Rejection:', res);
      const reason = res.reason instanceof Error
        ? (res.reason.message || res.reason.toString())
        : JSON.stringify(res.reason);
      reportToCloud('UNHANDLED_REJECTION', reason, {
        type: 'unhandledRejection',
        promise: String(res.promise),
        stack: res.reason?.stack || ''
      });
    });

    console.log('✅ 全局错误上报已初始化 → debug_logs');
  }
});