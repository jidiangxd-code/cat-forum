const api = require('../../utils/api.js');

Page({
  data: {
    nickName: '',
    avatarUrl: '',
    avatarFileId: '',
    gender: '',
    genderOptions: [
      { label: '男', value: 'male' },
      { label: '女', value: 'female' },
      { label: '保密', value: 'secret' }
    ],
    campus: '',
    bio: '',
    saving: false
  },

  onLoad() {
    this.loadUserInfo();
  },

  // 加载用户信息
  async loadUserInfo() {
    // 先读本地缓存快速展示
    const localInfo = wx.getStorageSync('userInfo');
    if (localInfo) {
      this.setData({
        nickName: localInfo.nickName || '',
        avatarUrl: localInfo.avatarUrl || ''
      });
    }

    // 再从云端拉取最新数据
    try {
      const db = wx.cloud.database();
      const openid = api.getOpenId();
      const res = await db.collection('users').where({ openid }).limit(1).get();

      if (res.data && res.data.length > 0) {
        const user = res.data[0];
        this.setData({
          nickName: user.nickName || '',
          avatarUrl: user.avatar || localInfo?.avatarUrl || '',
          avatarFileId: user.avatar || '',
          gender: user.gender || '',
          campus: user.campus || '',
          bio: user.bio || ''
        });

        // 同步更新本地缓存
        const userInfo = wx.getStorageSync('userInfo') || {};
        userInfo.nickName = user.nickName || '';
        userInfo.avatarUrl = user.avatar || '';
        wx.setStorageSync('userInfo', userInfo);
      }
    } catch (e) {
      console.warn('从云端加载用户信息失败', e);
    }
  },

  // 输入昵称
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  // 选择性别
  onGenderTap(e) {
    const val = e.currentTarget.dataset.val;
    this.setData({ gender: this.data.gender === val ? '' : val });
  },

  // 输入校区
  onCampusInput(e) {
    this.setData({ campus: e.detail.value });
  },

  // 输入个性签名
  onBioInput(e) {
    this.setData({ bio: e.detail.value });
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ avatarUrl: tempFilePath });
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
      const uploadResult = await wx.cloud.uploadFile({ cloudPath, filePath });

      this.setData({ avatarFileId: uploadResult.fileID });
      wx.hideLoading();
      wx.showToast({ title: '头像上传成功', icon: 'success' });
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
    if (this.data.nickName.trim().length < 2) {
      wx.showToast({ title: '昵称至少2个字符', icon: 'none' });
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
        gender: this.data.gender || '',
        campus: this.data.campus.trim(),
        bio: this.data.bio.trim(),
        updatedAt: db.serverDate()
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
            gender: this.data.gender || '',
            campus: this.data.campus.trim(),
            bio: this.data.bio.trim(),
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
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

      wx.showToast({ title: '保存成功 ✨', icon: 'success' });
      setTimeout(() => { wx.navigateBack(); }, 1500);
    } catch (err) {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
