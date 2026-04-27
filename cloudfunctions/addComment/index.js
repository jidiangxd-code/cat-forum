// 云函数入口：添加评论
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { catId, content } = event;

  // 参数校验
  if (!catId || !content) {
    return {
      success: false,
      code: 400,
      message: '缺少必填参数：catId 和 content'
    };
  }

  if (content.trim().length === 0) {
    return { success: false, code: 400, message: '评论内容不能为空' };
  }

  // 获取当前用户信息
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  try {
    // 验证帖子是否存在
    const catResult = await db.collection('cats').doc(catId).get();
    if (!catResult.data || catResult.data.status !== 'active') {
      return { success: false, code: 404, message: '帖子不存在或已删除' };
    }

    // 获取用户信息（昵称、头像）
    let authorName = '匿名用户';
    let avatar = '';
    try {
      const userResult = await db.collection('users')
        .where({ openId: openid })
        .get();
      if (userResult.data.length > 0) {
        authorName = userResult.data[0].authorName || '匿名用户';
        avatar = userResult.data[0].avatar || '';
      }
    } catch (e) {
      // 用户信息获取失败不影响评论
    }

    const now = new Date();
    const result = await db.collection('comments').add({
      data: {
        catId,
        authorId: openid,
        authorName,
        avatar,
        content: content.trim(),
        status: 'active',
        createTime: now
      }
    });

    return {
      success: true,
      data: {
        _id: result._id,
        catId,
        authorId: openid,
        authorName,
        content: content.trim(),
        createTime: now
      }
    };
  } catch (err) {
    return {
      success: false,
      code: 500,
      message: '添加评论失败: ' + err.message
    };
  }
};
