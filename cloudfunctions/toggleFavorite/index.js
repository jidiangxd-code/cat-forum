// 云函数入口：收藏/取消收藏猫咪
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 切换用户的收藏状态并同步 favorites 数据。
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
    // 查询用户记录
    const userResult = await db.collection("users").where({ openid }).get();

    let favorites = [];
    let userId = null;

    if (userResult.data.length > 0) {
      userId = userResult.data[0]._id;
      favorites = userResult.data[0].favorites || [];
    } else {
      // 首次收藏，创建用户记录
      const newUser = await db.collection("users").add({
        data: {
          openid,
          nickname: "匿名用户",
          avatar: "",
          favorites: [trimmedCatId],
          createTime: new Date(),
          updateTime: new Date(),
        },
      });
      return {
        success: true,
        code: 200,
        data: { action: "added", favorites: [trimmedCatId] },
        message: "收藏成功",
      };
    }

    // 切换收藏状态
    const index = favorites.indexOf(trimmedCatId);
    let action;
    let newFavorites;

    if (index > -1) {
      newFavorites = favorites.filter((_, i) => i !== index);
      action = "removed";
    } else {
      newFavorites = [...favorites, trimmedCatId];
      action = "added";
    }

    await db
      .collection("users")
      .doc(userId)
      .update({
        data: { favorites: newFavorites, updateTime: new Date() },
      });

    return {
      success: true,
      code: 200,
      data: { action, favorites: newFavorites },
      message: action === "added" ? "收藏成功" : "取消收藏",
    };
  } catch (err) {
    return {
      success: false,
      code: 500,
      message: "收藏操作失败: " + err.message,
    };
  }
};
