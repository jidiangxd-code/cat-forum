const api = require('../../utils/api.js');

Page({
  data: {
    userInfo: null,
    avatarError: false,
    stats: {
      publishCount: 0,
      likeCount: 0,
      collectCount: 0
    }
  },

  onLoad() {
    this.loadUserInfo();
    this.loadStats();
  },

  onShow() {
    // 每次显示时刷新数据
    this.loadStats();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const myOpenId = api.getOpenId();
      const stats = await api.getUserStats(myOpenId);

      this.setData({
        stats: {
          publishCount: stats.publishCount || 0,
          likeCount: stats.likeCount || 0,  // 获赞数 = 别人给我的点赞
          collectCount: stats.likeCount || 0  // 喜欢数 = 我点赞的猫咪数（和上面一样）
        }
      });
    } catch (err) {
      console.error('获取统计数据失败', err);
      this.setData({
        stats: {
          publishCount: 0,
          likeCount: 0,
          collectCount: 0
        }
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

  // 编辑资料
  editProfile() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile' });
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
  }
});
