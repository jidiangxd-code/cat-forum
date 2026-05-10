/**
 * CDN 图片配置
 * 将默认图片上传到云存储后，将 fileID 填入对应字段
 * 
 * 上传方法：
 * 1. 打开微信开发者工具
 * 2. 点击左侧「云开发」->「存储」
 * 3. 上传 default-cat.png 和 default-avatar.png
 * 4. 上传完成后，右键文件 -> 「复制文件 ID」
 * 5. 将 fileID 填入下方对应位置
 */

const CDN_IMAGES = {
  // 默认猫咪图片（上传后填写云文件 ID）
  DEFAULT_CAT: 'assets/images/default-cat.png',
  
  // 默认头像（上传后填写云文件 ID）
  DEFAULT_AVATAR: 'assets/images/default-avatar.png',
  
  // 默认商品图片（如有）
  DEFAULT_GOODS: 'images/default-goods-image.png',
};

/**
 * 获取图片路径（优先使用云存储，失败则使用本地路径）
 * @param {string} key - CDN_IMAGES 的 key
 * @param {string} fallback - 本地备用路径
 * @returns {string}
 */
function getImageUrl(key) {
  return CDN_IMAGES[key] || '';
}

/**
 * 检查是否已完成云存储配置
 * @returns {boolean}
 */
function isCloudConfigured() {
  return CDN_IMAGES.DEFAULT_CAT !== 'assets/images/default-cat.png' 
      && CDN_IMAGES.DEFAULT_AVATAR !== 'assets/images/default-avatar.png';
}

module.exports = {
  CDN_IMAGES,
  getImageUrl,
  isCloudConfigured
};
