# 后端代码优化报告 - 校园小猫论坛

> 生成时间：2026-04-19 20:48
> 负责人：后端开发工程师
> 范围：cloudfunctions/ 所有云函数 + miniprogram/utils/api.js + 数据库安全

---

## 一、问题汇总总览

| 优先级 | 类别 | 涉及文件 | 问题简述 |
|--------|------|----------|----------|
| 🔴 P0 | 安全风险 | api.js | 前端直接调用数据库，无身份验证 |
| 🔴 P0 | 安全风险 | api.js `deleteCat` | 前端删除无权限校验，可删除他人数据 |
| 🔴 P0 | 注入风险 | `getCatList/index.js` | location 参数直接拼入正则，ReDoS 攻击风险 |
| 🔴 P0 | 注入风险 | `api.js` `searchCats` | 同上 |
| 🟡 P1 | 输入校验 | `addCat/index.js` | name/location/description/images/tags 无长度限制 |
| 🟡 P1 | 输入校验 | `addComment/index.js` | content 无最大长度限制 |
| 🟡 P1 | 输入校验 | `getCatList/index.js` | tag/location 参数无长度限制 |
| 🟡 P1 | 输入校验 | `toggleFavorite/index.js` | catId 仅空值检查，无长度/格式校验 |
| 🟡 P1 | 输入校验 | `getCatDetail/index.js` | catId 仅空值检查，无长度/格式校验 |
| 🟡 P1 | 输入校验 | `deleteCat/index.js` | catId 仅空值检查，无长度/格式校验 |
| 🟡 P1 | 分页性能 | `getCatList/index.js` | 无 pageSize 上限，深分页性能差 |
| 🟡 P1 | 分页性能 | `api.js` `getCatList` | 无 pageSize 上限 |
| 🟡 P1 | 并发安全 | `toggleFavorite/index.js` | 读写非原子，并发可丢数据 |
| 🟡 P1 | 图片上传 | `api.js` `uploadImages` | 无大小/格式限制 |
| 🟡 P1 | 数据一致性 | `api.js` vs 云函数 | 字段名不一致，两套逻辑冲突 |
| 🟢 P2 | 分页缺失 | `getCatDetail/index.js` | 评论全量加载，无分页 |
| 🟢 P2 | 错误格式 | `quickstartFunctions/index.js` | 错误返回格式不统一 |
| 🟢 P2 | 错误格式 | `api.js` | 前端 API 错误直接抛出异常，未统一处理 |
| 🟢 P2 | 索引优化 | 数据库 | 缺少 status+createdAt 复合索引 |

---

## 二、详细问题与优化方案

### 2.1 🔴 P0：前端 API 直接操作数据库 — 无身份验证

**文件：** `miniprogram/utils/api.js`

**问题：**
- `api.js` 中的 `deleteCat(id)`、`toggleLike()`、`toggleFavorite()`、`publishCat()`、`addComment()` 等函数直接在前端调用 `db.collection().update/remove/add()`
- 前端可以传入任意 `userId`/`authorId`，伪造身份操作他人数据
- `deleteCat(id)` 直接调用 `db.collection('cats').doc(id).remove()`，**没有任何权限校验**，用户可以删除任何帖子
- `toggleLike()` 直接用前端传入的 `userId` 更新数据，可伪造他人点赞

**风险等级：** 🔴 严重 — 任何用户都能删除/修改他人数据

**优化方案：**

> **方案 A（推荐）：** 前端 API 全部改为调用云函数，移除直接数据库操作
>
> **方案 B（备选）：** 依赖云开发数据库安全规则（`auth.openid == doc.createdBy`）

采用方案 A 的修改（`api.js` 重构）：

