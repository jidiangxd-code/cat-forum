// DEPRECATED: 旧 cats 集合评论删除入口。当前主链路由 miniprogram/utils/api.js
// 的 deleteComment 软删除 comments。2026-05-02 检查确认前端页面无直接依赖；
// 保留此函数仅用于历史云端兼容，不再接入新页面。
// 云函数入口：删除评论
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { commentId } = event;

  // === 类型检查 + 长度限制 ===
  if (typeof commentId !== "string" || !commentId.trim()) {
    return { success: false, code: 400, message: "commentId 参数无效" };
  }
  const trimmedCommentId = commentId.trim();
  if (trimmedCommentId.length > 64) {
    return { success: false, code: 400, message: "commentId 格式错误" };
  }

  // 获取当前用户 openid
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: "请先登录" };
  }

  try {
    // 查询评论，验证身份
    const commentResult = await db
      .collection("comments")
      .doc(trimmedCommentId)
      .get();
    const comment = commentResult.data;

    if (!comment) {
      return { success: false, code: 404, message: "评论不存在" };
    }

    // 兼容新旧字段名：authorId（新）/ userId（旧）
    const authorId = comment.authorId || comment.userId;
    if (authorId !== openid) {
      return { success: false, code: 403, message: "无权删除他人评论" };
    }

    if (comment.status === "deleted") {
      return { success: false, code: 400, message: "评论已被删除" };
    }

    // 软删除评论
    await db
      .collection("comments")
      .doc(trimmedCommentId)
      .update({
        data: { status: "deleted" },
      });

    // 更新帖子的评论数
    try {
      if (comment.postId) {
        await db
          .collection("posts")
          .doc(comment.postId)
          .update({
            data: { commentCount: db.command.inc(-1) },
          });
      }
    } catch (e) {
      // 评论数更新失败不影响评论删除
    }

    return { success: true, code: 200, message: "删除成功" };
  } catch (err) {
    if (err.errCode === -502001) {
      return { success: false, code: 404, message: "评论不存在" };
    }
    return {
      success: false,
      code: 500,
      message: "删除评论失败: " + err.message,
    };
  }
};
