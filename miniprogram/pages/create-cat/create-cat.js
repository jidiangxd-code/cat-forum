// pages/create-cat/create-cat.js - 创建正式猫档案 / 编辑猫咪信息
const api = require('../../utils/api.js');

Page({
  data: {
    mode: 'create',   // 'create' | 'edit'
    catId: '',
    // 表单
    form: {
      fullName: '',
      appearance: '',
      gender: 'unknown',
      personality: '',
      location: '',
      status: 'active',
      coverImage: null
    },
    coverLocalPath: null,
    // 选项
    appearanceOptions: [],
    genderOptions: [],
    statusOptions: [],
    submitting: false
  },

  onLoad(options) {
    this.setData({
      appearanceOptions: api.APPEARANCE_OPTIONS,
      genderOptions: api.GENDER_OPTIONS,
      statusOptions: api.STATUS_OPTIONS
    });

    if (options.id) {
      this.setData({ catId: options.id, mode: 'edit' });
      this.loadExisting(options.id);
      wx.setNavigationBarTitle({ title: '编辑猫咪资料' });
    } else {
      wx.setNavigationBarTitle({ title: '创建正式猫档案' });
    }
  },

  async loadExisting(catId) {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await api.getCatProfile(catId);
      const cat = res.data;
      if (!cat) return;
      this.setData({
        form: {
          fullName: cat.fullName || '',
          appearance: cat.appearance || '',
          gender: cat.gender || 'unknown',
          personality: cat.personality || '',
          location: cat.location || '',
          status: cat.status || 'active',
          coverImage: cat.coverImage || null
        }
      });
      wx.hideLoading();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 选择封面图
  chooseCover() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ coverLocalPath: res.tempFiles[0].tempFilePath });
      }
    });
  },

  onFullNameInput(e) { this.setData({ 'form.fullName': e.detail.value }); },
  onPersonalityInput(e) { this.setData({ 'form.personality': e.detail.value }); },
  onLocationInput(e) { this.setData({ 'form.location': e.detail.value }); },

  onAppearanceTap(e) { this.setData({ 'form.appearance': e.currentTarget.dataset.val }); },

  onGenderTap(e) { this.setData({ 'form.gender': e.currentTarget.dataset.val }); },

  onStatusTap(e) { this.setData({ 'form.status': e.currentTarget.dataset.val }); },

  async submit() {
    const { form, mode, catId, coverLocalPath } = this.data;

    // 必填校验
    if (!form.fullName.trim()) {
      wx.showToast({ title: '请填写猫咪名字', icon: 'none' });
      return;
    }
    if (!form.appearance) {
      wx.showToast({ title: '请选择猫咪外貌', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      let coverImage = form.coverImage;

      // 如果有新选的封面图，先上传
      if (coverLocalPath) {
        const urls = await api.uploadImages([coverLocalPath], 'cats');
        coverImage = urls[0];
      }

      if (mode === 'create') {
        const res = await api.createCat({
          catType: 'formal',
          fullName: form.fullName.trim(),
          appearance: form.appearance,
          gender: form.gender,
          personality: form.personality.trim(),
          location: form.location.trim(),
          status: form.status,
          coverImage
        });

        wx.hideLoading();
        wx.showToast({ title: '档案创建成功 🎉', icon: 'success' });

        setTimeout(() => {
          wx.redirectTo({ url: `/pages/cat-home/cat-home?id=${res.data._id}` });
        }, 1200);

      } else {
        await api.updateCat(catId, 'edit', {
          fullName: form.fullName.trim(),
          appearance: form.appearance,
          gender: form.gender,
          personality: form.personality.trim(),
          location: form.location.trim(),
          status: form.status,
          coverImage
        });

        wx.hideLoading();
        wx.showToast({ title: '更新成功 ✅', icon: 'success' });

        setTimeout(() => {
          wx.navigateBack();
        }, 1200);
      }

    } catch (e) {
      wx.hideLoading();
      const msg = (e && e.message) || '保存失败';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
