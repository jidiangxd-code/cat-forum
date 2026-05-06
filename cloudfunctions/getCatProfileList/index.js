// 云函数：获取猫咪列表（排行榜 / 普通列表）
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function resolveVisibleCatIds(catIds = []) {
  const validIds = [...new Set((Array.isArray(catIds) ? catIds : []).filter(Boolean))];
  const visibleIds = new Set();

  for (let i = 0; i < validIds.length; i += 20) {
    const chunk = validIds.slice(i, i + 20);
    const postRes = await db.collection("posts")
      .where({
        catId: _.in(chunk),
        status: _.or([_.eq("active"), _.exists(false)])
      })
      .field({ catId: true })
      .get();

    (postRes.data || []).forEach(post => {
      if (post && post.catId) {
        visibleIds.add(post.catId);
      }
    });
  }

  return visibleIds;
}

async function filterCatsByDiscoveryVisibility(candidates = []) {
  const validCandidates = Array.isArray(candidates) ? candidates.filter(item => item && item._id) : [];
  if (validCandidates.length === 0) return [];

  const undecidedCats = validCandidates.filter(cat => typeof cat.discoveryVisible === "undefined");
  if (undecidedCats.length === 0) {
    return validCandidates.filter(cat => cat.discoveryVisible !== false);
  }

  const visibleIds = await resolveVisibleCatIds(undecidedCats.map(cat => cat._id));

  return validCandidates.filter(cat => {
    if (cat.discoveryVisible === false) return false;
    if (cat.discoveryVisible === true) return true;
    return visibleIds.has(cat._id);
  });
}

// 查询猫咪档案列表、排行与分页数据。
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
  let query = {
    isMerged: _.neq(true),
    discoveryVisible: _.or([_.eq(true), _.exists(false)])
  };

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
    const scanBatchSize = Math.min(pageSizeNum * 2, 40);
    const targetSkip = (pageNum - 1) * pageSizeNum;
    let candidateSkip = 0;
    let visibleSkipped = 0;
    let hasMore = false;
    const collected = [];

    while (collected.length < pageSizeNum) {
      const listRes = await db
        .collection("cats_profile")
        .where(query)
        .orderBy(orderField, orderDir)
        .skip(candidateSkip)
        .limit(scanBatchSize)
        .get();

      const batch = listRes.data || [];
      if (batch.length === 0) break;
      candidateSkip += batch.length;

      const visibleBatch = await filterCatsByDiscoveryVisibility(batch);
      if (visibleSkipped < targetSkip) {
        const needSkip = Math.min(targetSkip - visibleSkipped, visibleBatch.length);
        visibleSkipped += needSkip;
        collected.push(...visibleBatch.slice(needSkip, needSkip + (pageSizeNum - collected.length)));
      } else {
        collected.push(...visibleBatch.slice(0, pageSizeNum - collected.length));
      }

      if (batch.length < scanBatchSize) break;
    }

    const nextProbe = await db
      .collection("cats_profile")
      .where(query)
      .orderBy(orderField, orderDir)
      .skip(candidateSkip)
      .limit(scanBatchSize)
      .get();

    if ((nextProbe.data || []).length > 0) {
      const nextVisible = await filterCatsByDiscoveryVisibility(nextProbe.data || []);
      hasMore = hasMore || nextVisible.length > 0;
    }

    return {
      success: true,
      code: 200,
      data: {
        list: collected,
        total: targetSkip + collected.length + (hasMore ? 1 : 0),
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
