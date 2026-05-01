const api = require('../../utils/api.js');

Page({
  data: {
    likes: [],
    loading: true,
    empty: false
  },

  onLoad() {
    this.loadMyLikes();
  },

  onShow() {
    this.loadMyLikes();
  },

  async loadMyLikes() {
    this.setData({ loading: true });

    try {
      const openId = api.getOpenId();
      if (!openId || openId === 'guest') {
        this.setData({ likes: [], loading: false, empty: true });
        return;
      }

      const db = wx.cloud.database();
      // 查询我点赞过的帖子
      const res = await db.collection('posts')
        .where({ likedBy: openId })
        .orderBy('createTime', 'desc')
        .get();

      const likes = (res.data || []).map(p => ({
        ...p,
        timeStr: this._formatTime(p.createTime)
      }));

      this.setData({
        likes,
        loading: false,
        empty: likes.length === 0
      });
    } catch (err) {
      console.error('加载我的喜欢失败', err);
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

  onLikeTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  async onUnlike(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消喜欢',
      content: '确定要取消喜欢这篇帖子吗？',
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

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
