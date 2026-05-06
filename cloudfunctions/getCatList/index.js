// DEPRECATED: 旧 cats 集合查询入口。当前主链路使用 getCatProfileList + posts 查询，
// 数据模型为 cats_profile + posts。2026-05-02 检查确认前端页面无直接依赖；
// 保留此函数仅用于历史云端兼容，不再接入新页面。
// 云函数入口：获取猫咪列表
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 转义正则特殊字符，防止 ReDoS 注入
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.main = async (event, context) => {
  const { page = 1, pageSize = 10, tag, location } = event;

  // === 分页参数校验 ===
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  if (!Number.isInteger(pageNum) || pageNum < 1) {
    return { success: false, code: 400, message: "page 必须是正整数" };
  }
  if (!Number.isInteger(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 50) {
    return {
      success: false,
      code: 400,
      message: "pageSize 必须是 1-50 的整数",
    };
  }

  // 深分页限制
  const MAX_PAGE = 100;
  if (pageNum > MAX_PAGE) {
    return {
      success: false,
      code: 400,
      message: `请使用搜索功能或翻页不超过第 ${MAX_PAGE} 页`,
    };
  }

  // === 构建查询条件 ===
  // 兼容新旧字段名：authorId（新）/ createdBy（旧）
  // 兼容有无 status 字段的记录：查询 status='active' 或 status 不存在的记录
  const query = {
    status: _.or([_.eq("active"), _.exists(false)]),
  };

  // === tag 参数校验 ===
  if (tag !== undefined) {
    if (
      typeof tag !== "string" ||
      tag.trim().length === 0 ||
      tag.trim().length > 50
    ) {
      return { success: false, code: 400, message: "tag 参数无效" };
    }
    query.tags = _.in([tag.trim()]);
  }

  // === location 参数校验 + 正则转义（修复 ReDoS） ===
  if (location !== undefined) {
    if (
      typeof location !== "string" ||
      location.trim().length === 0 ||
      location.length > 50
    ) {
      return { success: false, code: 400, message: "location 参数无效" };
    }
    const escaped = escapeRegex(location.trim());
    query.location = db.RegExp({ regexp: escaped, options: "i" });
  }

  try {
    const totalResult = await db.collection("cats").where(query).count();
    const total = totalResult.total;

    const listResult = await db
      .collection("cats")
      .where(query)
      .orderBy("createTime", "desc")
      .skip((pageNum - 1) * pageSizeNum)
      .limit(pageSizeNum)
      .get();

    return {
      success: true,
      code: 200,
      data: {
        list: listResult.data,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
      },
    };
  } catch (err) {
    return {
      success: false,
      code: 500,
      message: "获取列表失败: " + err.message,
    };
  }
};
