// pages/cat-home/cat-home.js - 猫咪专属主页
const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    // 主题
    pageClass: theme.getPageClass(),
    themeId: theme.getThemeId(),
    // 内容
    catId: '',
    cat: null,
    posts: [],
    loading: true,
    postsLoading: false,
    hasMorePosts: true,
    postsPage: 1,
    // 投票状态
    voted: false,         // 今日是否已投票
    votedCatId: null,     // 今日投了哪只
    voteLoading: false,
    // 性别文字映射
    genderMap: { male: '♂ 公', female: '♀ 母', unknown: '性别未知' },
    statusMap: { active: '活跃', lost: '走失', adopted: '已领养' },
    statusColorMap: { active: '#4CAF50', lost: '#FF9800', adopted: '#2196F3' }
  },

  onLoad(options) {
    theme.applyTheme(this);
    if (options.id) {
      this.setData({ catId: options.id });
      this.loadAll();
    }
  },

  onPullDownRefresh() {
    this.setData({ postsPage: 1, hasMorePosts: true, posts: [] });
    this.loadAll().then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMorePosts && !this.data.postsLoading) {
      this.loadMorePosts();
    }
  },

  async loadAll() {
    this.setData({ loading: true, posts: [], postsPage: 1, hasMorePosts: true });
    await Promise.all([
      this.loadCatProfile(),
      this.loadTodayVote()
    ]);
    await this.loadPosts(true);
    this.setData({ loading: false });
  },

  async loadCatProfile() {
    try {
      const res = await api.getCatProfile(this.data.catId);
      const cat = res.data;
      if (!cat) return;
      this.setData({ cat });
      wx.setNavigationBarTitle({ title: cat.fullName || cat.codeName || '猫咪主页' });
    } catch (e) {
      console.error('加载档案失败', e);
    }
  },

  async loadTodayVote() {
    try {
      const voteRecord = await api.getTodayVote();
      this.setData({
        voted: !!voteRecord,
        votedCatId: voteRecord ? voteRecord.catId : null
      });
    } catch (e) {}
  },

  async loadPosts(reset = false) {
    if (reset) {
      this.setData({ postsPage: 1, posts: [], hasMorePosts: true });
    }
    this.setData({ postsLoading: true });
    try {
      const res = await api.getCatPosts(this.data.catId, this.data.postsPage, 10);
      const list = (res.data || []).map(p => ({
        ...p,
        createTimeStr: this._formatTime(p.createTime)
      }));
      this.setData({
        posts: reset ? list : [...this.data.posts, ...list],
        hasMorePosts: list.length >= 10,
        postsPage: this.data.postsPage + 1,
        postsLoading: false
      });
    } catch (e) {
      this.setData({ postsLoading: false, hasMorePosts: false });
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

  async loadMorePosts() {
    if (!this.data.hasMorePosts || this.data.postsLoading) return;
    await this.loadPosts(false);
  },

  // ===== 投票 =====
  async doVote() {
    if (this.data.voted) {
      wx.showToast({ title: '今日已投过票啦 🐱', icon: 'none' });
      return;
    }
    if (this.data.voteLoading) return;

    this.setData({ voteLoading: true });
    try {
      await api.voteCat(this.data.catId);
      // 更新本地票数
      const cat = { ...this.data.cat, totalVote: (this.data.cat.totalVote || 0) + 1 };
      this.setData({ cat, voted: true, votedCatId: this.data.catId, voteLoading: false });
      wx.showToast({ title: '投票成功 🎉', icon: 'success' });
    } catch (e) {
      this.setData({ voteLoading: false });
      const msg = (e && e.message) || '投票失败';
      wx.showToast({ title: msg, icon: 'none' });
    }
  },

  // ===== 跳转帖子详情 =====
  onPostTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // ===== 功能按钮 =====
  goPromote() {
    wx.navigateTo({ url: `/pages/promote-cat/promote-cat?id=${this.data.catId}` });
  },
  goEdit() {
    wx.navigateTo({ url: `/pages/create-cat/create-cat?id=${this.data.catId}&mode=edit` });
  },
  goMerge() {
    wx.navigateTo({ url: `/pages/merge-cat/merge-cat?id=${this.data.catId}` });
  },

  // 预览图片
  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    const urls = (this.data.cat && this.data.cat.coverImage) ? [this.data.cat.coverImage] : [];
    wx.previewImage({ current: src, urls: urls.length ? urls : [src] });
  },

  // 预览帖子图片
  previewPostImage(e) {
    const { images, index } = e.currentTarget.dataset;
    wx.previewImage({ current: images[index], urls: images });
  }
});
