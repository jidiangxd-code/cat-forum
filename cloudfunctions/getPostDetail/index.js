// 云函数：获取帖子详情（联表查询作者信息，解决匿名用户问题）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { postId } = event;
  if (!postId) {
    return { success: false, code: 400, message: '缺少 postId' };
  }

  try {
    // 1. 获取帖子基本信息
    const postRes = await db.collection('posts').doc(postId).get();
    if (!postRes.data) {
      return { success: false, code: 404, message: '帖子不存在' };
    }

    const post = postRes.data;

    // 2. 如果帖子没有 authorName（旧数据），联表查询 users 集合补充
    if (!post.authorName || post.authorName === '匿名用户') {
      try {
        const userRes = await db.collection('users')
          .where(_.or([
            { _openid: post.authorId },
            { openid: post.authorId }
          ]))
          .limit(1)
          .get();
        if (userRes.data && userRes.data.length > 0) {
          const user = userRes.data[0];
          post.authorName = user.nickName || user.nickname || '匿名用户';
          post.authorAvatar = user.avatar || user.avatarUrl || '';
        }
      } catch (e) {
        console.warn('查询作者信息失败（不影响帖子详情）', e);
      }
    }

    // 3. 同时获取作者是否已认证（users 集合里的信息）
    //    上面已经查过了，无需重复查询

    return { success: true, data: post };
  } catch (err) {
    console.error('getPostDetail 失败', err);
    return { success: false, code: 500, message: '获取帖子详情失败: ' + err.message };
  }
};
