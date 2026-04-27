const api = require('../../utils/api.js');

Page({
  data: {
    catId: '',
    cat: null,
    loading: true,
    comments: [],
    liked: false,
    inputContent: '',
    imageErrors: [],
    avatarError: false,
    categoryMap: {
      stray: '流浪猫',
      pet: '家养猫',
      lost: '寻猫启事'
    }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ catId: options.id });
      this.loadCatDetail();
      this.loadComments();
    }
  },

  /**
   * 加载猫咪详情
   * 图片直接显示云存储 fileID，无需额外转换
   */
  async loadCatDetail() {
    this.setData({ loading: true });

    try {
      const res = await api.getCatDetail(this.data.catId);
      const cat = res.data;
      const imageErrors = new Array((cat.images || []).length).fill(false);
      this.setData({
        cat,
        imageErrors,
        liked: cat.likedBy && cat.likedBy.includes(api.getOpenId()),
        loading: false
      });
      wx.setNavigationBarTitle({ title: cat.name || '猫咪详情' });
    } catch (err) {
      console.error('加载详情失败', err);
      // 云开发未就绪时，使用模拟数据
      this._loadMockDetail();
    }
  },

  /**
   * 加载评论
   */
  async loadComments() {
    try {
      const res = await api.getComments(this.data.catId);
      this.setData({ comments: res.data || [] });
    } catch (err) {
      console.error('加载评论失败', err);
      // 模拟评论数据
      this.setData({
        comments: [
          { _id: 'c1', authorName: '小明', avatar: '', content: '超级可爱的猫咪！', createTime: '2024-01-15 14:30' },
          { _id: 'c2', authorName: '小红', avatar: '', content: '🥰🥰🥰', createTime: '2024-01-15 16:20' }
        ]
      });
    }
  },

  /**
   * 点赞/取消点赞
   * 本地先更新，再同步到云数据库
   */
  toggleLike() {
    const liked = this.data.liked;
    const cat = { ...this.data.cat };
    cat.likeCount = liked ? (cat.likeCount - 1) : (cat.likeCount + 1);

    this.setData({ liked: !liked, cat });

    api.toggleLike(this.data.catId, api.getOpenId(), !liked).catch(err => {
      // 回滚
      cat.likeCount = liked ? (cat.likeCount + 1) : (cat.likeCount - 1);
      this.setData({ cat });
    });
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
   * 提交评论
   */
  async submitComment() {
    const content = this.data.inputContent.trim();
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }

    try {
      await api.addComment({
        catId: this.data.catId,
        content,
        authorId: api.getOpenId(),
        authorName: '我'
      });

      // Bug #08: 更新猫咪的评论计数
      if (this.data.cat) {
        this.setData({
          cat: { ...this.data.cat, commentCount: (this.data.cat.commentCount || 0) + 1 }
        });
      }

      this.setData({ inputContent: '' });
      this.loadComments();
      wx.showToast({ title: '评论成功 🎉', icon: 'success' });
    } catch (err) {
      console.error('评论失败', err);
      // 本地模拟添加
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const newComment = {
        _id: Date.now().toString(),
        authorName: '我',
        avatar: '',
        content,
        createTime: timeStr
      };
      this.setData({ inputContent: '', comments: [newComment, ...this.data.comments] });
      wx.showToast({ title: '评论成功 🎉', icon: 'success' });
    }
  },

  /**
   * 跳转到"我喜欢的"页面
   */
  goToMyLikes() {
    wx.navigateTo({
      url: '/pages/my-likes/my-likes'
    });
  },

  /**
   * 点击分享按钮
   * Bug #01 修复：shareCat 方法缺失
   */
  shareCat() {
    if (wx.showShareMenu) {
      wx.showShareMenu({ withShareTicket: true });
    } else {
      wx.showToast({ title: '请点击右上角分享', icon: 'none' });
    }
  },

  // 分享回调
  onShareAppMessage() {
    return {
      title: `快来看看${this.data.cat ? this.data.cat.name : '这只小猫'}！`,
      path: `/pages/detail/detail?id=${this.data.catId}`
    };
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

  // 模拟详情数据
  _loadMockDetail() {
    this.setData({
      cat: {
        _id: this.data.catId,
        name: '小橘',
        avatar: '',
        images: [
          '/images/default-cat.png',
          '/images/default-cat.png',
          '/images/default-cat.png'
        ],
        description: '图书馆门口的小橘猫，特别亲人，每天下午都会在那里晒太阳。看到它就会心情变好，是我们学校的明星猫咪！希望大家多多爱护它，不要吓到它哦~ ☀️🐱',
        location: '图书馆门口',
        category: 'stray',
        authorName: '爱猫同学',
        createTime: '2024-01-15',
        likeCount: 128,
        commentCount: 23
      },
      loading: false
    });
  },

  _getOpenId() {
    return api.getOpenId();
  }
});
