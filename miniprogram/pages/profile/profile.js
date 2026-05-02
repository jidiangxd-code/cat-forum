const api = require('../../utils/api.js');

Page({
  data: {
    userInfo: null,
    avatarError: false,
    isLoggedIn: false,
    stats: {
      publishCount: 0,
      likeCount: 0,
      collectCount: 0,
      favCount: 0
    },
    unreadCount: 0,
    // 深色模式
    isDarkMode: wx.getStorageSync('darkMode') || false
  },

  onLoad() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
    this.loadUserInfo();
    this.loadStats();
  },

  onShow() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
    // 每次显示时刷新数据
    this.loadUserInfo();
    this.loadStats();
    this.loadUnreadCount();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    const openId = api.getOpenId();
    this.setData({
      userInfo: userInfo || null,
      isLoggedIn: !!openId && openId !== 'guest'
    });
  },

  // 微信登录
  async doLogin() {
    try {
      wx.showLoading({ title: '登录中...' });
      const loginRes = await wx.cloud.callFunction({ name: 'login' });
      const openid = loginRes.result?.openid || loginRes.result?.openId || '';
      if (!openid) {
        wx.hideLoading();
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
        return;
      }
      wx.setStorageSync('openId', openid);

      // 获取用户信息（使用头像昵称填写能力）
      this.setData({ isLoggedIn: true });
      wx.hideLoading();
      wx.showToast({ title: '登录成功 🎉', icon: 'success' });
      this.loadStats();
    } catch (err) {
      wx.hideLoading();
      console.error('登录失败:', err);
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    if (avatarUrl) {
      const userInfo = this.data.userInfo || {};
      userInfo.avatarUrl = avatarUrl;
      wx.setStorageSync('userInfo', userInfo);
      this.setData({ userInfo, avatarError: false });
    }
  },

  // 加载统计数据
  async loadStats() {
    const openId = api.getOpenId();
    if (!openId || openId === 'guest') {
      this.setData({
        stats: { publishCount: 0, likeCount: 0, collectCount: 0 }
      });
      return;
    }
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      // 获取发布数量
      const postCountRes = await db.collection('posts')
        .where({ authorId: openId })
        .count();
      // 获取获赞总数
      const myPostsRes = await db.collection('posts')
        .where({ authorId: openId })
        .field({ likeCount: true })
        .get();
      const likeCount = (myPostsRes.data || []).reduce((sum, p) => sum + (p.likeCount || 0), 0);

      // 获取收藏数
      let favCount = 0;
      try {
        const favCountRes = await db.collection('favorites')
          .where({ userOpenid: openId })
          .count();
        favCount = favCountRes.total || 0;
      } catch (e) {}

      this.setData({
        stats: {
          publishCount: postCountRes.total || 0,
          likeCount: likeCount,
          collectCount: likeCount,
          favCount
        }
      });
    } catch (err) {
      console.error('获取统计数据失败', err);
      this.setData({
        stats: { publishCount: 0, likeCount: 0, collectCount: 0 }
      });
    }
  },

  // 头像加载失败
  onAvatarError() {
    this.setData({ avatarError: true });
  },

  // 我的发布
  goToMyPosts() {
    wx.navigateTo({ url: '/pages/my-posts/my-posts' });
  },

  // 我喜欢的
  goToMyLikes() {
    wx.navigateTo({ url: '/pages/my-likes/my-likes' });
  },

  // 我的评论
  goToMyComments() {
    wx.navigateTo({ url: '/pages/my-comments/my-comments' });
  },

  // 我的收藏
  goToMyFavorites() {
    wx.navigateTo({ url: '/pages/my-favorites/my-favorites' });
  },

  // 我的关注
  goToMyFollows() {
    wx.navigateTo({ url: '/pages/my-follows/my-follows?type=following' });
  },

  // 我的粉丝
  goToMyFollowers() {
    wx.navigateTo({ url: '/pages/my-follows/my-follows?type=followers' });
  },

  // 消息通知
  goToNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },

  // 加载未读通知数
  editProfile() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile' });
  },

  // 加载未读通知数
  async loadUnreadCount() {
    if (!this.data.isLoggedIn) {
      this.setData({ unreadCount: 0 });
      return;
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'getNotifications',
        data: { page: 1, pageSize: 1 }
      });
      if (res.result && res.result.success) {
        const count = res.result.data.unreadCount || 0;
        this.setData({ unreadCount: count });
      }
    } catch (e) {}
  },

  // 清除缓存
  // Bug #20 修复：改为只清除非关键缓存，保留 openId 等数据
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除临时缓存数据吗？（不会删除登录信息）',
      success: (res) => {
        if (res.confirm) {
          // 只清除非关键缓存，保留 openId 等关键数据
          wx.removeStorageSync('imageCache');
          wx.removeStorageSync('tempData');
          wx.removeStorageSync('searchHistory');
          wx.showToast({ title: '缓存已清除', icon: 'success' });
        }
      }
    });
  },

  // 关于我们
  aboutUs() {
    wx.showModal({
      title: '关于校园小猫论坛',
      content: '🐱 校园小猫论坛 v1.0.0\n\n用爱守护每一只校园小猫\n\n这是一个温暖的社区，让我们一起关爱校园里的流浪小猫，分享每一只可爱小猫的故事~',
      showCancel: false
    });
  },

  // 深色模式切换
  toggleDarkMode() {
    const newDark = !this.data.isDarkMode;
    this.setData({ isDarkMode: newDark });
    try {
      if (newDark) wx.setStorageSync('darkMode', true);
      else wx.removeStorageSync('darkMode');
    } catch(e) {}
    try {
      const pages = getCurrentPages();
      pages.forEach(p => { try { p.setData({ isDarkMode: newDark }); } catch(e) {} });
    } catch(e) {}
    try { getApp()._applyDarkMode(newDark); } catch(e) {}
  }
});
