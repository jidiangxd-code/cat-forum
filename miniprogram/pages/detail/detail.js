const api = require('../../utils/api.js');

Page({
  data: {
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
    categoryMap: {
      daily: '日常',
      rescue: '救助',
      neuter: '绝育',
      adopt: '领养',
      lost: '寻猫',
      other: '其他'
    },
    // 子评论（回复）
    isReply: false,
    replyToCommentId: '',
    replyToUserId: '',
    replyToUserName: '',
    replyPlaceholder: '说点什么吧...',
    // 关注相关
    isFollowing: false,
    currentUserId: '',
    authorAvatarError: false,
    // 举报相关
    showReport: false,
    selectedReason: '',
    reportDescription: '',
    reportSuccess: false,
    adUnitId: '',
    reportReasons: [
      { value: 'abuse', label: '色情暴力', icon: '🚫' },
      { value: 'ad', label: '广告骚扰', icon: '📢' },
      { value: 'fake', label: '虚假信息', icon: '⚠️' },
      { value: 'other', label: '其他', icon: '💬' }
    ]
  },

  onLoad(options) {
    const app = getApp();
    const adConfig = app.getAdConfig ? app.getAdConfig() : {};
    this.setData({
      adUnitId: adConfig.detailBannerAdUnitId || ''
    });
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

  /**
   * 加载帖子详情
   */
  async loadPostDetail() {
    this.setData({ loading: true });

    try {
      const res = await api.getPostDetail(this.data.postId);
      const post = res.data;
      
      // 格式化时间
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

      // 检查关注状态
      let isFollowing = false;
      if (openid && openid !== 'guest' && post.authorId && post.authorId !== 'guest' && post.authorId !== openid) {
        try {
          isFollowing = await api.isFollowing(post.authorId);
        } catch (e) {}
      }

      this.setData({
        post,
        liked: post.likedBy && post.likedBy.includes(openid),
        favorited,
        loading: false,
        catId: post.catId || '',
        isFollowing,
        currentUserId: openid
      });

      // 加载关联猫咪信息
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

  /**
   * 加载猫咪档案信息
   */
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

  /**
   * 加载评论（支持子评论分组）
   */
  async loadComments() {
    try {
      const res = await api.getComments(this.data.postId);
      const openid = api.getOpenId();
      const all = (res.data || []).map(c => ({
        ...c,
        timeStr: this._formatTime(c.createTime),
        liked: c.likedBy && c.likedBy.includes(openid),
        likeCount: c.likeCount || 0,
        replies: []
      }));
      // 分组：把子评论挂到对应 parentId 的主评论下
      const parents = [];
      const replies = [];
      all.forEach(c => {
        if (c.parentId) {
          replies.push(c);
        } else {
          parents.push(c);
        }
      });
      const parentMap = {};
      parents.forEach(p => { parentMap[p._id] = p; });
      replies.forEach(r => {
        if (parentMap[r.parentId]) {
          parentMap[r.parentId].replies.push(r);
        }
      });
      this.setData({ comments: parents });
    } catch (err) {
      console.error('加载评论失败', err);
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

  /**
   * 点赞/取消点赞
   * 本地先更新，再同步到云数据库
   */
  toggleLike() {
    const liked = this.data.liked;
    const post = { ...this.data.post };
    post.likeCount = liked ? (post.likeCount - 1) : (post.likeCount + 1);

    this.setData({ liked: !liked, post });

    const openid = api.getOpenId();
    api.togglePostLike(this.data.postId, openid, !liked).catch(err => {
      // 回滚
      post.likeCount = liked ? (post.likeCount + 1) : (post.likeCount - 1);
      this.setData({ post });
    });
  },

  /**
   * 收藏/取消收藏
   */
  async toggleFavorite() {
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const favorited = this.data.favorited;
    this.setData({ favorited: !favorited });

    try {
      await api.toggleFavorite(this.data.postId, !favorited);
      wx.showToast({
        title: favorited ? '已取消收藏' : '收藏成功 ⭐',
        icon: 'none',
        duration: 1000
      });
    } catch (err) {
      // 回滚
      this.setData({ favorited });
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  /**
   * 预览图片
   * Bug #18 修复：增加空值保护
   */
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

  // 输入评论
  onInputComment(e) {
    this.setData({ inputContent: e.detail.value });
  },

  /**
   * 子评论（回复）
   * 弹出回复输入框，锁定被回复用户
   */
  onReplyComment(e) {
    const comment = e.currentTarget.dataset.comment;
    if (!comment) return;
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先登录后再回复', icon: 'none' });
      return;
    }
    // 不能回复自己
    if (comment.authorId === openid) {
      wx.showToast({ title: '不能回复自己', icon: 'none' });
      return;
    }
    this.setData({
      isReply: true,
      replyToCommentId: comment._id,
      replyToUserId: comment.authorId,
      replyToUserName: comment.authorName,
      replyPlaceholder: `回复 @${comment.authorName}：`,
      inputContent: ''
    });
  },

  async onCommentLike(e) {
    const commentId = e.currentTarget.dataset.id;
    const isReply = e.currentTarget.dataset.reply === true || e.currentTarget.dataset.reply === 'true';
    const parentId = e.currentTarget.dataset.parentid || '';
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先登录后再点赞', icon: 'none' });
      return;
    }

    const comments = [...this.data.comments];
    let target = null;
    if (isReply) {
      const parent = comments.find(c => c._id === parentId);
      if (parent && parent.replies) {
        target = parent.replies.find(r => r._id === commentId);
      }
    } else {
      target = comments.find(c => c._id === commentId);
    }
    if (!target) return;

    const oldLiked = !!target.liked;
    target.liked = !oldLiked;
    target.likeCount = Math.max(0, (target.likeCount || 0) + (oldLiked ? -1 : 1));
    this.setData({ comments });

    try {
      await api.toggleCommentLike(commentId, !oldLiked);
    } catch (err) {
      target.liked = oldLiked;
      target.likeCount = Math.max(0, (target.likeCount || 0) + (oldLiked ? 1 : -1));
      this.setData({ comments });
      wx.showToast({ title: (err && err.message) || '点赞失败', icon: 'none' });
    }
  },

  /**
   * 取消回复模式
   */
  onCancelReply() {
    this.setData({
      isReply: false,
      replyToCommentId: '',
      replyToUserId: '',
      replyToUserName: '',
      replyPlaceholder: '说点什么吧...',
      inputContent: ''
    });
  },

  /**
   * 提交评论
   * 支持子评论（回复功能）
   */
  async submitComment() {
    const content = this.data.inputContent.trim();
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }

    const userInfo = wx.getStorageSync('userInfo') || {};
    const openid = api.getOpenId();

    try {
      // 内容安全审核
      let checkResult = null;
      try {
        checkResult = await api.checkContent({ content, images: [] });
      } catch (auditErr) {
        console.warn('评论审核服务异常，跳过本次审核继续提交', auditErr);
      }
      if (checkResult && !checkResult.success) {
        wx.showToast({ title: checkResult.reason || '内容包含违规信息', icon: 'none', duration: 2500 });
        return;
      }

      // 调用云函数写评论（含通知 + 评论数自动+1）
      await api.addComment({
        postId: this.data.postId,
        catId: this.data.catId,
        content,
        authorId: openid,
        authorName: userInfo.nickName || '匿名用户',
        authorAvatar: userInfo.avatarUrl || '',
        parentId: this.data.isReply ? this.data.replyToCommentId : '',
        replyToUserId: this.data.isReply ? this.data.replyToUserId : '',
        replyToUserName: this.data.isReply ? this.data.replyToUserName : ''
      });

      // 云函数已自动更新 commentCount，只需重置表单 + 乐观更新UI
      if (this.data.post) {
        this.setData({
          post: { ...this.data.post, commentCount: (this.data.post.commentCount || 0) + 1 }
        });
      }
      this.setData({ inputContent: '', isReply: false, replyToCommentId: '', replyToUserId: '', replyToUserName: '', replyPlaceholder: '说点什么吧...' });
      this.loadComments();
      wx.showToast({ title: '评论成功 🎉', icon: 'success' });
    } catch (err) {
      console.error('评论失败', err);
      wx.showModal({
        title: '评论提交失败',
        content: this._getErrorMessage(err),
        showCancel: false
      });
    }
  },

  _getErrorMessage(err) {
    if (!err) return '评论失败，请重试';
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    if (err.reason) return err.reason;
    if (err.errMsg) return err.errMsg;
    if (err.result && err.result.message) return err.result.message;
    try {
      return JSON.stringify(err);
    } catch (e) {
      return '评论失败，请重试';
    }
  },

  /**
   * 跳转到"我喜欢的"页面
   */
  goToMyLikes() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  /**
   * 轮播图加载失败处理
   */
  onSwiperImageError(e) {
    const index = e.currentTarget.dataset.index;
    const imageErrors = [...this.data.imageErrors];
    imageErrors[index] = true;
    this.setData({ imageErrors });
  },

  /**
   * 头像加载失败处理
   */
  onAvatarError() {
    this.setData({ avatarError: true });
  },

  /**
   * 评论头像加载失败处理
   */
  onCommentAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const comments = [...this.data.comments];
    if (comments[index]) {
      comments[index].avatarError = true;
      this.setData({ comments });
    }
  },

  /**
   * 子评论头像加载失败处理
   */
  onReplyAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const parentIndex = e.currentTarget.dataset.parent;
    const comments = [...this.data.comments];
    if (comments[parentIndex] && comments[parentIndex].replies && comments[parentIndex].replies[index]) {
      comments[parentIndex].replies[index].avatarError = true;
      this.setData({ comments });
    }
  },

  /**
   * 点击猫咪头像跳转猫咪主页
   */
  onCatTap() {
    if (this.data.catId) {
      wx.navigateTo({ url: `/pages/cat-home/cat-home?id=${this.data.catId}` });
    }
  },

  // ==================== 关注功能 ====================

  onAuthorAvatarError() {
    this.setData({ authorAvatarError: true });
  },

  onAuthorTap() {
    // TODO: 后续可跳转用户主页
  },

  async toggleFollow() {
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const authorId = this.data.post.authorId;
    if (!authorId || authorId === openid) return;

    const wasFollowing = this.data.isFollowing;
    this.setData({ isFollowing: !wasFollowing });

    try {
      await api.followUser(authorId, !wasFollowing);
      wx.showToast({ title: wasFollowing ? '已取消关注' : '关注成功 ✅', icon: 'none', duration: 1200 });
    } catch (err) {
      this.setData({ isFollowing: wasFollowing });
      wx.showToast({ title: err.message?.includes('已关注') ? '已经关注了' : '操作失败', icon: 'none' });
    }
  },

  // ==================== 举报功能 ====================

  showMoreMenu() {
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    this.setData({
      showReport: true,
      selectedReason: '',
      reportDescription: ''
    });
  },

  hideReport() {
    this.setData({ showReport: false });
  },

  selectReason(e) {
    this.setData({ selectedReason: e.currentTarget.dataset.value });
  },

  onReportDescInput(e) {
    this.setData({ reportDescription: e.detail.value });
  },

  async submitReport() {
    const { selectedReason, reportDescription } = this.data;
    if (!selectedReason) {
      wx.showToast({ title: '请选择举报原因', icon: 'none' });
      return;
    }

    try {
      const res = await api.reportPost({
        postId: this.data.postId,
        reason: selectedReason,
        description: reportDescription
      });

      if (res.success) {
        this.setData({ showReport: false, reportSuccess: true });
        setTimeout(() => this.setData({ reportSuccess: false }), 3000);
      } else {
        wx.showToast({ title: res.error || '举报失败', icon: 'none', duration: 2500 });
      }
    } catch (err) {
      console.error('举报失败', err);
      wx.showToast({ title: '举报提交失败，请重试', icon: 'none' });
    }
  }
});
