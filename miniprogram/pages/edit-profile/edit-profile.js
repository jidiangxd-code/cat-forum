const api = require('../../utils/api.js');
const theme = require('../../utils/theme.js');

Page({
  data: {
    themeId: '',
    pageClass: '',
    nickName: '',
    avatarUrl: '',
    avatarFileId: '',
    gender: '',
    genderOptions: [
      { label: '♂ 男', value: 'male' },
      { label: '♀ 女', value: 'female' },
      { label: '⚪ 保密', value: 'secret' }
    ],
    campus: '',
    bio: '',
    saving: false,
    hasChanges: false
  },

  onLoad() {
    this.setData({
      themeId: theme.getThemeId(),
      pageClass: theme.getPageClass()
    });
    theme.onChange(t => this.setData({ pageClass: theme.getPageClass() }));
    this.loadUserInfo();
  },

  onShow() {
    this.setData({
      themeId: theme.getThemeId(),
      pageClass: theme.getPageClass()
    });
  },

  // ===== 加载用户信息 =====
  async loadUserInfo() {
    const openid = api.getOpenId();
    if (!openid || openid === 'guest') return;

    const local = wx.getStorageSync('userInfo') || {};
    this.setData({
      nickName: local.nickName || '',
      avatarUrl: local.avatarUrl || '',
      gender: local.gender || '',
      campus: local.campus || '',
      bio: local.bio || ''
    });

    try {
      const db = wx.cloud.database();
      const res = await db.collection('users').where({ openid: openid }).limit(1).get();
      if (res.data && res.data.length > 0) {
        const u = res.data[0];
        this.setData({
          nickName: u.nickName || this.data.nickName || '',
          avatarUrl: u.avatar || this.data.avatarUrl || '',
          avatarFileId: u.avatar || '',
          gender: u.gender || '',
          campus: u.campus || '',
          bio: u.bio || ''
        });
      }
    } catch (e) {
      console.warn('云端加载失败', e);
    }
  },

  // ===== 头像 =====
  onChooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const fp = res.tempFiles[0].tempFilePath;
        this.setData({ avatarUrl: fp, hasChanges: true });
        this._uploadAvatar(fp);
      }
    });
  },

  async _uploadAvatar(filePath) {
    wx.showLoading({ title: '上传中...', mask: true });
    try {
      const parts = filePath.split('.');
      const ext = parts[parts.length - 1] || 'jpg';
      const rnd = Math.random().toString(36).slice(2, 8);
      const cloudPath = 'avatars/' + Date.now() + '_' + rnd + '.' + ext;
      const upRes = await wx.cloud.uploadFile({ cloudPath: cloudPath, filePath: filePath });
      this.setData({ avatarFileId: upRes.fileID, avatarUrl: upRes.fileID });
      wx.hideLoading();
      wx.showToast({ title: '头像上传成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      console.error('头像上传失败', err);
      wx.showToast({ title: '头像上传失败', icon: 'none' });
    }
  },

  onAvatarError() {
    this.setData({ avatarUrl: '/assets/images/default-avatar.png' });
  },

  // ===== 昵称 =====
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value, hasChanges: true });
  },

  // ===== 性别 =====
  onGenderTap(e) {
    const val = e.currentTarget.dataset.val;
    this.setData({ gender: this.data.gender === val ? '' : val, hasChanges: true });
  },

  // ===== 校区 =====
  onCampusInput(e) {
    this.setData({ campus: e.detail.value, hasChanges: true });
  },

  // ===== 个性签名 =====
  onBioInput(e) {
    this.setData({ bio: e.detail.value, hasChanges: true });
  },

  // ===== 保存 =====
  async submitEdit() {
    const name = (this.data.nickName || '').trim();
    if (!name) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    if (name.length < 2) {
      wx.showToast({ title: '昵称至少2个字符', icon: 'none' });
      return;
    }
    if (name.length > 20) {
      wx.showToast({ title: '昵称最多20个字符', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...', mask: true });

    const gender = this.data.gender || '';
    const campus = (this.data.campus || '').trim();
    const bio = (this.data.bio || '').trim();
    const avatarFileId = this.data.avatarFileId || '';

    try {
      try {
        const d = { nickName: name, gender: gender, campus: campus, bio: bio };
        if (avatarFileId) d.avatar = avatarFileId;
        await wx.cloud.callFunction({ name: 'updateUserProfile', data: d });
      } catch (fnErr) {
        console.warn('云函数失败，直写数据库', fnErr);
        await this._fallbackSave(name, gender, campus, bio, avatarFileId);
      }

      const local = wx.getStorageSync('userInfo') || {};
      local.nickName = name;
      local.avatarUrl = avatarFileId || local.avatarUrl || '';
      local.gender = gender;
      local.campus = campus;
      local.bio = bio;
      wx.setStorageSync('userInfo', local);

      wx.hideLoading();
      this.setData({ saving: false, hasChanges: false });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.hideLoading();
      this.setData({ saving: false });
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  async _fallbackSave(nickName, gender, campus, bio, avatarFileId) {
    const db = wx.cloud.database();
    const openid = api.getOpenId();
    const res = await db.collection('users').where({ openid: openid }).limit(1).get();
    const now = new Date();
    const data = { nickName: nickName, gender: gender, campus: campus, bio: bio, updateTime: now };
    if (avatarFileId) data.avatar = avatarFileId;
    if (res.data.length > 0) {
      await db.collection('users').doc(res.data[0]._id).update({ data: data });
    } else {
      await db.collection('users').add({ data: { openid: openid, ...data, createTime: now } });
    }
  },

  // ===== 返回确认 =====
  onBack() {
    if (this.data.hasChanges && !this.data.saving) {
      wx.showModal({
        title: '放弃修改？',
        content: '你有未保存的修改，确定要返回吗？',
        confirmText: '放弃',
        confirmColor: '#FF4D4F',
        success: (res) => { if (res.confirm) wx.navigateBack(); }
      });
    } else {
      wx.navigateBack();
    }
  }
});
