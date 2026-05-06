/**
 * API 工具层 - 统一管理云函数调用和数据库操作
 * 已重构为以猫咪档案(cats_profile)为核心的架构
 */

function getDB() {
  // 所有数据库访问都从这里取实例，并在未初始化时直接中断。
  if (!wx.cloud) {
    console.error('云开发未初始化');
    throw new Error('云开发未初始化');
  }
  return wx.cloud.database();
}

// 统一读取当前用户的 openId 缓存。
function getOpenId() {
  // 统一读取本地缓存的 openId，避免页面层分散处理登录态。
  return wx.getStorageSync('openId') || '';
}

function getLocalUserInfo() {
  const userInfo = wx.getStorageSync('userInfo');
  return userInfo && typeof userInfo === 'object' ? userInfo : {};
}

function isTemporaryAvatarUrl(avatarUrl = '') {
  const normalized = String(avatarUrl || '').trim();
  if (!normalized) return false;
  return /^wxfile:\/\//i.test(normalized) ||
    /^[a-zA-Z]:[\\/]/.test(normalized) ||
    /^\/(tmp|var|private)\//i.test(normalized);
}

function normalizeUserInfo(raw = {}, fallback = {}) {
  return {
    ...fallback,
    ...raw,
    nickName: String(raw.nickName || raw.nickname || fallback.nickName || '').trim(),
    avatarUrl: String(raw.avatarUrl || raw.avatar || fallback.avatarUrl || '').trim(),
    gender: raw.gender || fallback.gender || 'unknown'
  };
}

function resolveOwnerId(record = {}) {
  return record.authorId || record.createdBy || record.openid || record.openId || record.userOpenid || '';
}

function getOwnerCandidateIds(record = {}) {
  return [...new Set(
    [
      record.authorId,
      record.createdBy,
      record.openid,
      record.openId,
      record.userOpenid
    ]
      .map(value => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
  )];
}

function isOwnedByCurrentUser(record = {}, openid = getOpenId()) {
  if (!openid || openid === 'guest') return false;
  return getOwnerCandidateIds(record).includes(String(openid).trim());
}

function applyCurrentUserProfileToPost(post = {}, openid = getOpenId(), userInfo = getLocalUserInfo()) {
  if (!post || typeof post !== 'object') return post;

  if (!isOwnedByCurrentUser(post, openid)) {
    return {
      ...post,
      ownerId: resolveOwnerId(post)
    };
  }

  const nickName = String(userInfo.nickName || '').trim();
  const avatarUrl = String(userInfo.avatarUrl || '').trim();

  return {
    ...post,
    ownerId: resolveOwnerId(post),
    authorName: String(post.authorName || '').trim() || nickName || '匿名用户',
    authorAvatar: String(post.authorAvatar || '').trim() || avatarUrl || ''
  };
}

async function syncCurrentUserProfile(force = false) {
  const openid = getOpenId();
  const localUserInfo = normalizeUserInfo(getLocalUserInfo());

  if (!openid || openid === 'guest') {
    return normalizeUserInfo(localUserInfo);
  }

  const hasLocalProfile = !!(localUserInfo.nickName || localUserInfo.avatarUrl || localUserInfo.gender);
  const hasStableLocalAvatar = !!localUserInfo.avatarUrl && !isTemporaryAvatarUrl(localUserInfo.avatarUrl);
  if (hasLocalProfile && !force && hasStableLocalAvatar) {
    return normalizeUserInfo(localUserInfo);
  }

  const db = getDB();
  let cloudUser = null;

  try {
    const primaryRes = await db.collection('users').where({ openid }).limit(1).get();
    cloudUser = (primaryRes.data || [])[0] || null;

    if (!cloudUser) {
      const legacyRes = await db.collection('users').where({ openId: openid }).limit(1).get();
      cloudUser = (legacyRes.data || [])[0] || null;
    }
  } catch (err) {
    console.warn('同步用户资料失败，继续使用本地缓存', err);
  }

  const nextUserInfo = normalizeUserInfo(cloudUser || {}, localUserInfo);
  wx.setStorageSync('userInfo', nextUserInfo);

  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.userInfo = nextUserInfo;
    }
  } catch (e) {}

  return nextUserInfo;
}

