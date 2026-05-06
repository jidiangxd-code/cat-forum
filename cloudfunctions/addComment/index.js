// 云函数入口：添加评论（支持主帖评论 + 子评论/回复）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 处理评论、回复写入并补充通知逻辑。
exports.main = async (event, context) => {
  const {
    postId,     // 帖子ID（新增，支持 postId）
    catId,      // 猫咪档案ID
    content,
    attachments = [],
    authorName: eventAuthorName = '',
    authorAvatar: eventAuthorAvatar = '',
    // 子评论字段
    parentId,
    replyToUserId,
    replyToUserName
  } = event;

  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  const normalizedAttachments = Array.isArray(attachments)
    ? attachments
        .map(item => {
          if (!item || typeof item.url !== 'string' || !item.url.trim()) {
            return null;
          }
          return {
            type: item.type || 'image',
            url: item.url.trim(),
            name: typeof item.name === 'string' ? item.name.trim() : ''
          };
        })
        .filter(Boolean)
        .slice(0, 4)
    : [];

  // 参数校验（兼容旧版 catId 参数）
  if (!normalizedContent && normalizedAttachments.length === 0) {
    return { success: false, code: 400, message: '评论内容或附件不能为空' };
  }

  if (normalizedContent.length > 500) {
    return { success: false, code: 400, message: '评论不能超过500字' };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  // 获取用户信息
  let authorName = eventAuthorName || '匿名用户';
  let avatar = eventAuthorAvatar || '';
  try {
    const userResult = await db.collection('users')
      .where({ openid })
      .get();
    let user = userResult.data && userResult.data[0];
    if (!user) {
      const legacyUserResult = await db.collection('users')
        .where({ openId: openid })
        .get();
      user = legacyUserResult.data && legacyUserResult.data[0];
    }
    if (user) {
      authorName = user.nickName || user.authorName || authorName;
      avatar = user.avatar || avatar;
    }
  } catch (e) {
    // 用户信息获取失败不影响评论
  }

  try {
    // ---- 兼容两种调用方式 ----
    // ① 新版：传 postId，校验 posts 集合
    if (postId) {
      const postRes = await db.collection('posts').doc(postId).get();
      if (!postRes.data || postRes.data.status === 'deleted') {
        return { success: false, code: 404, message: '帖子不存在或已删除' };
      }
    }
    // ② 旧版：传 catId，校验 cats_profile 集合（向后兼容）
    else if (catId) {
      const catRes = await db.collection('cats_profile').doc(catId).get();
      if (!catRes.data || catRes.data.isMerged) {
        return { success: false, code: 404, message: '猫咪档案不存在或已合并' };
      }
    } else {
      return { success: false, code: 400, message: '缺少 postId 或 catId' };
    }

    // 子评论校验：parentId 存在时校验父评论
    if (parentId) {
      const parentRes = await db.collection('comments').doc(parentId).get();
      if (!parentRes.data) {
        return { success: false, code: 404, message: '回复的评论不存在' };
      }
      // 不允许回复自己
      if (replyToUserId === openid) {
        return { success: false, code: 400, message: '不能回复自己' };
      }
    }

    const now = new Date();
    const commentData = {
      postId: postId || '',
      catId: catId || '',
      authorId: openid,
      authorName,
      authorAvatar: avatar,
      content: normalizedContent,
      attachments: normalizedAttachments,
      status: 'active',
      createTime: now
    };

    // 子评论：记录父评论和被回复用户
    if (parentId) {
      commentData.parentId = parentId;
      commentData.replyToUserId = replyToUserId || '';
      commentData.replyToUserName = replyToUserName || '';
    }

    const result = await db.collection('comments').add({ data: commentData });

    // 更新帖子的评论数
    if (postId) {
      try {
        await db.collection('posts').doc(postId).update({
          data: { commentCount: db.command.inc(1) }
        });
      } catch (e) {
        console.error('更新评论数失败', e);
      }
    }

    // ========== 通知逻辑 ==========
    try {
      const notifyContent = normalizedContent || normalizedAttachments.map(item => {
        if (item.type === 'gif') return '[动图]';
        if (item.type === 'sticker') return '[表情包]';
        return '[图片]';
      }).join(' ');
      const notifyPayload = (toUserId, type, extra = {}) => ({
        toUserId,
        type,
        fromUserId: openid,
        fromUserName: authorName,
        fromUserAvatar: avatar,
        targetId: postId || catId || '',
        postId: postId || '',
        catId: catId || '',
        content: notifyContent,
        ...extra
      });

      if (parentId) {
        // 子评论：通知被回复用户
        if (replyToUserId && replyToUserId !== openid) {
          await db.collection('notifications').add({
            data: {
              toUserId: replyToUserId,
              type: 'reply',
              fromUserId: openid,
              fromUserName: authorName,
              fromUserAvatar: avatar,
              targetId: postId || catId || '',
              postId: postId || '',
              catId: catId || '',
              content: notifyContent,
              read: false,
              createTime: db.serverDate()
            }
          });
        }
        // 同时通知帖子作者（若非自己）
        if (postId) {
          const post = await db.collection('posts').doc(postId).get();
          if (post.data && post.data.authorId && post.data.authorId !== openid && post.data.authorId !== replyToUserId) {
            await db.collection('notifications').add({
              data: {
                toUserId: post.data.authorId,
                type: 'comment',
                fromUserId: openid,
                fromUserName: authorName,
                fromUserAvatar: avatar,
                targetId: postId,
                postId: postId,
                catId: catId || '',
                content: notifyContent,
                read: false,
                createTime: db.serverDate()
              }
            });
          }
        }
      } else if (postId) {
        // 主评论：通知帖子作者
        const post = await db.collection('posts').doc(postId).get();
        if (post.data && post.data.authorId && post.data.authorId !== openid) {
          await db.collection('notifications').add({
            data: {
              toUserId: post.data.authorId,
              type: 'comment',
              fromUserId: openid,
              fromUserName: authorName,
              fromUserAvatar: avatar,
              targetId: postId,
              postId: postId,
              catId: catId || '',
              content: notifyContent,
              read: false,
              createTime: db.serverDate()
            }
          });
        }
      }
    } catch (e) {
      console.error('通知写入失败（不影响评论）', e);
    }

    return {
      success: true,
      data: {
        _id: result._id,
        postId: postId || '',
        catId: catId || '',
        authorId: openid,
        authorName,
        authorAvatar: avatar,
        content: normalizedContent,
        attachments: normalizedAttachments,
        parentId: parentId || '',
        replyToUserId: replyToUserId || '',
        replyToUserName: replyToUserName || '',
        createTime: now
      }
    };
  } catch (err) {
    return { success: false, code: 500, message: '添加评论失败: ' + err.message };
  }
};
