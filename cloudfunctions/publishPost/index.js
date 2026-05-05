// 云函数：发布帖子（强制绑猫）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { success: false, code: 401, message: '请先登录' };

  const {
    catId,          // 必须绑定一只猫（已存在的猫的_id）
    images = [],    // 图片 fileID 数组
    content = '',   // 帖子描述
    category = 'daily', // 帖子分类：daily/rescue/neuter/adopt/lost/other
  } = event;

  // 强制绑猫校验
  if (!catId) {
    return { success: false, code: 400, message: '发帖必须选择或创建一只猫咪' };
  }
  if (!images || images.length === 0) {
    return { success: false, code: 400, message: '请至少上传一张图片' };
  }
  if (images.length > 9) {
    return { success: false, code: 400, message: '图片不能超过9张' };
  }
  if (!content.trim()) {
    return { success: false, code: 400, message: '请填写帖子描述' };
  }
  if (content.trim().length > 2000) {
    return { success: false, code: 400, message: '描述不能超过2000字' };
  }

  try {
    // 校验猫咪档案存在且有效
    const catRes = await db.collection('cats_profile').doc(catId).get();
    const cat = catRes.data;
    if (!cat) return { success: false, code: 404, message: '绑定的猫咪档案不存在' };
    if (cat.isMerged) return { success: false, code: 400, message: '该猫咪已被合并，请重新选择' };

    const now = new Date();

    // 写入帖子
    const result = await db.collection('posts').add({
      data: {
        catId,
        catType: cat.catType,
        images,
        content: content.trim(),
        category,
        authorId: openid,
        likeCount: 0,
        likedBy: [],
        commentCount: 0,
        status: 'active',
        createTime: now,
        updateTime: now
      }
    });

    // 如果该猫没有封面图，自动设置第一张图为封面
    if (!cat.coverImage && images[0]) {
      await db.collection('cats_profile').doc(catId).update({
        data: { coverImage: images[0], updateTime: now }
      });
    }

    return {
      success: true,
      code: 200,
      data: { _id: result._id },
      message: '发布成功 🎉'
    };
  } catch (err) {
    return { success: false, code: 500, message: '发布失败: ' + err.message };
  }
};
