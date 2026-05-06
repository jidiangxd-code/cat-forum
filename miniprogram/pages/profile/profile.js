// miniprogram/pages/profile/profile.js - 个人中心页面脚本
const api = require('../../utils/api.js');

Page({
  // 个人中心主要围绕登录态、头像兜底和统计卡片这三类状态展开。
  data: {
    userInfo: null,
    avatarError: false,
    isLoggedIn: false,
    isDarkMode: wx.getStorageSync('darkMode') || false,
    stats: {
      publishCount: 0,
      likeCount: 0,
      collectCount: 0,
      favCount: 0
    }
  },

  // 首次进入个人中心时，同时准备用户信息和统计概览。
  onLoad() {
    this.loadUserInfo();
    this.loadStats();
  },

  // 从其他页面返回后刷新资料和统计，保证个人中心展示的是最新数据。
  onShow() {
    // 每次显示时刷新数据
    this._syncTheme();
    this.loadUserInfo();
    this.loadStats();
  },

  // 从本地缓存恢复当前主题状态。
  _syncTheme() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
  },

  // 从本地缓存恢复昵称、头像和登录态，减少页面首屏等待。
  async loadUserInfo() {
    const userInfo = api.getLocalUserInfo();
    const openId = api.getOpenId();
    this.setData({
      userInfo: userInfo || null,
      isLoggedIn: !!openId && openId !== 'guest'
    });

    if (!openId || openId === 'guest') {
      return;
    }

    try {
      const latestUserInfo = await api.syncCurrentUserProfile();
      this.setData({
        userInfo: latestUserInfo || null,
        avatarError: false
      });
    } catch (err) {
      console.warn('刷新用户资料失败，继续使用本地缓存', err);
    }
  },

  // 调用 login 云函数补齐 openid，并把页面切换到已登录态。
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

      const userInfo = await api.syncCurrentUserProfile(true);
      api.markUserProfileUpdated();
      try {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.userInfo = userInfo;
        }
      } catch (e) {}

      // 获取用户信息（使用头像昵称填写能力）
      this.setData({ userInfo: userInfo || null });
      this.setData({ isLoggedIn: true });
      wx.hideLoading();
      wx.showToast({ title: '登录成功 🎉', icon: 'success' });
      this.loadUserInfo();
      this.loadStats();
    } catch (err) {
      wx.hideLoading();
      console.error('登录失败:', err);
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  // 处理 chooseAvatar 回调：先预览，再立即上传并持久化到云端，避免临时路径在重编译后失效。
  async onChooseAvatar(e) {
    const avatarUrl = String(e.detail.avatarUrl || '').trim();
    const openId = api.getOpenId();
    if (!avatarUrl) return;

    if (!openId || openId === 'guest') {
      wx.showToast({ title: '请先登录后再设置头像', icon: 'none' });
      return;
    }

    const previewUserInfo = {
      ...(this.data.userInfo || {}),
      avatarUrl
    };
    wx.setStorageSync('userInfo', previewUserInfo);
    this.setData({ userInfo: previewUserInfo, avatarError: false });

    try {
      await this._persistAvatar(avatarUrl);
    } catch (err) {
      console.error('保存头像失败', err);
      wx.showToast({ title: String(err?.message || '头像保存失败').slice(0, 20), icon: 'none' });
      await this.loadUserInfo();
    }
  },

  // 把 chooseAvatar 返回的临时头像上传到云存储，并写回 users 集合。
  async _persistAvatar(filePath) {
    wx.showLoading({ title: '保存头像中...', mask: true });
    try {
      const ext = (filePath.split('.').pop() || 'png').replace(/\?.*$/, '');
      const cloudPath = `avatars/${api.getOpenId()}_${Date.now()}.${ext}`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      });

      const latestUserInfo = await api.syncCurrentUserProfile(true);
      const saveRes = await wx.cloud.callFunction({
        name: 'updateUserProfile',
        data: {
          nickName: String(latestUserInfo?.nickName || '').trim(),
          gender: latestUserInfo?.gender || 'unknown',
          avatarFileId: uploadRes.fileID || ''
        }
      });

      if (!saveRes.result || saveRes.result.success === false) {
        throw new Error(saveRes.result?.message || '头像保存失败');
      }

      const nextUserInfo = {
        ...latestUserInfo,
        ...(saveRes.result?.data || {}),
        avatarUrl: saveRes.result?.data?.avatarUrl || uploadRes.fileID || ''
      };
      wx.setStorageSync('userInfo', nextUserInfo);
      api.markUserProfileUpdated();
      try {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.userInfo = nextUserInfo;
        }
      } catch (e) {}

      this.setData({
        userInfo: nextUserInfo,
        avatarError: false
      });
      wx.hideLoading();
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      throw err;
    }
  },

  // 从云数据库统计我的发布数、累计获赞和收藏数量。
  async loadStats() {
    const openId = api.getOpenId();
    if (!openId || openId === 'guest') {
      this.setData({
        stats: { publishCount: 0, likeCount: 0, collectCount: 0, favCount: 0 }
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
          collectCount: favCount,
          favCount
        }
      });
    } catch (err) {
      console.error('获取统计数据失败', err);
      this.setData({
        stats: { publishCount: 0, likeCount: 0, collectCount: 0, favCount: 0 }
      });
    }
  },

  // 头像资源失效时切换到默认头像兜底图。
  onAvatarError() {
    this.setData({ avatarError: true });
  },

  // 跳转到“我的发布”列表。
  goToMyPosts() {
    wx.navigateTo({ url: '/pages/my-posts/my-posts' });
  },

  // 跳转到“我喜欢的”列表。
  goToMyLikes() {
    wx.navigateTo({ url: '/pages/my-likes/my-likes' });
  },

  // 跳转到“我的评论”列表。
  goToMyComments() {
    wx.navigateTo({ url: '/pages/my-comments/my-comments' });
  },

  // 跳转到“我的收藏”列表。
  goToMyFavorites() {
    wx.navigateTo({ url: '/pages/my-favorites/my-favorites' });
  },

  // 跳转到资料编辑页。
  editProfile() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile' });
  },

  // 跳转到个人设置页。
  goToPersonalSettings() {
    wx.navigateTo({ url: '/pages/personal-settings/personal-settings' });
  },

  // 只清理临时缓存，避免误删 openId 等关键登录数据。
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

  // 展示应用简介和版本信息。
  aboutUs() {
    wx.showModal({
      title: '关于校园小猫论坛',
      content: '🐱 校园小猫论坛 v1.0.0\n\n用爱守护每一只校园小猫\n\n这是一个温暖的社区，让我们一起关爱校园里的流浪小猫，分享每一只可爱小猫的故事~',
      showCancel: false
    });
  }
});
