// 云函数：发布帖子 / 改绑猫咪 / 取消关联
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 确保用户在 users 集合中有记录（没有就自动创建）
async function ensureUser(openid) {
  if (!openid) return null;
  try {
    const res = await db.collection('users').where({ openid }).limit(1).get();
    if (res.data && res.data.length > 0) return res.data[0];
    // 自动创建基础记录
    const now = new Date();
    const result = await db.collection('users').add({
      data: {
        openid,
        nickName: '爱猫同学',
        avatar: '',
        createTime: now,
        updateTime: now
      }
    });
    return { _id: result._id, openid, nickName: '爱猫同学', avatar: '' };
  } catch (e) {
    console.warn('ensureUser 失败', e);
    return null;
  }
}

// 获取用户信息：优先用前端传的值，再查库
async function resolveAuthor(openid, eventAuthorName, eventAuthorAvatar) {
  // 前端传了就用前端的（双保险）
  if (eventAuthorName && eventAuthorName !== '匿名用户') {
    return {
      authorName: eventAuthorName,
      authorAvatar: eventAuthorAvatar || ''
    };
  }
  // fallback：查 users 集合
  const user = await ensureUser(openid);
  if (user) {
    return {
      authorName: user.nickName || '爱猫同学',
      authorAvatar: user.avatar || ''
    };
  }
  return { authorName: '爱猫同学', authorAvatar: '' };
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { success: false, code: 401, message: '请先登录' };

  const { action = 'publish' } = event;

  // ============ 改绑猫咪 ============
  if (action === 'updateCatId') {
    const { postId, newCatId } = event;
    if (!postId || !newCatId) {
      return { success: false, code: 400, message: '参数不完整' };
    }
    try {
      const postRes = await db.collection('posts').doc(postId).get();
      if (!postRes.data) return { success: false, code: 404, message: '帖子不存在' };
      if (postRes.data.authorId !== openid) {
        return { success: false, code: 403, message: '只有作者才能修改' };
      }
      const catRes = await db.collection('cats_profile').doc(newCatId).get();
      if (!catRes.data) return { success: false, code: 404, message: '目标猫咪不存在' };
      if (catRes.data.isMerged) return { success: false, code: 400, message: '该猫咪已被合并' };
      const now = new Date();
      await db.collection('posts').doc(postId).update({
        data: { catId: newCatId, catType: catRes.data.catType, updateTime: now }
      });
      return { success: true, message: '改绑成功' };
    } catch (err) {
      return { success: false, code: 500, message: '改绑失败：' + err.message };
    }
  }

  // ============ 取消关联 ============
  if (action === 'unbindCat') {
    const { postId } = event;
    if (!postId) return { success: false, code: 400, message: '缺少 postId' };
    try {
      const postRes = await db.collection('posts').doc(postId).get();
      if (!postRes.data) return { success: false, code: 404, message: '帖子不存在' };
      if (postRes.data.authorId !== openid) {
        return { success: false, code: 403, message: '只有作者才能修改' };
      }
      const now = new Date();
      await db.collection('posts').doc(postId).update({
        data: { catId: '', catType: '', updateTime: now }
      });
      return { success: true, message: '已取消关联' };
    } catch (err) {
      return { success: false, code: 500, message: '取消关联失败：' + err.message };
    }
  }

  // ============ 发布帖子 ============
  const {
    catId,
    images = [],
    content = '',
    category = 'daily',
    // 前端可以传入用户信息（双保险，防止 users 集合查不到）
    authorName: eventAuthorName,
    authorAvatar: eventAuthorAvatar
  } = event;

  if (!catId) return { success: false, code: 400, message: '发帖必须选择或创建一只猫咪' };
  if (!images || images.length === 0) return { success: false, code: 400, message: '请至少上传一张图片' };
  if (images.length > 9) return { success: false, code: 400, message: '图片不能超过9张' };
  if (!content.trim()) return { success: false, code: 400, message: '请填写帖子描述' };
  if (content.trim().length > 2000) return { success: false, code: 400, message: '描述不能超过2000字' };

  try {
    const catRes = await db.collection('cats_profile').doc(catId).get();
    const cat = catRes.data;
    if (!cat) return { success: false, code: 404, message: '绑定的猫咪档案不存在' };
    if (cat.isMerged) return { success: false, code: 400, message: '该猫咪已被合并，请重新选择' };

    // 获取用户信息（优先用前端传的，再查库）
    const { authorName, authorAvatar } = await resolveAuthor(openid, eventAuthorName, eventAuthorAvatar);

    const now = new Date();
    const result = await db.collection('posts').add({
      data: {
        catId, catType: cat.catType,
        images, content: content.trim(), category,
        authorId: openid, authorName, authorAvatar,
        likeCount: 0, likedBy: [], commentCount: 0,
        status: 'active', createTime: now, updateTime: now
      }
    });

    if (!cat.coverImage && images[0]) {
      await db.collection('cats_profile').doc(catId).update({
        data: { coverImage: images[0], updateTime: now }
      });
    }

    return { success: true, code: 200, data: { _id: result._id }, message: '发布成功 🎉' };
  } catch (err) {
    return { success: false, code: 500, message: '发布失败：' + err.message };
  }
};
