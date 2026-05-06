// DEPRECATED: 旧 cats 集合写入入口。当前主链路使用 createCat + publishPost，
// 数据模型为 cats_profile + posts。2026-05-02 检查确认前端页面无直接依赖；
// 保留此函数仅用于历史云端兼容，不再接入新页面。
// 云函数入口：添加猫咪帖子
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 常量定义
const MAX_NAME_LEN = 50;
const MAX_LOCATION_LEN = 100;
const MAX_DESC_LEN = 2000;
const MAX_IMAGES = 9;
const MAX_TAGS = 10;
const MAX_TAG_LEN = 20;

// 转义正则特殊字符，防止注入
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.main = async (event, context) => {
  const { name, location, description = "", images = [], tags = [] } = event;

  // === 类型检查 ===
  if (typeof name !== "string" || typeof location !== "string") {
    return {
      success: false,
      code: 400,
      message: "参数类型错误：name 和 location 必须是字符串",
    };
  }
  if (!Array.isArray(images) || !Array.isArray(tags)) {
    return {
      success: false,
      code: 400,
      message: "参数类型错误：images 和 tags 必须是数组",
    };
  }

  // === 必填 + 长度限制 ===
  const trimmedName = name.trim();
  const trimmedLocation = location.trim();

  if (!trimmedName) {
    return { success: false, code: 400, message: "猫咪名称不能为空" };
  }
  if (trimmedName.length > MAX_NAME_LEN) {
    return {
      success: false,
      code: 400,
      message: `猫咪名称不能超过 ${MAX_NAME_LEN} 个字符`,
    };
  }
  if (!trimmedLocation) {
    return { success: false, code: 400, message: "出现地点不能为空" };
  }
  if (trimmedLocation.length > MAX_LOCATION_LEN) {
    return {
      success: false,
      code: 400,
      message: `地点不能超过 ${MAX_LOCATION_LEN} 个字符`,
    };
  }

  const trimmedDesc = description.trim();
  if (trimmedDesc.length > MAX_DESC_LEN) {
    return {
      success: false,
      code: 400,
      message: `描述不能超过 ${MAX_DESC_LEN} 个字符`,
    };
  }

  // === 图片数量限制 ===
  if (images.length > MAX_IMAGES) {
    return {
      success: false,
      code: 400,
      message: `图片不能超过 ${MAX_IMAGES} 张`,
    };
  }
  // 图片路径格式校验
  for (const img of images) {
    if (
      typeof img !== "string" ||
      img.trim().length === 0 ||
      img.length > 500
    ) {
      return { success: false, code: 400, message: "图片路径格式无效" };
    }
  }

  // === 标签数量和格式限制 ===
  if (tags.length > MAX_TAGS) {
    return {
      success: false,
      code: 400,
      message: `标签不能超过 ${MAX_TAGS} 个`,
    };
  }
  for (const tag of tags) {
    if (
      typeof tag !== "string" ||
      tag.trim().length === 0 ||
      tag.trim().length > MAX_TAG_LEN
    ) {
      return {
        success: false,
        code: 400,
        message: `标签格式错误：每个标签需为 1-${MAX_TAG_LEN} 个字符的字符串`,
      };
    }
  }

  // 获取当前用户 openid
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: "请先登录" };
  }

  try {
    const now = new Date();
    const result = await db.collection("cats").add({
      data: {
        name: trimmedName,
        location: trimmedLocation,
        description: trimmedDesc,
        images,
        tags,
        authorId: openid,
        likeCount: 0,
        likedBy: [],
        commentCount: 0,
        viewCount: 0,
        status: "active",
        createTime: now,
        updateTime: now,
      },
    });

    return {
      success: true,
      code: 200,
      data: { _id: result._id },
      message: "发布成功",
    };
  } catch (err) {
    return {
      success: false,
      code: 500,
      message: "添加帖子失败: " + err.message,
    };
  }
};
