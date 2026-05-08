// pages/merge-cat/merge-cat.js - 标记重复猫、发起合并
const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    themeId: theme.getThemeId(),
    pageClass: theme.getPageClass(),
    catId: '',          // 当前（被合并的）猫
    cat: null,          // 当前猫信息
    loading: true,
    // 选择目标猫
    targetCat: null,
    showPicker: false,
    pickList: [],
    pickLoading: false,
    pickKeyword: '',
    // 提交
    submitting: false
  },

  onLoad(options) {
    theme.applyTheme(this);
    if (options.id) {
      this.setData({ catId: options.id });
      this.loadCat(options.id);
    }
  },

  async loadCat(catId) {
    try {
      const res = await api.getCatProfile(catId);
      this.setData({ cat: res.data, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  // 打开目标猫选择器
  async openPicker() {
    this.setData({ showPicker: true, pickLoading: true, pickList: [], pickKeyword: '' });
    try {
      const res = await api.getCatProfileList({ mode: 'list', pageSize: 50 });
      const all = (res.data && res.data.list) || [];
      // 排除自身
      const filtered = all.filter(c => c._id !== this.data.catId);
      this.setData({ pickList: filtered, pickLoading: false });
    } catch (e) {
      this.setData({ pickLoading: false });
    }
  },

  closePicker() {
    this.setData({ showPicker: false });
  },

  async onPickSearch(e) {
    const kw = e.detail.value;
    this.setData({ pickKeyword: kw });
    if (!kw.trim()) {
      this.openPicker();
      return;
    }
    this.setData({ pickLoading: true });
    try {
      const results = await api.searchCatProfiles(kw);
      const filtered = results.filter(c => c._id !== this.data.catId);
      this.setData({ pickList: filtered, pickLoading: false });
    } catch (e) {
      this.setData({ pickLoading: false });
    }
  },

  onPickTarget(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ targetCat: cat, showPicker: false });
  },

  resetTarget() {
    this.setData({ targetCat: null });
  },

  // 确认合并
  async doMerge() {
    if (!this.data.targetCat) {
      wx.showToast({ title: '请选择目标档案', icon: 'none' });
      return;
    }

    const { cat, targetCat } = this.data;

    wx.showModal({
      title: '确认合并',
      content: `确认将「${cat.fullName || cat.codeName}」合并到「${targetCat.fullName || targetCat.codeName}」？\n\n合并后旧档案将隐藏，所有帖子和票数迁移到目标猫，此操作不可撤销。`,
      confirmText: '确认合并',
      confirmColor: '#FF7043',
      success: async (res) => {
        if (!res.confirm) return;

        this.setData({ submitting: true });
        wx.showLoading({ title: '合并中...', mask: true });

        try {
          await api.mergeCat(this.data.catId, this.data.targetCat._id);
          wx.hideLoading();
          wx.showToast({ title: '合并成功 ✅', icon: 'success' });

          // 跳转到目标猫主页
          setTimeout(() => {
            wx.redirectTo({ url: `/pages/cat-home/cat-home?id=${this.data.targetCat._id}` });
          }, 1500);

        } catch (e) {
          wx.hideLoading();
          const msg = (e && e.message) || '合并失败';
          wx.showToast({ title: msg, icon: 'none', duration: 2500 });
          this.setData({ submitting: false });
        }
      }
    });
  }
});
