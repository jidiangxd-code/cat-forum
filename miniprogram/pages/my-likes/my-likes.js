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

  /**
   * 加载我喜欢的猫咪列表
   * Bug #09 修复：通过 api.js 调用
   */
  async loadMyLikes() {
    this.setData({ loading: true });

    try {
      const myOpenId = api.getOpenId();
      const res = await api.getMyLikes(myOpenId);

      this.setData({
        likes: res.data,
        loading: false,
        empty: res.data.length === 0
      });
    } catch (err) {
      console.error('加载我的喜欢失败', err);
      this.setData({ loading: false, empty: true });
    }
  },

  /**
   * 点击跳转到详情
   */
  onLikeTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  /**
   * 取消喜欢
   */
  async onUnlike(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '取消喜欢',
      content: '确定要取消喜欢这只小猫吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.toggleLike(id, api.getOpenId(), false);
            this.loadMyLikes();
            wx.showToast({ title: '已取消', icon: 'success' });
          } catch (err) {
            // 本地移除
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
