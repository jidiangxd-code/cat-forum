const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    themeId: theme.getThemeId(),
    pageClass: theme.getPageClass(),
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
    theme.applyTheme(this);
    this.loadUserInfo();
  },

  // 加载用户信息（本地缓存 + 云端同步）
  async loadUserInfo() {
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') return;

    // 先读本地缓存快速展示
    const localInfo = wx.getStorageSync('userInfo');
    this.setData({
      nickName: localInfo?.nickName || '',
      avatarUrl: localInfo?.avatarUrl || '',
      gender: localInfo?.gender || '',
      campus: localInfo?.campus || '',
      bio: localInfo?.bio || ''
    });

    // 再从云端拉取最新数据
    try {
      const db = wx.cloud.database();
      const res = await db.collection('users').where({ openid }).limit(1).get();

      if (res.data && res.data.length > 0) {
        const user = res.data[0];
        const newData = {
          nickName: user.nickName || localInfo?.nickName || '',
          avatarUrl: user.avatar || localInfo?.avatarUrl || '',
          avatarFileId: user.avatar || '',
          gender: user.gender || '',
          campus: user.campus || '',
          bio: user.bio || ''
        };
        this.setData(newData);

        // 同步更新本地缓存
        const cached = localInfo || {};
        cached.nickName = newData.nickName;
        cached.avatarUrl = newData.avatarUrl;
        cached.gender = newData.gender;
        cached.campus = newData.campus;
        cached.bio = newData.bio;
        wx.setStorageSync('userInfo', cached);
      }
    } catch (e) {
      console.warn('从云端加载用户信息失败，使用本地缓存', e);
      wx.showToast({ title: '用户资料加载失败', icon: 'none' });
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
      // 通过 updateUserProfile 云函数更新云端
      try {
        await wx.cloud.callFunction({
          name: 'updateUserProfile',
          data: {
            nickName: this.data.nickName.trim(),
            avatar: this.data.avatarFileId || undefined,
            campus: this.data.campus.trim(),
            gender: this.data.gender || '',
            bio: this.data.bio.trim()
          }
        });
      } catch (err) {
        console.warn('updateUserProfile 云函数失败，尝试直接更新', err);
        // fallback: 直接操作数据库
        const db = wx.cloud.database();
        const myOpenId = api.getOpenId();
        const userResult = await db.collection('users').where({ openid: myOpenId }).get();
        const updateData = {
          nickName: this.data.nickName.trim(),
          gender: this.data.gender || '',
          campus: this.data.campus.trim(),
          bio: this.data.bio.trim(),
          updatedAt: db.serverDate()
        };
        if (this.data.avatarFileId) updateData.avatar = this.data.avatarFileId;
        if (userResult.data.length > 0) {
          await db.collection('users').doc(userResult.data[0]._id).update({ data: updateData });
        } else {
          await db.collection('users').add({ data: { openid: myOpenId, ...updateData, createdAt: db.serverDate() } });
        }
      }

      // 更新本地存储
      const userInfo = wx.getStorageSync('userInfo') || {};
      userInfo.nickName = this.data.nickName.trim();
      userInfo.avatarUrl = this.data.avatarUrl;
      userInfo.gender = this.data.gender;
      userInfo.campus = this.data.campus;
      userInfo.bio = this.data.bio;
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
