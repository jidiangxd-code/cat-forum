// pages/index/index.js - 首页（帖子流）
const api = require('../../utils/api.js');

Page({
  // 当前页面或组件依赖的响应式状态统一维护在这里。
  data: {
    // 首页核心状态：帖子列表、分页信息、主题状态和猫咪缓存统一维护在这里。
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
    },
    adUnitId: ''
  },

  // 初始化当前页面状态并触发首屏数据加载。
  onLoad() {
    // 首次进入首页时同步广告配置和主题状态，并拉取首屏帖子。
    const app = getApp();
    const adConfig = app.getAdConfig ? app.getAdConfig() : {};
    this._lastUserProfileUpdatedAt = api.getUserProfileUpdatedAt();
    this._lastOpenId = api.getOpenId();
    this.setData({
      isDarkMode: wx.getStorageSync('darkMode') || false,
      adUnitId: adConfig.indexBannerAdUnitId || ''
    });
    this.loadPosts(true);
  },

  // 在页面重新显示时同步最新状态或刷新数据。
  onShow() {
    // 每次回到首页时刷新主题状态，保证与全局主题开关一致。
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
    const currentOpenId = api.getOpenId();
    const currentUpdatedAt = api.getUserProfileUpdatedAt();
    const shouldReload =
      currentOpenId !== this._lastOpenId ||
      currentUpdatedAt !== this._lastUserProfileUpdatedAt;

    api.syncCurrentUserProfile()
      .then(userInfo => {
        const postList = (this.data.postList || []).map(post => api.applyCurrentUserProfileToPost(post, api.getOpenId(), userInfo));
        this.setData({ postList });
        if (shouldReload) {
          this._lastOpenId = currentOpenId;
          this._lastUserProfileUpdatedAt = currentUpdatedAt;
          this.setData({ page: 1, hasMore: true, postList: [] });
          this.loadPosts(true);
        }
      })
      .catch(() => null);
  },

  // 响应下拉刷新并重置列表或详情数据。
  onPullDownRefresh() {
    // 下拉刷新要重置分页游标，再重新请求第一页数据。
    this.setData({ page: 1, hasMore: true, postList: [] });
    this.loadPosts(true).then(() => wx.stopPullDownRefresh());
  },

  // 在可继续加载时触发下一页数据请求。
  onReachBottom() {
    // 到底分页只在还有更多且当前未加载时触发。
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts(false);
    }
  },

  // 加载帖子列表并维护分页、缓存和展示状态。
    async loadPosts(reset = false) {
      // 通过页面状态和实例锁双重保护，避免重复并发请求。
      if ((this._loading || this.data.loading) && !reset) return;
      this._loading = true;
      this.setData({ loading: true });

    try {
        // 先按当前排序和分页规则取帖子列表。
        const res = await api.getPostList({ page: this.data.page, pageSize: this.data.pageSize, sort: this.data.sortBy });
        const posts = res.data || [];
        const currentOpenId = api.getOpenId();
        const likedPostIds = new Set(api.getLikedPostIds(currentOpenId));

        // 批量获取未缓存的猫咪档案
        // 批量补齐当前页帖子关联的猫咪档案，并写入本地缓存。
        const catIds = [...new Set(posts.map(p => p.catId).filter(Boolean))];
      const newIds = catIds.filter(id => !this.data.catCache[id]);
      const catCache = { ...this.data.catCache };
      if (newIds.length > 0) {
        const catResults = await Promise.allSettled(
          newIds.map(id => api.getCatProfile(id))
        );
        catResults.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.data) {
            catCache[newIds[i]] = r.value.data;
          }
        });
        this.setData({ catCache });
      }

        // 合并猫咪信息到帖子
        // 把猫咪档案和格式化时间拼到帖子对象上，供视图层直接渲染。
        const enriched = posts.map(p => ({
          ...api.applyCurrentUserProfileToPost(p),
          liked: !!(
            p.liked === true ||
            likedPostIds.has(p._id) ||
            (currentOpenId && currentOpenId !== 'guest' && Array.isArray(p.likedBy) && p.likedBy.includes(currentOpenId))
          ),
          cat: catCache[p.catId] || null,
          createTimeStr: this._formatTime(p.createTime)
        }));

      this.setData({
        postList: reset ? enriched : [...this.data.postList, ...enriched],
        hasMore: posts.length >= this.data.pageSize,
        page: this.data.page + 1,
        loading: false
      });
      this._loading = false;
    } catch (e) {
      console.error('加载帖子失败', e);
      this.setData({ loading: false });
      this._loading = false;
    }
  },

  // 把时间字段格式化为相对时间或日期文案。
  _formatTime(t) {
    // 首页用相对时间文案，让信息流阅读更轻量。
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
    // 点赞先做本地乐观更新，失败后再回滚。
    const { id, liked } = e.currentTarget.dataset;
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先去“我的”里登录后再点赞', icon: 'none' });
      return;
    }
    const idx = this.data.postList.findIndex(p => p._id === id);
    if (idx === -1) return;
    if (this._likingPostId === id) return;
    this._likingPostId = id;
    const list = [...this.data.postList];
    const oldLikeCount = Number(list[idx].likeCount || 0);
    list[idx] = {
      ...list[idx],
      liked: !liked,
      likeCount: Math.max(0, liked ? (oldLikeCount - 1) : (oldLikeCount + 1))
    };
    this.setData({ postList: list });
    api.togglePostLike(id, openid, !liked)
      .then(result => {
        const nextList = [...this.data.postList];
        const nextIdx = nextList.findIndex(p => p._id === id);
        if (nextIdx === -1) return;
        nextList[nextIdx] = {
          ...nextList[nextIdx],
          liked: !!result?.data?.liked,
          likeCount: Math.max(0, Number(result?.data?.likeCount || 0))
        };
        this.setData({ postList: nextList });
      })
      .catch(err => {
        const rollbackList = [...this.data.postList];
        const rollbackIdx = rollbackList.findIndex(p => p._id === id);
        if (rollbackIdx !== -1) {
          rollbackList[rollbackIdx] = {
            ...rollbackList[rollbackIdx],
            liked,
            likeCount: oldLikeCount
          };
          this.setData({ postList: rollbackList });
        }
        wx.showToast({ title: (err && err.message) || '点赞失败', icon: 'none' });
      })
      .finally(() => {
        this._likingPostId = '';
      });
  },

  // 打开图片预览器查看当前大图。
  previewImage(e) {
    // 首页图片点击只负责调起系统预览，不改变页面业务状态。
    const { images, index } = e.currentTarget.dataset;
    wx.previewImage({ current: images[index], urls: images });
  },

  // 跳转到发帖页面。
  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  },

  // 跳转到猫咪榜单或发现页面。
  goCatList() {
    try {
      wx.setStorageSync('catListInitialTab', 'rank_total');
    } catch (e) {}
    wx.switchTab({ url: '/pages/cat-list/cat-list' });
  },

  // 搜索
  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  },

  // 排序切换
  switchSort(e) {
    // 切换最新/热门时清空旧列表并从第一页重载。
    const sort = e.currentTarget.dataset.sort;
    if (sort === this.data.sortBy) return;
    this.setData({ sortBy: sort, page: 1, hasMore: true, postList: [] });
    this.loadPosts(true);
  },

  // 深色模式切换
  toggleDarkMode() {
    // 主题切换既更新当前页，也同步到页面栈和全局 app。
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
