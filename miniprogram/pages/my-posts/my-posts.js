const api = require('../../utils/api.js');

Page({
  data: {
    posts: [],
    loading: true,
    empty: false,
    // Bug #19 修复：分类映射
    categoryMap: {
      stray: '流浪猫',
      pet: '家养猫',
      lost: '寻猫启事'
    }
  },

  onLoad() {
    this.loadMyPosts();
  },

  onShow() {
    // 返回时刷新数据
    this.loadMyPosts();
  },

  /**
   * 加载我发布的猫咪列表
   * Bug #09 修复：通过 api.js 调用
   */
  async loadMyPosts() {
    this.setData({ loading: true });

    try {
      const myOpenId = api.getOpenId();
      const res = await api.getMyPosts(myOpenId);

      this.setData({
        posts: res.data,
        loading: false,
        empty: res.data.length === 0
      });
    } catch (err) {
      console.error('加载我的发布失败', err);
      this.setData({ loading: false, empty: true });
    }
  },

  /**
   * 点击帖子跳转到详情
   */
  onPostTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  /**
   * 封面图片加载失败
   */
  onCoverError(e) {
    const index = e.currentTarget.dataset.index;
    const posts = [...this.data.posts];
    if (posts[index]) {
      posts[index].coverError = true;
      this.setData({ posts });
    }
  },

  /**
   * 长按删除帖子
   */
  onLongPress(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除「${name}」吗？删除后无法恢复。`,
      confirmText: '删除',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          await this._deletePost(id);
        }
      }
    });
  },

  /**
   * 删除帖子
   * Bug #10 修复：删除帖子时级联删除该帖子下的所有评论
   * Bug #09 修复：通过 api.js 调用
   */
  async _deletePost(id) {
    wx.showLoading({ title: '删除中...', mask: true });

    try {
      const post = this.data.posts.find(p => p._id === id);

      // Bug #10: 先删除该帖子下的所有评论
      await api.getDB().collection('comments').where({ catId: id }).remove();

      // 再删除帖子
      await api.deleteCat(id);

      // 删除云存储中的图片
      if (post && post.images && post.images.length > 0) {
        try {
          await wx.cloud.deleteFile({
            fileList: post.images
          });
        } catch (imgErr) {
          console.warn('删除图片失败', imgErr);
        }
      }

      wx.hideLoading();
      wx.showToast({ title: '删除成功', icon: 'success' });

      // 重新加载列表
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
