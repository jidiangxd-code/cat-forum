// DEPRECATED: 旧 cats 集合删除入口。当前主链路由 miniprogram/utils/api.js
// 的 deleteCat 兼容层软删除 posts 并标记 comments。2026-05-02 检查确认前端页面
// 无直接依赖；保留此函数仅用于历史云端兼容，不再接入新页面。
// 云函数入口：删除猫咪帖子
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 删除或停用猫咪档案相关数据。
exports.main = async (event, context) => {
  const { catId } = event;

  // === 类型检查 + 长度限制 ===
  if (typeof catId !== "string" || !catId.trim()) {
    return { success: false, code: 400, message: "catId 参数无效" };
  }
  const trimmedCatId = catId.trim();
  if (trimmedCatId.length > 64) {
    return { success: false, code: 400, message: "catId 格式错误" };
  }

  // 获取当前用户 openid
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: "请先登录" };
  }

  try {
    // 查询帖子信息，验证权限
    const catResult = await db.collection("cats").doc(trimmedCatId).get();
    const cat = catResult.data;

    if (!cat) {
      return { success: false, code: 404, message: "帖子不存在" };
    }

    // 兼容新旧字段名：authorId（新）/ createdBy（旧）
    const authorId = cat.authorId || cat.createdBy;
    if (authorId !== openid) {
      return { success: false, code: 403, message: "无权删除他人帖子" };
    }

    // 软删除：更新状态为 deleted
    await db
      .collection("cats")
      .doc(trimmedCatId)
      .update({
        data: { status: "deleted", updateTime: new Date() },
      });

    // 同时软删除相关评论
    await db
      .collection("comments")
      .where({ catId: trimmedCatId })
      .update({ data: { status: "deleted" } });

    return { success: true, code: 200, message: "删除成功" };
  } catch (err) {
    if (err.errCode === -502001) {
      return { success: false, code: 404, message: "帖子不存在" };
    }
    return {
      success: false,
      code: 500,
      message: "删除失败: " + err.message,
    };
  }
};
