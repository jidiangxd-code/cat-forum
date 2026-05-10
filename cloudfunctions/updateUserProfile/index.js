// 云函数：创建或更新用户档案
// 首次登录时自动创建；之后用于更新昵称、头像及所有资料字段
// 更新昵称时会同步批量更新该用户所有历史帖子和评论中的 authorName
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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
    let oldNickName = '';

    if (existing.data && existing.data.length > 0) {
      // 记录旧昵称，用于判断是否需要同步历史帖子
      oldNickName = existing.data[0].nickName || '';
    }

    if (existing.data && existing.data.length > 0) {
      // 更新现有记录（只更新传了非空值的字段，避免空字符串覆盖已有数据）
      const updateData = { updateTime: now };
      if (nickName !== undefined && nickName !== '') updateData.nickName = nickName;
      if (avatar !== undefined && avatar !== '') updateData.avatar = avatar;
      if (campus !== undefined && campus !== '') updateData.campus = campus;
      if (gender !== undefined && gender !== '') updateData.gender = gender;
      if (bio !== undefined) updateData.bio = bio; // bio 允许清空

      await db.collection('users').doc(existing.data[0]._id).update({ data: updateData });

      // 如果昵称有变化，同步更新历史帖子和评论的 authorName
      if (nickName !== undefined && nickName !== oldNickName && nickName) {
        await syncAuthorName(openid, nickName, avatar || '');
      }

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

      // 首次创建时也同步帖子（理论上不会有历史帖子，但保留逻辑）
      if (nickName) {
        await syncAuthorName(openid, nickName, avatar || '');
      }

      return { success: true, message: '资料创建成功', action: 'created' };
    }
  } catch (err) {
    console.error('updateUserProfile 失败', err);
    return { success: false, message: '资料保存失败: ' + err.message };
  }
};

/**
 * 同步更新该用户所有历史帖子和评论中的 authorName/authorAvatar
 * 在云函数端执行，无 20 条限制
 */
async function syncAuthorName(openid, nickName, avatar) {
  try {
    // 1. 批量更新 posts 集合
    const postUpdate = {};
    if (nickName) postUpdate.authorName = nickName;
    if (avatar) postUpdate.authorAvatar = avatar;

    if (Object.keys(postUpdate).length > 0) {
      const postRes = await db.collection('posts')
        .where({ authorId: openid })
        .update({ data: postUpdate });
      console.log(`同步更新 posts：${postRes.stats.updated} 条`);
    }

    // 2. 批量更新 comments 集合
    const commentUpdate = {};
    if (nickName) commentUpdate.authorName = nickName;
    if (avatar) commentUpdate.authorAvatar = avatar;

    if (Object.keys(commentUpdate).length > 0) {
      const commentRes = await db.collection('comments')
        .where({ authorId: openid })
        .update({ data: commentUpdate });
      console.log(`同步更新 comments：${commentRes.stats.updated} 条`);
    }
  } catch (err) {
    console.error('syncAuthorName 失败', err);
    // 不抛出错误，避免影响主要的资料更新流程
  }
}