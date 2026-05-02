// pages/index/index.js - 首页（帖子流）
const api = require('../../utils/api.js');

Page({
  data: {
    postList: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 15,
    // 排序：'latest' 最新 | 'hot' 最热
    sortBy: 'latest',
    // 深色模式
    isDarkMode: wx.getStorageSync('darkMode') || false,
    // 猫咪档案缓存（catId -> cat）
    catCache: {},
    // 分类映射
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
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
    this.loadPosts(true);
  },

  onShow() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, postList: [] });
    this.loadPosts(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts(false);
    }
  },

  async loadPosts(reset = false) {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await api.getPostList({ page: this.data.page, pageSize: this.data.pageSize, sort: this.data.sortBy });
      const posts = res.data || [];

      // 批量获取未缓存的猫咪档案
      const catIds = [...new Set(posts.map(p => p.catId).filter(Boolean))];
      const newIds = catIds.filter(id => !this.data.catCache[id]);
      if (newIds.length > 0) {
        const catResults = await Promise.allSettled(
          newIds.map(id => api.getCatProfile(id))
        );
        const newCache = { ...this.data.catCache };
        catResults.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.data) {
            newCache[newIds[i]] = r.value.data;
          }
        });
        this.setData({ catCache: newCache });
      }

      // 合并猫咪信息到帖子
      const enriched = posts.map(p => ({
        ...p,
        cat: this.data.catCache[p.catId] || null,
        createTimeStr: this._formatTime(p.createTime)
      }));

      this.setData({
        postList: reset ? enriched : [...this.data.postList, ...enriched],
        hasMore: posts.length >= this.data.pageSize,
        page: this.data.page + 1,
        loading: false
      });
    } catch (e) {
      console.error('加载帖子失败', e);
      this.setData({ loading: false });
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

  // 点击跳转猫咪主页
  onCatTap(e) {
    const catId = e.currentTarget.dataset.catid;
    if (!catId) return;
    wx.navigateTo({ url: `/pages/cat-home/cat-home?id=${catId}` });
  },

  // 点击帖子
  onPostTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 点赞
  onLike(e) {
    const { id, liked } = e.currentTarget.dataset;
    const openid = api.getOpenId();
    const idx = this.data.postList.findIndex(p => p._id === id);
    if (idx === -1) return;
    const list = [...this.data.postList];
    list[idx] = {
      ...list[idx],
      liked: !liked,
      likeCount: liked ? (list[idx].likeCount - 1) : (list[idx].likeCount + 1)
    };
    this.setData({ postList: list });
    api.togglePostLike(id, openid, !liked).catch(() => {
      list[idx].liked = liked;
      list[idx].likeCount = liked ? list[idx].likeCount + 1 : list[idx].likeCount - 1;
      this.setData({ postList: list });
    });
  },

  previewImage(e) {
    const { images, index } = e.currentTarget.dataset;
    wx.previewImage({ current: images[index], urls: images });
  },

  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  },

  goCatList() {
    wx.switchTab({ url: '/pages/cat-list/cat-list' });
  },

  // 搜索
  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  // 排序切换
  switchSort(e) {
    const sort = e.currentTarget.dataset.sort;
    if (sort === this.data.sortBy) return;
    this.setData({ sortBy: sort, page: 1, hasMore: true, postList: [] });
    this.loadPosts(true);
  },

  // 深色模式切换
  toggleDarkMode() {
    const newDark = !this.data.isDarkMode;
    this.setData({ isDarkMode: newDark });
    try {
      if (newDark) {
        wx.setStorageSync('darkMode', true);
      } else {
        wx.removeStorageSync('darkMode');
      }
    } catch(e) {}
    // 全局通知所有页面
    try {
      const pages = getCurrentPages();
      pages.forEach(p => {
        try { p.setData({ isDarkMode: newDark }); } catch(e) {}
      });
    } catch(e) {}
    // 尝试通知 app 同步
    const app = getApp();
    try { app._applyDarkMode(newDark); } catch(e) {}
  }
});