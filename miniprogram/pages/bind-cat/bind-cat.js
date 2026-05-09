// pages/bind-cat/bind-cat.js - 帖子绑定猫咪选择页
const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    pageClass: theme.getPageClass(),
    themeId: theme.getThemeId(),
    postId: '',
    currentCatId: '',     // 当前帖子已绑定的猫（用于高亮）
    currentCatName: '',   // 当前绑定的猫名（提示用）
    tabs: [
      { id: 'all', name: '全部猫咪' },
      { id: 'formal', name: '正式猫' },
      { id: 'unknown', name: '未知猫' }
    ],
    currentTab: 'all',
    catList: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    keyword: '',
    searchMode: false,
    binding: false         // 绑定操作中
  },

  onLoad(options) {
    theme.applyTheme(this);
    if (options.postId) {
      this.setData({ postId: options.postId });
    }
    if (options.currentCatId) {
      this.setData({ currentCatId: options.currentCatId });
    }
    if (options.currentCatName) {
      this.setData({ currentCatName: decodeURIComponent(options.currentCatName) });
    }
    wx.setNavigationBarTitle({ title: '选择猫咪' });
    this.loadList();
  },

  onShow() {
    theme._updateNavBar(theme.getCurrent());
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

  // ==================== Tab切换 ====================

  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab, page: 1, catList: [], hasMore: true, keyword: '', searchMode: false });
    this.loadList();
  },

  // ==================== 加载列表 ====================

  async loadList() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      let mode = this.data.currentTab;
      // 未知猫tab用 unknown_list，其他用 list
      if (mode === 'unknown') mode = 'unknown_list';
      if (mode === 'formal') mode = 'list'; // 正式猫在 list 里返回的，前端过滤
      if (mode === 'all') mode = 'list';

      const res = await api.getCatProfileList({
        mode: mode,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      let list = (res.data && res.data.list) || [];
      // 前端过滤正式猫/全部
      if (this.data.currentTab === 'formal') {
        list = list.filter(c => c.catType === 'formal');
      }

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

  // ==================== 搜索 ====================

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

  // ==================== 选择猫咪 ====================

  async selectCat(e) {
    const catId = e.currentTarget.dataset.id;
    const catName = e.currentTarget.dataset.name;

    // 如果选的是当前已绑定的猫，提示无需重复绑定
    if (catId === this.data.currentCatId) {
      wx.showToast({ title: '已绑定此猫咪', icon: 'none' });
      return;
    }

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认绑定',
        content: `将帖子绑定到「${catName}」？`,
        confirmText: '确认绑定',
        confirmColor: '#4CAF50',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) return;

    this.setData({ binding: true });
    try {
      await api.callCloud('publishPost', {
        action: 'updateCatId',
        postId: this.data.postId,
        newCatId: catId
      });
      wx.showToast({ title: '绑定成功 ✅', icon: 'success' });
      // 返回详情页
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (err) {
      console.error('绑定失败', err);
      wx.showToast({ title: err.message || '绑定失败', icon: 'none' });
    } finally {
      this.setData({ binding: false });
    }
  },

  // ==================== 创建新猫咪 ====================

  goCreateCat() {
    wx.navigateTo({
      url: `/pages/create-cat/create-cat?bindPostId=${this.data.postId}`
    });
  },

  // ==================== 取消关联 ====================

  async unbindCat() {
    const catName = this.data.currentCatName || '这只猫';
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '取消关联',
        content: `确定将帖子从「${catName}」取消关联吗？\n\n帖子将变为"未归档"状态。`,
        confirmText: '取消关联',
        confirmColor: '#f44336',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false)
      });
    });
    if (!confirmed) return;

    this.setData({ binding: true });
    try {
      await api.callCloud('publishPost', {
        action: 'unbindCat',
        postId: this.data.postId
      });
      wx.showToast({ title: '已取消关联', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
    } catch (err) {
      console.error('取消关联失败', err);
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ binding: false });
    }
  }
});
