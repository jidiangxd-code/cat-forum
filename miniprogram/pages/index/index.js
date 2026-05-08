// pages/index/index.js - 首页（帖子流）
const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    // 主题
    pageClass: theme.getPageClass(),
    themeId: theme.getThemeId(),
    themeName: theme.getCurrent().name,
    themeIcon: theme.getCurrent().icon,
    // 内容
    postList: [],
    loading: true,
    hasMore: true,
    page: 1,
    pageSize: 15,
    // 猫咪档案缓存（catId -> cat）
    catCache: {},
    // 用户信息缓存（authorId -> user）
    authorCache: {},
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
    // 应用当前主题
    const current = theme.getCurrentId();
    this.setData({ pageClass: 'page theme-' + current, themeId: current, themeName: theme.getCurrent().name, themeIcon: theme.getCurrent().icon });
    // 监听主题变化
    theme.onChange((t) => this.setData({ pageClass: 'page theme-' + t.id, themeId: t.id, themeName: t.name, themeIcon: t.icon }));
    this.loadPosts(true);
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
    if (this._loading) return;
    this._loading = true;
    this.setData({ loading: true });

    try {
      const res = await api.getPostList({ page: this.data.page, pageSize: this.data.pageSize });
      const posts = res.data || [];

      // 批量获取未缓存的猫咪档案
      const catIds = [...new Set(posts.map(p => p.catId).filter(Boolean))];
      const newCatIds = catIds.filter(id => !this.data.catCache[id]);
      if (newCatIds.length > 0) {
        const catResults = await Promise.allSettled(
          newCatIds.map(id => api.getCatProfile(id))
        );
        const newCatCache = { ...this.data.catCache };
        catResults.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.data) {
            newCatCache[newCatIds[i]] = r.value.data;
          }
        });
        this.setData({ catCache: newCatCache });
      }

      // 批量获取缺失作者信息的用户数据
      const authorIds = [...new Set(
        posts
          .filter(p => !p.authorName && p.authorId)
          .map(p => p.authorId)
      )];
      const newAuthorIds = authorIds.filter(id => !this.data.authorCache[id]);
      if (newAuthorIds.length > 0) {
        const db = wx.cloud.database();
        const authorResults = await Promise.allSettled(
          newAuthorIds.map(id =>
            db.collection('users').where({ openid: id }).limit(1).get()
          )
        );
        const newAuthorCache = { ...this.data.authorCache };
        authorResults.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.data && r.value.data.length > 0) {
            const user = r.value.data[0];
            newAuthorCache[newAuthorIds[i]] = {
              nickName: user.nickName || '匿名用户',
              avatar: user.avatar || ''
            };
          } else {
            newAuthorCache[newAuthorIds[i]] = { nickName: '匿名用户', avatar: '' };
          }
        });
        this.setData({ authorCache: newAuthorCache });
      }

      // 合并猫咪信息和作者信息到帖子
      const enriched = posts.map(p => {
        const cat = this.data.catCache[p.catId] || null;
        // 优先用帖子自带的 authorName/authorAvatar，没有则从缓存查
        let authorName = p.authorName;
        let authorAvatar = p.authorAvatar;
        if (!authorName && p.authorId && this.data.authorCache[p.authorId]) {
          authorName = this.data.authorCache[p.authorId].nickName;
          authorAvatar = this.data.authorCache[p.authorId].avatar;
        }
        return {
          ...p,
          cat,
          authorName: authorName || '匿名用户',
          authorAvatar: authorAvatar || '',
          createTimeStr: this._formatTime(p.createTime)
        };
      });

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

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' });
  }
});
