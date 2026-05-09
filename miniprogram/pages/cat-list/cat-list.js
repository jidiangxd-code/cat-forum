// pages/cat-list/cat-list.js - 猫咪档案列表页（含排行榜）
const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    // 主题
    pageClass: theme.getPageClass(),
    themeId: theme.getThemeId(),
    // 内容
    tabs: [
      { id: 'list', name: '全部猫咪' },
      { id: 'rank_total', name: '人气榜' },
      { id: 'rank_new', name: '新晋猫' },
      { id: 'unknown_list', name: '未知猫' }
    ],
    currentTab: 'list',
    catList: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    keyword: '',
    searchMode: false
  },

  onLoad() {
    const current = theme.getCurrentId();
    this.setData({ pageClass: 'page theme-' + current, themeId: current });
    theme.onChange((t) => this.setData({ pageClass: 'page theme-' + t.id, themeId: t.id }));
    // 设置页面背景色和导航栏颜色
    this._applyThemeBackground();
    theme._updateNavBar(theme.getCurrent());
    this.loadList();
  },

  onShow() {
    // 每次显示页面时更新背景色和导航栏颜色
    this._applyThemeBackground();
    theme._updateNavBar(theme.getCurrent());
  },

  _applyThemeBackground() {
    try {
      const t = theme.getCurrent();
      const bgColor = t['--color-bg'];
      console.log('[cat-list] 设置背景色:', bgColor);
      wx.setBackgroundColor({
        backgroundColor: bgColor,
        backgroundColorTop: bgColor,
        backgroundColorBottom: bgColor,
        success: () => console.log('[cat-list] 背景色设置成功'),
        fail: (err) => console.warn('[cat-list] 背景色设置失败:', err)
      });
    } catch (e) {
      console.warn('[cat-list] _applyThemeBackground 异常:', e);
    }
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, catList: [] });
    this.loadList().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList();
    }
  },

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab, page: 1, catList: [], hasMore: true, keyword: '', searchMode: false });
    this.loadList();
  },

  async loadList() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await api.getCatProfileList({
        mode: this.data.currentTab,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      const list = (res.data && res.data.list) || [];
      this.setData({
        catList: this.data.page === 1 ? list : [...this.data.catList, ...list],
        hasMore: list.length >= this.data.pageSize,
        page: this.data.page + 1,
        loading: false
      });
    } catch (e) {
      console.error('加载猫咪列表失败', e);
      this.setData({ loading: false, hasMore: false });
    }
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  async doSearch() {
    const kw = this.data.keyword.trim();
    if (!kw) {
      this.setData({ searchMode: false, page: 1, catList: [], hasMore: true });
      this.loadList();
      return;
    }
    this.setData({ loading: true, searchMode: true, catList: [] });
    try {
      const results = await api.searchCatProfiles(kw);
      this.setData({ catList: results, loading: false, hasMore: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  clearSearch() {
    this.setData({ keyword: '', searchMode: false, page: 1, catList: [], hasMore: true });
    this.loadList();
  },

  // 跳转猫咪主页
  onCatTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/cat-home/cat-home?id=${id}` });
  },

  // 去创建正式猫
  goCreateFormal() {
    wx.navigateTo({ url: '/pages/create-cat/create-cat?type=formal' });
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