const LIKED_POSTS_STORAGE_PREFIX = 'likedPosts:';
const USER_PROFILE_UPDATED_AT_KEY = 'userProfileUpdatedAt';

function getLikedPostsStorageKey(openid = getOpenId()) {
  return `${LIKED_POSTS_STORAGE_PREFIX}${openid || 'guest'}`;
}

function getLikedPostIds(openid = getOpenId()) {
  const raw = wx.getStorageSync(getLikedPostsStorageKey(openid));
  return Array.isArray(raw) ? raw.filter(id => typeof id === 'string' && id) : [];
}

function syncLikedPostIds(ids = [], openid = getOpenId()) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && id))];
  wx.setStorageSync(getLikedPostsStorageKey(openid), uniqueIds);
  return uniqueIds;
}

function updateLikedPostIds(postId, liked, openid = getOpenId()) {
  if (!postId) return [];
  const current = getLikedPostIds(openid);
  const next = liked
    ? [...new Set([...current, postId])]
    : current.filter(id => id !== postId);
  return syncLikedPostIds(next, openid);
}

function markUserProfileUpdated() {
  const stamp = Date.now();
  wx.setStorageSync(USER_PROFILE_UPDATED_AT_KEY, stamp);
  return stamp;
}

function getUserProfileUpdatedAt() {
  return Number(wx.getStorageSync(USER_PROFILE_UPDATED_AT_KEY) || 0);
}

// ==================== 云函数调用封装 ====================

function callCloud(name, params = {}) {
  // 统一封装云函数调用和错误翻译，页面层只关心业务结果。
  return wx.cloud.callFunction({ name, data: params, timeout: 30000 })
    .then(res => {
      if (res.result && res.result.success === false) {
        return Promise.reject(res.result);
      }
      return res.result;
    })
    .catch(err => {
      const errMsg = err && (err.errMsg || err.message || '');
      const errCode = err && (err.errCode || err.code);
      if (errCode === -501000 || /FUNCTION_NOT_FOUND|FunctionName parameter could not be found/i.test(errMsg)) {
        return Promise.reject({
          ...err,
          code: 'FUNCTION_NOT_FOUND',
          message: `云函数 ${name} 未部署或当前云环境不可用，请先在微信开发者工具中上传并部署 ${name}`
        });
      }
      return Promise.reject(err);
    });
}

function isFunctionNotFoundError(err) {
  const errMsg = err && (err.errMsg || err.message || '');
  const errCode = err && (err.errCode || err.code);
  return errCode === -501000 || errCode === 'FUNCTION_NOT_FOUND' || /FUNCTION_NOT_FOUND|FunctionName parameter could not be found/i.test(errMsg);
}

