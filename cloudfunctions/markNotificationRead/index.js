// 云函数入口：标记通知为已读
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  const { notificationId = '', markAll = false } = event;

  try {
    if (markAll) {
      // 全部标记为已读
      const result = await db.collection('notifications')
        .where({ toUserId: openid, read: false })
        .update({
          data: { read: true, readTime: db.serverDate() }
        });
      return {
        success: true,
        updated: result.updated || 0,
        message: '已全部标记为已读'
      };
    } else if (notificationId) {
      // 单条标记为已读
      const result = await db.collection('notifications')
        .doc(notificationId)
        .update({
          data: { read: true, readTime: db.serverDate() }
        });
      return {
        success: true,
        updated: result.updated || 0,
        message: '已标记为已读'
      };
    } else {
      return { success: false, code: 400, message: '缺少参数' };
    }
  } catch (err) {
    return {
      success: false,
      code: 500,
      message: '标记已读失败: ' + err.message
    };
  }
};