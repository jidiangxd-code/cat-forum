// miniprogram/pages/detail/detail.js - 帖子详情页面脚本
const api = require('../../utils/api.js');

const QUICK_EMOJIS = ['😀', '😻', '🥹', '😂', '😭', '🥰', '😿', '👍', '👀', '🐱', '🐾', '❤️'];
const STICKER_PACK_STORAGE_KEY = 'commentStickerPack';
const RECENT_STICKER_STORAGE_KEY = 'recentCommentStickerRecent';
const MAX_COMMENT_ATTACHMENTS = 4;

function inferAttachmentType(path = '', preferredType = '') {
  const normalizedPath = String(path).toLowerCase();
  if (preferredType === 'sticker') {
    return 'sticker';
  }
  if (/\.gif($|\?)/.test(normalizedPath)) {
    return 'gif';
  }
  return 'image';
}

function createComposerAttachment(payload = {}) {
  const localPath = payload.localPath || payload.filePath || '';
  return {
    id: payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    localPath,
    type: payload.type || inferAttachmentType(localPath, payload.source === 'sticker-pack' ? 'sticker' : ''),
    name: payload.name || '',
    source: payload.source || 'picker'
  };
}

function normalizeStoredSticker(sticker = {}) {
  const filePath = sticker.filePath || sticker.localPath || '';
  if (!filePath) {
    return null;
  }
  return {
    id: sticker.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filePath,
    type: sticker.type || inferAttachmentType(filePath, 'sticker'),
    name: sticker.name || '自定义表情包',
    createTime: sticker.createTime || Date.now()
  };
}

