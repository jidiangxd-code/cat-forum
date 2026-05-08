const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    themeId: theme.getThemeId(),
    pageClass: theme.getPageClass(),
    posts: [],
    loading: true,
    empty: false,
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
    theme.applyTheme(this);
    this.loadMyPosts();
  },

  onShow() {
    this.loadMyPosts();
  },

  async loadMyPosts() {
    this.setData({ loading: true });

    try {
      const openId = api.getOpenId();
      if (!openId || openId === 'guest') {
        this.setData({ posts: [], loading: false, empty: true });
        return;
      }

      const db = wx.cloud.database();
      const res = await db.collection('posts')
        .where({ authorId: openId })
        .orderBy('createTime', 'desc')
        .get();

      const posts = (res.data || []).map(p => ({
        ...p,
        timeStr: this._formatTime(p.createTime)
      }));

      this.setData({
        posts,
        loading: false,
        empty: posts.length === 0
      });
    } catch (err) {
      console.error('加载我的发布失败', err);
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
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  onCoverError(e) {
    const index = e.currentTarget.dataset.index;
    const posts = [...this.data.posts];
    if (posts[index]) {
      posts[index].coverError = true;
      this.setData({ posts });
    }
  },

  onLongPress(e) {
    const id = e.currentTarget.dataset.id;
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

  async _deletePost(id) {
    wx.showLoading({ title: '删除中...', mask: true });

    try {
      const post = this.data.posts.find(p => p._id === id);
      const db = wx.cloud.database();

      // 先删除该帖子下的所有评论
      const commentsRes = await db.collection('comments')
        .where({ postId: id })
        .get();
      if (commentsRes.data && commentsRes.data.length > 0) {
        const deletePromises = commentsRes.data.map(c =>
          db.collection('comments').doc(c._id).remove()
        );
        await Promise.all(deletePromises);
      }

      // 删除帖子
      await db.collection('posts').doc(id).remove();

      // 删除云存储中的图片
      if (post && post.images && post.images.length > 0) {
        try {
          await wx.cloud.deleteFile({ fileList: post.images });
        } catch (imgErr) {
          console.warn('删除图片失败', imgErr);
        }
      }

      wx.hideLoading();
      wx.showToast({ title: '删除成功', icon: 'success' });
      this.loadMyPosts();
    } catch (err) {
      wx.hideLoading();
      console.error('删除失败', err);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  }
});
