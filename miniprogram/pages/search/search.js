// pages/search/search.js - 搜索页
const api = require('../../utils/api.js');

Page({
  data: {
    keyword: '',
    autoFocus: true,
    activeTab: 'cats',      // 'cats' | 'posts'
    hasSearched: false,
    // 猫咪搜索结果
    catsResult: [],
    loadingCats: false,
    // 帖子搜索结果
    postsResult: [],
    loadingPosts: false,
    // 搜索历史
    searchHistory: [],
    // 热门搜索词
    hotKeywords: ['橘猫', '狸花', '三花', '白猫', '流浪猫', '领养', '绝育'],
    // 猫咪信息缓存
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

  onLoad(options) {
    // 页面加载时自动聚焦搜索框
    this.setData({ autoFocus: true });
    // 读取搜索历史
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ searchHistory: history.slice(0, 10) });
    // 如果有外部传入的关键词，自动搜索
    if (options.keyword) {
      this.setData({ keyword: options.keyword });
      this.doSearch();
    }
  },

  onShow() {
    // 每次显示时刷新历史
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ searchHistory: history.slice(0, 10) });
  },

  // 输入时同步关键词
  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  // 清空输入
  clearInput() {
    this.setData({ keyword: '', hasSearched: false, catsResult: [], postsResult: [] });
  },

  // 执行搜索
  async doSearch() {
    const keyword = this.data.keyword.trim();
    if (!keyword) return;

    // 保存搜索历史
    this._saveHistory(keyword);

    this.setData({
      hasSearched: true,
      activeTab: 'cats',
      catsResult: [],
      postsResult: [],
      loadingCats: true,
      loadingPosts: true
    });

    // 并发搜索猫咪和帖子
    await Promise.all([
      this._searchCats(keyword),
      this._searchPosts(keyword)
    ]);
  },

  // 搜索猫咪
  async _searchCats(keyword) {
    try {
      const cats = await api.searchCats(keyword);
      this.setData({ catsResult: cats, loadingCats: false });
    } catch (e) {
      console.error('搜索猫咪失败', e);
      this.setData({ catsResult: [], loadingCats: false });
    }
  },

  // 搜索帖子
  async _searchPosts(keyword) {
    try {
      const posts = await api.searchPosts(keyword);
      // 补充猫咪信息
      const catIds = [...new Set(posts.map(p => p.catId).filter(Boolean))];
      const newIds = catIds.filter(id => !this.data.catCache[id]);

      if (newIds.length > 0) {
        const results = await Promise.allSettled(
          newIds.map(id => api.getCatProfile(id))
        );
        const cache = { ...this.data.catCache };
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.data) {
            cache[newIds[i]] = r.value.data;
          }
        });
        this.setData({ catCache: cache });
      }

      const enriched = posts.map(p => ({
        ...p,
        cat: this.data.catCache[p.catId] || null,
        createTimeStr: this._formatTime(p.createTime)
      }));

      this.setData({ postsResult: enriched, loadingPosts: false });
    } catch (e) {
      console.error('搜索帖子失败', e);
      this.setData({ postsResult: [], loadingPosts: false });
    }
  },

  // 切换 Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  // 点击历史记录/热门词搜索
  onHistoryTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ keyword });
    this.doSearch();
  },

  // 清空搜索历史
  clearHistory() {
    wx.removeStorageSync('searchHistory');
    this.setData({ searchHistory: [] });
  },

  // 保存搜索历史（去重，保留最近10条）
  _saveHistory(keyword) {
    let history = wx.getStorageSync('searchHistory') || [];
    history = history.filter(h => h !== keyword); // 去重
    history.unshift(keyword); // 插入头部
    history = history.slice(0, 10); // 保留10条
    wx.setStorageSync('searchHistory', history);
    this.setData({ searchHistory: history });
  },

  // 点击猫咪卡片 → 跳转猫咪主页
  onCatTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/cat-home/cat-home?id=${id}` });
  },

  // 点击帖子卡片 → 跳转帖子详情
  onPostTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
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
  }
});