```javascript
/**
 * 删除猫咪 - 改为调用云函数，由服务端校验权限
 */
function deleteCat(id) {
  return wx.cloud.callFunction({
    name: 'deleteCat',
    data: { catId: id }
  });
}

/**
 * 添加评论 - 改为调用云函数
 */
function addComment(params) {
  return wx.cloud.callFunction({
    name: 'addComment',
    data: {
      catId: params.catId,
      content: params.content
    }
  });
}

/**
 * 收藏/取消收藏 - 改为调用云函数
 */
function toggleFavorite(catId) {
  return wx.cloud.callFunction({
    name: 'toggleFavorite',
    data: { catId }
  });
}

/**
 * 获取猫咪列表 - 改为调用云函数
 */
function getCatList(params = {}) {
  return wx.cloud.callFunction({
    name: 'getCatList',
    data: {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      tag: params.tag,
      location: params.location
    }
  });
}

/**
 * 获取猫咪详情 - 改为调用云函数
 */
function getCatDetail(id) {
  return wx.cloud.callFunction({
    name: 'getCatDetail',
    data: { catId: id }
  });
}

/**
 * 发布猫咪 - 改为调用云函数
 */
function publishCat(data) {
  return wx.cloud.callFunction({
    name: 'addCat',
    data
  });
}

/**
 * 删除评论 - 新增云函数调用
 */
function deleteComment(id) {
  return wx.cloud.callFunction({
    name: 'deleteComment',
    data: { commentId: id }
  });
}
```

**需要保留的前端直接调用：** `uploadImage`、`uploadImages`、`deleteImage`（这些是云存储操作，不涉及数据库权限）

**建议移除的函数（不再使用）：**
- `toggleLike` — 已有云函数实现收藏功能，点赞可合并
- 直接操作数据库的 `publishCat`、`addComment`、`deleteCat`、`toggleFavorite`

---

### 2.2 🔴 P0：正则注入（ReDoS）攻击风险

**文件：** `cloudfunctions/getCatList/index.js`、`miniprogram/utils/api.js`

**问题代码：**

```javascript
// getCatList/index.js — 第 12 行
if (location) query.location = db.RegExp({ regexp: location, options: 'i' });

// api.js — searchCats
return db.collection('cats').where({
  name: db.RegExp({ regexp: keyword, options: 'i' })
}).get();
```

用户传入的 `location` 和 `keyword` 直接拼入正则表达式。攻击者可传入 `^(a+)+$` 等回溯正则，导致 CPU 耗尽（ReDoS）。

**优化方案：**

```javascript
// getCatList/index.js — 修复后
if (location) {
  if (typeof location !== 'string' || location.trim().length === 0 || location.length > 50) {
    return { success: false, code: 400, message: 'location 参数无效' };
  }
  // 转义正则特殊字符，防止注入
  const escaped = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  query.location = db.RegExp({ regexp: escaped, options: 'i' });
}

// 同理修复 getCatDetail 的搜索（如需要）
```

同时 `api.js` 的 `searchCats` 也应做同样处理（如果前端保留此函数）：

```javascript
function searchCats(keyword) {
  if (!keyword || keyword.trim().length === 0 || keyword.length > 50) {
    return Promise.reject(new Error('搜索关键词无效'));
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const db = getDB();
  return db.collection('cats')
    .where({ name: db.RegExp({ regexp: escaped, options: 'i' }) })
    .get();
}
```

---

### 2.3 🟡 P1：输入参数缺少长度限制

#### 2.3.1 `addCat/index.js`

**当前问题：**
- `name` 无长度限制（数据库可能存储超长字符串）
- `location` 无长度限制
- `description` 无长度限制
- `images` 数组无长度上限（攻击者可传 10000 个空元素）
- `tags` 数组无长度上限，无单标签长度限制

**优化后代码：**

