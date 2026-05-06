// 云函数入口：内容安全审核（调用微信 msgSecCheck API）
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MAX_TEXT_LEN = 2000;

// 转义正则特殊字符，防止注入
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 兼容旧链路的文字内容安全审核。
exports.main = async (event, context) => {
  const { text } = event;

  // === 类型检查 + 长度限制 ===
  if (typeof text !== "string") {
    return { success: false, code: 400, message: "text 参数必须是字符串" };
  }
  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return { success: false, code: 400, message: "待检查文本不能为空" };
  }
  if (trimmedText.length > MAX_TEXT_LEN) {
    return {
      success: false,
      code: 400,
      message: `文本不能超过 ${MAX_TEXT_LEN} 个字符`,
    };
  }

  try {
    // 调用微信内容安全 API
    const result = await cloud.openapi.security.msgSecCheck({
      content: trimmedText,
    });

    // 返回审核结果
    if (result.errCode === 0) {
      return {
        success: true,
        code: 200,
        data: {
          pass: true,
          label: 0,
          suggestion: "pass",
        },
        message: "内容审核通过",
      };
    } else if (result.errCode === 87014) {
      // 内容包含违法违规内容
      return {
        success: false,
        code: 400,
        data: {
          pass: false,
          label: result.label || 100,
          suggestion: result.suggestion || "block",
        },
        message: "内容包含违规信息，请修改后重试",
      };
    } else {
      // 其他错误（如调用频率超限等）
      return {
        success: false,
        code: 500,
        message: "内容审核服务异常: " + (result.errMsg || "未知错误"),
      };
    }
  } catch (err) {
    // 如果未开通内容安全 API 权限
    if (err.errCode === -1 || err.errCode === -501000) {
      return {
        success: false,
        code: 503,
        message: "内容安全服务未开通，请联系管理员",
      };
    }
    return {
      success: false,
      code: 500,
      message: "内容审核失败: " + err.message,
    };
  }
};
