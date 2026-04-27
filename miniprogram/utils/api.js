/**
 * API 工具层 - 统一管理云函数调用和数据库操作
 * 已重构为以猫咪档案(cats_profile)为核心的架构
 */

function getDB() {
  if (!wx.cloud) {
    console.error('云开发未初始化');
    throw new Error('云开发未初始化');
  }
  return wx.cloud.database();
}

function getOpenId() {
  return wx.getStorageSync('openId') || '';
}

// ==================== 云函数调用封装 ====================

function callCloud(name, params = {}) {
  return wx.cloud.callFunction({ name, data: params })
    .then(res => {
      if (res.result && res.result.success === false) {
        return Promise.reject(res.result);
      }
      return res.result;
    });
}

// ==================== 猫咪档案相关 ====================

/**
 * 创建猫咪档案（正式猫 or 未知代号猫）
 * @param {object} params - catType, codeName/fullName, appearance, gender, personality, location, status, coverImage
 */
function createCat(params) {
  return callCloud('createCat', params);
}

/**
 * 更新猫咪档案信息
 * @param {string} catId
 * @param {string} action - 'edit' | 'promote'
 * @param {object} fields - 要更新的字段
 */
function updateCat(catId, action, fields) {
  return callCloud('updateCat', { catId, action, ...fields });
}

/**
 * 获取猫咪档案详情
 */
function getCatProfile(catId) {
  const db = getDB();
  return db.collection('cats_profile').doc(catId).get()
    .then(res => ({ success: true, data: res.data }));
}

/**
 * 获取猫咪列表/排行榜
 * @param {object} params - mode, page, pageSize, keyword
 * mode: 'list' | 'rank_total' | 'rank_new' | 'unknown_list'
 */
function getCatProfileList(params = {}) {
  return callCloud('getCatProfileList', params);
}

/**
 * 搜索猫咪（按名字/代号）
 * 前端分别查 fullName 和 codeName 再合并去重
 */
async function searchCatProfiles(keyword) {
  const db = getDB();
  const _ = db.command;
  const kw = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reg = db.RegExp({ regexp: kw, options: 'i' });
  const baseQuery = { isMerged: _.neq(true) };

  const [nameRes, codeRes] = await Promise.all([
    db.collection('cats_profile').where({ ...baseQuery, fullName: reg }).limit(20).get(),
    db.collection('cats_profile').where({ ...baseQuery, codeName: reg }).limit(20).get()
  ]);

  const map = {};
  [...(nameRes.data || []), ...(codeRes.data || [])].forEach(c => { map[c._id] = c; });
  return Object.values(map);
}

/**
 * 合并重复猫咪
 */
function mergeCat(fromCatId, toCatId) {
  return callCloud('mergeCat', { fromCatId, toCatId });
}

// ==================== 投票 ====================

/**
 * 投票
 */
function voteCat(catId) {
  return callCloud('voteCat', { catId });
}

/**
 * 查询当前用户今日是否已投票
 */
async function getTodayVote() {
  const db = getDB();
  const openid = getOpenId();
  if (!openid) return null;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  try {
    const res = await db.collection('votes')
      .where({ userOpenid: openid, voteDate: today })
      .limit(1)
      .get();
    return res.data && res.data.length > 0 ? res.data[0] : null;
  } catch (e) {
    return null;
  }
}

// ==================== 帖子相关 ====================

/**
 * 发布帖子（强制绑猫）
 * @param {object} params - catId, images, content
 */
function publishPost(params) {
  return callCloud('publishPost', params);
}

/**
 * 获取某只猫的所有帖子
 */
function getCatPosts(catId, page = 1, pageSize = 20) {
  const db = getDB();
  const _ = db.command;
  return db.collection('posts')
    .where({ catId, status: _.or([_.eq('active'), _.exists(false)]) })
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
    .then(res => ({ success: true, data: res.data || [] }));
}

/**
 * 获取帖子详情
 */
function getPostDetail(postId) {
  const db = getDB();
  return db.collection('posts').doc(postId).get();
}

/**
 * 获取帖子列表（首页）
 */
function getPostList(params = {}) {
  const db = getDB();
  const _ = db.command;
  const { page = 1, pageSize = 15 } = params;
  return db.collection('posts')
    .where({ status: _.or([_.eq('active'), _.exists(false)]) })
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
    .then(res => ({ success: true, data: res.data || [] }));
}

// ==================== 评论 ====================

function getComments(postId) {
  const db = getDB();
  return db.collection('comments')
    .where({ postId })
    .orderBy('createTime', 'asc')
    .get();
}

function addComment(params) {
  const db = getDB();
  return db.collection('comments').add({
    data: {
      postId: params.postId,
      catId: params.catId,
      content: params.content,
      authorId: params.authorId,
      authorName: params.authorName || '匿名用户',
      authorAvatar: params.authorAvatar || '',
      createTime: db.serverDate()
    }
  });
}

function deleteComment(id) {
  const db = getDB();
  return db.collection('comments').doc(id).remove();
}

// ==================== 点赞帖子 ====================

function togglePostLike(postId, userId, liked) {
  const db = getDB();
  const _ = db.command;
  if (liked) {
    return db.collection('posts').doc(postId).update({
      data: { likeCount: _.inc(1), likedBy: _.push(userId) }
    });
  } else {
    return db.collection('posts').doc(postId).update({
      data: { likeCount: _.inc(-1), likedBy: _.pull(userId) }
    });
  }
}

// ==================== 图片上传 ====================

async function uploadImages(filePaths, folder = 'cats') {
  const uploadPromises = filePaths.map(async (path) => {
    const ext = path.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const cloudPath = `${folder}/${timestamp}-${randomStr}.${ext}`;
    const result = await wx.cloud.uploadFile({ cloudPath, filePath: path });
    return result.fileID;
  });
  return Promise.all(uploadPromises);
}

// ==================== 外貌选项 ====================

const APPEARANCE_OPTIONS = [
  '橘猫', '橘白', '狸花', '白猫', '黑猫', '黑白', '三花', '玳瑁',
  '蓝猫', '暹罗', '折耳', '英短', '美短', '布偶', '其他'
];

const GENDER_OPTIONS = [
  { label: '公', value: 'male' },
  { label: '母', value: 'female' },
  { label: '未知', value: 'unknown' }
];

const STATUS_OPTIONS = [
  { label: '活跃', value: 'active' },
  { label: '走失', value: 'lost' },
  { label: '已领养', value: 'adopted' }
];

module.exports = {
  getOpenId,
  createCat,
  updateCat,
  getCatProfile,
  getCatProfileList,
  searchCatProfiles,
  mergeCat,
  voteCat,
  getTodayVote,
  publishPost,
  getCatPosts,
  getPostDetail,
  getPostList,
  getComments,
  addComment,
  deleteComment,
  togglePostLike,
  uploadImages,
  APPEARANCE_OPTIONS,
  GENDER_OPTIONS,
  STATUS_OPTIONS
};
