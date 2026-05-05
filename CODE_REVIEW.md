# cat-forum 项目代码梳理报告

> 生成时间：2026-05-05  
> 项目路径：`C:\Users\郭旭东\Desktop\kai_fa\xiao_mao\cat-forum`  
> 技术栈：微信小程序 + 微信云开发（云函数 / 云数据库 / 云存储）

---

## 目录

1. [项目整体架构](#1-项目整体架构)
2. [数据库集合设计](#2-数据库集合设计)
3. [前端页面逻辑](#3-前端页面逻辑)
4. [公共工具层](#4-公共工具层)
5. [云函数清单](#5-云函数清单)
6. [核心业务流程](#6-核心业务流程)
7. [已发现的 Bug 与问题](#7-已发现的-bug-与问题)
8. [代码质量观察](#8-代码质量观察)
9. [优化建议](#9-优化建议)

---

## 1. 项目整体架构

```
cat-forum/
├── miniprogram/              # 小程序前端
│   ├── app.js                # 全局入口（openId初始化、暗色模式、错误上报）
│   ├── app.json              # 全局配置（15页面、4-tab TabBar）
│   ├── app.wxss              # 全局样式（CSS变量双主题系统）
│   ├── pages/                # 15个页面
│   │   ├── index/            # 首页（帖子流）
│   │   ├── cat-list/         # 猫咪列表 + 排行榜
│   │   ├── cat-home/         # 猫咪主页
│   │   ├── create-cat/       # 创建/编辑猫咪档案
│   │   ├── promote-cat/      # 未知猫转正
│   │   ├── merge-cat/        # 合并重复猫咪
│   │   ├── publish/          # 发布帖子（最复杂页面）
│   │   ├── detail/           # 帖子详情 + 评论
│   │   ├── profile/          # 个人主页
│   │   ├── search/           # 搜索
│   │   ├── my-posts/         # 我的帖子
│   │   ├── my-follows/       # 关注/粉丝
│   │   ├── notifications/    # 消息通知
│   │   └── ...
│   ├── components/           # 公共组件
│   │   ├── cat-card/         # 猫咪卡片
│   │   └── cloudTipModal/    # 提示弹窗
│   └── utils/
│       └── api.js            # 统一API层（419行）
│
├── cloudfunctions/           # 云函数（25+个）
│   ├── login/                # 获取openId
│   ├── createCat/            # 创建猫咪档案
│   ├── updateCat/            # 编辑/转正猫咪
│   ├── mergeCat/             # 合并猫咪
│   ├── voteCat/              # 每日投票
│   ├── publishPost/          # 发布帖子
│   ├── addComment/           # 发表评论（含通知）
│   ├── checkContent/         # 内容安全审核（当前版本）
│   ├── contentCheck/         # 内容安全审核（旧版，已废弃）
│   ├── getCatProfileList/    # 获取猫咪列表
│   ├── getNotifications/     # 获取通知
│   ├── markNotificationRead/ # 标记已读
│   ├── followUser/           # 关注用户
│   ├── getFollowList/        # 获取关注/粉丝列表
│   ├── toggleFavorite/       # 收藏帖子
│   ├── reportPost/           # 举报帖子
│   ├── deleteComment/        # 删除评论
│   ├── getDebugLogs/         # 读取错误日志
│   ├── init-collections/     # 初始化数据库集合（一次性）
│   ├── addCat/               # ⚠️ 旧架构遗留（操作cats集合）
│   ├── deleteCat/            # ⚠️ 旧架构遗留（操作cats集合）
│   ├── getCatList/           # ⚠️ 旧架构遗留（操作cats集合）
│   └── getCatDetail/         # ⚠️ 旧架构遗留（操作cats集合）
│
└── project.config.json       # AppID: wx508e2fc1c2ec5b53
```

### 架构核心原则

| 层次 | 职责 |
|------|------|
| **前端页面** | 展示逻辑、用户交互、乐观更新 |
| **utils/api.js** | 统一封装所有云调用，前端不直接访问数据库 |
| **云函数** | 复杂业务逻辑、权限校验、跨集合事务 |
| **云数据库** | 简单读取（前端直查）+ 复杂写操作（云函数代理） |
| **云存储** | 用户上传的图片（通过 `wx.cloud.uploadFile`） |

---

## 2. 数据库集合设计

### 当前架构集合（`cats_profile` 为核心）

#### `cats_profile` — 猫咪档案（核心集合）

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | String | 云数据库自动生成 |
| `catType` | `'formal'` \| `'unknown'` | 正式猫 / 未知猫 |
| `fullName` | String | 正式猫专有，如"橘宝" |
| `codeName` | String | 未知猫专有，如"U-2024001" |
| `appearance` | String[] | 外貌标签（15种选项） |
| `gender` | String | 性别 |
| `location` | String | 常出没地点 |
| `status` | String | 状态（活跃/离校/去世等） |
| `coverImage` | String | 封面图（云存储fileID） |
| `totalVote` | Number | 累计获赞数 |
| `isMerged` | Boolean | 是否已被合并（合并后设为true） |
| `healthTags` | String[] | 健康标签 |
| `editLog` | Object[] | 编辑历史记录 |
| `createTime` | Date | 创建时间 |

#### `posts` — 帖子

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | String | — |
| `catId` | String | **必填**，关联 `cats_profile._id` |
| `content` | String | 帖子文本内容 |
| `images` | String[] | 图片fileID数组 |
| `category` | String | 分类标签 |
| `authorId` | String | 作者openId |
| `likedBy` | String[] | 点赞用户openId数组 |
| `likeCount` | Number | 点赞数 |
| `commentCount` | Number | 评论数 |
| `status` | `'active'` \| `'deleted'` | 状态 |
| `reported` | Boolean | 是否被举报 |
| `createTime` | Date | 创建时间 |

#### `comments` — 评论

| 字段 | 类型 | 说明 |
|------|------|------|
| `postId` | String | 关联帖子 |
| `parentId` | String? | 父评论ID（二级评论） |
| `content` | String | 评论内容 |
| `authorId` | String | 评论者openId |
| `status` | `'active'` \| `'deleted'` | 软删除 |
| `createTime` | Date | — |

#### `votes` — 每日投票记录（防刷）

| 字段 | 类型 | 说明 |
|------|------|------|
| `userOpenid` | String | — |
| `catId` | String | 投票的猫咪 |
| `voteDate` | String | `YYYY-MM-DD` 格式 |

#### `notifications` — 消息通知

| 字段 | 类型 | 说明 |
|------|------|------|
| `toUserId` | String | 接收者openId |
| `fromUserId` | String | 发送者openId |
| `type` | `'like'` \| `'comment'` \| `'follow'` | 通知类型 |
| `postId` | String? | 关联帖子 |
| `isRead` | Boolean | 是否已读 |
| `createTime` | Date | — |

#### 其他集合

| 集合名 | 用途 |
|--------|------|
| `users` | 用户信息（avatarUrl、nickname、openid） |
| `follows` | 关注关系（followerOpenid → followedOpenid） |
| `favorites` | 收藏记录（独立集合，前端直查） |
| `reports` | 举报记录 |
| `debug_logs` | 前端错误日志（app.js全局捕获写入） |

### ⚠️ 遗留集合（旧架构残留，应废弃）

| 集合名 | 问题 |
|--------|------|
| `cats` | 旧版猫咪集合，与 `cats_profile` 并存，4个旧云函数仍在操作它 |

---

## 3. 前端页面逻辑

### 页面一览

| 页面 | 路径 | 核心功能 | 代码行数 |
|------|------|----------|----------|
| 首页 | `pages/index` | 帖子信息流 + 下拉刷新 + 上拉加载 | 144 |
| 猫咪列表 | `pages/cat-list` | 列表/总榜/新猫榜/未知猫，搜索 | 125 |
| 猫咪主页 | `pages/cat-home` | 猫咪档案 + 相关帖子 + 每日投票 | 149 |
| 创建猫咪 | `pages/create-cat` | 创建/编辑双模式，封面上传 | 183 |
| 未知猫转正 | `pages/promote-cat` | 给未知猫补充完整信息转为正式猫 | 147 |
| 合并猫咪 | `pages/merge-cat` | 防重复：将A猫合并到B猫 | 119 |
| 发布帖子 | `pages/publish` | 5步发布流程，3种绑猫模式 | 275 |
| 帖子详情 | `pages/detail` | 帖子内容 + 评论树 + 点赞/收藏 | 288 |
| 个人主页 | `pages/profile` | 统计数据 + 设置 + 暗色模式 | 178 |
| 搜索 | `pages/search` | 并发搜索猫咪+帖子，搜索历史 | 183 |
| 我的帖子 | `pages/my-posts` | 帖子管理，联级删除评论+图片 | 143 |
| 我的关注 | `pages/my-follows` | 关注/粉丝列表 | 119 |
| 消息通知 | `pages/notifications` | 分类通知 + TabBar角标 | 193 |

### 关键页面详解

#### `publish/publish.js` — 最复杂页面（275行）

**发布流程（5步）：**
```
用户点击发布
  ↓ Step 1: checkContent(文字内容) ← 微信内容安全API
  ↓ Step 2: uploadImages(本地图片路径) → 云存储 fileID[]
  ↓ Step 3: checkContent(图片fileID[]) ← 图片安全审核
  ↓ Step 4: [可选] createCat(新建未知猫) → 获取 catId
  ↓ Step 5: publishPost({ content, images, catId, category })
```

**绑猫三种模式：**
```
pick_formal   → 从正式猫列表选择
pick_unknown  → 从未知猫列表选择
new_unknown   → 发帖时同步创建新的未知猫
```

#### `detail/detail.js` — 次复杂页面（288行）

**加载策略：**
```javascript
// 并发加载帖子详情 + 猫咪信息 + 检查收藏状态
Promise.all([loadPost(), loadCatProfile(), checkFavoriteStatus()])

// 评论加载（串行，依赖 postId）
loadComments()
```

**点赞乐观更新：**
```javascript
// 1. 先更新本地UI（即时响应）
this.setData({ 'post.likeCount': newCount, liked: !liked })

// 2. 再调云函数
try {
  await api.togglePostLike(postId, userId, liked)
} catch(e) {
  // 3. 失败则回滚
  this.setData({ 'post.likeCount': oldCount, liked: liked })
}
```

#### `index/index.js` — 首页信息流

**帖子+猫咪信息批量合并：**
```javascript
// Step 1: 获取帖子列表（直接查数据库）
const posts = await api.getPostList(params)

// Step 2: 提取所有不重复的 catId
const catIds = [...new Set(posts.map(p => p.catId))]

// Step 3: 并发批量获取猫咪档案
const cats = await Promise.allSettled(catIds.map(id => api.getCatProfile(id)))

// Step 4: 将猫咪信息注入对应帖子
posts.forEach(post => { post.catInfo = catMap[post.catId] })
```

---

## 4. 公共工具层

### `utils/api.js`（419行）——统一API层

**设计模式：所有云调用收口在此，页面层只调用 `api.xxx()`**

#### 核心封装函数

```javascript
// 基础包装：统一错误处理
callCloud(name, params)  // → wx.cloud.callFunction，result.success===false时reject

// openId获取（优先本地缓存）
getOpenId()  // → wx.getStorageSync('openId')
```

#### 猫咪相关

```javascript
createCat(params)                    // → createCat 云函数
updateCat(catId, action, fields)     // action: 'edit' | 'promote'
getCatProfile(catId)                 // 直接查 cats_profile.doc(catId)（不走云函数）
getCatProfileList(params)            // → getCatProfileList 云函数
searchCatProfiles(keyword)           // 双字段正则：fullName OR codeName
mergeCat(fromCatId, toCatId)         // → mergeCat 云函数
voteCat(catId)                       // → voteCat 云函数
getTodayVote()                       // 直查 votes 集合（当日记录）
```

#### 帖子相关

```javascript
publishPost(params)                          // → publishPost 云函数
getPostList({ catId?, authorId?, skip, limit })  // 直查 posts 集合
togglePostLike(postId, userId, liked)        // 原子操作：_.inc + _.push/pull
toggleFavorite(postId, favorite)             // → toggleFavorite 云函数
```

#### 内容安全

```javascript
checkContent({ type, content/fileID })  // → checkContent 云函数
uploadImages(localPaths, folder)         // wx.cloud.uploadFile 批量上传
```

#### 常量导出

```javascript
APPEARANCE_OPTIONS  // 15种外貌描述
GENDER_OPTIONS      // 性别选项
STATUS_OPTIONS      // 状态选项
```

---

## 5. 云函数清单

### 当前架构（操作 `cats_profile` 集合）

| 云函数 | 触发方 | 核心逻辑 |
|--------|--------|----------|
| `login` | app.js 启动 | 返回 OPENID / APPID / UNIONID |
| `createCat` | create-cat页面 | 向 cats_profile 插入记录，totalVote=0 |
| `updateCat` | create-cat/promote-cat | edit：更新字段；promote：catType改formal |
| `mergeCat` | merge-cat页面 | 迁移posts.catId，累加totalVote，标记isMerged |
| `voteCat` | cat-home页面 | 防重投票（votes集合按日期去重） |
| `publishPost` | publish页面 | 发帖，自动回填猫咪coverImage |
| `addComment` | detail页面 | 发评论，自动发通知（评论/回复/楼中楼） |
| `checkContent` | publish/detail | 文字+图片内容安全审核（v2 API） |
| `getCatProfileList` | cat-list页面 | 4种模式：list/rank_total/rank_new/unknown_list |
| `getNotifications` | notifications页面 | 获取通知列表+未读数，富化帖子封面 |
| `markNotificationRead` | notifications页面 | 单条或全量已读 |
| `followUser` | 多页面 | 写入follows集合，发关注通知 |
| `getFollowList` | my-follows页面 | 查关注/粉丝，批量获取用户信息 |
| `toggleFavorite` | detail页面 | 操作 users.favorites 数组 |
| `reportPost` | detail页面 | 写举报记录，满3次自动标记帖子 |
| `deleteComment` | detail页面 | 软删除评论（status='deleted'） |
| `getDebugLogs` | 开发调试 | 读取 debug_logs 集合 |
| `init-collections` | 一次性初始化 | 创建9个集合 |

### 旧架构遗留（操作 `cats` 集合，应废弃）

| 云函数 | 问题 |
|--------|------|
| `addCat` | 操作旧 `cats` 集合，与新架构不兼容 |
| `deleteCat` | 同上 |
| `getCatList` | 同上（有 ReDoS 防护，代码质量较好） |
| `getCatDetail` | 同上，操作 viewCount |
| `contentCheck` | 旧版内容安全API，已被 `checkContent` 替代 |

---

## 6. 核心业务流程

### 流程一：用户发布一篇帖子

```
用户填写内容 + 上传图片 + 选择/创建猫咪
    ↓
[前端] checkContent(文字) → 微信内容安全审核
    ↓ 通过
[前端] wx.cloud.uploadFile × N → 获得图片 fileID[]
    ↓
[前端] checkContent(图片fileID[]) → 图片安全审核
    ↓ 通过
[可选] createCat(未知猫信息) → 获得新 catId
    ↓
[云函数 publishPost] 插入 posts 记录
    + 如果该猫 coverImage 为空，自动用帖子首图填充
    ↓
跳转至帖子详情页
```

### 流程二：未知猫转为正式猫

```
发现某猫重复或已确认身份
    ↓
方案A（单猫转正）:
  promote-cat页面 → api.updateCat(catId, 'promote', {fullName,...})
  → updateCat云函数 → catType改为'formal'，写入editLog

方案B（合并重复猫）:
  merge-cat页面 → 选择源猫(A)和目标猫(B)
  → mergeCat云函数:
    1. 将所有 posts.catId=A 改为 catId=B
    2. B.totalVote += A.totalVote
    3. A.isMerged = true（不物理删除）
```

### 流程三：每日投票防刷

```
用户点击"给它投票"
    ↓
[云函数 voteCat]:
  查 votes 集合 WHERE userOpenid=X AND voteDate=今天
    ↓ 若已存在 → 返回 { alreadyVoted: true }
    ↓ 若不存在 → 插入votes记录 + cats_profile.totalVote += 1
    ↓
前端乐观更新投票数，展示"今日已投"状态
```

### 流程四：评论触发多层通知

```
用户A 在帖子P（作者B）下发表评论
    ↓
addComment云函数:
  1. 插入 comments 记录
  2. posts.commentCount += 1
  3. 若 A ≠ B → 给B发"评论通知"
  
  若是回复评论C（作者D）:
  4. 若 A ≠ D → 给D发"回复通知"
  5. 若 D ≠ B 且 A ≠ B → 再给B发一条"楼中楼通知"
```

---

## 7. 已发现的 Bug 与问题

### 🔴 严重 Bug（会导致运行时崩溃）

#### Bug 1：`api.isFollowing` 未定义
- **位置**：`pages/my-follows/my-follows.js` 第81行
- **代码**：`const alreadyFollowing = await api.isFollowing(userId);`
- **问题**：`utils/api.js` 中**未导出** `isFollowing` 函数
- **影响**：进入"我的关注"页面时，如果粉丝列表有数据，会报 `api.isFollowing is not a function` 错误
- **修复方案**：在 `api.js` 中添加：
  ```javascript
  async function isFollowing(targetOpenId) {
    const openId = getOpenId();
    const db = wx.cloud.database();
    const res = await db.collection('follows')
      .where({ followerOpenid: openId, followedOpenid: targetOpenId })
      .count();
    return res.total > 0;
  }
  // 并在 module.exports 中导出
  ```

#### Bug 2：云函数中调用客户端 API
- **位置**：`cloudfunctions/followUser/index.js` 第43行
- **代码**：`const userInfo = wx.getStorageSync ? wx.getStorageSync('userInfo') : {};`
- **问题**：`wx.getStorageSync` 是微信小程序**客户端**专属 API，云函数（Node.js 环境）中**无法访问**
- **影响**：关注时，通知消息中的 `fromUserName` 永远是默认值 "某用户"
- **修复方案**：云函数通过 `cloud.getWXContext()` 拿 openId，再从 `users` 集合查用户信息：
  ```javascript
  const { OPENID } = cloud.getWXContext();
  const userRes = await db.collection('users').where({ openid: OPENID }).get();
  const userInfo = userRes.data[0] || {};
  ```

### 🟡 中等问题（数据不一致）

#### 问题 3：旧架构集合遗留
- **位置**：`cloudfunctions/addCat/`, `deleteCat/`, `getCatList/`, `getCatDetail/`
- **问题**：这4个云函数全部操作 `cats` 集合（旧架构），而当前业务已迁移到 `cats_profile`
- **影响**：若前端误调旧云函数，数据写入旧集合，对用户完全不可见
- **修复方案**：确认无前端调用后，将这4个云函数标记废弃或删除

#### 问题 4：`deleteComment` 更新错误集合
- **位置**：`cloudfunctions/deleteComment/index.js`
- **代码**：`db.collection('cats').doc(catId).update({ commentCount: _.inc(-1) })`
- **问题**：应该更新 `posts.commentCount`，却更新了 `cats` 集合（旧集合 + 错误字段）
- **影响**：删除评论后，帖子详情页评论数不会减少
- **修复方案**：
  ```javascript
  // 改为
  await db.collection('posts').doc(postId).update({
    data: { commentCount: _.inc(-1) }
  });
  ```

#### 问题 5：`addComment` 字段名大小写不一致
- **位置**：`cloudfunctions/addComment/index.js`
- **代码**：`db.collection('users').where({ openId: fromUserId })`
- **问题**：`users` 集合中用户的 openId 字段名是 `openid`（全小写），查询用的是 `openId`（驼峰）
- **影响**：评论通知中的 `fromUserAvatar` 和 `fromUserName` 始终为空
- **修复方案**：将查询条件改为 `{ openid: fromUserId }`

### 🟢 低优先级问题

#### 问题 6：`favorites` 集合与 `users.favorites` 数组并存
- `api.js` 中 `toggleFavorite` 调用云函数，操作 `users.favorites` 数组
- `detail.js` 中直接查询独立的 `favorites` 集合检查收藏状态
- 两套存储机制导致状态不一致，收藏后刷新可能显示未收藏

#### 问题 7：`contentCheck` 废弃云函数未清理
- `cloudfunctions/contentCheck/` 是旧版内容安全实现，已被 `checkContent` 完全替代
- 建议删除，避免被误调

---

## 8. 代码质量观察

### 亮点

| 特性 | 说明 |
|------|------|
| **API层统一** | `utils/api.js` 收口所有云调用，页面代码干净 |
| **乐观更新** | 点赞/投票先更新UI再调云端，用户体验流畅 |
| **全局错误上报** | `app.js` 挂载 `onError` + `onUnhandledRejection`，写入 debug_logs |
| **CSS变量双主题** | `app.wxss` 用CSS变量实现一键切换，扩展性好 |
| **内容安全保守策略** | `checkContent` API异常时拒绝发布，不存在安全绕过 |
| **投票防刷** | `voteCat` 用独立 votes 集合按日期去重，逻辑正确 |
| **合并不删除** | `mergeCat` 将源猫标记 `isMerged=true` 而非物理删除，可溯源 |

### 代码异味

| 问题 | 位置 | 说明 |
|------|------|------|
| 硬编码集合名 | 多处 | `'cats_profile'`、`'posts'` 等直接写字符串，建议提取常量 |
| 无事务支持 | `mergeCat` 等 | 云数据库不支持跨集合事务，合并中途失败会数据不一致 |
| 评论数不维护 | `publishPost` | 插入帖子时无初始 `commentCount: 0` |
| 暗色模式全量广播 | `cat-list.js` | 切换主题时遍历所有页面 setData，页面多时有性能开销 |
| 搜索无防抖 | `search.js` | 输入即触发，高频搜索时云数据库压力大 |

---

## 9. 优化建议

### 短期（一周内）

1. **修复 Bug 1**：在 `api.js` 补充 `isFollowing` 函数并导出
2. **修复 Bug 2**：`followUser` 云函数用 `cloud.getWXContext()` + 数据库查询替代 `wx.getStorageSync`
3. **修复 Bug 4**：`deleteComment` 更新 `posts.commentCount` 而非 `cats.commentCount`
4. **修复 Bug 5**：`addComment` 查用户时用 `openid`（全小写）

### 中期（一月内）

5. **统一收藏存储**：选择 `favorites` 独立集合 OR `users.favorites` 数组，删除另一套
6. **清理旧架构代码**：确认 `addCat/deleteCat/getCatList/getCatDetail/contentCheck` 无前端引用后删除
7. **搜索加防抖**：`search.js` 输入框加 300ms 防抖
8. **补充 `commentCount: 0` 初始值**：`publishPost` 云函数插入时加 `commentCount: 0`

### 长期（架构级）

9. **集合名常量化**：提取 `utils/collections.js` 统一管理集合名，避免拼写错误
10. **评论计数原子性**：`addComment` 和 `deleteComment` 用 `_.inc(±1)` 更新 `posts.commentCount`（已有但有bug）
11. **暗色模式改用事件总线**：替代遍历页面的广播方式
12. **分页统一**：帖子列表/评论列表的分页逻辑抽取到 `api.js`，减少页面重复代码

---

## 附录：关键常量

### 外貌选项（APPEARANCE_OPTIONS，15种）
虎斑、橘猫、黑猫、白猫、奶牛、三花、玳瑁、布偶、暹罗、英短、美短、缅因、布偶、混血、其他

### 性别选项（GENDER_OPTIONS）
公猫（未绝育）、母猫（未绝育）、公猫（已绝育）、母猫（已绝育）、未知

### 状态选项（STATUS_OPTIONS）
在校活跃、在校较少出现、已离校、已去世、未知

---

*本文档由代码梳理工具自动生成，如有错误请手动修正。*
