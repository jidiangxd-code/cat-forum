const theme = require('./utils/theme.js');

App({
  globalData: {
    userInfo: null,
    baseUrl: 'https://example.com',
    cloudEnvId: null,
    themeManager: theme,
  },

  async onLaunch() {
    // 初始化云开发环境（明确指定 env，避免开发者版/体验版连不同环境）
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d6gz1l670de10862e',
        traceUser: true
      });
      console.log('云开发初始化完成，env:', 'cloud1-d6gz1l670de10862e');
      
      try {
        const envId = wx.cloud.ENV || 'default';
        console.log('当前云环境 ID:', envId);
        this.globalData.cloudEnvId = envId;
      } catch(e) {}
    }

    // 初始化全局错误上报
    this._initErrorReporter();

    // 加载并应用保存的主题
    const savedTheme = theme.loadSaved();
    theme.apply(savedTheme);

    // 获取用户 openid（带超时保护，不阻塞主流程）
    this._initOpenId();
  },

  async _initOpenId() {
    try {
      const res = await Promise.race([
        wx.cloud.callFunction({
          name: 'login',
          timeout: 8000
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('login timeout')), 8000))
      ]);
      console.log('[login] 完整返回:', JSON.stringify(res));
      const openid = res.result?.openid || res.result?.openId || res.result?.data?.openid || '';
      if (openid) {
        wx.setStorageSync('openId', openid);
        console.log('openid:', openid);
        // 同步拉取用户信息，存入 Storage（供评论、帖子等模块读取作者名）
        this._syncUserInfo(openid);
      } else {
        console.warn('openid 为空，使用 guest');
        wx.setStorageSync('openId', 'guest');
      }
    } catch (err) {
      console.warn('login 调用失败，使用 guest:', err.message || err);
      wx.setStorageSync('openId', 'guest');
    }
  },

  async _syncUserInfo(openid) {
    try {
      const res = await Promise.race([
        wx.cloud.database().collection('users').where({ openid }).limit(1).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('syncUserInfo timeout')), 5000))
      ]);
      if (res.data && res.data.length > 0) {
        const user = res.data[0];
        const userInfo = {
          nickName: user.nickName || '',
          avatarUrl: user.avatar || ''
        };
        wx.setStorageSync('userInfo', userInfo);
        this.globalData.userInfo = userInfo;
        console.log('用户信息已同步:', userInfo.nickName);
      } else {
        console.log('users 集合中暂无该用户记录（首次使用）');
      }
    } catch (e) {
      console.warn('同步用户信息失败:', e);
    }
  },

  onShow() {
    // 监听系统主题变化
    try {
      wx.onThemeChange((res) => {
        // 如果用户没有手动设置主题，则跟随系统
        const userSetTheme = wx.getStorageSync('themeId');
        if (!userSetTheme) {
          theme.apply(res.theme === 'dark' ? 'dark' : 'orange');
        }
      });
    } catch (e) {}
    console.log('小程序显示');
  },

  onHide() {
    console.log('小程序隐藏');
  },

  // ==================== 全局错误上报 ====================

  _initErrorReporter() {
    const MAX_LOG_LEN = 2000;

    function reportToCloud(level, message, extra = {}) {
      if (!wx.cloud) return;
      const pages = getCurrentPages();
      const currentPage = pages.length > 0 ? pages[pages.length - 1].route || '' : '';
      const openid = wx.getStorageSync('openId') || '';

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
        stack: res.reason?.stack || ''
      });
    });

    console.log('✅ 全局错误上报已初始化 → debug_logs');
  }
});
