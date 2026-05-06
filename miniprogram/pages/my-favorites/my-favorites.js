// pages/my-favorites/my-favorites.js - 我的收藏
const api = require('../../utils/api.js');

Page({
  // 当前页面或组件依赖的响应式状态统一维护在这里。
  data: {
    posts: [],
    loading: true,
    empty: false,
    page: 1,
    hasMore: true,
    isDarkMode: wx.getStorageSync('darkMode') || false,
    categoryMap: {
      daily: '日常',
      rescue: '救助',
      neuter: '绝育',
      adopt: '领养',
      lost: '寻猫',
      other: '其他'
    }
  },

  // 初始化当前页面状态并触发首屏数据加载。
  onLoad() {
    this.refreshFavorites(true);
  },

  // 在页面重新显示时同步最新状态或刷新数据。
  onShow() {
    this._syncTheme();
    this.refreshFavorites(true);
  },

  _syncTheme() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
  },

  // 响应下拉刷新并重置列表或详情数据。
  onPullDownRefresh() {
    this.refreshFavorites(true).then(() => wx.stopPullDownRefresh());
  },

  // 在可继续加载时触发下一页数据请求。
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadFavorites(false);
    }
  },

  // 统一重置分页游标并重新加载收藏列表，避免旧页码残留导致首屏空白。
  async refreshFavorites(reset = false) {
    if (reset) {
      this.setData({ page: 1, hasMore: true, posts: [], empty: false });
    }
    return this.loadFavorites(reset);
  },

  // 加载当前用户收藏的帖子列表。
  async loadFavorites(reset = false) {
    this.setData({ loading: true });

    try {
      const openId = api.getOpenId();
      if (!openId || openId === 'guest') {
        this.setData({ posts: [], loading: false, empty: true });
        return;
      }

      const currentPage = reset ? 1 : this.data.page;
      const res = await api.getFavoritePosts(currentPage, 20);
      const posts = (res.data || []).map(p => ({
        ...p,
        timeStr: this._formatTime(p.createTime)
      }));

      const catIds = [...new Set(posts.map(item => item.catId).filter(Boolean))];
      const catCache = {};
      if (catIds.length > 0) {
        const catResults = await Promise.allSettled(
          catIds.map(id => api.getCatProfile(id))
        );
        catResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value && result.value.data) {
            catCache[catIds[index]] = result.value.data;
          }
        });
      }

      const enrichedPosts = posts.map(item => {
        const cat = item.catId ? catCache[item.catId] : null;
        return {
          ...item,
          cat,
          catName: cat ? (cat.fullName || cat.codeName || '未知猫咪') : '未知猫咪',
          catCover: (cat && cat.coverImage) || '',
          displayContent: item.content || '这条收藏内容暂时没有文字描述'
        };
      });

      this.setData({
        posts: currentPage === 1 ? enrichedPosts : [...this.data.posts, ...enrichedPosts],
        hasMore: enrichedPosts.length >= 20,
        page: currentPage + 1,
        loading: false,
        empty: currentPage === 1 && enrichedPosts.length === 0
      });
    } catch (err) {
      console.error('加载收藏失败', err);
      this.setData({ loading: false, empty: true });
    }
  },

  // 把时间字段格式化为相对时间或日期文案。
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

  // 跳转到收藏内容关联的猫咪主页。
  onCatTap(e) {
    const catId = e.currentTarget.dataset.catid;
    if (!catId) {
      wx.showToast({ title: '猫咪档案不存在', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/cat-home/cat-home?id=${catId}` });
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
            this.refreshFavorites(true);
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

  // 跳转到发帖页面。
  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  }
});