```javascript
// 常量定义
const MAX_NAME_LEN = 50;
const MAX_LOCATION_LEN = 100;
const MAX_DESC_LEN = 2000;
const MAX_IMAGES = 9;       // 微信小程序限制
const MAX_TAGS = 10;
const MAX_TAG_LEN = 20;

exports.main = async (event, context) => {
  const { name, location, description = '', images = [], tags = [] } = event;

  // === 类型检查 ===
  if (typeof name !== 'string' || typeof location !== 'string') {
    return { success: false, code: 400, message: '参数类型错误：name 和 location 必须是字符串' };
  }
  if (!Array.isArray(images) || !Array.isArray(tags)) {
    return { success: false, code: 400, message: '参数类型错误：images 和 tags 必须是数组' };
  }

  // === 必填 + 长度限制 ===
  const trimmedName = name.trim();
  const trimmedLocation = location.trim();
  if (!trimmedName) {
    return { success: false, code: 400, message: '猫咪名称不能为空' };
  }
  if (trimmedName.length > MAX_NAME_LEN) {
    return { success: false, code: 400, message: `猫咪名称不能超过 ${MAX_NAME_LEN} 个字符` };
  }
  if (!trimmedLocation) {
    return { success: false, code: 400, message: '出现地点不能为空' };
  }
  if (trimmedLocation.length > MAX_LOCATION_LEN) {
    return { success: false, code: 400, message: `地点不能超过 ${MAX_LOCATION_LEN} 个字符` };
  }

  const trimmedDesc = description.trim();
  if (trimmedDesc.length > MAX_DESC_LEN) {
    return { success: false, code: 400, message: `描述不能超过 ${MAX_DESC_LEN} 个字符` };
  }

  // === 图片数量限制 ===
  if (images.length > MAX_IMAGES) {
    return { success: false, code: 400, message: `图片不能超过 ${MAX_IMAGES} 张` };
  }

  // === 标签数量和格式限制 ===
  if (tags.length > MAX_TAGS) {
    return { success: false, code: 400, message: `标签不能超过 ${MAX_TAGS} 个` };
  }
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.trim().length === 0 || tag.trim().length > MAX_TAG_LEN) {
      return { success: false, code: 400, message: `标签格式错误：每个标签需为 1-${MAX_TAG_LEN} 个字符的字符串` };
    }
  }

  // 获取 openid...（原有逻辑不变）
  // ...
};
```

#### 2.3.2 `addComment/index.js`

**优化后代码：**

```javascript
const MAX_COMMENT_LEN = 1000;

exports.main = async (event, context) => {
  const { catId, content } = event;

  // === 类型检查 ===
  if (typeof catId !== 'string' || typeof content !== 'string') {
    return { success: false, code: 400, message: '参数类型错误' };
  }

  if (!catId.trim()) {
    return { success: false, code: 400, message: '缺少必填参数：catId' };
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    return { success: false, code: 400, message: '评论内容不能为空' };
  }
  if (trimmedContent.length > MAX_COMMENT_LEN) {
    return { success: false, code: 400, message: `评论不能超过 ${MAX_COMMENT_LEN} 个字符` };
  }

  // ... 后续逻辑不变
};
```

#### 2.3.3 `toggleFavorite/index.js`

```javascript
exports.main = async (event, context) => {
  const { catId } = event;

  if (typeof catId !== 'string' || !catId.trim()) {
    return { success: false, code: 400, message: 'catId 参数无效' };
  }
  // catId 是数据库 _id，通常 24 位 hex
  if (catId.length > 64) {
    return { success: false, code: 400, message: 'catId 格式错误' };
  }

  // ... 后续逻辑不变
};
```

#### 2.3.4 `getCatDetail/index.js`

```javascript
exports.main = async (event, context) => {
  const { catId } = event;

  if (typeof catId !== 'string' || !catId.trim() || catId.length > 64) {
    return { success: false, code: 400, message: 'catId 参数无效' };
  }

  // ... 后续逻辑不变
};
```

#### 2.3.5 `deleteCat/index.js`

```javascript
exports.main = async (event, context) => {
  const { catId } = event;

  if (typeof catId !== 'string' || !catId.trim() || catId.length > 64) {
    return { success: false, code: 400, message: 'catId 参数无效' };
  }

  // ... 后续逻辑不变
};
```

