// 云函数：获取猫咪列表（排行榜 / 普通列表）
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const {
    mode = "list", // 'list' | 'rank_total' | 'rank_new' | 'unknown_list'
    page = 1,
    pageSize = 20,
    keyword, // 按名字/代号/外貌搜索
  } = event;

  const pageNum = Number(page);
  const pageSizeNum = Math.min(Number(pageSize), 50);
  if (!Number.isInteger(pageNum) || pageNum < 1) {
    return { success: false, code: 400, message: "page 参数无效" };
  }

  // 基础查询：排除已合并的猫
  let query = { isMerged: _.neq(true) };

  // 按类型过滤
  if (mode === "unknown_list") {
    query.catType = "unknown";
  }

  // 关键词搜索（名字/代号/外貌）
  if (keyword && keyword.trim()) {
    const kw = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const reg = db.RegExp({ regexp: kw, options: "i" });
    query = {
      ...query,
      // 微信云DB不支持 $or 多字段搜索，改用前端过滤或外貌字段单独搜索
      // 此处先用 appearance 匹配，前端可再做名字过滤
    };
    // 关键词改为在外貌/名字中模糊匹配（只支持单字段）
    // 实际搜索逻辑在前端结合两个查询
    query.appearance = reg;
  }

  // 排序方式
  let orderField = "createTime";
  let orderDir = "desc";
  if (mode === "rank_total") {
    orderField = "totalVote";
    orderDir = "desc";
  } else if (mode === "rank_new") {
    orderField = "createTime";
    orderDir = "desc";
  }

  try {
    const totalRes = await db.collection("cats_profile").where(query).count();
    const listRes = await db
      .collection("cats_profile")
      .where(query)
      .orderBy(orderField, orderDir)
      .skip((pageNum - 1) * pageSizeNum)
      .limit(pageSizeNum)
      .get();

    return {
      success: true,
      code: 200,
      data: {
        list: listRes.data || [],
        total: totalRes.total,
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
