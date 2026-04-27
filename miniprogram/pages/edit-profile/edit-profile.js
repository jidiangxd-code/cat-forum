const api = require('../../utils/api.js');

Page({
  data: {
    nickName: '',
    avatarUrl: '',
    saving: false
  },

  onLoad() {
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        nickName: userInfo.nickName || '',
        avatarUrl: userInfo.avatarUrl || ''
      });
    }
  },

  // 输入昵称
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({ avatarUrl: tempFilePath });

        // 上传到云存储
        this._uploadAvatar(tempFilePath);
      }
    });
  },

  // 上传头像到云存储
  async _uploadAvatar(filePath) {
    wx.showLoading({ title: '上传中...', mask: true });

    try {
      const ext = filePath.split('.').pop() || 'jpg';
      const cloudPath = `avatars/${Date.now()}.${ext}`;

      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath
      });

      wx.hideLoading();
      wx.showToast({ title: '头像上传成功', icon: 'success' });

      // 保存 fileID 到 data，提交时一起保存
      this.setData({ avatarFileId: uploadResult.fileID });
    } catch (err) {
      wx.hideLoading();
      console.error('上传头像失败', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  // 保存修改
  async submitEdit() {
    if (!this.data.nickName.trim()) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    try {
      const db = wx.cloud.database();
      const myOpenId = api.getOpenId();

      // 查询用户记录
      const userResult = await db.collection('users')
        .where({ openid: myOpenId })
        .get();

      const updateData = {
        nickName: this.data.nickName.trim(),
        updatedAt: new Date()
      };

      // 如果上传了新头像，保存 fileID
      if (this.data.avatarFileId) {
        updateData.avatar = this.data.avatarFileId;
      }

      if (userResult.data.length > 0) {
        // 更新现有记录
        await db.collection('users').doc(userResult.data[0]._id).update({
          data: updateData
        });
      } else {
        // 创建新记录
        await db.collection('users').add({
          data: {
            openid: myOpenId,
            nickName: this.data.nickName.trim(),
            avatar: this.data.avatarFileId || '',
            favorites: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // 更新本地存储
      const userInfo = wx.getStorageSync('userInfo') || {};
      userInfo.nickName = this.data.nickName.trim();
      if (this.data.avatarUrl) {
        userInfo.avatarUrl = this.data.avatarUrl;
      }
      wx.setStorageSync('userInfo', userInfo);

      wx.showToast({ title: '保存成功', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
