// 云函数入口：获取当前用户通知列表
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  const { page = 1, pageSize = 20, type = '' } = event;
  const skip = (page - 1) * pageSize;

  try {
    // 构建查询条件
    const query = { toUserId: openid };
    if (type && type !== 'all') {
      query.type = type;
    }

    // 通知类型映射：前端 type -> 数据库 type
    const TYPE_MAP = {
      'like_post': 'like_post',
      'like_cat': 'like_cat',
      'comment': 'comment',
      'reply': 'reply',
      'follow': 'follow'
    };

    let finalQuery = { toUserId: openid };
    if (type && TYPE_MAP[type]) {
      finalQuery.type = TYPE_MAP[type];
    }

    // 查询通知列表（按时间倒序）
    const notifRes = await db.collection('notifications')
      .where(finalQuery)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取未读总数
    const unreadRes = await db.collection('notifications')
      .where({ toUserId: openid, read: false })
      .count();

    const notifications = notifRes.data || [];
    const unreadCount = unreadRes.total || 0;

    // 补充发布者/猫咪等信息（只补充关键字段，减少请求）
    const result = await Promise.all(notifications.map(async (n) => {
      const item = { ...n };

      // 格式化时间
      if (item.createTime) {
        const d = item.createTime instanceof Date ? item.createTime : new Date(item.createTime);
        item.timeAgo = getTimeAgo(d);
      }

      // 获取帖子/猫咪封面图（如果有）
      if (n.postId) {
        try {
          const postRes = await db.collection('posts').doc(n.postId).field({ images: true, content: true }).get();
          if (postRes.data) {
            item.coverImage = postRes.data.images && postRes.data.images[0] || '';
            item.postContent = postRes.data.content ? postRes.data.content.substring(0, 50) : '';
          }
        } catch (e) {}
      }

      return item;
    }));

    return {
      success: true,
      data: {
        list: result,
        unreadCount,
        hasMore: notifications.length === pageSize
      }
    };
  } catch (err) {
    return {
      success: false,
      code: 500,
      message: '获取通知失败: ' + err.message
    };
  }
};

function getTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + '天前';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}