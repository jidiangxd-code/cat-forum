// 云函数：创建或更新用户档案
// 首次登录时自动创建；之后用于更新昵称、头像及所有资料字段
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, message: '无法获取用户身份' };
  }

  const { nickName, avatar, campus, gender, bio } = event;

  try {
    const existing = await db.collection('users').where({ openid }).limit(1).get();
    const now = new Date();

    if (existing.data && existing.data.length > 0) {
      // 更新现有记录（只更新传了值的字段）
      const updateData = { updateTime: now };
      if (nickName !== undefined) updateData.nickName = nickName;
      if (avatar !== undefined) updateData.avatar = avatar;
      if (campus !== undefined) updateData.campus = campus;
      if (gender !== undefined) updateData.gender = gender;
      if (bio !== undefined) updateData.bio = bio;

      await db.collection('users').doc(existing.data[0]._id).update({ data: updateData });
      return { success: true, message: '资料更新成功', action: 'updated' };
    } else {
      // 首次创建
      const newUser = {
        openid,
        nickName: nickName || '爱猫同学',
        avatar: avatar || '',
        campus: campus || '',
        gender: gender || '',
        bio: bio || '',
        createTime: now,
        updateTime: now
      };
      await db.collection('users').add({ data: newUser });
      return { success: true, message: '资料创建成功', action: 'created' };
    }
  } catch (err) {
    console.error('updateUserProfile 失败', err);
    return { success: false, message: '资料保存失败: ' + err.message };
  }
};