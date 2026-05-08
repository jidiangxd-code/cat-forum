// 云函数入口：用户登录，获取 openid，同时创建/更新用户档案
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  console.log('[login] OPENID:', openid);
  console.log('[login] APPID:', wxContext.APPID);
  console.log('[login] UNIONID:', wxContext.UNIONID);

  // 尝试自动创建/更新用户档案（nickName/avatar 由前端传入）
  if (openid) {
    try {
      const nickName = event.nickName || '爱猫同学';
      const avatar = event.avatar || '';
      const now = new Date();

      const existing = await db.collection('users').where({ openid }).limit(1).get();
      if (existing.data && existing.data.length > 0) {
        // 已存在，更新全部用户资料（含 nickName/avatar/campus/gender/bio）
        const updateData = { updateTime: now };
        // 只更新传入的非空字段
        if (nickName) updateData.nickName = nickName;
        if (avatar !== undefined) updateData.avatar = avatar;
        if (event.campus !== undefined) updateData.campus = event.campus;
        if (event.gender !== undefined) updateData.gender = event.gender;
        if (event.bio !== undefined) updateData.bio = event.bio;
        await db.collection('users').doc(existing.data[0]._id).update({
          data: updateData
        });
        console.log('[login] 更新用户档案:', updateData);
      } else {
        // 首次登录，创建档案
        await db.collection('users').add({
          data: {
            openid,
            nickName,
            avatar,
            campus: event.campus || '',
            gender: event.gender || '',
            bio: event.bio || '',
            createTime: now,
            updateTime: now
          }
        });
        console.log('[login] 新建用户档案:', nickName);
      }
    } catch (e) {
      console.warn('[login] 自动创建用户档案失败（不影响登录）', e.message || e);
    }
  }

  return {
    openid: openid,
    appId: wxContext.APPID,
    unionid: wxContext.UNIONID || ''
  };
};
