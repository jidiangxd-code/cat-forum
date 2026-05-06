// 云函数：updateUserProfile - 更新当前登录用户的个人资料。
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  const avatarFileId = String(event.avatarFileId || '').trim();
  const now = new Date();

  try {
    let userRes = await db.collection('users').where({ openid }).limit(1).get();
    if (!userRes.data.length) {
      userRes = await db.collection('users').where({ openId: openid }).limit(1).get();
    }

    const existingUser = userRes.data[0] || null;
    const nickName = String(event.nickName || existingUser?.nickName || existingUser?.nickname || '').trim();
    const gender = event.gender || existingUser?.gender || 'unknown';

    if (!nickName) {
      return { success: false, code: 400, message: '请先设置昵称后再保存头像' };
    }

    const updateData = {
      openid,
      openId: openid,
      nickName,
      gender,
      updatedAt: now
    };

    if (avatarFileId) {
      updateData.avatar = avatarFileId;
      updateData.avatarUrl = avatarFileId;
    }

    if (existingUser) {
      await db.collection('users').doc(existingUser._id).update({
        data: updateData
      });
    } else {
      await db.collection('users').add({
        data: {
          ...updateData,
          avatar: avatarFileId || '',
          avatarUrl: avatarFileId || '',
          favorites: [],
          createdAt: now
        }
      });
    }

    return {
      success: true,
      code: 200,
      data: {
        openid,
        nickName,
        gender,
        avatarUrl: avatarFileId || existingUser?.avatarUrl || existingUser?.avatar || ''
      },
      message: '保存成功'
    };
  } catch (err) {
    return {
      success: false,
      code: 500,
      message: `保存失败: ${err.message}`
    };
  }
};
