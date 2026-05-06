// miniprogram/pages/edit-profile/edit-profile.js - 个人资料编辑页面脚本
const api = require("../../utils/api.js");

Page({
  // 当前页面或组件依赖的响应式状态统一维护在这里。
  data: {
    nickName: "",
    avatarUrl: "",
    gender: "unknown",
    genderOptions: [
      { label: "保密", value: "unknown" },
      { label: "男生", value: "male" },
      { label: "女生", value: "female" }
    ],
    saving: false,
  },

  // 初始化当前页面状态并触发首屏数据加载。
  onLoad() {
    this.loadUserInfo();
  },

  // 加载用户信息
  async loadUserInfo() {
    let userInfo = api.getLocalUserInfo();
    try {
      userInfo = await api.syncCurrentUserProfile();
    } catch (e) {}
    if (userInfo) {
      this.setData({
        nickName: userInfo.nickName || "",
        avatarUrl: userInfo.avatarUrl || "",
        gender: userInfo.gender || "unknown",
      });
    }
  },

  // 输入昵称
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  // 选择性别选项并更新表单状态。
  onGenderTap(e) {
    this.setData({ gender: e.currentTarget.dataset.value });
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({ avatarUrl: tempFilePath });

        // 上传到云存储
        this._uploadAvatar(tempFilePath);
      },
    });
  },

  // 上传头像到云存储
  async _uploadAvatar(filePath) {
    wx.showLoading({ title: "上传中...", mask: true });

    try {
      const ext = filePath.split(".").pop() || "jpg";
      const cloudPath = `avatars/${Date.now()}.${ext}`;

      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath,
      });

      const uploadedFileId = uploadResult.fileID || "";
      wx.hideLoading();
      wx.showToast({ title: "头像上传成功", icon: "success" });

      // 保存 fileID 到 data，提交时一起保存
      this.setData({
        avatarFileId: uploadedFileId,
        avatarUrl: uploadedFileId || filePath
      });
    } catch (err) {
      wx.hideLoading();
      console.error("上传头像失败", err);
      wx.showToast({ title: "上传失败", icon: "none" });
    }
  },

  // 保存修改
  async submitEdit() {
    if (!this.data.nickName.trim()) {
      wx.showToast({ title: "昵称不能为空", icon: "none" });
      return;
    }

    this.setData({ saving: true });

    try {
      const myOpenId = api.getOpenId();
      if (!myOpenId || myOpenId === "guest") {
        wx.showToast({ title: "请先登录后再保存", icon: "none" });
        return;
      }

      const saveRes = await wx.cloud.callFunction({
        name: "updateUserProfile",
        data: {
          nickName: this.data.nickName.trim(),
          gender: this.data.gender,
          avatarFileId: this.data.avatarFileId || ""
        }
      });

      if (!saveRes.result || saveRes.result.success === false) {
        throw new Error(saveRes.result?.message || "保存失败");
      }

      // 更新本地存储
      const userInfo = wx.getStorageSync("userInfo") || {};
      userInfo.nickName = saveRes.result?.data?.nickName || this.data.nickName.trim();
      userInfo.gender = saveRes.result?.data?.gender || this.data.gender;
      if (this.data.avatarUrl || saveRes.result?.data?.avatarUrl) {
        userInfo.avatarUrl = this.data.avatarUrl || saveRes.result?.data?.avatarUrl || "";
      }
      wx.setStorageSync("userInfo", userInfo);
      api.markUserProfileUpdated();
      try {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.userInfo = userInfo;
        }
      } catch (e) {}
      try {
        await api.syncCurrentUserProfile(true);
      } catch (e) {}

      wx.showToast({ title: "保存成功", icon: "success" });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error("保存失败", err);
      const rawMessage = String(err?.message || err?.errMsg || "保存失败");
      const message = /FUNCTION_NOT_FOUND|FunctionName parameter could not be found|找不到云函数|未部署/i.test(rawMessage)
        ? "请先部署 updateUserProfile 云函数"
        : rawMessage.replace(/^保存失败:\s*/i, "").slice(0, 20);
      wx.showToast({ title: message || "保存失败", icon: "none", duration: 2500 });
    } finally {
      this.setData({ saving: false });
    }
  },
});
