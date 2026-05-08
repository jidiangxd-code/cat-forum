const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    // 主题
    pageClass: theme.getPageClass(),
    themeId: theme.getThemeId(),
    // 内容
    postId: '',
    catId: '',
    post: null,
    cat: null,
    loading: true,
    comments: [],
    liked: false,
    favorited: false,
    inputContent: '',
    imageErrors: [],
    avatarError: false,
    submittingComment: false,  // 防止评论重复提交
    togglingFavorite: false,   // 防止收藏重复操作
    categoryMap: {
      daily: '日常',
      rescue: '救助',
      neuter: '绝育',
      adopt: '领养',
      lost: '寻猫',
      other: '其他'
    }
  },

  onLoad(options) {
    // 应用当前主题
    const current = theme.getCurrentId();
    this.setData({ pageClass: 'page theme-' + current, themeId: current });
    theme.onChange((t) => this.setData({ pageClass: 'page theme-' + t.id, themeId: t.id }));
    if (options.id) {
      this.setData({ postId: options.id });
      this.loadPostDetail();
      this.loadComments();
    }
  },

  onShareAppMessage() {
    const post = this.data.post;
    const cat = this.data.cat;
    const title = cat
      ? `快来看看${cat.fullName || cat.codeName || '这只小猫'}！`
      : '校园小猫论坛 — 发现每一只可爱的猫咪';
    return {
      title,
      path: `/pages/detail/detail?id=${this.data.postId}`,
      imageUrl: (post && post.images && post.images[0]) || ''
    };
  },

  async loadPostDetail() {
    this.setData({ loading: true });

    try {
      const res = await api.getPostDetail(this.data.postId);
      const post = res.data;
      
      post.createTimeStr = this._formatTime(post.createTime);
      
      // 检查是否已收藏
      const openid = api.getOpenId();
      let favorited = false;
      if (openid && openid !== 'guest') {
        try {
          const favRes = await wx.cloud.database().collection('favorites')
            .where({ postId: this.data.postId, userOpenid: openid })
            .count();
          favorited = favRes.total > 0;
        } catch (e) {}
      }

      this.setData({
        post,
        liked: post.likedBy && post.likedBy.includes(openid),
        favorited,
        loading: false,
        catId: post.catId || ''
      });

      if (post.catId) {
        this.loadCatProfile(post.catId);
      }

      wx.setNavigationBarTitle({ title: '帖子详情' });
    } catch (err) {
      console.error('加载详情失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
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
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  async loadCatProfile(catId) {
    try {
      const res = await api.getCatProfile(catId);
      if (res.data) {
        this.setData({ cat: res.data });
      }
    } catch (err) {
      console.error('加载猫咪信息失败', err);
    }
  },

  async loadComments() {
    try {
      const res = await api.getComments(this.data.postId);
      const comments = (res.data || []).map(c => ({
        ...c,
        timeStr: this._formatTime(c.createTime)
      }));
      this.setData({ comments });
    } catch (err) {
      console.error('加载评论失败', err);
    }
  },

  toggleLike() {
    const liked = this.data.liked;
    const post = { ...this.data.post };
    post.likeCount = liked ? (post.likeCount - 1) : (post.likeCount + 1);

    this.setData({ liked: !liked, post });

    const openid = api.getOpenId();
    api.togglePostLike(this.data.postId, openid, !liked).catch(err => {
      post.likeCount = liked ? (post.likeCount + 1) : (post.likeCount - 1);
      this.setData({ post });
    });
  },

  /**
   * 收藏/取消收藏（带防重机制）
   */
  async toggleFavorite() {
    // 防重：正在操作中则忽略
    if (this.data.togglingFavorite) return;

    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const favorited = this.data.favorited;
    this.setData({ favorited: !favorited, togglingFavorite: true });

    try {
      await api.toggleFavorite(this.data.postId, !favorited);
      wx.showToast({
        title: favorited ? '已取消收藏' : '收藏成功 ⭐',
        icon: 'none',
        duration: 1000
      });
    } catch (err) {
      // 回滚状态
      this.setData({ favorited });
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      // 延迟解锁，防止快速双击
      setTimeout(() => {
        this.setData({ togglingFavorite: false });
      }, 500);
    }
  },

  previewImage(e) {
    if (!this.data.cat || !this.data.cat.images || this.data.cat.images.length === 0) {
      wx.showToast({ title: '暂无图片', icon: 'none' });
      return;
    }
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.cat.images[index],
      urls: this.data.cat.images
    });
  },

  onInputComment(e) {
    this.setData({ inputContent: e.detail.value });
  },

  /**
   * 提交评论（带防重机制）
   */
  async submitComment() {
    // 防重：正在提交中则忽略
    if (this.data.submittingComment) return;

    const content = this.data.inputContent.trim();
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }

    // 立即锁定
    this.setData({ submittingComment: true });

    const userInfo = wx.getStorageSync('userInfo') || {};

    try {
      // 内容安全审核
      const checkResult = await api.checkContent({ content, images: [] });
      if (!checkResult.success) {
        this.setData({ submittingComment: false });
        wx.showToast({ title: checkResult.reason || '内容包含违规信息', icon: 'none', duration: 2500 });
        return;
      }

      await api.addComment({
        postId: this.data.postId,
        catId: this.data.catId,
        content,
        authorId: api.getOpenId(),
        authorName: userInfo.nickName || '匿名用户',
        authorAvatar: userInfo.avatarUrl || ''
      });

      // 更新帖子的评论计数
      if (this.data.post) {
        this.setData({
          post: { ...this.data.post, commentCount: (this.data.post.commentCount || 0) + 1 }
        });
      }

      this.setData({ inputContent: '' });
      this.loadComments();
      wx.showToast({ title: '评论成功 🎉', icon: 'success' });
    } catch (err) {
      console.error('评论失败', err);
      wx.showToast({ title: '评论失败，请重试', icon: 'none' });
    } finally {
      // 延迟解锁，防止快速双击
      setTimeout(() => {
        this.setData({ submittingComment: false });
      }, 500);
    }
  },

  goToMyLikes() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  onSwiperImageError(e) {
    const index = e.currentTarget.dataset.index;
    const imageErrors = [...this.data.imageErrors];
    imageErrors[index] = true;
    this.setData({ imageErrors });
  },

  onAvatarError() {
    this.setData({ avatarError: true });
  },

  onCommentAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const comments = [...this.data.comments];
    if (comments[index]) {
      comments[index].avatarError = true;
      this.setData({ comments });
    }
  },

  onCatTap() {
    if (this.data.catId) {
      wx.navigateTo({ url: `/pages/cat-home/cat-home?id=${this.data.catId}` });
    }
  }
});
