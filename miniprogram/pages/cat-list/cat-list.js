// pages/cat-list/cat-list.js - 猫咪档案列表页（含排行榜）
const api = require('../../utils/api.js');

Page({
  data: {
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
    this.loadList();
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
  }
});
