// 云函数入口：发送通知
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { toUserId, type, fromUserId, fromUserName, fromUserAvatar, targetId, targetTitle, content, postId, catId } = event;

  // 参数校验
  if (!toUserId || !type || !fromUserId) {
    return { success: false, code: 400, message: '缺少必填参数' };
  }

  // 不能给自己发通知
  if (toUserId === fromUserId) {
    return { success: true, action: 'skipped_self' };
  }

  // 通知类型白名单
  const ALLOWED_TYPES = ['like_post', 'like_cat', 'comment', 'reply', 'follow'];
  if (!ALLOWED_TYPES.includes(type)) {
    return { success: false, code: 400, message: '不支持的通知类型' };
  }

  try {
    const result = await db.collection('notifications').add({
      data: {
        toUserId,
        type,
        fromUserId,
        fromUserName: fromUserName || '某用户',
        fromUserAvatar: fromUserAvatar || '',
        targetId: targetId || '',
        targetTitle: targetTitle || '',
        content: content || '',
        postId: postId || '',
        catId: catId || '',
        read: false,
        createTime: db.serverDate()
      }
    });

    return {
      success: true,
      data: { _id: result._id },
      message: '通知已发送'
    };
  } catch (err) {
    return {
      success: false,
      code: 500,
      message: '发送通知失败: ' + err.message
    };
  }
};