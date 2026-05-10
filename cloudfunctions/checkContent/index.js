// 云函数：内容安全审核
// 统一处理文字 + 图片审核，发布/评论提交前必须调用
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 违规类型映射（微信内容安全 label 说明）
// 100=正常，10001=广告，20001=时政，20002=色情，
// 20003=辱骂，20006=违法犯罪，20008=欺诈，20012=低俗，20013=版权，21000=其他
const LABEL_MAP = {
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

/**
 * 解析微信内容安全返回的 label，生成友好提示
 * @param {number} label - 微信返回的 label 值
 * @param {string} [detail] - 可选的详细说明
 * @returns {string} 友好提示语
 */
function formatReason(label, detail) {
  const labelName = LABEL_MAP[label] || `违规类型(${label})`;
  let reason = `内容包含${labelName}信息，请修改后重试`;
  if (detail) {
    reason += `\n详细信息：${detail}`;
  }
  return reason;
}

/**
 * 审核文字内容
 * @param {string} content - 待审核文本
 * @param {string} openid - 用户 openid
 * @returns {object} { pass: boolean, reason: string, label?: number }
 */
async function checkText(content, openid) {
  if (!content || !content.trim()) {
    return { pass: true, reason: '' };
  }
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 1, // 1=资料，2=评论，3=论坛，4=社交日志
      openid: openid,
      content: content.trim()
    });
    // result.label: 100=正常，其他=违规
    if (res.result.label === 100) {
      return { pass: true, reason: '' };
    }
    return {
      pass: false,
      reason: formatReason(res.result.label, res.result.message),
      label: res.result.label
    };
  } catch (err) {
    // 错误码 87014 = 内容违规（部分场景下通过 catch 返回）
    if (err.errorCode === 87014 || err.errCode === 87014) {
      const label = (err.result && err.result.label) || 21000;
      return {
        pass: false,
        reason: formatReason(label, err.errMsg),
        label: label
      };
    }
    // 其他接口异常（网络、权限等），记录日志但放行，不影响用户发布
    console.warn('[checkContent] 文字审核接口异常（已放行）:', err.errorCode || err.errCode, err.errMsg || err.message);
    return { pass: true, reason: '' };
  }
}

/**
 * 根据文件扩展名推断 contentType
 */
function getContentType(fileID) {
  const ext = (fileID || '').split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  return map[ext] || 'image/jpeg';
}

/**
 * 审核图片内容
 * @param {string} fileID - 云存储文件ID
 * @param {string} openid - 用户 openid
 * @returns {object} { pass: boolean, reason: string, label?: number }
 */
async function checkImage(fileID, openid) {
  if (!fileID) {
    return { pass: true, reason: '' };
  }
  try {
    const res = await cloud.downloadFile({ fileID });
    const buffer = res.fileContent;

    const result = await cloud.openapi.security.imgSecCheck({
      version: 2,
      scene: 1,
      openid: openid,
      media: {
        contentType: getContentType(fileID),
        value: buffer
      }
    });

    if (result.result && result.result.label === 100) {
      return { pass: true, reason: '' };
    }
    // errCode === 0 但无 result 也视为通过
    if (result.errCode === 0) {
      return { pass: true, reason: '' };
    }
    const label = (result.result && result.result.label) || 21000;
    return {
      pass: false,
      reason: `图片包含${LABEL_MAP[label] || '违规'}内容，请更换后重试`,
      label
    };
  } catch (err) {
    // 错误码 87014 = 内容违规
    if (err.errorCode === 87014 || err.errCode === 87014) {
      const label = (err.result && err.result.label) || 21000;
      return {
        pass: false,
        reason: `图片包含${LABEL_MAP[label] || '违规'}内容，请更换后重试`,
        label
      };
    }
    // 其他接口异常，记录但放行
    console.warn('[checkContent] 图片审核接口异常（已放行）:', err.errorCode || err.errCode, err.errMsg || err.message);
    return { pass: true, reason: '' };
  }
}

exports.main = async (event, context) => {
  const { content, images } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID || '';
  console.log('[checkContent] openid:', openid || '未获取');

  // 1. 文字审核
  if (content) {
    const textResult = await checkText(content, openid);
    if (!textResult.pass) {
      console.log('[checkContent] 文字审核未通过:', textResult.reason);
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
      console.log('[checkContent] 图片审核未通过:', failed.reason);
      return { success: false, type: 'image', reason: failed.reason };
    }
  }

  return { success: true, reason: '' };
};
