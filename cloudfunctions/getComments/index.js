// 云函数：获取评论列表（联表查询评论者信息，解决匿名用户问题）
// 支持主评论 + 子评论（回复）的完整数据结构
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { postId } = event;
  if (!postId) {
    return { success: false, code: 400, message: '缺少 postId' };
  }

  try {
    // 使用 aggregate + lookup 联表查询 users 集合，获取评论者信息
    const result = await db.collection('comments').aggregate()
      .match({ postId })
      .sort({ createTime: 1 })
      .lookup({
        from: 'users',
        let: { authorId: '$authorId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$_openid', '$$authorId'] },
                  { $eq: ['$openid', '$$authorId'] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: 'authorInfo'
      })
      .end();

    const comments = (result.data || [])
      .filter(c => c.status !== 'deleted')
      .map(c => {
        const author = c.authorInfo && c.authorInfo[0] || {};
        return {
          ...c,
          // 优先用评论里已有的字段，找不到再从 users 集合取
          authorName: c.authorName || author.nickName || author.nickname || '匿名用户',
          authorAvatar: c.authorAvatar || author.avatar || author.avatarUrl || '',
          // 清理联表数据，避免传输过大
          authorInfo: undefined
        };
      });

    return { success: true, data: comments };
  } catch (err) {
    console.error('getComments 失败', err);
    return { success: false, code: 500, message: '获取评论失败: ' + err.message };
  }
};
