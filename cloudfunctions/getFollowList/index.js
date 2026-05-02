// 云函数：获取关注列表 / 粉丝列表
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { userId, type, page = 1, pageSize = 20 } = event;

  if (!userId) {
    return { success: false, code: 400, message: '缺少 userId' };
  }

  if (!['following', 'followers'].includes(type)) {
    return { success: false, code: 400, message: 'type 必须是 following 或 followers' };
  }

  try {
    let records;
    if (type === 'following') {
      // 我关注的人
      records = await db.collection('follows')
        .where({ fromUserId: userId })
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();
    } else {
      // 我的粉丝
      records = await db.collection('follows')
        .where({ toUserId: userId })
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();
    }

    const list = records.data || [];

    // 如果有关注关系记录，批量查询对方用户信息
    const targetIds = list.map(r => type === 'following' ? r.toUserId : r.fromUserId);
    let userMap = {};

    if (targetIds.length > 0) {
      try {
        const usersRes = await db.collection('users')
          .where({
            _id: db.command.in(targetIds)
          })
          .field({ _id: true, nickName: true, avatarUrl: true })
          .get();

        (usersRes.data || []).forEach(u => {
          userMap[u._id] = u;
        });
      } catch (e) {
        console.error('查询用户信息失败', e);
      }
    }

    // 组装结果
    const result = list.map(r => {
      const targetId = type === 'following' ? r.toUserId : r.fromUserId;
      const user = userMap[targetId] || {};
      return {
        id: r._id,
        userId: targetId,
        nickName: user.nickName || '爱猫同学',
        avatarUrl: user.avatarUrl || '',
        createTime: r.createTime
      };
    });

    // 总数
    const countRes = type === 'following'
      ? await db.collection('follows').where({ fromUserId: userId }).count()
      : await db.collection('follows').where({ toUserId: userId }).count();

    return {
      success: true,
      data: result,
      total: countRes.total,
      page,
      pageSize
    };

  } catch (err) {
    return { success: false, code: 500, message: '查询失败: ' + err.message };
  }
};
