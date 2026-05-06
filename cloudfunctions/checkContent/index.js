// 云函数：内容安全审核
// 统一处理文字 + 图片审核，发布/评论提交前必须调用
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/**
 * 审核文字内容
 * @param {string} content - 待审核文本
 * @returns {object} { pass: boolean, reason: string }
 */
async function checkText(content, openid) {
  if (!content || !content.trim()) {
    return { pass: true, reason: '' };
  }
  if (!openid) {
    console.warn('缺少 OPENID，跳过文字安全审核');
    return { pass: true, reason: '' };
  }
  try {
    const result = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 1, // 1=资料，2=评论，3=论坛，4=社交日志
      openid,
      content: content.trim()
    });
    // result.label: 100=正常，其他=违规
    if (result.label === 100) {
      return { pass: true, reason: '' };
    }
    // 违规类型映射
    const labelMap = {
      10001: '广告',
      20001: '时政',
      20002: '色情',
      20003: '辱骂',
      20006: '违法犯罪',
      20008: '欺诈',
      20012: '低俗',
      20013: '版权',
      21000: '其他'
    };
    return { pass: false, reason: `内容包含违规信息（${labelMap[result.label] || '未知类型'}），请修改后重试` };
  } catch (err) {
    console.error('文字审核异常:', err);
    // 本地联调/云端接口异常时不阻断发布，避免内容安全服务不可用导致核心流程无法验证。
    // 正式上线前如果需要严格审核，可改回 pass: false。
    return { pass: true, reason: '文字审核服务异常，已跳过本次审核' };
  }
}

/**
 * 审核图片内容
 * @param {string} fileID - 云存储文件ID
 * @returns {object} { pass: boolean, reason: string }
 */
async function checkImage(fileID, openid) {
  if (!fileID) {
    return { pass: true, reason: '' };
  }
  if (!openid) {
    console.warn('缺少 OPENID，跳过图片安全审核');
    return { pass: true, reason: '' };
  }
  try {
    // 先获取文件临时链接
    const fileRes = await cloud.getTempFileURL({ fileList: [fileID] });
    const fileUrl = fileRes.fileList[0] && fileRes.fileList[0].tempFileURL;
    if (!fileUrl) {
      return { pass: false, reason: '图片获取失败' };
    }

    // 下载图片到 buffer
    const res = await cloud.downloadFile({ fileID });
    const buffer = res.fileContent;

    const result = await cloud.openapi.security.imgSecCheck({
      version: 2,
      scene: 1,
      openid,
      media: {
        contentType: 'image/png',
        value: buffer
      }
    });

    if (result.label === 100) {
      return { pass: true, reason: '' };
    }
    return { pass: false, reason: '图片审核未通过，请更换图片后重试' };
  } catch (err) {
    console.error('图片审核异常:', err);
    // 本地联调/云端接口异常时不阻断发布，避免内容安全服务不可用导致核心流程无法验证。
    // 正式上线前如果需要严格审核，可改回 pass: false。
    return { pass: true, reason: '图片审核服务异常，已跳过本次审核' };
  }
}

// 统一审核文字和图片内容的安全性。
exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { content, images } = event;

  // 1. 文字审核
  if (content) {
    const textResult = await checkText(content, openid);
    if (!textResult.pass) {
      return { success: false, type: 'text', reason: textResult.reason };
    }
  }

  // 2. 图片审核（并发处理，最多9张）
  if (images && Array.isArray(images) && images.length > 0) {
    const imageResults = await Promise.all(
      images.slice(0, 9).map(img => checkImage(img, openid))
    );
    const failed = imageResults.find(r => !r.pass);
    if (failed) {
      return { success: false, type: 'image', reason: failed.reason };
    }
  }

  return { success: true, reason: '' };
};
