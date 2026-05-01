// 云函数：关注/取消关注用户
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action, fromUserId, toUserId } = event;

  if (!fromUserId || !toUserId) {
    return { success: false, code: 400, message: '缺少必要参数' };
  }

  if (fromUserId === toUserId) {
    return { success: false, code: 400, message: '不能关注自己' };
  }

  if (!['follow', 'unfollow'].includes(action)) {
    return { success: false, code: 400, message: 'action 必须是 follow 或 unfollow' };
  }

  try {
    if (action === 'follow') {
      // 检查是否已关注
      const exist = await db.collection('follows')
        .where({ fromUserId, toUserId })
        .count();

      if (exist.total > 0) {
        return { success: false, code: 409, message: '已经关注过了' };
      }

      // 写入关注记录
      await db.collection('follows').add({
        data: {
          fromUserId,
          toUserId,
          createTime: db.serverDate()
        }
      });

      // 给被关注者发通知
      try {
        const userInfo = wx.getStorageSync ? wx.getStorageSync('userInfo') : {};
        await db.collection('notifications').add({
          data: {
            toUserId,
            type: 'follow',
            fromUserId,
            fromUserName: userInfo.nickName || '某用户',
            fromUserAvatar: userInfo.avatarUrl || '',
            targetId: fromUserId,
            targetTitle: userInfo.nickName || '某用户',
            read: false,
            createTime: db.serverDate()
          }
        });
      } catch (e) {
        console.error('发送关注通知失败', e);
      }

      return { success: true, action: 'followed' };

    } else {
      // 取消关注
      const res = await db.collection('follows')
        .where({ fromUserId, toUserId })
        .get();

      if (res.data && res.data.length > 0) {
        await db.collection('follows').doc(res.data[0]._id).remove();
        return { success: true, action: 'unfollowed' };
      } else {
        return { success: false, code: 404, message: '未关注，无法取消' };
      }
    }
  } catch (err) {
    return { success: false, code: 500, message: '操作失败: ' + err.message };
  }
};
