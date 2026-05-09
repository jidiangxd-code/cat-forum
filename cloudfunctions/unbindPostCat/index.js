// 云函数：取消帖子猫咪关联
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { postId } = event;

  if (!postId || typeof postId !== 'string') {
    return { success: false, code: 400, message: '缺少 postId' };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  try {
    // 1. 查询帖子，验证存在性和作者身份
    const postRes = await db.collection('posts').doc(postId).get();
    if (!postRes.data) {
      return { success: false, code: 404, message: '帖子不存在' };
    }
    if (postRes.data.authorId !== openid) {
      return { success: false, code: 403, message: '只有帖子作者才能取消关联' };
    }

    const now = new Date();

    // 2. 清空 catId（帖子变为未归档状态）
    await db.collection('posts').doc(postId).update({
      data: {
        catId: '',
        catType: '',
        updateTime: now
      }
    });

    return {
      success: true,
      message: '已取消关联'
    };
  } catch (err) {
    console.error('unbindPostCat 失败', err);
    return { success: false, code: 500, message: '取消关联失败: ' + err.message };
  }
};
