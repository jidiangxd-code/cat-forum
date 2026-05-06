// miniprogram/pages/my-likes/my-likes.js - 我的喜欢页面脚本
const api = require('../../utils/api.js');

Page({
  // 当前页面或组件依赖的响应式状态统一维护在这里。
  data: {
    likes: [],
    loading: true,
    empty: false,
    isDarkMode: wx.getStorageSync('darkMode') || false
  },

  // 初始化当前页面状态并触发首屏数据加载。
  onLoad() {
    this.loadMyLikes();
  },

  // 在页面重新显示时同步最新状态或刷新数据。
  onShow() {
    this._syncTheme();
    this.loadMyLikes();
  },

  _syncTheme() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
  },

  // 加载当前用户点赞过的帖子列表。
    async loadMyLikes() {
      this.setData({ loading: true });

      try {
        const openId = api.getOpenId();
        if (!openId || openId === 'guest') {
          this.setData({ likes: [], loading: false, empty: true });
          return;
        }

        const cachedLikedIds = api.getLikedPostIds(openId);
        const cloudLikes = await this._loadCloudLikedPosts(openId);
        const cachedLikes = cachedLikedIds.length > 0
          ? await this._loadLikedPostsByIds(cachedLikedIds)
          : [];

        let likes = this._mergeLikes(cloudLikes, cachedLikes);

        if (likes.length === 0 && cachedLikedIds.length === 0) {
          likes = [];
        }

        likes = likes
          .filter(item => item && item._id)
          .sort((a, b) => new Date(b.createTime || 0).getTime() - new Date(a.createTime || 0).getTime())
          .map(p => ({
          ...p,
          timeStr: this._formatTime(p.createTime)
        }));

      if (likes.length > 0) {
        api.syncLikedPostIds(likes.map(item => item._id), openId);
      }

      // 页面优先展示关联猫咪信息，不足时再回退到帖子内容和帖子封面。
      const catIds = [...new Set(likes.map(item => item.catId).filter(Boolean))];
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

      const enrichedLikes = likes.map(item => {
        const cat = item.catId ? catCache[item.catId] : null;
        const contentPreview = (item.content || '').replace(/\s+/g, ' ').trim();
        return {
          ...item,
          cat,
          displayName: cat ? (cat.fullName || cat.codeName || '未知猫咪') : (contentPreview.slice(0, 12) || '未命名帖子'),
          displayLocation: cat ? (cat.location || item.location || '地点未知') : (item.location || '地点未知'),
          coverImage: (item.images && item.images[0]) || (cat && cat.coverImage) || '/assets/images/default-cat.png'
        };
      });

      this.setData({
        likes: enrichedLikes,
        loading: false,
        empty: enrichedLikes.length === 0
      });
    } catch (err) {
      console.error('加载我的喜欢失败', err);
      this.setData({ loading: false, empty: true });
      }
    },

    // 已登录场景优先以云端 likedBy 结果为准，再回退到扫描兜底。
    async _loadCloudLikedPosts(openId) {
      let likes = await this._loadLikedPostsByQuery(openId);
      if (likes.length === 0) {
        likes = await this._loadLikedPostsByScan(openId);
      }
      return likes;
    },

    // 合并云端结果和本地缓存结果，避免本地缓存短暂缺失造成“我的喜欢”空白。
    _mergeLikes(primary = [], secondary = []) {
      const postMap = {};
      [...primary, ...secondary].forEach(item => {
        if (item && item._id && item.status !== 'deleted') {
          postMap[item._id] = item;
        }
      });
      return Object.values(postMap);
    },

  // 优先按本地记录的已点赞帖子 ID 取详情，避免完全依赖数组查询行为。
  async _loadLikedPostsByIds(ids = []) {
    const validIds = [...new Set(ids.filter(id => typeof id === 'string' && id))];
    if (validIds.length === 0) return [];

    const db = wx.cloud.database();
    const _ = db.command;
    const chunks = [];
    for (let i = 0; i < validIds.length; i += 20) {
      chunks.push(validIds.slice(i, i + 20));
    }

    const results = await Promise.allSettled(
      chunks.map(chunk => db.collection('posts').where({ _id: _.in(chunk) }).get())
    );

    const postMap = {};
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        (result.value.data || []).forEach(item => {
          if (item && item._id && item.status !== 'deleted') {
            postMap[item._id] = item;
          }
        });
      }
    });

    return validIds.map(id => postMap[id]).filter(Boolean);
  },

  // 优先直接按 likedBy 查询我的点赞内容；这里不做 orderBy，减少索引依赖。
  async _loadLikedPostsByQuery(openId) {
    const db = wx.cloud.database();
    const _ = db.command;
    const res = await db.collection('posts')
      .where({
        likedBy: _.all([openId])
      })
      .get();

    return (res.data || []).filter(item => item.status !== 'deleted');
  },

  // 如果直接查询命不中，再扫描最近帖子兜底，兼容数组查询或索引异常场景。
  async _loadLikedPostsByScan(openId) {
    const db = wx.cloud.database();
    const _ = db.command;
    const batchSize = 100;
    const maxScan = 300;
    const collected = [];

    for (let skip = 0; skip < maxScan; skip += batchSize) {
      const res = await db.collection('posts')
        .where({
          status: _.or([_.eq('active'), _.exists(false)])
        })
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(batchSize)
        .get();

      const batch = res.data || [];
      if (batch.length === 0) {
        break;
      }

      batch.forEach(item => {
        if (Array.isArray(item.likedBy) && item.likedBy.includes(openId)) {
          collected.push(item);
        }
      });

      if (batch.length < batchSize) {
        break;
      }
    }

    return collected;
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

  // 处理点赞按钮点击或跳转到目标内容。
  onLikeTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 取消喜欢记录并刷新本地列表。
  async onUnlike(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消喜欢',
      content: '确定要取消喜欢这条内容吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const openId = api.getOpenId();
            await api.togglePostLike(id, openId, false);
            this.loadMyLikes();
            wx.showToast({ title: '已取消', icon: 'success' });
          } catch (err) {
            const likes = this.data.likes.filter(item => item._id !== id);
            this.setData({ likes, empty: likes.length === 0 });
            wx.showToast({ title: '已取消', icon: 'success' });
          }
        }
      }
    });
  },

  // 返回首页继续浏览内容。
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 封面图加载失败时回退到默认图片。
  onCoverError(e) {
    const index = Number(e.currentTarget.dataset.index);
    const likes = [...this.data.likes];
    if (!likes[index]) return;
    likes[index].coverError = true;
    this.setData({ likes });
  }
});
