const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { commentId, liked } = event;
  if (typeof commentId !== 'string' || !commentId.trim()) {
    return { success: false, code: 400, message: 'commentId 参数无效' };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  try {
    const commentRes = await db.collection('comments').doc(commentId).get();
    const comment = commentRes.data;
    if (!comment || comment.status === 'deleted') {
      return { success: false, code: 404, message: '评论不存在' };
    }

    const likedBy = comment.likedBy || [];
    const alreadyLiked = likedBy.includes(openid);
    if (liked && alreadyLiked) {
      return { success: true, data: { liked: true, likeCount: comment.likeCount || likedBy.length || 0 } };
    }
    if (!liked && !alreadyLiked) {
      return { success: true, data: { liked: false, likeCount: comment.likeCount || likedBy.length || 0 } };
    }

    await db.collection('comments').doc(commentId).update({
      data: liked
        ? { likeCount: _.inc(1), likedBy: _.push(openid) }
        : { likeCount: _.inc(-1), likedBy: _.pull(openid) }
    });

    const nextCount = Math.max(0, (comment.likeCount || likedBy.length || 0) + (liked ? 1 : -1));
    return { success: true, data: { liked, likeCount: nextCount } };
  } catch (err) {
    if (err.errCode === -502001) {
      return { success: false, code: 404, message: '评论不存在' };
    }
    return { success: false, code: 500, message: '评论点赞失败: ' + err.message };
  }
};