Page({
  // 当前页面或组件依赖的响应式状态统一维护在这里。
  data: {
    // 详情页状态：帖子、猫咪、评论、回复、收藏和举报数据都集中在这里。
    postId: '',
    catId: '',
    post: null,
    cat: null,
    loading: true,
    comments: [],
    liked: false,
    favorited: false,
    inputContent: '',
    selectedAttachments: [],
    isSubmittingComment: false,
    quickEmojiList: QUICK_EMOJIS,
    showEmojiPanel: false,
    showStickerPanel: false,
    stickerPack: [],
    recentStickers: [],
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

  // 初始化当前页面状态并触发首屏数据加载。
  onLoad(options) {
    // 进入详情页时读取广告配置，并根据路由参数启动数据加载。
    const app = getApp();
    const adConfig = app.getAdConfig ? app.getAdConfig() : {};
    this._loadStickerCollections();
    this.setData({
      adUnitId: adConfig.detailBannerAdUnitId || ''
    });
    if (options.id) {
      this.setData({ postId: options.id });
      this.loadPostDetail();
      this.loadComments();
    }
  },

  onShow() {
    api.syncCurrentUserProfile()
      .then(userInfo => {
        if (!this.data.post) return;
        this.setData({
          post: api.applyCurrentUserProfileToPost(this.data.post, api.getOpenId(), userInfo)
        });
      })
      .catch(() => null);
  },

  // 生成当前页面的分享标题、路径和配图。
  onShareAppMessage() {
    // 分享标题优先使用关联猫咪名称，提升内容传播时的可读性。
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
      const post = api.applyCurrentUserProfileToPost(res.data || {});
      
      // 格式化时间
      post.createTimeStr = this._formatDateTime(post.createTime);
      
      // 检查当前用户是否已收藏，用于初始化收藏按钮状态。
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

      // 仅在浏览他人帖子时查询关注关系，避免自己关注自己。
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

      // 如果帖子绑定了猫咪档案，再补充加载猫咪详情卡片。
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

  // 把时间字段格式化为相对时间或日期文案。
  _formatDateTime(t) {
    // 详情页显示更完整的时间，保留到小时和分钟。
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
      // 先把原始评论补齐展示字段，再构建主评论/回复树。
      const all = (res.data || []).map(c => this._mapCommentForView(c, openid));
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
      // 页面层只保留主评论数组，子评论通过 replies 挂在父评论下。
      this.setData({ comments: parents });
    } catch (err) {
      console.error('加载评论失败', err);
    }
  },

  // 把时间字段格式化为相对时间或日期文案。
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
    // 点赞按钮先改本地状态，云端失败时再回滚。
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先去“我的”里登录后再点赞', icon: 'none' });
      return;
    }
    const liked = this.data.liked;
    const post = { ...this.data.post };
    const oldLikeCount = Number(post.likeCount || 0);
    if (this._likingPost) return;
    this._likingPost = true;
    post.likeCount = Math.max(0, liked ? (oldLikeCount - 1) : (oldLikeCount + 1));

    this.setData({ liked: !liked, post });

    api.togglePostLike(this.data.postId, openid, !liked)
      .then(result => {
        const nextLiked = !!result?.data?.liked;
        const nextLikeCount = Math.max(0, Number(result?.data?.likeCount || 0));
        this.setData({
          liked: nextLiked,
          post: {
            ...this.data.post,
            likeCount: nextLikeCount
          }
        });
      })
      .catch(err => {
        this.setData({
          liked,
          post: {
            ...this.data.post,
            likeCount: oldLikeCount
          }
        });
        wx.showToast({ title: (err && err.message) || '点赞失败', icon: 'none' });
      })
      .finally(() => {
        this._likingPost = false;
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
    // 收藏操作采用乐观更新，保证按钮反馈足够即时。
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
    // 评论输入框和回复输入框共用同一份 inputContent 状态。
    this.setData({ inputContent: e.detail.value });
  },

  // 聚焦输入框时收起辅助面板，避免遮挡当前输入区域。
  onInputFocus() {
    if (this.data.showEmojiPanel || this.data.showStickerPanel) {
      this.setData({ showEmojiPanel: false, showStickerPanel: false });
    }
  },

  // 载入本地保存的表情包和最近使用记录。
  _loadStickerCollections() {
    const stickerPack = (wx.getStorageSync(STICKER_PACK_STORAGE_KEY) || [])
      .map(normalizeStoredSticker)
      .filter(Boolean);
    const recentStickers = (wx.getStorageSync(RECENT_STICKER_STORAGE_KEY) || [])
      .map(normalizeStoredSticker)
      .filter(Boolean);
    this.setData({ stickerPack, recentStickers });
  },

  // 统一给评论补齐附件和预览所需字段。
  _mapCommentForView(comment, openid) {
    const attachments = this._normalizeCommentAttachments(comment.attachments || []);
    return {
      ...comment,
      timeStr: this._formatTime(comment.createTime),
      liked: comment.likedBy && comment.likedBy.includes(openid),
      likeCount: comment.likeCount || 0,
      replies: [],
      attachments,
      attachmentUrls: attachments.map(item => item.url)
    };
  },

  // 评论附件统一归一化，兼容旧数据和新结构。
  _normalizeCommentAttachments(attachments = []) {
    return (Array.isArray(attachments) ? attachments : [])
      .map(item => {
        if (!item || !item.url) return null;
        return {
          type: item.type || inferAttachmentType(item.url),
          url: item.url,
          name: item.name || ''
        };
      })
      .filter(Boolean);
  },

  // 切换常用 emoji 面板。
  toggleEmojiPanel() {
    this.setData({
      showEmojiPanel: !this.data.showEmojiPanel,
      showStickerPanel: false
    });
  },

  // 切换表情包面板。
  toggleStickerPanel() {
    this.setData({
      showStickerPanel: !this.data.showStickerPanel,
      showEmojiPanel: false
    });
  },

  // 点击常用 emoji 时直接追加到评论输入框里。
  onPickEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji || '';
    if (!emoji) return;
    this.setData({
      inputContent: `${this.data.inputContent}${emoji}`
    });
  },

  // 为当前评论挑选图片或 GIF 附件。
  chooseCommentMedia() {
    const remain = MAX_COMMENT_ATTACHMENTS - this.data.selectedAttachments.length;
    if (remain <= 0) {
      wx.showToast({ title: `最多添加${MAX_COMMENT_ATTACHMENTS}个附件`, icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const attachments = (res.tempFiles || []).map(file => createComposerAttachment({
          localPath: file.tempFilePath,
          type: inferAttachmentType(file.tempFilePath),
          source: 'picker'
        }));
        this._appendSelectedAttachments(attachments);
        this.setData({ showEmojiPanel: false, showStickerPanel: false });
      }
    });
  },

  // 统一把待发送附件追加进输入区，并处理上限。
  _appendSelectedAttachments(attachments = []) {
    const remain = MAX_COMMENT_ATTACHMENTS - this.data.selectedAttachments.length;
    const nextAttachments = attachments.slice(0, remain);
    if (nextAttachments.length === 0) {
      return;
    }
    this.setData({
      selectedAttachments: [...this.data.selectedAttachments, ...nextAttachments]
    });
    if (attachments.length > remain) {
      wx.showToast({ title: `最多添加${MAX_COMMENT_ATTACHMENTS}个附件`, icon: 'none' });
    }
  },

  // 删除还没发送出去的评论附件。
  removeSelectedAttachment(e) {
    const index = Number(e.currentTarget.dataset.index);
    const selectedAttachments = [...this.data.selectedAttachments];
    selectedAttachments.splice(index, 1);
    this.setData({ selectedAttachments });
  },

  // 预览当前输入区里选中的图片、动图或表情包。
  previewSelectedAttachment(e) {
    const index = Number(e.currentTarget.dataset.index);
    const urls = this.data.selectedAttachments.map(item => item.localPath).filter(Boolean);
    if (!urls.length || !urls[index]) return;
    wx.previewImage({
      current: urls[index],
      urls
    });
  },

  // 预览评论里已经发送出去的图片、动图或表情包。
  previewCommentAttachment(e) {
    const current = e.currentTarget.dataset.current;
    const urls = e.currentTarget.dataset.urls || [];
    if (!current || !urls.length) return;
    wx.previewImage({ current, urls });
  },

  // 把本地图片或 GIF 存进“我的表情包”。
  addStickerToPack() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFile = res.tempFiles && res.tempFiles[0];
        if (!tempFile || !tempFile.tempFilePath) {
          return;
        }
        wx.saveFile({
          tempFilePath: tempFile.tempFilePath,
          success: (saveRes) => {
            const sticker = normalizeStoredSticker({
              filePath: saveRes.savedFilePath,
              type: 'sticker',
              name: inferAttachmentType(tempFile.tempFilePath) === 'gif' ? '自定义动图表情' : '自定义表情包',
              createTime: Date.now()
            });
            if (!sticker) return;
            const stickerPack = [
              sticker,
              ...this.data.stickerPack.filter(item => item.filePath !== sticker.filePath)
            ].slice(0, 20);
            this._saveStickerPack(stickerPack);
            this.setData({ stickerPack, showStickerPanel: true, showEmojiPanel: false });
            wx.showToast({ title: '已加入表情包', icon: 'success' });
          },
          fail: () => {
            wx.showToast({ title: '保存表情包失败', icon: 'none' });
          }
        });
      }
    });
  },

  // 从最近使用或我的表情包里取一张直接带入当前评论。
  useStickerFromPack(e) {
    const source = e.currentTarget.dataset.source;
    const index = Number(e.currentTarget.dataset.index);
    const list = source === 'recent' ? this.data.recentStickers : this.data.stickerPack;
    const sticker = list[index];
    if (!sticker) return;

    this._appendSelectedAttachments([createComposerAttachment({
      localPath: sticker.filePath,
      type: 'sticker',
      name: sticker.name,
      source: 'sticker-pack'
    })]);
    this._pushRecentSticker(sticker);
  },

  // 持久化“我的表情包”列表。
  _saveStickerPack(stickerPack) {
    wx.setStorageSync(STICKER_PACK_STORAGE_KEY, stickerPack);
  },

  // 持久化“常用表情包”列表。
  _saveRecentStickers(recentStickers) {
    wx.setStorageSync(RECENT_STICKER_STORAGE_KEY, recentStickers);
  },

  // 每次使用表情包后把它顶到最近使用列表。
  _pushRecentSticker(sticker) {
    const normalized = normalizeStoredSticker(sticker);
    if (!normalized) return;
    const recentStickers = [
      normalized,
      ...this.data.recentStickers.filter(item => item.filePath !== normalized.filePath)
    ].slice(0, 8);
    this._saveRecentStickers(recentStickers);
    this.setData({ recentStickers });
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
    const rootParentId = e.currentTarget.dataset.rootparentid || comment.parentId || comment._id;
    this.setData({
      isReply: true,
      replyToCommentId: rootParentId,
      replyToUserId: comment.authorId,
      replyToUserName: comment.authorName,
      replyPlaceholder: `回复 @${comment.authorName}：`,
      showEmojiPanel: false,
      showStickerPanel: false
    });
  },

  // 切换评论点赞状态并刷新局部计数。
  async onCommentLike(e) {
    // 评论点赞同时兼容主评论和子评论，靠 dataset 区分目标节点。
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
    if (target.authorId === openid) {
      wx.showToast({ title: '不能给自己的评论点赞', icon: 'none' });
      return;
    }

    // 对评论点赞同样使用本地先更新、失败再回滚的策略。
    const oldLiked = !!target.liked;
    target.liked = !oldLiked;
    target.likeCount = Math.max(0, (target.likeCount || 0) + (oldLiked ? -1 : 1));
    this.setData({ comments });

    try {
      const result = await api.toggleCommentLike(commentId, !oldLiked);
      if (result && result.data) {
        target.liked = !!result.data.liked;
        target.likeCount = Math.max(0, Number(result.data.likeCount || 0));
        this.setData({ comments });
      }
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
      replyPlaceholder: '说点什么吧...'
    });
  },

  /**
   * 提交评论
   * 支持子评论（回复功能）
   */
  async submitComment() {
    if (this._commentSubmitting || this.data.isSubmittingComment) {
      return;
    }
    this._commentSubmitting = true;
    this.setData({ isSubmittingComment: true });

    const content = this.data.inputContent.trim();
    const selectedAttachments = this.data.selectedAttachments || [];
    if (!content && selectedAttachments.length === 0) {
      wx.showToast({ title: '请输入内容或添加附件', icon: 'none' });
      this._commentSubmitting = false;
      this.setData({ isSubmittingComment: false });
      return;
    }

    const userInfo = wx.getStorageSync('userInfo') || {};
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先登录后再评论', icon: 'none' });
      this._commentSubmitting = false;
      this.setData({ isSubmittingComment: false });
      return;
    }

    wx.showLoading({ title: '发送中...', mask: true });
    try {
      let uploadedAttachments = [];

      // 先走文字审核；审核服务异常时允许继续提交，避免评论完全阻塞。
      let textCheckResult = null;
      try {
        textCheckResult = await api.checkContent({ content, images: [] });
      } catch (auditErr) {
        console.warn('评论文字审核服务异常，跳过本次审核继续提交', auditErr);
      }
      if (textCheckResult && !textCheckResult.success) {
        wx.hideLoading();
        wx.showToast({ title: textCheckResult.reason || '内容包含违规信息', icon: 'none', duration: 2500 });
        return;
      }

      if (selectedAttachments.length > 0) {
        const localPaths = selectedAttachments
          .map(item => item.localPath)
          .filter(Boolean);
        const uploadedUrls = await api.uploadImages(localPaths, 'comments');

        let imageCheckResult = null;
        try {
          imageCheckResult = await api.checkContent({ content: '', images: uploadedUrls });
        } catch (auditErr) {
          console.warn('评论图片审核服务异常，跳过本次审核继续提交', auditErr);
        }
        if (imageCheckResult && !imageCheckResult.success) {
          wx.hideLoading();
          wx.showToast({ title: imageCheckResult.reason || '图片审核未通过', icon: 'none', duration: 2500 });
          return;
        }

        uploadedAttachments = selectedAttachments.map((item, index) => ({
          type: item.type || inferAttachmentType(item.localPath),
          url: uploadedUrls[index],
          name: item.name || ''
        })).filter(item => item.url);
      }

      // 调用云函数统一写评论、发通知并更新帖子评论数。
      await api.addComment({
        postId: this.data.postId,
        catId: this.data.catId,
        content,
        attachments: uploadedAttachments,
        authorId: openid,
        authorName: userInfo.nickName || '匿名用户',
        authorAvatar: userInfo.avatarUrl || '',
        parentId: this.data.isReply ? this.data.replyToCommentId : '',
        replyToUserId: this.data.isReply ? this.data.replyToUserId : '',
        replyToUserName: this.data.isReply ? this.data.replyToUserName : ''
      });

      // 提交成功后只做表单重置和前端计数同步，评论列表再重新拉取。
      if (this.data.post) {
        this.setData({
          post: { ...this.data.post, commentCount: (this.data.post.commentCount || 0) + 1 }
        });
      }
      this.setData({
        inputContent: '',
        selectedAttachments: [],
        showEmojiPanel: false,
        showStickerPanel: false,
        isReply: false,
        replyToCommentId: '',
        replyToUserId: '',
        replyToUserName: '',
        replyPlaceholder: '说点什么吧...'
      });
      this.loadComments();
      wx.showToast({ title: '评论成功 🎉', icon: 'success' });
    } catch (err) {
      console.error('评论失败', err);
      wx.showModal({
        title: '评论提交失败',
        content: this._getErrorMessage(err),
        showCancel: false
      });
    } finally {
      wx.hideLoading();
      this._commentSubmitting = false;
      this.setData({ isSubmittingComment: false });
    }
  },

  // 统一提炼接口或运行时错误信息，便于提示展示。
  _getErrorMessage(err) {
    // 从不同错误结构里抽取可读提示，减少“操作失败”式空泛报错。
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
    // 记录图片加载失败索引，交给视图层决定回退显示。
    const index = e.currentTarget.dataset.index;
    const imageErrors = [...this.data.imageErrors];
    imageErrors[index] = true;
    this.setData({ imageErrors });
  },

  /**
   * 头像加载失败处理
   */
  onAvatarError() {
    // 当前主头像加载失败时切换到默认头像占位。
    this.setData({ avatarError: true });
  },

  /**
   * 评论头像加载失败处理
   */
  onCommentAvatarError(e) {
    // 标记主评论头像加载失败，避免重复请求损坏链接。
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
    // 标记子评论头像加载失败，处理逻辑和主评论一致但多一层父评论索引。
    const index = Number(e.currentTarget.dataset.index);
    const parentIndex = Number(e.currentTarget.dataset.parent);
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

  // 跳转到帖子作者的相关页面或关注入口。
  onAuthorTap() {
    // TODO: 后续可跳转用户主页
  },

  // 切换当前用户对目标作者的关注关系。
  async toggleFollow() {
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const authorId = this.data.post.authorId;
    if (!authorId || authorId === openid) return;

    const wasFollowing = this.data.isFollowing;
    // 关注按钮使用乐观更新，保证交互反馈及时。
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
    // 举报入口只有登录用户可用，打开时顺带重置上次选择的原因和描述。
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

  // 关闭举报面板并重置临时输入。
  hideReport() {
    this.setData({ showReport: false });
  },

  // 选择举报原因并更新当前表单。
  selectReason(e) {
    this.setData({ selectedReason: e.currentTarget.dataset.value });
  },

  // 同步举报补充说明内容。
  onReportDescInput(e) {
    this.setData({ reportDescription: e.detail.value });
  },

  // 提交帖子举报信息并反馈处理结果。
  async submitReport() {
    const { selectedReason, reportDescription } = this.data;
    if (!selectedReason) {
      wx.showToast({ title: '请选择举报原因', icon: 'none' });
      return;
    }

    try {
      // 举报提交统一走 reportPost 接口，前端只负责收集表单字段。
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