function isPermissionDeniedError(err) {
  const errMsg = err && (err.errMsg || err.message || '');
  const errCode = err && (err.errCode || err.code || '');
  return /permission|auth|denied/i.test(String(errMsg)) || /PERMISSION|DENIED/i.test(String(errCode));
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
 * 搜索猫咪（模糊匹配名字、代号、外貌、地点、性格，以及相关帖子的描述/位置）
 */
async function searchCatProfiles(keyword) {
  const db = getDB();
  const _ = db.command;
  const kw = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reg = db.RegExp({ regexp: kw, options: 'i' });
  const baseQuery = { isMerged: _.neq(true) };

  // 先从猫咪档案多字段做模糊匹配，覆盖名字、代号、外貌和地点。
  const catQueries = [
    db.collection('cats_profile').where({ ...baseQuery, fullName: reg }).limit(20).get(),
    db.collection('cats_profile').where({ ...baseQuery, codeName: reg }).limit(20).get(),
    db.collection('cats_profile').where({ ...baseQuery, appearance: reg }).limit(20).get(),
    db.collection('cats_profile').where({ ...baseQuery, location: reg }).limit(20).get(),
    db.collection('cats_profile').where({ ...baseQuery, personality: reg }).limit(20).get()
  ];

  // 再从帖子内容和地点反查关联猫咪，补全只在帖子里命中的档案。
  const postQueries = [
    db.collection('posts').where({ status: _.or([_.eq('active'), _.exists(false)]), location: reg }).limit(30).get(),
    db.collection('posts').where({ status: _.or([_.eq('active'), _.exists(false)]), content: reg }).limit(30).get()
  ];

  const [catResults, postResults] = await Promise.all([
    Promise.allSettled(catQueries),
    Promise.allSettled(postQueries)
  ]);

  // 用 map 合并多路查询结果，避免同一只猫重复出现在结果里。
  const map = {};
  catResults.forEach(r => {
    if (r.status === 'fulfilled') {
      (r.value.data || []).forEach(c => { map[c._id] = c; });
    }
  });

  const relatedCatIds = [];
  postResults.forEach(r => {
    if (r.status === 'fulfilled') {
      (r.value.data || []).forEach(p => {
        if (p.catId && !map[p.catId] && !relatedCatIds.includes(p.catId)) {
          relatedCatIds.push(p.catId);
        }
      });
    }
  });

  if (relatedCatIds.length > 0) {
    // 对帖子反查出的 catId 再补一次档案查询，保证结果完整。
    const relatedRes = await db.collection('cats_profile')
      .where({ ...baseQuery, _id: _.in(relatedCatIds.slice(0, 20)) })
      .limit(20)
      .get();
    (relatedRes.data || []).forEach(c => { map[c._id] = c; });
  }

  return Object.values(map);
}

/**
 * 获取带 GPS 坐标的猫咪动态，用于猫广场轨迹/活动范围估计
 */
async function getCatLocationPosts(limit = 80) {
  const db = getDB();
  const _ = db.command;
  return db.collection('posts')
    .where({
      status: _.or([_.eq('active'), _.exists(false)]),
      latitude: _.gt(0),
      longitude: _.gt(0)
    })
    .orderBy('createTime', 'desc')
    .limit(limit)
    .get()
    .then(res => ({ success: true, data: res.data || [] }));
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

  // 以 yyyy-mm-dd 作为投票日键，约束一人一天一票。
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
  const { page = 1, pageSize = 15, sort = 'latest' } = params;

  // 首页默认只展示 active 或未显式标记状态的帖子。
  let query = db.collection('posts').where({ status: _.or([_.eq('active'), _.exists(false)]) });

  if (sort === 'hot') {
    // 热门：按 likeCount 降序，再按评论数降序
    query = query.orderBy('likeCount', 'desc').orderBy('createTime', 'desc');
  } else {
    // 最新：按时间降序
    query = query.orderBy('createTime', 'desc');
  }

  return query
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
    .then(res => ({ success: true, data: res.data || [] }));
}

// ==================== 评论 ====================

function getComments(postId) {
  const db = getDB();
  const _ = db.command;
  // 评论按创建时间升序返回，便于前端再组装楼层和回复关系。
  return db.collection('comments')
    .where({
      postId,
      status: _.or([_.eq('active'), _.exists(false)])
    })
    .orderBy('createTime', 'asc')
    .get();
}

/**
 * 添加评论（调用云函数，触发通知 + 评论数更新）
 * @param {object} params - postId, catId, content, authorId, authorName, authorAvatar,
 *                           parentId, replyToUserId, replyToUserName
 */
function addComment(params) {
  return callCloud('addComment', {
    postId: params.postId || '',
    catId: params.catId || '',
    content: params.content,
    attachments: Array.isArray(params.attachments) ? params.attachments : [],
    authorId: params.authorId,
    authorName: params.authorName || '匿名用户',
    authorAvatar: params.authorAvatar || '',
    parentId: params.parentId || '',
    replyToUserId: params.replyToUserId || '',
    replyToUserName: params.replyToUserName || ''
  });
}

// 删除指定评论并回收关联统计。
function deleteComment(id) {
  return callCloud('deleteComment', { commentId: id });
}

// 删除指定帖子并同步页面列表。
async function deletePost(postId) {
  try {
    return await callCloud('deletePost', { postId });
  } catch (err) {
    const canFallback =
      isFunctionNotFoundError(err) ||
      err?.code === 403 ||
      /无权删除|只能删除自己发布的帖子/.test(String(err?.message || err?.errMsg || ''));

    if (!canFallback) {
      throw err;
    }

    const db = getDB();
    const _ = db.command;
    const openid = getOpenId();
    if (!openid || openid === 'guest') {
      throw new Error('请先登录后再删除');
    }

    try {
      const postRes = await db.collection('posts').doc(postId).get();
      const post = postRes.data;
      if (!post) {
        throw new Error('帖子不存在');
      }
      if (!isOwnedByCurrentUser(post, openid)) {
        throw new Error('只能删除自己发布的帖子');
      }

      const updateTime = typeof db.serverDate === 'function' ? db.serverDate() : new Date();
      await db.collection('posts').doc(postId).update({
        data: {
          status: 'deleted',
          updateTime
        }
      });

      const commentRes = await db.collection('comments')
        .where({
          postId,
          status: _.or([_.eq('active'), _.exists(false)])
        })
        .limit(100)
        .get();

      await Promise.all((commentRes.data || []).map(comment =>
        db.collection('comments').doc(comment._id).update({
          data: {
            status: 'deleted',
            updateTime
          }
        }).catch(() => null)
      ));

      return { success: true, code: 200, message: '删除成功', source: 'local-fallback' };
    } catch (fallbackErr) {
      if (isPermissionDeniedError(fallbackErr)) {
        throw new Error('当前删除链路需要重新部署 deletePost 云函数，或放开数据库权限后才能完成兜底删除');
      }
      throw fallbackErr;
    }
  }
}

// ==================== 点赞帖子 ====================

function togglePostLike(postId, userId, liked) {
  if (!userId || userId === 'guest') {
    return Promise.reject(new Error('请先登录后再点赞'));
  }
  return callCloud('togglePostLike', { postId, liked }).then(res => {
    const nextLiked = !!(res && res.data && res.data.liked);
    updateLikedPostIds(postId, nextLiked, userId);
    return res;
  });
}

// 切换评论点赞状态并返回最新结果。
function toggleCommentLike(commentId, liked) {
  return callCloud('toggleCommentLike', { commentId, liked });
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
    // 收藏前先查重，避免重复收藏导致脏数据。
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
    // 取消收藏时删除当前用户对应的收藏记录。
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

  // 先按收藏时间分页取收藏记录，再批量补帖子详情。
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
 * @param {object} params - content: 文字内容, images: 图片URL数组
 * @returns {object} { success: boolean, reason: string }
 */
function checkContent(params) {
  return callCloud('checkContent', params);
}

// ==================== 图片上传 ====================

async function uploadImages(filePaths, folder = 'cats') {
  // 为每张图片生成唯一云路径，避免同名文件互相覆盖。
  const uploadPromises = filePaths.map(async (path) => {
    const ext = path.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const cloudPath = `${folder}/${timestamp}-${randomStr}.${ext}`;
    const result = await wx.cloud.uploadFile({ cloudPath, filePath: path, timeout: 30000 });
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
    // 帖子搜索当前只按正文关键词匹配，结果按时间倒序返回。
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
  // 补齐封面图和投票数字段，供搜索结果直接渲染。
  // 补充投票数据
  return cats.map(c => ({
    ...c,
    totalVote: c.totalVote || 0,
    coverImage: c.coverImage || (c.images && c.images[0]) || ''
  }));
}

// ==================== 举报 ====================

/**
 * 举报帖子/评论
 * @param {object} params - postId, commentId(可选), reason(abuse/ad/fake/other), description(可选)
 */
function reportPost(params) {
  const openid = getOpenId();
  if (!openid) return Promise.reject(new Error('未登录'));

  const userInfo = wx.getStorageSync('userInfo') || {};
  // 举报接口由前端补齐举报人身份字段，云函数专注写库和审核流程。
  return callCloud('reportPost', {
    postId: params.postId,
    commentId: params.commentId || '',
    reporterId: openid,
    reporterName: userInfo.nickName || '匿名用户',
    reason: params.reason,
    description: params.description || ''
  });
}

// ==================== 通知相关 ====================

/**
 * 获取通知列表
 * @param {number} page
 * @param {number} pageSize
 * @param {string} type - ''|'like_post'|'like_cat'|'comment'|'reply'|'follow'
 */
function getNotifications(page = 1, pageSize = 20, type = '') {
  return callCloud('getNotifications', { page, pageSize, type });
}

/**
 * 标记通知已读
 * @param {string} notificationId - 通知ID（空则全部已读）
 * @param {boolean} markAll - 是否全部标记
 */
function markNotificationRead(notificationId = '', markAll = false) {
  return callCloud('markNotificationRead', { notificationId, markAll });
}

// ==================== 关注用户 ====================

/**
 * 关注/取消关注用户
 * @param {string} toUserId - 被关注者 ID
 * @param {boolean} follow - true=关注, false=取消
 */
function followUser(toUserId, follow) {
  const openid = getOpenId();
  if (!openid) return Promise.reject(new Error('未登录'));
  const userInfo = wx.getStorageSync('userInfo') || {};
  // 关注通知需要展示发起者昵称和头像，所以这里一起传给云函数。
  return callCloud('followUser', {
    action: follow ? 'follow' : 'unfollow',
    fromUserId: openid,
    toUserId,
    fromUserName: userInfo.nickName || '',
    fromUserAvatar: userInfo.avatarUrl || ''
  });
}

/**
 * 检查当前用户是否已关注某用户
 * @param {string} toUserId - 被检查的用户 ID
 * @returns {boolean}
 */
async function isFollowing(toUserId) {
  const openid = getOpenId();
  if (!openid) return false;
  const db = getDB();
  try {
    const res = await db.collection('follows')
      .where({ fromUserId: openid, toUserId })
      .count();
    return res.total > 0;
  } catch (e) {
    return false;
  }
}

/**
 * 获取关注/粉丝列表
 * @param {string} type - 'following'|'followers'
 * @param {number} page
 * @param {number} pageSize
 */
function getFollowList(type, page = 1, pageSize = 20) {
  const openid = getOpenId();
  if (!openid) return Promise.reject(new Error('未登录'));
  return callCloud('getFollowList', { userId: openid, type, page, pageSize });
}

// ==================== 外貌选项 ====================

const APPEARANCE_OPTIONS = [
  // 猫咪外貌常用选项，供创建和编辑档案页面复用。
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
  getLocalUserInfo,
  syncCurrentUserProfile,
  resolveOwnerId,
  getOwnerCandidateIds,
  isOwnedByCurrentUser,
  applyCurrentUserProfileToPost,
  checkContent,
  createCat,
  updateCat,
  getCatProfile,
  getCatProfileList,
  searchCatProfiles,
  getCatLocationPosts,
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
  deletePost,
  togglePostLike,
  toggleCommentLike,
  toggleFavorite,
  getFavoritePosts,
  uploadImages,
  searchPosts,
  searchCats,
  reportPost,
  getNotifications,
  markNotificationRead,
  followUser,
  isFollowing,
  getFollowList,
  getLikedPostIds,
  syncLikedPostIds,
  markUserProfileUpdated,
  getUserProfileUpdatedAt,
  APPEARANCE_OPTIONS,
  GENDER_OPTIONS,
  STATUS_OPTIONS
};
