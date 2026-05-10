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
 * @param {object} params - catId, images, content, category
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
 * TODO: 云函数部署完成后改为 callCloud('getPostDetail', { postId })
 * 暂用直查数据库，旧数据可能显示"匿名用户"，部署后自动修复
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

/**
 * 获取评论列表
 * TODO: 云函数部署完成后改为 callCloud('getComments', { postId })
 * 暂用直查数据库，旧数据可能显示"匿名用户"，部署后自动修复
 */
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

// ==================== 收藏 ====================

/**
 * 收藏/取消收藏帖子
 * 使用独立的 favorites 集合，不依赖 users 集合
 * @param {string} postId - 帖子ID
 * @param {boolean} favorite - true=收藏, false=取消
 */
async function toggleFavorite(postId, favorite) {
  const db = getDB();
  const openid = getOpenId();
  if (!openid) return Promise.reject(new Error('未登录'));

  if (favorite) {
    // 检查是否已收藏
    const existRes = await db.collection('favorites')
      .where({ postId, userOpenid: openid })
      .count();
    if (existRes.total > 0) {
      return { success: true, action: 'already_favorited' };
    }
    await db.collection('favorites').add({
      data: {
        postId,
        userOpenid: openid,
        createTime: db.serverDate()
      }
    });
    return { success: true, action: 'added' };
  } else {
    // 取消收藏
    const res = await db.collection('favorites')
      .where({ postId, userOpenid: openid })
      .get();
    if (res.data && res.data.length > 0) {
      await db.collection('favorites').doc(res.data[0]._id).remove();
    }
    return { success: true, action: 'removed' };
  }
}

/**
 * 获取用户收藏列表（帖子）
 * @param {number} page
 * @param {number} pageSize
 */
async function getFavoritePosts(page = 1, pageSize = 20) {
  const db = getDB();
  const openid = getOpenId();
  if (!openid) return { data: [], total: 0 };

  const favRes = await db.collection('favorites')
    .where({ userOpenid: openid })
    .orderBy('createTime', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  const favList = favRes.data || [];
  if (favList.length === 0) return { data: [], total: 0 };

  // 批量获取帖子详情
  const postIds = favList.map(f => f.postId);
  const _ = db.command;
  const postsRes = await db.collection('posts')
    .where({ _id: _.in(postIds) })
    .get();

  const postMap = {};
  (postsRes.data || []).forEach(p => { postMap[p._id] = p; });

  // 按收藏时间排列，附带帖子详情
  const result = favList.map(f => ({
    ...postMap[f.postId],
    favoriteId: f._id,
    favoriteTime: f.createTime
  })).filter(p => p._id); // 过滤掉已删除的帖子

  // 获取总数
  const totalRes = await db.collection('favorites')
    .where({ userOpenid: openid })
    .count();

  return { data: result, total: totalRes.total };
}

// ==================== 内容安全审核 ====================

/**
 * 内容安全审核（文字+图片）
 * 不使用 callCloud 封装，因为 success:false 是正常业务逻辑（内容违规），
 * 不是云函数调用异常，应该用返回值而非异常来处理。
 * @param {object} params - content: 文字内容, images: 图片云文件ID数组
 * @returns {object} { success: boolean, type: string, reason: string }
 */
function checkContent(params) {
  return wx.cloud.callFunction({ name: 'checkContent', data: params })
    .then(res => res.result || { success: true, reason: '' })
    .catch(err => {
      // 网络等异常才走到这里
      console.error('[api] checkContent 调用失败:', err);
      return { success: true, reason: '' };  // 异常时放行，不阻断用户
    });
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

/**
 * 搜索帖子（按内容关键词）
 * @param {string} keyword
 */
async function searchPosts(keyword) {
  const db = getDB();
  const _ = db.command;
  if (!keyword || !keyword.trim()) return [];
  const kw = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reg = db.RegExp({ regexp: kw, options: 'i' });
  try {
    const res = await db.collection('posts')
      .where({
        status: _.or([_.eq('active'), _.exists(false)]),
        content: reg
      })
      .orderBy('createTime', 'desc')
      .limit(30)
      .get();
    return res.data || [];
  } catch (e) {
    return [];
  }
}

/**
 * 搜索猫咪档案（按名字/代号），返回带封面和投票数
 * @param {string} keyword
 */
async function searchCats(keyword) {
  const cats = await searchCatProfiles(keyword);
  // 补充投票数据
  return cats.map(c => ({
    ...c,
    totalVote: c.totalVote || 0,
    coverImage: c.coverImage || (c.images && c.images[0]) || ''
  }));
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
  callCloud,
  checkContent,
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
  toggleFavorite,
  getFavoritePosts,
  uploadImages,
  searchPosts,
  searchCats,
  APPEARANCE_OPTIONS,
  GENDER_OPTIONS,
  STATUS_OPTIONS
};
