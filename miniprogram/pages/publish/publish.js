// pages/publish/publish.js - 发帖页（强制绑猫）
const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    // 主题
    pageClass: theme.getPageClass(),
    themeId: theme.getThemeId(),
    // 图片
    images: [],
    uploadedUrls: [],
    // 帖子内容
    content: '',
    // 帖子分类
    categoryList: [
      { label: '日常', value: 'daily' },
      { label: '救助', value: 'rescue' },
      { label: '绝育', value: 'neuter' },
      { label: '领养', value: 'adopt' },
      { label: '寻猫', value: 'lost' },
      { label: '其他', value: 'other' }
    ],
    category: '',
    // 绑猫模式: null | 'pick_formal' | 'pick_unknown' | 'new_unknown'
    bindMode: null,
    // 已选猫咪
    selectedCat: null,
    // 新建未知猫的表单
    newUnknownForm: {
      codeName: '',
      appearance: ''
    },
    // 外貌选项
    appearanceOptions: [],
    // 猫咪选择列表（用于pick模式）
    catPickList: [],
    catPickLoading: false,
    catPickKeyword: '',
    showCatPicker: false,
    catPickMode: '',  // 'formal' | 'unknown'
    // 提交状态
    submitting: false
  },

  onLoad() {
    const current = theme.getCurrentId();
    this.setData({ pageClass: 'page theme-' + current, themeId: current, appearanceOptions: api.APPEARANCE_OPTIONS });
    theme.onChange((t) => this.setData({ pageClass: 'page theme-' + t.id, themeId: t.id }));
    // 设置页面背景色和导航栏颜色
    this._applyThemeBackground();
    theme._updateNavBar(theme.getCurrent());
  },

  onShow() {
    // 每次显示页面时更新背景色和导航栏颜色
    this._applyThemeBackground();
    theme._updateNavBar(theme.getCurrent());
  },

  _applyThemeBackground() {
    try {
      const t = theme.getCurrent();
      const bgColor = t['--color-bg'];
      console.log('[publish] 设置背景色:', bgColor);
      wx.setBackgroundColor({
        backgroundColor: bgColor,
        backgroundColorTop: bgColor,
        backgroundColorBottom: bgColor,
        success: () => console.log('[publish] 背景色设置成功'),
        fail: (err) => console.warn('[publish] 背景色设置失败:', err)
      });
    } catch (e) {
      console.warn('[publish] _applyThemeBackground 异常:', e);
    }
  },

  // 选择图片
  chooseImage() {
    const remain = 9 - this.data.images.length;
    if (remain <= 0) return;
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = res.tempFiles.map(f => f.tempFilePath);
        this.setData({
          images: [...this.data.images, ...paths],
          uploadedUrls: [...this.data.uploadedUrls, ...new Array(paths.length).fill(null)]
        });
      }
    });
  },

  deleteImage(e) {
    const idx = e.currentTarget.dataset.index;
    const images = [...this.data.images];
    const urls = [...this.data.uploadedUrls];
    images.splice(idx, 1);
    urls.splice(idx, 1);
    this.setData({ images, uploadedUrls: urls });
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  // ===== 绑猫模式选择 =====
  selectBindMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ bindMode: mode, selectedCat: null });

    if (mode === 'pick_formal') {
      this._openCatPicker('formal');
    } else if (mode === 'pick_unknown') {
      this._openCatPicker('unknown');
    }
    // new_unknown 直接在页面内填写
  },

  // 打开猫咪选择器
  async _openCatPicker(mode) {
    this.setData({ showCatPicker: true, catPickMode: mode, catPickLoading: true, catPickList: [] });
    try {
      const modeKey = mode === 'formal' ? 'list' : 'unknown_list';
      const res = await api.getCatProfileList({ mode: modeKey, pageSize: 50 });
      const list = (res.data && res.data.list) || [];
      // 过滤掉 formal 模式下的 unknown 猫
      const filtered = mode === 'formal'
        ? list.filter(c => c.catType === 'formal')
        : list.filter(c => c.catType === 'unknown');
      this.setData({ catPickList: filtered, catPickLoading: false });
    } catch (e) {
      this.setData({ catPickLoading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 搜索猫咪
  async onPickSearch(e) {
    const kw = e.detail.value;
    this.setData({ catPickKeyword: kw });
    if (!kw.trim()) {
      this._openCatPicker(this.data.catPickMode);
      return;
    }
    this.setData({ catPickLoading: true });
    try {
      const results = await api.searchCatProfiles(kw);
      const mode = this.data.catPickMode;
      const filtered = mode === 'formal'
        ? results.filter(c => c.catType === 'formal')
        : results.filter(c => c.catType === 'unknown');
      this.setData({ catPickList: filtered, catPickLoading: false });
    } catch (e) {
      this.setData({ catPickLoading: false });
    }
  },

  // 选择某只猫
  onPickCat(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ selectedCat: cat, showCatPicker: false });
  },

  closeCatPicker() {
    this.setData({ showCatPicker: false });
    if (!this.data.selectedCat) {
      this.setData({ bindMode: null });
    }
  },

  // 取消选猫，重新选择
  resetBind() {
    this.setData({ bindMode: null, selectedCat: null });
  },

  // 新建未知猫：代号输入
  onCodeNameInput(e) {
    this.setData({ 'newUnknownForm.codeName': e.detail.value });
  },

  // 新建未知猫：外貌选择
  onAppearanceTap(e) {
    const val = e.currentTarget.dataset.val;
    this.setData({ 'newUnknownForm.appearance': val });
  },

  // 帖子分类选择
  onCategoryTap(e) {
    this.setData({ category: e.currentTarget.dataset.val });
  },

  // ===== 提交 =====
  async submitPost() {
    // 校验图片
    if (this.data.images.length === 0) {
      wx.showToast({ title: '请至少上传一张照片', icon: 'none' });
      return;
    }
    // 校验内容
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请填写描述内容', icon: 'none' });
      return;
    }
    // 校验分类
    if (!this.data.category) {
      wx.showToast({ title: '请选择帖子分类', icon: 'none' });
      return;
    }
    // 校验绑猫
    if (!this.data.bindMode) {
      wx.showToast({ title: '请选择或创建一只猫咪', icon: 'none' });
      return;
    }
    if ((this.data.bindMode === 'pick_formal' || this.data.bindMode === 'pick_unknown') && !this.data.selectedCat) {
      wx.showToast({ title: '请从列表选择一只猫', icon: 'none' });
      return;
    }
    if (this.data.bindMode === 'new_unknown') {
      if (!this.data.newUnknownForm.codeName.trim()) {
        wx.showToast({ title: '请为这只猫填写代号', icon: 'none' });
        return;
      }
      if (!this.data.newUnknownForm.appearance) {
        wx.showToast({ title: '请选择猫咪外貌', icon: 'none' });
        return;
      }
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '发布中...', mask: true });

    try {
      // 1. 内容安全审核
      const checkResult = await api.checkContent({
        content: this.data.content.trim(),
        images: [] // 图片上传后再审核
      });
      if (!checkResult.success) {
        wx.hideLoading();
        wx.showModal({
          title: '内容审核未通过',
          content: checkResult.reason || '内容包含违规信息，请修改后重试',
          showCancel: false
        });
        this.setData({ submitting: false });
        return;
      }

      // 2. 上传图片
      const imageUrls = await api.uploadImages(this.data.images, 'posts');

      // 3. 图片安全审核
      const imgCheckResult = await api.checkContent({ content: '', images: imageUrls });
      if (!imgCheckResult.success) {
        wx.hideLoading();
        wx.showModal({
          title: '图片审核未通过',
          content: imgCheckResult.reason || '图片包含违规内容，请更换后重试',
          showCancel: false
        });
        this.setData({ submitting: false });
        return;
      }

      // 4. 如果是新建未知猫，先创建档案
      let catId = this.data.selectedCat ? this.data.selectedCat._id : null;

      if (this.data.bindMode === 'new_unknown') {
        const form = this.data.newUnknownForm;
        const catRes = await api.createCat({
          catType: 'unknown',
          codeName: form.codeName.trim(),
          appearance: form.appearance,
          coverImage: imageUrls[0]
        });
        catId = catRes.data._id;
      }

      // 5. 发布帖子
      await api.publishPost({
        catId,
        images: imageUrls,
        content: this.data.content.trim(),
        category: this.data.category
      });

      wx.hideLoading();
      wx.showToast({ title: '发布成功 🎉', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1500);

    } catch (err) {
      wx.hideLoading();
      console.error('发布失败:', err);
      const msg = (err && err.message) || '发布失败，请重试';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
