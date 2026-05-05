// DEPRECATED: 旧 cats 集合详情入口。当前主链路由 miniprogram/utils/api.js
// 的 getCatDetail 兼容层读取 posts/cats_profile。2026-05-02 检查确认前端页面
// 无直接依赖；保留此函数仅用于历史云端兼容，不再接入新页面。
// 云函数入口：获取猫咪详情
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { catId, commentPage = 1, commentPageSize = 20 } = event;

  // === 类型检查 + 长度限制 ===
  if (typeof catId !== "string" || !catId.trim()) {
    return { success: false, code: 400, message: "catId 参数无效" };
  }
  const trimmedCatId = catId.trim();
  if (trimmedCatId.length > 64) {
    return { success: false, code: 400, message: "catId 格式错误" };
  }

  // === 评论分页校验 ===
  const cPage = Math.max(Number(commentPage), 1);
  const cPageSize = Math.min(Math.max(Number(commentPageSize), 1), 50);

  try {
    const catResult = await db.collection("cats").doc(trimmedCatId).get();
    const cat = catResult.data;

    if (!cat) {
      return { success: false, code: 404, message: "猫咪帖子不存在" };
    }

    // 增加浏览次数
    await db
      .collection("cats")
      .doc(trimmedCatId)
      .update({
        data: { viewCount: _.inc(1) },
      });

    // 评论分页查询
    const commentsResult = await db
      .collection("comments")
      .where({ catId: trimmedCatId, status: "active" })
      .orderBy("createTime", "desc")
      .skip((cPage - 1) * cPageSize)
      .limit(cPageSize)
      .get();

    const commentsTotal = await db
      .collection("comments")
      .where({ catId: trimmedCatId, status: "active" })
      .count();

    return {
      success: true,
      code: 200,
      data: {
        ...cat,
        comments: commentsResult.data,
        commentPage: cPage,
        commentPageSize: cPageSize,
        commentTotal: commentsTotal.total,
      },
    };
  } catch (err) {
    if (err.errCode === -502001) {
      return { success: false, code: 404, message: "猫咪帖子不存在" };
    }
    return {
      success: false,
      code: 500,
      message: "获取详情失败: " + err.message,
    };
  }
};
