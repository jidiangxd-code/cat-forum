/**
 * 用户登录 - 获取openid，同步用户资料到本地
 */
function login(options = {}) {
  const { nickName, avatarUrl } = options;
  return wx.cloud.callFunction({
    name: 'login',
    data: { nickName, avatar: avatarUrl }
  }).then(res => {
    if (res.result && res.result.openid) {
      // 登录成功，保存 openid 和用户资料到本地
      const userInfo = {
        nickName: nickName || res.result.nickName || '爱猫同学',
        avatarUrl: avatarUrl || res.result.avatarUrl || '',
        campus: '',
        gender: '',
        bio: ''
      };
      wx.setStorageSync('openId', res.result.openid);
      wx.setStorageSync('userInfo', userInfo);
      return { success: true, openid: res.result.openid, userInfo };
    }
    return { success: false };
  }).catch(err => {
    console.error('登录失败', err);
    return { success: false, error: err };
  });
}

/**
 * 静默登录（仅获取openid，不传资料）
 */
function silentLogin() {
  return wx.cloud.callFunction({ name: 'login', data: {} })
    .then(res => {
      if (res.result && res.result.openid) {
        wx.setStorageSync('openId', res.result.openid);
        return { success: true, openid: res.result.openid };
      }
      return { success: false };
    })
    .catch(() => ({ success: false }));
}