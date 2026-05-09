const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    // 主题
    pageClass: theme.getPageClass(),
    themeId: theme.getThemeId(),
    themeName: theme.getCurrent().name,
    // 主题选项
    themeOptions: theme.getAll(),
    userInfo: null,
    avatarError: false,
    editingNickName: false,
    nickNameDraft: '',
    isLoggedIn: false,
    stats: {
      publishCount: 0,
      likeCount: 0,
      collectCount: 0,
      favCount: 0
    },
    // Tab 切换
    currentTab: 'posts',
    tabs: [
      { key: 'posts', label: '我的发布', icon: '📝' },
      { key: 'likes', label: '我喜欢的', icon: '❤️' },
      { key: 'comments', label: '我的评论', icon: '💬' },
      { key: 'favorites', label: '我的收藏', icon: '⭐' }
    ],
    // Tab 内容数据
    tabData: {
      posts: [],
      likes: [],
      comments: [],
      favorites: []
    },
    tabLoading: {
      posts: false,
      likes: false,
      comments: false,
      favorites: false
    },
    tabEmpty: {
      posts: false,
      likes: false,
      comments: false,
      favorites: false
    }
  },

  onLoad() {
    const current = theme.getCurrentId();
    this.setData({ pageClass: 'page theme-' + current, themeId: current, themeName: theme.getCurrent().name, themeOptions: theme.getAll() });
    theme.onChange((t) => this.setData({ pageClass: 'page theme-' + t.id, themeId: t.id, themeName: t.name }));
    // 设置页面背景色和导航栏颜色
    this._applyThemeBackground();
    theme._updateNavBar(theme.getCurrent());
    this.loadUserInfo();
    this.loadStats();
  },

  // 切换主题
  switchTheme(e) {
    const id = e.currentTarget.dataset.id;
    theme.apply(id);
  },

  onShow() {
    // 每次显示页面时更新背景色和导航栏颜色
    this._applyThemeBackground();
    theme._updateNavBar(theme.getCurrent());
    this.loadUserInfo();
    this.loadStats();
    // 加载当前 Tab 数据
    if (this.data.isLoggedIn) {
      this._loadCurrentTab();
    }
  },

  _applyThemeBackground() {
    try {
      const t = theme.getCurrent();
      const bgColor = t['--color-bg'];
      console.log('[profile] 设置背景色:', bgColor);
      wx.setBackgroundColor({
        backgroundColor: bgColor,
        backgroundColorTop: bgColor,
        backgroundColorBottom: bgColor,
        success: () => console.log('[profile] 背景色设置成功'),
        fail: (err) => console.warn('[profile] 背景色设置失败:', err)
      });
    } catch (e) {
      console.warn('[profile] _applyThemeBackground 异常:', e);
    }
  },

  // 加载用户信息（本地缓存 + 云端同步）
  async loadUserInfo() {
    const openId = api.getOpenId();
    const localInfo = wx.getStorageSync('userInfo');
    
    if (!openId || openId === 'guest') {
      this.setData({ userInfo: null, isLoggedIn: false });
      return;
    }
    
    this.setData({ userInfo: localInfo || {}, isLoggedIn: true });
    
    // 从云端拉取最新用户档案
    try {
      const db = wx.cloud.database();
      const res = await db.collection('users').where({ openid: openId }).limit(1).get();
      
      if (res.data && res.data.length > 0) {
        const cloudUser = res.data[0];
        const mergedInfo = {
          nickName: cloudUser.nickName || localInfo?.nickName || '爱猫同学',
          avatarUrl: cloudUser.avatar || localInfo?.avatarUrl || '',
          gender: cloudUser.gender || '',
          campus: cloudUser.campus || '',
          bio: cloudUser.bio || ''
        };
        
        this.setData({ userInfo: mergedInfo });
        wx.setStorageSync('userInfo', mergedInfo);
      } else if (localInfo) {
        // 云端无记录但本地有缓存，尝试同步
        this.setData({ userInfo: localInfo });
      }
    } catch (e) {
      console.warn('从云端加载用户信息失败，使用本地缓存', e);
      if (localInfo) this.setData({ userInfo: localInfo });
      wx.showToast({ title: '用户资料加载失败，请检查网络', icon: 'none', duration: 2000 });
    }
  },

  // 微信登录
  async doLogin() {
    try {
      wx.showLoading({ title: '登录中...' });

      // 获取用户昵称和头像（需要用户授权）
      let userInfo = null;
      try {
        userInfo = await new Promise((resolve) => {
          wx.getUserProfile({
            desc: '用于完善您的个人资料',
            success: res => resolve(res.userInfo),
            fail: () => resolve(null)
          });
        });
      } catch (e) {}

      const nickName = userInfo?.nickName || '爱猫同学';
      const avatar = userInfo?.avatarUrl || '';

      const loginRes = await wx.cloud.callFunction({
        name: 'login',
        data: { nickName, avatar }
      });
      const openid = loginRes.result?.openid || loginRes.result?.openId || '';
      if (!openid) {
        wx.hideLoading();
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
        return;
      }
      wx.setStorageSync('openId', openid);

      // 保存用户信息到本地
      const localUserInfo = { nickName, avatarUrl: avatar };
      wx.setStorageSync('userInfo', localUserInfo);

      this.setData({ userInfo: localUserInfo, isLoggedIn: true });
      wx.hideLoading();
      wx.showToast({ title: '登录成功 🎉', icon: 'success' });
      this.loadStats();
      this._loadCurrentTab();
    } catch (err) {
      wx.hideLoading();
      console.error('登录失败:', err);
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  // 选择头像
  async onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    if (!avatarUrl) return;

    const userInfo = { ...(this.data.userInfo || {}), avatarUrl };
    wx.setStorageSync('userInfo', userInfo);
    this.setData({ userInfo, avatarError: false });

    // 同步头像到云端 users 集合
    try {
      await wx.cloud.callFunction({
        name: 'updateUserProfile',
        data: { nickName: userInfo.nickName || '', avatar: avatarUrl }
      });
    } catch (err) {
      console.warn('头像保存失败', err);
    }
  },

  // 昵称输入
  onNickNameInput(e) {
    this.setData({ nickNameDraft: e.detail.value });
  },

  // 保存昵称
  async saveNickName() {
    const nickName = (this.data.nickNameDraft || '').trim();
    if (!nickName) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    if (nickName.length > 20) {
      wx.showToast({ title: '昵称不能超过20字', icon: 'none' });
      return;
    }
    const userInfo = { ...(this.data.userInfo || {}), nickName };
    wx.setStorageSync('userInfo', userInfo);
    this.setData({ userInfo, editingNickName: false });

    try {
      await wx.cloud.callFunction({
        name: 'updateUserProfile',
        data: { nickName, avatar: userInfo.avatarUrl || '' }
      });
      wx.showToast({ title: '昵称已更新', icon: 'success' });
    } catch (err) {
      console.warn('昵称保存失败', err);
    }
  },

  // 切换昵称编辑
  toggleNickNameEdit() {
    this.setData({
      editingNickName: !this.data.editingNickName,
      nickNameDraft: this.data.userInfo?.nickName || ''
    });
  },

  // 加载统计数据
  async loadStats() {
    const openId = api.getOpenId();
    if (!openId || openId === 'guest') {
      this.setData({
        stats: { publishCount: 0, likeCount: 0, collectCount: 0, favCount: 0 }
      });
      return;
    }
    try {
      const db = wx.cloud.database();
      const postCountRes = await db.collection('posts')
        .where({ authorId: openId })
        .count();

      const myPostsRes = await db.collection('posts')
        .where({ authorId: openId })
        .field({ likeCount: true })
        .get();
      const likeCount = (myPostsRes.data || []).reduce((sum, p) => sum + (p.likeCount || 0), 0);

      let favCount = 0;
      try {
        const favCountRes = await db.collection('favorites')
          .where({ userOpenid: openId })
          .count();
        favCount = favCountRes.total || 0;
      } catch (e) {}

      this.setData({
        stats: {
          publishCount: postCountRes.total || 0,
          likeCount: likeCount,
          collectCount: likeCount,
          favCount
        }
      });
    } catch (err) {
      console.error('获取统计数据失败', err);
      this.setData({
        stats: { publishCount: 0, likeCount: 0, collectCount: 0, favCount: 0 }
      });
    }
  },

  // ========== Tab 切换 ==========
  
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
    this.setData({ currentTab: tab });
    // 如果该 Tab 还没加载过，加载数据
    if (this.data.tabData[tab].length === 0 && !this.data.tabEmpty[tab]) {
      this._loadTabData(tab);
    }
  },

  _loadCurrentTab() {
    this._loadTabData(this.data.currentTab);
  },

  async _loadTabData(tab) {
    const openId = api.getOpenId();
    if (!openId || openId === 'guest') return;

    const loadingKey = `tabLoading.${tab}`;
    this.setData({ [loadingKey]: true });

    try {
      const db = wx.cloud.database();
      let list = [];

      switch (tab) {
        case 'posts': {
          const res = await db.collection('posts')
            .where({ authorId: openId })
            .orderBy('createTime', 'desc')
            .limit(20)
            .get();
          list = res.data || [];
          break;
        }
        case 'likes': {
          // 我喜欢的 = 我发布的帖子中我点赞过的（或通过 likedBy 查）
          // 这里简化为：查所有帖子，筛选 likedBy 包含自己的
          const _ = db.command;
          const allRes = await db.collection('posts')
            .where({ likedBy: _.in([openId]) })
            .orderBy('createTime', 'desc')
            .limit(20)
            .get();
          list = allRes.data || [];
          break;
        }
        case 'comments': {
          const comRes = await db.collection('comments')
            .where({ authorId: openId })
            .orderBy('createTime', 'desc')
            .limit(30)
            .get();
          list = comRes.data || [];
          break;
        }
        case 'favorites': {
          const favApi = require('../../utils/api.js');
          const favRes = await favApi.getFavoritePosts(1, 20);
          list = favRes.data || [];
          break;
        }
      }

      const dataKey = `tabData.${tab}`;
      const emptyKey = `tabEmpty.${tab}`;
      this.setData({
        [dataKey]: list,
        [emptyKey]: list.length === 0,
        [loadingKey]: false
      });

      // 格式化时间
      const formatted = list.map(item => ({
        ...item,
        timeStr: this._formatTime(item.createTime || item.favoriteTime)
      }));
      this.setData({ [dataKey]: formatted });

    } catch (err) {
      console.error(`加载 ${tab} 数据失败`, err);
      this.setData({ [loadingKey]: false });
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

  // ========== 点击事件 ==========

  onAvatarError() {
    this.setData({ avatarError: true });
  },

  // Tab 内点击帖子 → 跳转详情
  onPostTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
    }
  },

  // 取消收藏（在收藏 Tab 中）
  async unfavorite(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消收藏',
      content: '确定要取消收藏这篇帖子吗？',
      confirmText: '取消收藏',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.toggleFavorite(id, false);
            wx.showToast({ title: '已取消收藏', icon: 'success' });
            this.setData({
              'tabData.favorites': [],
              'tabEmpty.favorites': false
            });
            this._loadTabData('favorites');
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 预览图片
  previewImage(e) {
    e.stopPropagation();
    const { images, index } = e.currentTarget.dataset;
    if (images && images.length > 0) {
      wx.previewImage({ current: images[index], urls: images });
    }
  },

  editProfile() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile' });
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除临时缓存数据吗？（不会删除登录信息）',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('imageCache');
          wx.removeStorageSync('tempData');
          wx.removeStorageSync('searchHistory');
          wx.showToast({ title: '缓存已清除', icon: 'success' });
        }
      }
    });
  },

  aboutUs() {
    wx.showModal({
      title: '关于校园小猫论坛',
      content: '🐱 校园小猫论坛 v1.0.0\n\n用爱守护每一只校园小猫\n\n这是一个温暖的社区，让我们一起关爱校园里的流浪小猫，分享每一只可爱小猫的故事~',
      showCancel: false
    });
  }
});
