// 云函数：获取帖子详情（每次都联表查询最新作者信息）
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

    // 2. 每次都联表查询 users 集合，获取最新昵称和头像
    //    这样即使用户改了名，帖子详情也能显示最新名字
    if (post.authorId) {
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
          // 用最新昵称覆盖（如果 users 里有的话）
          if (user.nickName) {
            post.authorName = user.nickName;
          }
          if (user.avatar) {
            post.authorAvatar = user.avatar;
          }
        }
      } catch (e) {
        console.warn('查询最新作者信息失败（使用帖子内存储的值）', e);
      }
    }

    return { success: true, data: post };
  } catch (err) {
    console.error('getPostDetail 失败', err);
    return { success: false, code: 500, message: '获取帖子详情失败: ' + err.message };
  }
};
