const api = require('../../utils/api.js');

Page({
  data: {
    comments: [],
    loading: true,
    empty: false
  },

  onLoad() {
    this.loadMyComments();
  },

  onShow() {
    this.loadMyComments();
  },

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

      const enriched = comments.map(c => {
        const post = postCache[c.postId];
        return {
          ...c,
          postContent: post ? (post.content || '').substring(0, 30) : '帖子已删除',
          postImage: post && post.images && post.images[0] ? post.images[0] : ''
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

  onPostTap(e) {
    const postId = e.currentTarget.dataset.postid;
    if (!postId) {
      wx.showToast({ title: '帖子不存在', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/detail/detail?id=${postId}` });
  },

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

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
