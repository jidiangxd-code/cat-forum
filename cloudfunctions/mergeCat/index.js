// 云函数：合并重复猫咪（旧猫 -> 目标猫）
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { success: false, code: 401, message: "请先登录" };

  const { fromCatId, toCatId } = event;

  if (!fromCatId || !toCatId) {
    return {
      success: false,
      code: 400,
      message: "fromCatId 和 toCatId 不能为空",
    };
  }
  if (fromCatId === toCatId) {
    return { success: false, code: 400, message: "不能合并自身" };
  }

  try {
    // 1. 查询两个档案
    const [fromRes, toRes] = await Promise.all([
      db.collection("cats_profile").doc(fromCatId).get(),
      db.collection("cats_profile").doc(toCatId).get(),
    ]);
    const fromCat = fromRes.data;
    const toCat = toRes.data;

    if (!fromCat)
      return { success: false, code: 404, message: "被合并的猫咪档案不存在" };
    if (!toCat)
      return { success: false, code: 404, message: "目标猫咪档案不存在" };
    if (fromCat.isMerged)
      return { success: false, code: 400, message: "该猫咪已经被合并过了" };
    if (toCat.isMerged)
      return {
        success: false,
        code: 400,
        message: "目标猫咪档案已被合并，请选择有效档案",
      };

    const now = new Date();

    // 2. 将旧猫的所有帖子迁移到目标猫
    // 批量更新 posts 表中 catId === fromCatId 的记录
    // 微信云数据库不支持批量 update where，需要先查后改
    const postsRes = await db
      .collection("posts")
      .where({ catId: fromCatId })
      .limit(500)
      .get();

    if (postsRes.data && postsRes.data.length > 0) {
      const updatePromises = postsRes.data.map((post) =>
        db
          .collection("posts")
          .doc(post._id)
          .update({
            data: { catId: toCatId, updateTime: now },
          }),
      );
      await Promise.all(updatePromises);
    }

    // 3. 旧猫票数累加到目标猫
    await db
      .collection("cats_profile")
      .doc(toCatId)
      .update({
        data: {
          totalVote: _.inc(fromCat.totalVote || 0),
          updateTime: now,
          editLog: _.push({
            action: "merge_received",
            operator: openid,
            time: now,
            note: `从 ${fromCatId} 合并来 ${fromCat.totalVote || 0} 票`,
          }),
        },
      });

    // 4. 旧猫标记为已合并、隐藏
    await db
      .collection("cats_profile")
      .doc(fromCatId)
      .update({
        data: {
          isMerged: true,
          mergedTo: toCatId,
          updateTime: now,
          editLog: _.push({
            action: "merged",
            operator: openid,
            time: now,
            note: `已合并到 ${toCatId}`,
          }),
        },
      });

    return {
      success: true,
      code: 200,
      message: "合并成功，旧档案已隐藏，内容已迁移到目标猫咪",
      data: { toCatId, movedPosts: postsRes.data ? postsRes.data.length : 0 },
    };
  } catch (err) {
    return { success: false, code: 500, message: "合并失败: " + err.message };
  }
};
