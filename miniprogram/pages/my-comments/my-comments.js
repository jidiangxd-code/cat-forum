// miniprogram/pages/my-comments/my-comments.js - 我的评论页面脚本
const api = require('../../utils/api.js');

Page({
  // 当前页面或组件依赖的响应式状态统一维护在这里。
  data: {
    comments: [],
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

  // 初始化当前页面状态并触发首屏数据加载。
  onLoad() {
    this.loadMyComments();
  },

  // 在页面重新显示时同步最新状态或刷新数据。
  onShow() {
    this._syncTheme();
    this.loadMyComments();
  },

  _syncTheme() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
  },

  // 加载当前用户发表过的评论列表。
  async loadMyComments() {
    this.setData({ loading: true });

    try {
      const openId = api.getOpenId();
      if (!openId || openId === 'guest') {
        this.setData({ comments: [], loading: false, empty: true });
        return;
      }

      const db = wx.cloud.database();
      const _ = db.command;
      // 查询我的评论
      const res = await db.collection('comments')
        .where({
          authorId: openId,
          status: _.or([_.eq('active'), _.exists(false)])
        })
        .orderBy('createTime', 'desc')
        .get();

      const comments = (res.data || []).map(c => ({
        ...c,
        timeStr: this._formatTime(c.createTime)
      }));

      // 批量关联查询帖子信息
      const postIds = [...new Set(comments.map(c => c.postId).filter(Boolean))];
      const postCache = {};
      if (postIds.length > 0) {
        const postResults = await Promise.allSettled(
          postIds.map(id => db.collection('posts').doc(id).get())
        );
        postResults.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.data) {
            postCache[postIds[i]] = r.value.data;
          }
        });
      }

      const catIds = [...new Set(comments.map(c => c.catId).filter(Boolean))];
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

      const enriched = comments.map(c => {
        const post = postCache[c.postId];
        const cat = c.catId ? catCache[c.catId] : null;
        const postContent = post ? (post.content || '') : '';
        return {
          ...c,
          cat,
          catName: cat ? (cat.fullName || cat.codeName || '未知猫咪') : '未知猫咪',
          catImage: (cat && cat.coverImage) || (post && post.images && post.images[0]) || '',
          postId: c.postId || '',
          postContent: postContent ? `${postContent.substring(0, 36)}${postContent.length > 36 ? '...' : ''}` : '帖子已删除',
          postImage: post && post.images && post.images[0] ? post.images[0] : '',
          postLocation: post ? (post.location || '') : '',
          postCategory: post ? (post.category || '') : ''
        };
      });

      this.setData({
        comments: enriched,
        loading: false,
        empty: enriched.length === 0
      });
    } catch (err) {
      console.error('加载我的评论失败', err);
      this.setData({ loading: false, empty: true });
    }
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

  // 跳转到目标帖子的详情页。
  onPostTap(e) {
    const postId = e.currentTarget.dataset.postid;
    if (!postId) {
      wx.showToast({ title: '帖子不存在', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/detail/detail?id=${postId}` });
  },

  // 跳转到评论关联的猫咪主页。
  onCatTap(e) {
    const catId = e.currentTarget.dataset.catid;
    if (!catId) {
      wx.showToast({ title: '猫咪档案不存在', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/cat-home/cat-home?id=${catId}` });
  },

  // 确认并删除当前用户的评论记录。
  async onDeleteComment(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除评论',
      content: '确定要删除这条评论吗？',
      confirmText: '删除',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.deleteComment(id);
            this.loadMyComments();
            wx.showToast({ title: '删除成功', icon: 'success' });
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 返回首页继续浏览内容。
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
