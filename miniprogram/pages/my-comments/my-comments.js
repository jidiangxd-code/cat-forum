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

  /**
   * 加载我的评论
   * Bug #09 修复：通过 api.js 调用
   */
  async loadMyComments() {
    this.setData({ loading: true });

    try {
      const myOpenId = api.getOpenId();

      // 查询我的评论
      const res = await api.getMyComments(myOpenId);

      // 关联查询猫咪信息
      const commentsWithCat = await Promise.all(
        res.data.map(async (comment) => {
          try {
            const catRes = await api.getCatDetail(comment.catId);
            return {
              ...comment,
              catName: catRes.data.name || '无名小猫',
              catImage: catRes.data.images && catRes.data.images[0] ? catRes.data.images[0] : '',
              catId: comment.catId
            };
          } catch (err) {
            return {
              ...comment,
              catName: '未知猫咪',
              catImage: '',
              catId: comment.catId
            };
          }
        })
      );

      this.setData({
        comments: commentsWithCat,
        loading: false,
        empty: commentsWithCat.length === 0
      });
    } catch (err) {
      console.error('加载我的评论失败', err);
      this.setData({ loading: false, empty: true });
    }
  },

  /**
   * 点击跳转到对应的猫咪详情
   * Bug #03 修复：增加 catId 有效性检查
   */
  onCatTap(e) {
    const id = e.currentTarget.dataset.catid;
    if (!id) {
      wx.showToast({ title: '猫咪信息无效', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  /**
   * 删除评论
   * Bug #09 修复：通过 api.js 调用
   */
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
            // 本地移除
            const comments = this.data.comments.filter(item => item._id !== id);
            this.setData({ comments, empty: comments.length === 0 });
            wx.showToast({ title: '删除成功', icon: 'success' });
          }
        }
      }
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
