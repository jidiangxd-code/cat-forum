// pages/merge-cat/merge-cat.js - 标记重复猫、发起合并
const api = require("../../utils/api.js");

Page({
  // 当前页面或组件依赖的响应式状态统一维护在这里。
  data: {
    catId: "", // 当前（被合并的）猫
    cat: null, // 当前猫信息
    loading: true,
    // 选择目标猫
    targetCat: null,
    showPicker: false,
    pickList: [],
    pickLoading: false,
    pickKeyword: "",
    // 提交
    submitting: false,
  },

  // 初始化当前页面状态并触发首屏数据加载。
  onLoad(options) {
    if (options.id) {
      this.setData({ catId: options.id });
      this.loadCat(options.id);
    }
  },

  // 读取当前猫咪或目标猫咪的详细资料。
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
    this.setData({
      showPicker: true,
      pickLoading: true,
      pickList: [],
      pickKeyword: "",
    });
    try {
      const res = await api.getCatProfileList({ mode: "list", pageSize: 50 });
      const all = (res.data && res.data.list) || [];
      // 排除自身
      const filtered = all.filter((c) => c._id !== this.data.catId);
      this.setData({ pickList: filtered, pickLoading: false });
    } catch (e) {
      this.setData({ pickLoading: false });
    }
  },

  // 关闭目标猫咪选择器。
  closePicker() {
    this.setData({ showPicker: false });
  },

  // 按关键词筛选选择器中的候选猫咪。
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
      const filtered = results.filter((c) => c._id !== this.data.catId);
      this.setData({ pickList: filtered, pickLoading: false });
    } catch (e) {
      this.setData({ pickLoading: false });
    }
  },

  // 确认当前选中的合并目标猫咪。
  onPickTarget(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ targetCat: cat, showPicker: false });
  },

  // 清空当前选中的合并目标。
  resetTarget() {
    this.setData({ targetCat: null });
  },

  // 确认合并
  async doMerge() {
    if (!this.data.targetCat) {
      wx.showToast({ title: "请选择目标档案", icon: "none" });
      return;
    }

    const { cat, targetCat } = this.data;

    wx.showModal({
      title: "确认合并",
      content: `确认将「${cat.fullName || cat.codeName}」合并到「${targetCat.fullName || targetCat.codeName}」？\n\n合并后旧档案将隐藏，所有帖子和票数迁移到目标猫，此操作不可撤销。`,
      confirmText: "确认合并",
      confirmColor: "#FF7043",
      success: async (res) => {
        if (!res.confirm) return;

        this.setData({ submitting: true });
        wx.showLoading({ title: "合并中...", mask: true });

        try {
          await api.mergeCat(this.data.catId, this.data.targetCat._id);
          wx.hideLoading();
          wx.showToast({ title: "合并成功 ✅", icon: "success" });

          // 跳转到目标猫主页
          setTimeout(() => {
            wx.redirectTo({
              url: `/pages/cat-home/cat-home?id=${this.data.targetCat._id}`,
            });
          }, 1500);
        } catch (e) {
          wx.hideLoading();
          const msg = (e && e.message) || "合并失败";
          wx.showToast({ title: msg, icon: "none", duration: 2500 });
          this.setData({ submitting: false });
        }
      },
    });
  },
});
