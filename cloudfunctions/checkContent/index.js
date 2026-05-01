// 云函数：内容安全审核
// 统一处理文字 + 图片审核，发布/评论提交前必须调用
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

/**
 * 审核文字内容
 * @param {string} content - 待审核文本
 * @returns {object} { pass: boolean, reason: string }
 */
async function checkText(content) {
  if (!content || !content.trim()) {
    return { pass: true, reason: '' };
  }
  try {
    const result = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 1, // 1=资料，2=评论，3=论坛，4=社交日志
      openid: '', // 由云运行时自动注入
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
    // 审核接口异常时，保守处理：拒绝发布
    return { pass: false, reason: '内容审核服务异常，请稍后重试' };
  }
}

/**
 * 审核图片内容
 * @param {string} fileID - 云存储文件ID
 * @returns {object} { pass: boolean, reason: string }
 */
async function checkImage(fileID) {
  if (!fileID) {
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
      openid: '',
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
    return { pass: false, reason: '图片审核服务异常，请稍后重试' };
  }
}

exports.main = async (event) => {
  const { content, images } = event;

  // 1. 文字审核
  if (content) {
    const textResult = await checkText(content);
    if (!textResult.pass) {
      return { success: false, type: 'text', reason: textResult.reason };
    }
  }

  // 2. 图片审核（并发处理，最多9张）
  if (images && Array.isArray(images) && images.length > 0) {
    const imageResults = await Promise.all(
      images.slice(0, 9).map(img => checkImage(img))
    );
    const failed = imageResults.find(r => !r.pass);
    if (failed) {
      return { success: false, type: 'image', reason: failed.reason };
    }
  }

  return { success: true, reason: '' };
};
