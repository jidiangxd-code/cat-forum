// 云函数：togglePostLike - 切换帖子点赞状态并返回最新结果。
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function normalizeLikedBy(list = []) {
  return [...new Set(
    (Array.isArray(list) ? list : [])
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  )];
}

// 切换帖子点赞状态并返回最终点赞结果。
exports.main = async (event) => {
  const { postId, liked } = event;
  if (typeof postId !== 'string' || !postId.trim()) {
    return { success: false, code: 400, message: 'postId 参数无效' };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  try {
    const result = await db.runTransaction(async transaction => {
      const postRes = await transaction.collection('posts').doc(postId).get();
      const post = postRes.data;
      if (!post || post.status === 'deleted') {
        throw new Error('帖子不存在');
      }

      const likedBy = normalizeLikedBy(post.likedBy);
      const alreadyLiked = likedBy.includes(openid);
      let nextLikedBy = likedBy;

      if (liked && !alreadyLiked) {
        nextLikedBy = [...likedBy, openid];
      } else if (!liked && alreadyLiked) {
        nextLikedBy = likedBy.filter(id => id !== openid);
      }

      const nextLikeCount = nextLikedBy.length;
      await transaction.collection('posts').doc(postId).update({
        data: {
          likedBy: nextLikedBy,
          likeCount: nextLikeCount
        }
      });

      return {
        liked: nextLikedBy.includes(openid),
        likeCount: nextLikeCount
      };
    });

    return {
      success: true,
      code: 200,
      data: result
    };
  } catch (err) {
    if (err.errCode === -502001 || /帖子不存在/.test(String(err.message || ''))) {
      return { success: false, code: 404, message: '帖子不存在' };
    }
    return {
      success: false,
      code: 500,
      message: '帖子点赞失败: ' + err.message
    };
  }
};