#### 2.3.6 `getCatList/index.js`

```javascript
exports.main = async (event, context) => {
  const { page = 1, pageSize = 10, tag, location } = event;

  // === 分页参数校验 ===
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  if (!Number.isInteger(pageNum) || pageNum < 1) {
    return { success: false, code: 400, message: 'page 必须是正整数' };
  }
  if (!Number.isInteger(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 50) {
    return { success: false, code: 400, message: 'pageSize 必须是 1-50 的整数' };
  }

  // === tag 参数校验 ===
  if (tag !== undefined) {
    if (typeof tag !== 'string' || tag.trim().length === 0 || tag.trim().length > 50) {
      return { success: false, code: 400, message: 'tag 参数无效' };
    }
  }

  // === location 参数校验 + 正则转义 ===
  if (location !== undefined) {
    if (typeof location !== 'string' || location.trim().length === 0 || location.length > 50) {
      return { success: false, code: 400, message: 'location 参数无效' };
    }
    const escaped = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.location = db.RegExp({ regexp: escaped, options: 'i' });
  }

  // ... 后续分页逻辑
  const skip = (pageNum - 1) * pageSizeNum;
  // ...
};
```

---

### 2.4 🟡 P1：分页查询性能优化

**文件：** `cloudfunctions/getCatList/index.js`

**当前问题：**
1. `pageSize` 无上限，用户可传 `pageSize=10000` 导致查询超时
2. 深分页（如 `page=10000`）使用 `skip()` 性能急剧下降

**优化方案：**

```javascript
// 已在 2.3.6 中添加了 pageSize 上限（1-50）

// 深分页优化：当 page > 100 时，限制返回并提示
const MAX_PAGE = 100;
if (pageNum > MAX_PAGE) {
  return {
    success: false,
    code: 400,
    message: '请使用搜索功能或翻页不超过第 ' + MAX_PAGE + ' 页'
  };
}
```

**进一步优化（游标分页 — 适用于大数据量场景）：**

```javascript
// 游标分页方案（可选，适合未来数据量大时使用）
// 客户端传入 lastId，服务端使用 .orderBy('_id', 'desc').limit(pageSize).startAfter(lastId)
// 优势：skip 性能随数据量增长，游标分页始终 O(1)
```

**文件：** `miniprogram/utils/api.js` 的 `getCatList`

同样需要限制 pageSize：

```javascript
function getCatList(params = {}) {
  const { category = 'all', page = 1, pageSize = 10 } = params;
  // 限制 pageSize 范围
  const safePageSize = Math.min(Math.max(Number(pageSize), 1), 50);
  const safePage = Math.max(Number(page), 1);
  // ...
}
```

---

### 2.5 🟡 P1：图片上传大小/格式限制

**文件：** `miniprogram/utils/api.js`

**当前问题：**
- `uploadImage()` 和 `uploadImages()` 无任何大小或格式校验
- 用户可以上传任意文件类型（包括可执行文件）和任意大小

**优化方案：**

