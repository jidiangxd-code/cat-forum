// pages/promote-cat/promote-cat.js - 未知猫转正
const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    themeId: theme.getThemeId(),
    pageClass: theme.getPageClass(),
    catId: '',
    cat: null,
    loading: true,
    form: {
      fullName: '',
      gender: 'unknown',
      personality: '',
      location: '',
      status: 'active',
      coverImage: null,
      healthTags: []
    },
    coverLocalPath: null,
    appearanceOptions: [],
    genderOptions: [],
    statusOptions: [],
    healthTagOptions: [
      { label: '🦄 已绝育', value: '已绝育' },
      { label: '💉 已驱虫', value: '已驱虫' },
      { label: '🤰 怀孕中', value: '怀孕中' },
      { label: '🏥 生病/受伤', value: '生病/受伤' },
      { label: '⚠️ 需要关注', value: '需要关注' }
    ],
    submitting: false
  },

  onLoad(options) {
    theme.applyTheme(this);
    this.setData({
      appearanceOptions: api.APPEARANCE_OPTIONS,
      genderOptions: api.GENDER_OPTIONS,
      statusOptions: api.STATUS_OPTIONS
    });
    if (options.id) {
      this.setData({ catId: options.id });
      this.loadCat(options.id);
    }
  },

  async loadCat(catId) {
    try {
      const res = await api.getCatProfile(catId);
      const cat = res.data;
      if (!cat) {
        wx.showToast({ title: '猫咪不存在', icon: 'none' });
        return;
      }
      if (cat.catType !== 'unknown') {
        wx.showToast({ title: '该猫咪已是正式猫', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1200);
        return;
      }
      // 预填已有信息
      this.setData({
        cat,
        loading: false,
        form: {
          fullName: '',
          gender: cat.gender || 'unknown',
          personality: cat.personality || '',
          location: cat.location || '',
          status: cat.status || 'active',
          coverImage: cat.coverImage || null,
          healthTags: Array.isArray(cat.healthTags) ? cat.healthTags : []
        }
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  chooseCover() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ coverLocalPath: res.tempFiles[0].tempFilePath });
      }
    });
  },

  onFullNameInput(e) { this.setData({ 'form.fullName': e.detail.value }); },
  onPersonalityInput(e) { this.setData({ 'form.personality': e.detail.value }); },
  onLocationInput(e) { this.setData({ 'form.location': e.detail.value }); },
  onGenderTap(e) { this.setData({ 'form.gender': e.currentTarget.dataset.val }); },
  onStatusTap(e) { this.setData({ 'form.status': e.currentTarget.dataset.val }); },

  onHealthTagTap(e) {
    const val = e.currentTarget.dataset.val;
    const tags = [...(this.data.form.healthTags || [])];
    const idx = tags.indexOf(val);
    if (idx >= 0) {
      tags.splice(idx, 1);
    } else {
      tags.push(val);
    }
    this.setData({ 'form.healthTags': tags });
  },

  async doPromote() {
    const { form, catId, coverLocalPath } = this.data;
    if (!form.fullName.trim()) {
      wx.showToast({ title: '请填写正式名字', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '转正中...', mask: true });

    try {
      let coverImage = form.coverImage;
      if (coverLocalPath) {
        const urls = await api.uploadImages([coverLocalPath], 'cats');
        coverImage = urls[0];
      }

      await api.updateCat(catId, 'promote', {
        fullName: form.fullName.trim(),
        gender: form.gender,
        personality: form.personality.trim(),
        location: form.location.trim(),
        status: form.status,
        coverImage,
        healthTags: form.healthTags
      });

      wx.hideLoading();
      wx.showToast({ title: '转正成功！🎉', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (e) {
      wx.hideLoading();
      const msg = (e && e.message) || '转正失败，请重试';
      wx.showToast({ title: msg, icon: 'none', duration: 2500 });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
