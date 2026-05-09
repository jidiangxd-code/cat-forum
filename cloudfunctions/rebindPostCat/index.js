// 云函数：帖子改绑猫咪
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { postId, newCatId } = event;

  // 参数校验
  if (!postId || typeof postId !== 'string') {
    return { success: false, code: 400, message: '缺少 postId' };
  }
  if (!newCatId || typeof newCatId !== 'string') {
    return { success: false, code: 400, message: '缺少 newCatId' };
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
      return { success: false, code: 403, message: '只有帖子作者才能修改绑定' };
    }

    // 2. 验证目标猫咪存在且有效
    const catRes = await db.collection('cats_profile').doc(newCatId).get();
    if (!catRes.data) {
      return { success: false, code: 404, message: '目标猫咪不存在' };
    }
    if (catRes.data.isMerged) {
      return { success: false, code: 400, message: '该猫咪已被合并，请选择其他猫咪' };
    }

    const newCat = catRes.data;
    const now = new Date();

    // 3. 更新帖子的 catId 和 catType
    await db.collection('posts').doc(postId).update({
      data: {
        catId: newCatId,
        catType: newCat.catType || 'unknown',
        updateTime: now
      }
    });

    // 4. 如果新猫没有封面图，用帖子第一张图做封面
    if (!newCat.coverImage && postRes.data.images && postRes.data.images[0]) {
      await db.collection('cats_profile').doc(newCatId).update({
        data: { coverImage: postRes.data.images[0], updateTime: now }
      });
    }

    return {
      success: true,
      message: '改绑成功',
      data: {
        newCatId,
        newCatName: newCat.fullName || newCat.codeName
      }
    };
  } catch (err) {
    console.error('rebindPostCat 失败', err);
    return { success: false, code: 500, message: '改绑失败: ' + err.message };
  }
};
