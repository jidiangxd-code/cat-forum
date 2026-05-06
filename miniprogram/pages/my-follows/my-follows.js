// miniprogram/pages/my-follows/my-follows.js - 关注关系页面脚本
const api = require('../../utils/api.js');

Page({
  // 当前页面或组件依赖的响应式状态统一维护在这里。
  data: {
    type: 'following', // 'following' | 'followers'
    list: [],
    loading: true,
    hasMore: false,
    page: 1,
    pageSize: 20,
    emptyText: '暂无关注',
    isDarkMode: wx.getStorageSync('darkMode') || false
  },

  // 初始化当前页面状态并触发首屏数据加载。
  onLoad(options) {
    const type = options.type || 'following';
    this.setData({
      type,
      emptyText: type === 'following' ? '还没有关注任何人' : '还没有粉丝'
    });
    wx.setNavigationBarTitle({
      title: type === 'following' ? '我的关注' : '我的粉丝'
    });
    this.loadList();
  },

  // 在页面重新显示时同步最新状态或刷新数据。
  onShow() {
    // 每次回来刷新
    this._syncTheme();
  },

  _syncTheme() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
  },

  // 按当前标签、分页和模式加载列表数据。
  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await api.getFollowList(this.data.type, this.data.page, this.data.pageSize);
      const newList = res.success ? res.data : [];
      this.setData({
        list: this.data.page === 1 ? newList : [...this.data.list, ...newList],
        hasMore: newList.length >= this.data.pageSize,
        loading: false
      });
    } catch (err) {
      console.error('加载列表失败', err);
      this.setData({ loading: false });
    }
  },

  // 在可继续加载时触发下一页数据请求。
  async onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    await this.loadList();
  },

  // 响应下拉刷新并重置列表或详情数据。
  async onPullDownRefresh() {
    this.setData({ page: 1, list: [] });
    await this.loadList();
    wx.stopPullDownRefresh();
  },

  // 关注/取关
  async toggleFollow(e) {
    const userId = e.currentTarget.dataset.userid;
    const item = this.data.list.find(i => i.userId === userId);
    if (!item) return;

    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 如果是粉丝列表中的用户，当前用户对其是"关注"操作
    // 如果是关注列表中的用户，当前用户对其是"取关"操作
    const isInFollowingList = this.data.type === 'following';
    const willFollow = isInFollowingList ? false : true; // 粉丝页→点击是关注；关注页→点击是取消

    const prevList = [...this.data.list];
    // 乐观更新：粉丝页取消"请求关注"时直接添加；关注页移除
    if (isInFollowingList) {
      this.setData({ list: this.data.list.filter(i => i.userId !== userId) });
    } else {
      // 检查是否已关注
      const alreadyFollowing = await api.isFollowing(userId);
      if (alreadyFollowing) {
        // 取关
        this.setData({ list: this.data.list.filter(i => i.userId !== userId) });
      } else {
        // 加关注
        const idx = this.data.list.findIndex(i => i.userId === userId);
        if (idx >= 0) {
          const newList = [...this.data.list];
          newList[idx] = { ...newList[idx], justFollowed: true };
          this.setData({ list: newList });
        }
      }
    }

    try {
      await api.followUser(userId, willFollow);
      wx.showToast({
        title: willFollow ? '关注成功 ✅' : '已取消关注',
        icon: 'none',
        duration: 1200
      });
    } catch (err) {
      // 回滚
      this.setData({ list: prevList });
      wx.showToast({ title: err.message?.includes('已关注') ? '已经关注了' : '操作失败', icon: 'none' });
    }
  },

  // 处理头像加载失败的兜底显示。
  onAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const list = [...this.data.list];
    if (list[index]) {
      list[index].avatarError = true;
      this.setData({ list });
    }
  }
});
