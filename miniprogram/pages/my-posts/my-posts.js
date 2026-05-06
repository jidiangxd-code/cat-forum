// miniprogram/pages/my-posts/my-posts.js - 我的发布页面脚本
const api = require('../../utils/api.js');

Page({
  // “我的发布”页主要维护帖子列表、空状态和类目文案映射。
  data: {
    posts: [],
    loading: true,
    empty: false,
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

  // 首次进入页面时拉取当前用户发过的帖子。
  onLoad() {
    this.loadMyPosts();
  },

  // 从详情页或发布页返回后重新刷新，保证列表内容最新。
  onShow() {
    this._syncTheme();
    api.syncCurrentUserProfile().catch(() => null);
    this.loadMyPosts();
  },

  _syncTheme() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
  },

  // 读取当前用户发布的帖子，并补上用于展示的时间文案。
  async loadMyPosts() {
    this.setData({ loading: true });

    try {
      const openId = api.getOpenId();
      if (!openId || openId === 'guest') {
        this.setData({ posts: [], loading: false, empty: true });
        return;
      }

      const db = wx.cloud.database();
      const _ = db.command;
      const ownerQueries = [
        { authorId: openId },
        { createdBy: openId },
        { openid: openId },
        { openId },
        { userOpenid: openId }
      ];

      const queryResults = await Promise.allSettled(
        ownerQueries.map(query =>
          db.collection('posts')
            .where({
              ...query,
              status: _.or([_.eq('active'), _.exists(false)])
            })
            .orderBy('createTime', 'desc')
            .get()
        )
      );

      const postMap = {};
      queryResults.forEach(result => {
        if (result.status === 'fulfilled') {
          (result.value.data || []).forEach(post => {
            postMap[post._id] = api.applyCurrentUserProfileToPost(post, openId);
          });
        }
      });

      const posts = Object.values(postMap).sort((a, b) => {
        const aTime = new Date(a.createTime || 0).getTime();
        const bTime = new Date(b.createTime || 0).getTime();
        return bTime - aTime;
      });

      const catIds = [...new Set(posts.map(post => post.catId).filter(Boolean))];
      const catMap = {};
      if (catIds.length > 0) {
        const catResults = await Promise.allSettled(catIds.map(id => api.getCatProfile(id)));
        catResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.data) {
            catMap[catIds[index]] = result.value.data;
          }
        });
      }

      const displayPosts = posts.map(post => {
        const cat = catMap[post.catId] || null;
        const content = String(post.content || post.description || '').trim();
        const displayTitle = cat
          ? (cat.fullName || cat.codeName || '我的帖子')
          : (content ? `${content.slice(0, 18)}${content.length > 18 ? '...' : ''}` : '我的帖子');

        return {
          ...post,
          cat,
          timeStr: this._formatTime(post.createTime),
          displayTitle,
          displayContent: content || '这条发布还没有补充描述'
        };
      });

      this.setData({
        posts: displayPosts,
        loading: false,
        empty: displayPosts.length === 0
      });
    } catch (err) {
      console.error('加载我的发布失败', err);
      this.setData({ loading: false, empty: true });
    }
  },

  // 把帖子创建时间整理成“刚刚 / x分钟前 / 月日”的列表文案。
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

  // 点击卡片后跳转到对应帖子详情。
  onPostTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 某条帖子封面加载失败时，只给该卡片切换默认图片。
  onCoverError(e) {
    const index = e.currentTarget.dataset.index;
    const posts = [...this.data.posts];
    if (posts[index]) {
      posts[index].coverError = true;
      this.setData({ posts });
    }
  },

  // 长按卡片时弹出删除确认框，作为“我的发布”的管理入口。
  onLongPress(e) {
    const id = e.currentTarget.dataset.id;
    this._confirmDeletePost(id);
  },

  // 右上角删除按钮与长按共用同一套确认逻辑，降低模拟器长按失败的影响。
  onDeleteTap(e) {
    const id = e.currentTarget.dataset.id;
    this._confirmDeletePost(id);
  },

  _confirmDeletePost(id) {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这篇帖子吗？删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          await this._deletePost(id);
        }
      }
    });
  },

  // 真正调用删除接口，并在成功后重新拉取列表。
  async _deletePost(id) {
    wx.showLoading({ title: '删除中...', mask: true });

    try {
      await api.deletePost(id);
      wx.hideLoading();
      wx.showToast({ title: '删除成功', icon: 'success' });
      this.loadMyPosts();
    } catch (err) {
      wx.hideLoading();
      console.error('删除失败', err);
      wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' });
    }
  },

  // 空状态下引导用户直接去发新帖子。
  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  }
});
