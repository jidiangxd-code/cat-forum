<<<<<<< Updated upstream
// pages/notifications/notifications.js - 消息通知页
const api = require('../../utils/api.js');

Page({
  data: {
    loading: true,
    loadingMore: false,
    list: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    unreadCount: 0,
    activeTab: 'all',
    tabs: [
      { label: '全部', type: 'all' },
      { label: '获赞', type: 'like' },
      { label: '评论', type: 'comment' },
      { label: '关注', type: 'follow' }
    ]
  },

  onLoad() {
    this.loadNotifications();
    this.loadUnreadCount();
  },

  onShow() {
    // 每次进入刷新未读数
    this.loadUnreadCount();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, list: [] });
    Promise.all([
      this.loadNotifications(true),
      this.loadUnreadCount()
    ]).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.setData({ loadingMore: true });
      this.loadNotifications(false, this.data.page + 1)
        .finally(() => this.setData({ loadingMore: false }));
    }
  },

  // 加载通知列表
  async loadNotifications(refresh = false, page = 1) {
    if (refresh) this.setData({ loading: true });
    try {
      const typeMap = {
        all: '',
        like: 'like',
        comment: 'comment',
        follow: 'follow'
      };
      const res = await wx.cloud.callFunction({
        name: 'getNotifications',
        data: {
          page,
          pageSize: this.data.pageSize,
          type: typeMap[this.data.activeTab]
        }
      });

      if (res.result && res.result.success) {
        const newList = res.result.data.list || [];
        this.setData({
          list: refresh || page === 1 ? newList : [...this.data.list, ...newList],
          hasMore: res.result.data.hasMore,
          page: page,
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('加载通知失败', err);
      this.setData({ loading: false });
    }
  },

  // 加载未读数
  async loadUnreadCount() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getNotifications',
        data: { page: 1, pageSize: 1 }
      });
      if (res.result && res.result.success) {
        this.setData({ unreadCount: res.result.data.unreadCount || 0 });
        // 同步更新 tabBar 角标
        if (res.result.data.unreadCount > 0) {
          wx.setTabBarBadge({
            index: 3,
            text: String(res.result.data.unreadCount > 99 ? '99+' : res.result.data.unreadCount)
          }).catch(() => {});
        } else {
          wx.removeTabBarBadge({ index: 3 }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('获取未读数失败', err);
    }
  },

  // Tab 切换
  switchTab(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.activeTab) return;
    this.setData({ activeTab: type, page: 1, list: [], hasMore: true });
    this.loadNotifications(true);
  },

  // 点击通知
  async onNotificationTap(e) {
    const item = e.currentTarget.dataset.item;

    // 标记已读
    if (!item.read) {
      try {
        await wx.cloud.callFunction({
          name: 'markNotificationRead',
          data: { notificationId: item._id }
        });
        item.read = true;
        this.setData({ unreadCount: Math.max(0, this.data.unreadCount - 1) });
        if (this.data.unreadCount <= 0) {
          wx.removeTabBarBadge({ index: 3 }).catch(() => {});
        }
      } catch (err) {
        console.error('标记已读失败', err);
      }
    }

    // 跳转到对应页面
    if (item.postId) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${item.postId}` });
    } else if (item.catId) {
      wx.navigateTo({ url: `/pages/cat-home/cat-home?id=${item.catId}` });
    }
  },

  // 全部已读
  async markAllRead() {
    try {
      wx.showLoading({ title: '处理中...' });
      await wx.cloud.callFunction({
        name: 'markNotificationRead',
        data: { markAll: true }
      });
      wx.hideLoading();
      wx.showToast({ title: '已全部已读', icon: 'success' });
      // 更新本地状态
      const updatedList = this.data.list.map(n => ({ ...n, read: true }));
      this.setData({ list: updatedList, unreadCount: 0 });
      wx.removeTabBarBadge({ index: 3 }).catch(() => {});
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败', icon: 'none' });
      console.error('全部已读失败', err);
    }
  },

  // 通知文本映射
  getNotifText(type) {
    const map = {
      like_post: '赞了你的帖子',
      like_cat: '赞了你的猫咪',
      comment: '评论了你的帖子',
      reply: '回复了你',
      follow: '关注了你',
      system: '系统通知'
    };
    return map[type] || '有新动态';
  },

  // 图片加载失败
  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    if (index !== undefined) {
      const list = [...this.data.list];
      list[index].coverImage = '';
      this.setData({ list });
    }
  },

  // 下拉刷新回调（兼容写法）
  onRefresh() {
    this.onPullDownRefresh();
  }
});
=======
// pages/notifications/notifications.js
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})
>>>>>>> Stashed changes
