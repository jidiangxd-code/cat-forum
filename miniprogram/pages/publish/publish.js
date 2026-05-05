// pages/publish/publish.js - 发帖页（强制绑猫 + GPS定位）
const api = require('../../utils/api.js');

// 预设校园地点列表（可按需修改）
const CAMPUS_LOCATIONS = [
  '图书馆', '食堂门口', '宿舍楼下', '教学楼', '操场', '体育馆',
  '行政楼', '实验楼', '校医院', '东门', '南门', '北门',
  '花园', '湖边', '自习室', '快递站'
];

Page({
  data: {
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
    // 位置
    locationList: CAMPUS_LOCATIONS,
    selectedLocation: '',
    hasLocation: false,
    locationLoading: false,
    latitude: null,
    longitude: null,
    locationLabel: '',
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
    catPickMode: '',
    // 提交状态
    submitting: false,
    // 预览模式
    previewMode: false,
    // 深色模式
    isDarkMode: wx.getStorageSync('darkMode') || false
  },

  onShow() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
  },

  onLoad() {
    this.setData({ appearanceOptions: api.APPEARANCE_OPTIONS, locationList: CAMPUS_LOCATIONS, isDarkMode: wx.getStorageSync('darkMode') || false });
  },

  onReachBottom() {},

  // ===== 位置功能 =====

  /**
   * 点击标签选择校园地点
   */
  onLocationTap(e) {
    const loc = e.currentTarget.dataset.loc;
    const isSelected = this.data.selectedLocation === loc;
    this.setData({
      selectedLocation: isSelected ? '' : loc,
      hasLocation: !isSelected,
      locationLabel: isSelected ? '' : loc
    });
  },

  /**
   * 手动获取 GPS（点击按钮触发，含授权引导）
   */
  getGpsLocation() {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.userLocation']) {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => { this._doGetLocation(); },
            fail: () => {
              wx.showToast({ title: '可从下方标签选择地点', icon: 'none', duration: 2000 });
            }
          });
        } else {
          this._doGetLocation();
        }
      }
    });
  },

  _doGetLocation() {
    this.setData({ locationLoading: true });
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const label = `${res.latitude.toFixed(6)}, ${res.longitude.toFixed(6)}`;
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          locationLabel: label,
          selectedLocation: '',
          hasLocation: true,
          locationLoading: false
        });
        wx.showToast({ title: '定位成功', icon: 'success', duration: 1200 });
      },
      fail: () => {
        this.setData({ locationLoading: false });
        wx.showToast({ title: '获取定位失败，请手动选择地点', icon: 'none', duration: 2000 });
      }
    });
  },

  /**
   * 清除位置选择
   */
  clearLocation() {
    this.setData({
      selectedLocation: '',
      hasLocation: false,
      locationLabel: '',
      latitude: null,
      longitude: null
    });
  },

  // ===== 图片选择 =====

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
  },

  async _openCatPicker(mode) {
    this.setData({ showCatPicker: true, catPickMode: mode, catPickLoading: true, catPickList: [] });
    try {
      const modeKey = mode === 'formal' ? 'list' : 'unknown_list';
      const res = await api.getCatProfileList({ mode: modeKey, pageSize: 50 });
      const list = (res.data && res.data.list) || [];
      const filtered = mode === 'formal'
        ? list.filter(c => c.catType === 'formal')
        : list.filter(c => c.catType === 'unknown');
      this.setData({ catPickList: filtered, catPickLoading: false });
    } catch (e) {
      this.setData({ catPickLoading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

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

  resetBind() {
    this.setData({ bindMode: null, selectedCat: null });
  },

  onCodeNameInput(e) {
    this.setData({ 'newUnknownForm.codeName': e.detail.value });
  },

  onAppearanceTap(e) {
    const val = e.currentTarget.dataset.val;
    this.setData({ 'newUnknownForm.appearance': val });
  },

  onCategoryTap(e) {
    this.setData({ category: e.currentTarget.dataset.val });
  },

  // ===== 预览功能 =====

  showPreview() {
    if (this.data.images.length === 0) {
      wx.showToast({ title: '请先添加照片', icon: 'none' }); return;
    }
    if (!this.data.content.trim()) {
      wx.showToast({ title: '请先填写描述', icon: 'none' }); return;
    }
    if (!this.data.category) {
      wx.showToast({ title: '请先选择分类', icon: 'none' }); return;
    }
    if (!this.data.bindMode) {
      wx.showToast({ title: '请先绑定猫咪', icon: 'none' }); return;
    }
    if ((this.data.bindMode === 'pick_formal' || this.data.bindMode === 'pick_unknown') && !this.data.selectedCat) {
      wx.showToast({ title: '请从列表选择一只猫', icon: 'none' }); return;
    }
    if (this.data.bindMode === 'new_unknown') {
      if (!this.data.newUnknownForm.codeName.trim()) {
        wx.showToast({ title: '请为这只猫填写代号', icon: 'none' }); return;
      }
      if (!this.data.newUnknownForm.appearance) {
        wx.showToast({ title: '请选择猫咪外貌', icon: 'none' }); return;
      }
    }
    this.setData({ previewMode: true });
  },

  closePreview() {
    this.setData({ previewMode: false });
  },

  goBackToEdit() {
    this.setData({ previewMode: false });
  },

  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({ current: this.data.images[index], urls: this.data.images });
  },

  // ===== 发布流程 =====

  async confirmPublish() {
    this.setData({ submitting: true });
    wx.showLoading({ title: '发布中...', mask: true });
    let publishStep = '准备发布';

    try {
      // 1. 内容安全审核
      publishStep = '文字安全审核';
      const checkResult = await api.checkContent({ content: this.data.content.trim(), images: [] });
      if (!checkResult.success) {
        wx.hideLoading();
        wx.showModal({
          title: '内容审核未通过',
          content: checkResult.reason || '内容包含违规信息，请修改后重试',
          showCancel: false
        });
        this.setData({ submitting: false, previewMode: false });
        return;
      }

      // 2. 上传图片
      publishStep = '上传图片';
      const imageUrls = await api.uploadImages(this.data.images, 'posts');

      // 3. 图片安全审核
      publishStep = '图片安全审核';
      const imgCheckResult = await api.checkContent({ content: '', images: imageUrls });
      if (!imgCheckResult.success) {
        wx.hideLoading();
        wx.showModal({
          title: '图片审核未通过',
          content: imgCheckResult.reason || '图片包含违规内容，请更换后重试',
          showCancel: false
        });
        this.setData({ submitting: false, previewMode: false });
        return;
      }

      // 4. 如果是新建未知猫，先创建档案
      let catId = this.data.selectedCat ? this.data.selectedCat._id : null;

      if (this.data.bindMode === 'new_unknown') {
        publishStep = '创建未知猫档案';
        const form = this.data.newUnknownForm;
        const catRes = await api.createCat({
          catType: 'unknown',
          codeName: form.codeName.trim(),
          appearance: form.appearance,
          coverImage: imageUrls[0]
        });
        catId = catRes.data._id;
      }

      // 5. 发布帖子（携带位置信息）
      publishStep = '写入帖子';
      const postData = {
        catId,
        images: imageUrls,
        content: this.data.content.trim(),
        category: this.data.category
      };
      // 注入位置
      if (this.data.selectedLocation) {
        postData.location = this.data.selectedLocation;
      } else if (this.data.latitude && this.data.longitude) {
        postData.location = `${this.data.latitude.toFixed(6)}, ${this.data.longitude.toFixed(6)}`;
      }
      if (this.data.latitude) postData.latitude = this.data.latitude;
      if (this.data.longitude) postData.longitude = this.data.longitude;

      await api.publishPost(postData);

      wx.hideLoading();
      wx.showToast({ title: '发布成功 🎉', icon: 'success' });

      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 1500);

    } catch (err) {
      wx.hideLoading();
      console.error('发布失败:', err);
      const msg = this._getErrorMessage(err);
      wx.showModal({
        title: `${publishStep}失败`,
        content: msg,
        showCancel: false
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  _getErrorMessage(err) {
    if (!err) return '发布失败，请重试';
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    if (err.reason) return err.reason;
    if (err.errMsg) return err.errMsg;
    if (err.result && err.result.message) return err.result.message;
    try {
      return JSON.stringify(err);
    } catch (e) {
      return '发布失败，请重试';
    }
  },

  // 深色模式切换
  toggleDarkMode() {
    const newDark = !this.data.isDarkMode;
    this.setData({ isDarkMode: newDark });
    try {
      if (newDark) wx.setStorageSync('darkMode', true);
      else wx.removeStorageSync('darkMode');
    } catch(e) {}
    try {
      const pages = getCurrentPages();
      pages.forEach(p => { try { p.setData({ isDarkMode: newDark }); } catch(e) {} });
    } catch(e) {}
    try { getApp()._applyDarkMode(newDark); } catch(e) {}
  }
});

