// 云函数：deletePost - 删除帖子并回收关联统计状态。
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function resolveOwnerId(post = {}) {
  return post.authorId || post.createdBy || post.openid || post.openId || post.userOpenid || '';
}

function getOwnerCandidateIds(post = {}) {
  return [...new Set(
    [
      post.authorId,
      post.createdBy,
      post.openid,
      post.openId,
      post.userOpenid
    ]
      .map(value => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
  )];
}

// 删除帖子并回收关联统计状态。
exports.main = async (event) => {
  const { postId } = event;
  if (typeof postId !== 'string' || !postId.trim()) {
    return { success: false, code: 400, message: 'postId 参数无效' };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  try {
    const postRes = await db.collection('posts').doc(postId).get();
    const post = postRes.data;
    if (!post) {
      return { success: false, code: 404, message: '帖子不存在' };
    }
    if (!getOwnerCandidateIds(post).includes(String(openid).trim())) {
      return { success: false, code: 403, message: '无权删除他人帖子' };
    }

    await db.collection('posts').doc(postId).update({
      data: {
        status: 'deleted',
        updateTime: new Date()
      }
    });

    const commentRes = await db.collection('comments')
      .where({ postId, status: _.or([_.eq('active'), _.exists(false)]) })
      .limit(100)
      .get();

    await Promise.all((commentRes.data || []).map(comment =>
      db.collection('comments').doc(comment._id).update({
        data: { status: 'deleted' }
      })
    ));

    return { success: true, code: 200, message: '删除成功' };
  } catch (err) {
    if (err.errCode === -502001) {
      return { success: false, code: 404, message: '帖子不存在' };
    }
    return { success: false, code: 500, message: '删除帖子失败: ' + err.message };
  }
};
