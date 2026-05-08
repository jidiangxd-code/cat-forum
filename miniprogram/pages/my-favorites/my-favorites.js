// pages/my-favorites/my-favorites.js - 我的收藏
const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    themeId: theme.getThemeId(),
    pageClass: theme.getPageClass(),
    posts: [],
    loading: true,
    empty: false,
    page: 1,
    hasMore: true,
    categoryMap: {
      daily: '日常',
      rescue: '救助',
      neuter: '绝育',
      adopt: '领养',
      lost: '寻猫',
      other: '其他'
    }
  },

  onLoad() {
    theme.applyTheme(this);
    this.loadFavorites();
  },

  onShow() {
    this.loadFavorites();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, posts: [] });
    this.loadFavorites().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadFavorites();
    }
  },

  async loadFavorites() {
    this.setData({ loading: true });

    try {
      const openId = api.getOpenId();
      if (!openId || openId === 'guest') {
        this.setData({ posts: [], loading: false, empty: true });
        return;
      }

      const res = await api.getFavoritePosts(this.data.page, 20);
      const posts = (res.data || []).map(p => ({
        ...p,
        timeStr: this._formatTime(p.createTime)
      }));

      this.setData({
        posts: this.data.page === 1 ? posts : [...this.data.posts, ...posts],
        hasMore: posts.length >= 20,
        page: this.data.page + 1,
        loading: false,
        empty: this.data.page === 1 && posts.length === 0
      });
    } catch (err) {
      console.error('加载收藏失败', err);
      this.setData({ loading: false, empty: true });
    }
  },

  _formatTime(t) {
    if (!t) return '';
    const d = t instanceof Date ? t : new Date(t);
    if (isNaN(d)) return '';
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  },

  // 点击帖子跳转详情
  onPostTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 取消收藏
  async unfavorite(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消收藏',
      content: '确定要取消收藏这篇帖子吗？',
      confirmText: '取消收藏',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.toggleFavorite(id, false);
            wx.showToast({ title: '已取消收藏', icon: 'success' });
            // 刷新列表
            this.setData({ page: 1, posts: [], hasMore: true });
            this.loadFavorites();
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 预览图片
  previewImage(e) {
    const { images, index } = e.currentTarget.dataset;
    wx.previewImage({ current: images[index], urls: images });
  },

  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  }
});