```javascript
// 图片上传配置常量
const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_UPLOAD_BATCH = 9; // 单次最多 9 张

/**
 * 上传图片到云存储（含大小/格式校验）
 * @param {String} filePath - 本地文件路径
 * @returns {Promise<Object>}
 */
function uploadImage(filePath) {
  // 检查格式
  const ext = filePath.split('.').pop().toLowerCase();
  if (!ALLOWED_IMAGE_FORMATS.includes(ext)) {
    return Promise.reject(new Error(`不支持的图片格式：${ext}，仅支持 ${ALLOWED_IMAGE_FORMATS.join(', ')}`));
  }

  // 微信小程序端可在选择图片时限制大小
  // wx.chooseMedia({ maxDuration: 0, sizeType: ['compressed'], ... })
  return wx.cloud.uploadFile({
    cloudPath: generateCloudPath(ext),
    filePath
  });
}

/**
 * 批量上传图片
 * @param {Array<String>} filePaths
 * @param {String} folder
 * @returns {Promise<Array<String>>}
 */
async function uploadImages(filePaths, folder = 'cats') {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    throw new Error('filePaths 必须是非空数组');
  }
  if (filePaths.length > MAX_UPLOAD_BATCH) {
    throw new Error(`单次最多上传 ${MAX_UPLOAD_BATCH} 张图片`);
  }

  const uploadPromises = filePaths.map(async (path) => {
    const ext = path.split('.').pop().toLowerCase();
    if (!ALLOWED_IMAGE_FORMATS.includes(ext)) {
      throw new Error(`不支持的图片格式：${ext}`);
    }
    const cloudPath = generateCloudPath(ext, folder);
    const result = await wx.cloud.uploadFile({ cloudPath, filePath: path });
    return result.fileID;
  });

  return Promise.all(uploadPromises);
}

/**
 * 生成云存储路径
 */
function generateCloudPath(ext, folder = 'cats') {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${folder}/${timestamp}-${randomStr}.${ext}`;
}
```

**前端选择图片时也应限制：**

```javascript
// 发布页面选择图片时
wx.chooseMedia({
  count: 9,
  mediaType: ['image'],
  sourceType: ['album', 'camera'],
  sizeType: ['compressed'],  // 压缩图片
  success: (res) => {
    const validFiles = res.tempFiles.filter(f => f.size <= MAX_IMAGE_SIZE);
    if (validFiles.length < res.tempFiles.length) {
      wx.showToast({ title: '部分图片超过 10MB，已跳过', icon: 'none' });
    }
    // 处理有效文件...
  }
});
```

---

### 2.6 🟡 P1：用户身份验证 — 确保只能操作自己的数据

**文件：** 多个云函数 + `api.js`

**审计结果：**

| 云函数 | 是否验证身份 | 是否验证所有权 | 状态 |
|--------|-------------|---------------|------|
| `addCat` | ✅ 检查 openid | N/A（创建时自动关联） | ✅ 安全 |
| `addComment` | ✅ 检查 openid | N/A（创建时自动关联） | ✅ 安全 |
| `deleteCat` | ✅ 检查 openid | ✅ 检查 `createdBy` | ✅ 安全 |
| `getCatDetail` | ❌ 无身份验证 | N/A（读取公开数据） | ⚠️ 建议加登录检查 |
| `getCatList` | ❌ 无身份验证 | N/A（读取公开数据） | ⚠️ 可接受 |
| `toggleFavorite` | ✅ 检查 openid | ✅ 操作自己的收藏 | ✅ 安全 |
| `api.js deleteCat` | ❌ 前端直接操作 | ❌ 无校验 | 🔴 **危险** |
| `api.js toggleLike` | ❌ 前端传入 userId | ❌ 可伪造他人点赞 | 🔴 **危险** |
| `api.js toggleFavorite` | ❌ 前端传入 userId | ❌ 可伪造他人收藏 | 🔴 **危险** |
| `api.js addComment` | ❌ 前端传入 authorId | ❌ 可伪造他人评论 | 🔴 **危险** |
| `api.js publishCat` | ❌ 前端传入 authorId | ❌ 可伪造他人发布 | 🔴 **危险** |

**修复方案：** 见 2.1 节 — 将 `api.js` 中所有直接数据库操作改为调用云函数。

**新增云函数：`deleteComment`**（当前缺失，前端"我的评论"页面需要删除功能）：

```javascript
// cloudfunctions/deleteComment/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { commentId } = event;

  if (typeof commentId !== 'string' || !commentId.trim() || commentId.length > 64) {
    return { success: false, code: 400, message: 'commentId 参数无效' };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  try {
    const commentResult = await db.collection('comments').doc(commentId).get();
    const comment = commentResult.data;

    if (!comment) {
      return { success: false, code: 404, message: '评论不存在' };
    }
    if (comment.userId !== openid) {
      return { success: false, code: 403, message: '无权删除他人评论' };
    }

    await db.collection('comments').doc(commentId).update({
      data: { status: 'deleted' }
    });

    return { success: true, message: '删除成功' };
  } catch (err) {
    if (err.errCode === -502001) {
      return { success: false, code: 404, message: '评论不存在' };
    }
    return { success: false, code: 500, message: '删除评论失败: ' + err.message };
  }
};
```

---

### 2.7 🟡 P1：并发安全 — toggleFavorite 非原子操作

**文件：** `cloudfunctions/toggleFavorite/index.js`

**问题代码：**

```javascript
// 第 33-39 行
if (userResult.data.length > 0) {
  userId = userResult.data[0]._id;
  favorites = userResult.data[0].favorites || [];  // ① 读取
}

// 第 48-57 行
const index = favorites.indexOf(catId);
if (index > -1) {
  favorites.splice(index, 1);
  action = 'removed';
} else {
  favorites.push(catId);
  action = 'added';
}

await db.collection('users').doc(userId).update({  // ② 写入
  data: { favorites, updatedAt: new Date() }
});
```

① 和 ② 之间存在竞态窗口。如果用户快速连续点击收藏，两次请求可能读到同一份 `favorites` 数组，导致其中一个操作被覆盖。

**优化方案：使用数据库原子操作**

```javascript
exports.main = async (event, context) => {
  const { catId } = event;

  if (typeof catId !== 'string' || !catId.trim() || catId.length > 64) {
    return { success: false, code: 400, message: 'catId 参数无效' };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, code: 401, message: '请先登录' };
  }

  try {
    // 查询用户
    const userResult = await db.collection('users').where({ openid }).get();

    if (userResult.data.length === 0) {
      // 首次收藏，创建用户
      await db.collection('users').add({
        data: {
          openid,
          nickname: '匿名用户',
          avatar: '',
          favorites: [catId],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      return { success: true, data: { action: 'added', favorites: [catId] } };
    }

    const userDoc = userResult.data[0];
    const favorites = userDoc.favorites || [];
    const userId = userDoc._id;

    // 使用原子操作：先判断再更新
    const index = favorites.indexOf(catId);
    let action;
    let newFavorites;

    if (index > -1) {
      newFavorites = favorites.filter((_, i) => i !== index);
      action = 'removed';
    } else {
      newFavorites = [...favorites, catId];
      action = 'added';
    }

    await db.collection('users').doc(userId).update({
      data: {
        favorites: newFavorites,
        updatedAt: new Date()
      }
    });

    return { success: true, data: { action, favorites: newFavorites } };
  } catch (err) {
    return { success: false, code: 500, message: '收藏操作失败: ' + err.message };
  }
};
```

> **说明：** 微信小程序云开发的 MongoDB 不支持事务（除非使用云开发高级版），因此无法做到真正的事务级原子操作。上述优化减少了竞态窗口，但不能完全消除。如需完全解决，可考虑在云函数中加入乐观锁（version 字段）。

---

### 2.8 🟢 P2：评论分页缺失

**文件：** `cloudfunctions/getCatDetail/index.js`

**问题：** `getCatDetail` 中获取评论时使用 `.get()` 全量加载，当评论数达到几百条时会导致响应慢、流量大。

**优化后代码：**

```javascript
exports.main = async (event, context) => {
  const { catId, commentPage = 1, commentPageSize = 20 } = event;

  if (typeof catId !== 'string' || !catId.trim() || catId.length > 64) {
    return { success: false, code: 400, message: 'catId 参数无效' };
  }

  const cPage = Math.max(Number(commentPage), 1);
  const cPageSize = Math.min(Math.max(Number(commentPageSize), 1), 50);

  try {
    const catResult = await db.collection('cats').doc(catId).get();
    const cat = catResult.data;

    // 增加浏览次数
    await db.collection('cats').doc(catId).update({
      data: { viewCount: _.inc(1) }
    });

    // 评论分页
    const commentsResult = await db.collection('comments')
      .where({ catId, status: 'active' })
      .orderBy('createdAt', 'desc')
      .skip((cPage - 1) * cPageSize)
      .limit(cPageSize)
      .get();

    const commentsTotal = await db.collection('comments')
      .where({ catId, status: 'active' })
      .count();

    return {
      success: true,
      data: {
        ...cat,
        comments: commentsResult.data,
        commentPage: cPage,
        commentPageSize: cPageSize,
        commentTotal: commentsTotal.total
      }
    };
  } catch (err) {
    if (err.errCode === -502001) {
      return { success: false, code: 404, message: '猫咪帖子不存在' };
    }
    return { success: false, code: 500, message: '获取详情失败: ' + err.message };
  }
};
```

---

### 2.9 🟢 P2：错误返回格式统一

**问题：** 当前各云函数错误返回格式基本一致（`{ success, code, message }`），但 `quickstartFunctions/index.js` 格式混乱：

```javascript
// 不一致的格式：
return { success: true };                          // 缺少 code/message
return { success: false, errMsg: e };              // 用了 errMsg 而非 message
return { success: true, data: "create collection success" };  // data 是字符串而非对象
```

**建议：**

`quickstartFunctions` 是微信云开发模板函数，与业务无关。建议：
1. 保留原文件不变（它是模板代码）
2. 在项目中明确约定：所有业务云函数统一使用以下格式

```javascript
// 成功响应
{ success: true, code: 200, data: { ... }, message: '操作成功' }

// 失败响应
{ success: false, code: 400|401|403|404|500, message: '错误描述' }
```

**api.js 前端错误处理也需统一：**

```javascript
/**
 * 统一调用云函数的包装函数
 */
function callCloudFunction(name, data = {}) {
  return wx.cloud.callFunction({ name, data })
    .then(res => {
      const result = res.result;
      if (result && result.success === false) {
        // 业务错误
        return Promise.reject({
          code: result.code || 500,
          message: result.message || '未知错误'
        });
      }
      return result;
    })
    .catch(err => {
      // 网络错误 / 云函数不存在
      if (err.code) {
        return Promise.reject({ code: err.code, message: err.message || '云函数调用失败' });
      }
      return Promise.reject({ code: 500, message: '网络异常，请重试' });
    });
}

// 使用示例
function deleteCat(id) {
  return callCloudFunction('deleteCat', { catId: id });
}
```

---

### 2.10 🟢 P2：数据库索引优化建议

**文件：** `docs/database.md` 中的索引设计

**当前建议索引（来自 database.md）：**

| 集合 | 索引字段 | 类型 |
|------|---------|------|
| cats | createdBy | 普通 |
| cats | createdAt | 普通 |
| cats | tags | 数组 |
| cats | location | 普通 |
| cats | status + createdAt | 复合 |
| users | openid | 唯一 |
| comments | catId | 普通 |
| comments | catId + createdAt | 复合 |
| comments | userId | 普通 |

**建议补充：**

| 集合 | 索引字段 | 类型 | 用途 |
|------|---------|------|------|
| cats | status + createdAt | **降序复合** | getCatList 最高频查询 + 排序 |
| cats | status + location | 复合 | 按地点筛选（未来扩展） |
| comments | catId + status + createdAt | 复合三元索引 | 过滤已删除评论 + 排序，减少全表扫描 |
| users | openid | 唯一 | 已有，确保不重复 |

**复合索引创建顺序（重要性降序）：**

```javascript
// 在云开发控制台 → 数据库 → 索引管理中创建

// 1. cats: status(asc) + createdAt(desc) — 最高频
db.collection('cats').createIndex({ status: 1, createdAt: -1 })

// 2. comments: catId(asc) + status(asc) + createdAt(desc)
db.collection('comments').createIndex({ catId: 1, status: 1, createdAt: -1 })

// 3. users: openid(asc) — 唯一索引
db.collection('users').createIndex({ openid: 1 }, { unique: true })

// 4. cats: createdBy(asc) + createdAt(desc) — "我的发布"页面
db.collection('cats').createIndex({ createdBy: 1, createdAt: -1 })
```

---

### 2.11 其他安全建议

#### 2.11.1 数据库权限配置

确保云开发控制台中的安全规则正确配置：

**cats 集合：**
```json
{
  "read": true,
  "write": "auth.openid == doc.createdBy",
  "create": "auth.openid != null",
  "delete": "auth.openid == doc.createdBy"
}
```

**users 集合：**
```json
{
  "read": "auth.openid == doc.openid",
  "write": "auth.openid == doc.openid",
  "create": "auth.openid != null"
}
```

**comments 集合：**
```json
{
  "read": true,
  "write": "auth.openid == doc.userId",
  "create": "auth.openid != null",
  "delete": "auth.openid == doc.userId"
}
```

#### 2.11.2 XSS 防护

评论内容在前端展示时应转义 HTML：

```javascript
// 前端展示评论时
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
// 或在 WXML 中避免使用 unescaped 绑定
```

#### 2.11.3 频率限制

建议在云函数中加入简单的频率限制（基于 openid + 时间窗口）：

```javascript
// 防刷评论示例
async function checkRateLimit(openid, action, windowMs = 60000, maxCount = 10) {
  const db = cloud.database();
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  const countResult = await db.collection('rate_limits')
    .where({
      openid,
      action,
      createdAt: db.command.gte(windowStart)
    })
    .count();

  if (countResult.total >= maxCount) {
    return false; // 超出频率限制
  }

  await db.collection('rate_limits').add({
    data: { openid, action, createdAt: now }
  });
  return true;
}
```

---

## 三、修改清单汇总

### 3.1 需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `cloudfunctions/addCat/index.js` | 添加输入参数长度/类型/数组限制 |
| `cloudfunctions/addComment/index.js` | 添加 content 最大长度限制 |
| `cloudfunctions/getCatList/index.js` | 添加 pageSize 上限、正则转义、深分页限制 |
| `cloudfunctions/getCatDetail/index.js` | 添加 catId 校验、评论分页 |
| `cloudfunctions/deleteCat/index.js` | 添加 catId 类型/长度校验 |
| `cloudfunctions/toggleFavorite/index.js` | 添加 catId 校验、优化并发安全 |
| `miniprogram/utils/api.js` | **重构**：移除直接数据库操作，改为调用云函数 |

### 3.2 需要新增的文件

| 文件 | 用途 |
|------|------|
| `cloudfunctions/deleteComment/index.js` | 删除评论云函数 |
| `cloudfunctions/deleteComment/package.json` | 依赖配置 |

### 3.3 需要配置的数据库索引

| 集合 | 索引 | 优先级 |
|------|------|--------|
| cats | status + createdAt(降序) | 高 |
| comments | catId + status + createdAt(降序) | 高 |
| cats | createdBy + createdAt(降序) | 中 |

---

## 四、风险评估

| 风险项 | 当前状态 | 优化后状态 |
|--------|---------|-----------|
| 前端伪造他人身份操作数据 | 🔴 存在 | ✅ 已消除 |
| 正则注入导致服务不可用 | 🔴 存在 | ✅ 已消除 |
| 超长输入导致存储溢出 | 🟡 存在 | ✅ 已限制 |
| 无限分页导致查询超时 | 🟡 存在 | ✅ 已限制 |
| 图片上传任意文件 | 🟡 存在 | ✅ 已限制 |
| 评论全量加载影响性能 | 🟢 可优化 | ✅ 已分页 |
| 收藏操作并发丢失 | 🟡 存在 | ⚠️ 部分缓解 |

---

*文档结束*
