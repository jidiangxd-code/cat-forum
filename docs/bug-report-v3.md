# Bug 报告 v3 - 修复验证 + 新发现

> **审查日期：** 2026-04-19 21:23
> **审查范围：** 验证 v2 修复是否生效 + 全面重新扫描所有 JS/WXML/WXSS
> **审查人：** QA Engineer

---

## 📊 v2 Bug 修复验证结果

### ✅ 已确认修复（9 个）

| Bug | 描述 | 验证方式 | 状态 |
|-----|------|----------|------|
| #01 | detail 页 shareCat 方法缺失 | detail.js 中 `shareCat()` 已存在 | ✅ 已修复 |
| #02 | my-posts goPublish 方法缺失 | my-posts.js 中 `goPublish()` 已存在 | ✅ 已修复 |
| #03 | my-comments catId 跳转未校验 | `onCatTap()` 中增加 `if (!id)` 检查 | ✅ 已修复 |
| #04 | publish 页 navigateBack 从 tabBar 进入失败 | publish.js 中增加 `pages.length > 1` 判断 | ✅ 已修复 |
| #08 | 评论成功后未更新 commentCount | detail.js `submitComment()` 中同步更新 | ✅ 已修复 |
| #12 | 评论时间显示 [object Object] | detail.js 使用格式化字符串 `timeStr` | ✅ 已修复 |
| #15 | 默认图片路径不存在 | `/assets/images/default-avatar.png` 和 `default-cat.png` 已创建 | ✅ 已修复 |
| #18 | previewImage 缺少空值保护 | detail.js 增加 `cat.images` 空检查 | ✅ 已修复 |
| #22 | Mock 数据使用 placekitten.com（中国无法访问） | index.js 替换为 `/images/default-cat.png` | ✅ 已修复 |

### ❌ 修复失败 / 新发现（1 个）

| Bug | 描述 | 问题 | 状态 |
|-----|------|------|------|
| #11 | 首页 loading 初始值为 false | **修复引入回归！** data 中 `loading` 定义了**两次**，第二个 `loading: false` 覆盖了第一个 `loading: true` | ❌ 修复失败（更严重） |

---

## 🔴 P0 — 严重（阻塞多人使用）

### Bug #09（遗留）: 前端直接操作数据库，绕过云函数
- **位置：** 所有页面（index.js, detail.js, profile.js, my-posts.js, my-likes.js, my-comments.js, publish.js）
- **验证：** 所有页面仍直接使用 `db.collection('cats')` 操作数据。`api.js` 虽被 require 但各页面均绕过它直接调用 `wx.cloud.database()`
- **影响：** 
  - 数据库权限必须设置为宽松模式
  - 缺乏服务端校验（如删除操作无创建者验证）
  - 云函数（addCat, deleteCat, getCatDetail, getCatList, toggleFavorite）完全未使用
- **严重等级：** 🔴 P0

### Bug #13（遗留）: _getOpenId() 返回硬编码 'guest'
- **位置：** 所有页面的 `_getOpenId()` 方法
- **验证：** 每个页面仍是 `return wx.getStorageSync('openId') || 'guest';`。整个项目中 `wx.setStorageSync('openId', ...)` 从未被调用
- **影响：** 所有用户共享 'guest' 身份，多人使用时数据完全混乱
- **严重等级：** 🔴 P0

---

## 🟡 P1 — 高（影响功能完整性）

### Bug #05（遗留）: 前端与云函数字段名严重不一致
- **位置：** publish.js vs cloudfunctions/addCat/index.js vs index.js
- **验证：**
  - 前端发布写入：`authorId`, `likeCount`, `createTime`, `likedBy`, `commentCount`, `updatedAt`
  - 云函数 addCat 写入：`createdBy`, `likes`, `createdAt`, `status`, `tags`
  - 云函数 getCatList 查询使用：`createdAt`（前端写入 `createTime`）、`status: 'active'`（前端不写 `status`）
- **影响：** 前端和云函数数据完全不兼容，一旦切换到云函数，所有现有数据不可见
- **严重等级：** 🟡 P1

### Bug #06（遗留）: getCatList 按 status 过滤，但前端不写入 status
- **位置：** cloudfunctions/getCatList/index.js 第 12 行
- **验证：** `const query = { status: 'active' };` 仍在。前端发布帖子时不写入 `status` 字段
- **影响：** 通过云函数查询时，前端发布的帖子全部被过滤掉
- **严重等级：** 🟡 P1

### Bug #10（遗留）: 删除帖子未级联删除评论
- **位置：** miniprogram/pages/my-posts/my-posts.js `_deletePost()` 方法
- **验证：** `_deletePost()` 仅执行 `db.collection('cats').doc(id).remove()` 和删除云存储图片，**没有任何对 comments 集合的操作**
- **影响：** 删除帖子后，该帖子下的所有评论成为孤儿记录
- **严重等级：** 🟡 P1

### Bug #11-REGRESSION（新发现）: loading 初始值修复引入重复 key
- **位置：** miniprogram/pages/index/index.js data 对象
- **验证：**
  ```js
  data: {
    catList: [],
    currentTab: 'all',
    // Bug #11: loading 初始值改为 true
    loading: true,     // ← 第一个
    tabs: [...],
    loading: false,    // ← 第二个！覆盖了上面的 true
    hasMore: true,
    ...
  }
  ```
  JavaScript 对象中重复 key，**后定义的覆盖先定义的**。实际 `loading` 初始值仍为 `false`，**且比之前更难发现**（因为有一个注释说是 true）
- **影响：** 首次加载仍会闪过空状态，修复反而让问题更隐蔽
- **严重等级：** 🟡 P1

---

## 🟢 P2 — 中（影响体验）

### Bug #19（遗留）: my-posts.wxml 分类文本硬编码
- **位置：** miniprogram/pages/my-posts/my-posts.wxml 第 42 行
- **验证：** `<text>{{item.category === 'stray' ? '流浪猫' : item.category === 'pet' ? '家养猫' : '寻猫'}}</text>` 仍使用三元运算符硬编码，未使用 data 中的 `categoryMap`
- **对比：** detail 页使用 `{{categoryMap[cat.category] || '小猫'}}` 统一从 data 读取
- **影响：** 与详情页不一致，修改分类名需改多处
- **严重等级：** 🟢 P2

### Bug #20（遗留）: clearCache 清除所有本地存储
- **位置：** miniprogram/pages/profile/profile.js `clearCache()` 方法
- **验证：** 仍使用 `wx.clearStorageSync()` 清除全部本地存储，包括 openId 等关键数据。清除后无任何提示或跳转
- **影响：** 用户清除缓存后丢失登录状态，但页面不刷新
- **严重等级：** 🟢 P2

### Bug #25（遗留）: 云函数 addCat 字段命名与前端不一致
- **位置：** cloudfunctions/addCat/index.js
- **验证：** 写入 `createdBy`, `likes`, `createdAt`，前端使用 `authorId`, `likeCount`, `createTime`
- **影响：** 与 Bug #05 同源，未来切换到云函数时数据不兼容
- **严重等级：** 🟢 P2

---

## 🔵 P3 — 低（优化建议）

### Bug #14（遗留）: publish.wxml wx:for 使用 index 作为 key
- **位置：** miniprogram/pages/publish/publish.wxml
- **验证：** `wx:key="index"` 仍在（删除图片时可能渲染错乱）
- **严重等级：** 🔵 P3

### Bug #16（遗留）: api.js getUserFavorites 使用空数组查询
- **位置：** miniprogram/utils/api.js 第 155-160 行
- **验证：** `db.command.in([])` 仍为空数组
- **严重等级：** 🔵 P3

### Bug #17（遗留）: api.js 大量函数未被使用
- **位置：** miniprogram/utils/api.js
- **验证：** `searchCats`, `getUserStats`, `toggleFavorite`, `getUserFavorites`, `publishCat`, `uploadImage`, `uploadImages` 均未被页面引用
- **严重等级：** 🔵 P3

### Bug #21（遗留）: onReachBottom 上拉加载更多无去重
- **位置：** miniprogram/pages/index/index.js
- **验证：** `onReachBottom()` 直接追加新数据，无 `_id` 去重逻辑
- **严重等级：** 🔵 P3

### Bug #23（遗留）: app.js baseUrl 无实际用途
- **位置：** miniprogram/app.js 第 4 行
- **验证：** `baseUrl: 'https://example.com'` 仍存在且未被引用
- **严重等级：** 🔵 P3

### Bug #24（遗留）: cloudTipModal 组件未被使用
- **位置：** miniprogram/components/cloudTipModal/
- **验证：** 组件完整存在，但无任何页面引用
- **严重等级：** 🔵 P3

### 新发现 Bug #26: cat-card.js data 对象重复定义
- **位置：** miniprogram/components/cat-card/cat-card.js
- **验证：** `data` 被定义了两次（第 8 行和第 29 行），第二个会覆盖第一个
  ```js
  data: {
    categoryText: '小猫'    // ← 第一个
  },
  observers: { ... },
  methods: { ... },
  data: {                   // ← 第二个，覆盖上面的
    categoryText: '小猫',
    imageLoadError: false
  }
  ```
- **影响：** 代码结构混乱，如果后续需要修改 data 可能改错位置
- **严重等级：** 🔵 P3

---

## 📊 统计

| 严重程度 | v2 数量 | v2 已修复 | v3 仍存 | v3 新增 |
|----------|---------|-----------|---------|---------|
| 🔴 P0 | 6 | 6 | 2 (#09, #13) | 0 |
| 🟡 P1 | 7 | 3 (#08, #12) + 1修复失败(#11) | 5 (#05, #06, #10, #11回归) | 1 (#11回归) |
| 🟢 P2 | 7 | 2 (#15, #18) | 3 (#19, #20, #25) | 0 |
| 🔵 P3 | 5 | 1 (#22) | 4 (#14, #16, #17, #21) + 2 遗留(#23, #24) | 2 (#26, #11回归归类调整) |

> **注：** v2 共 25 个 Bug，v3 确认 9 个已修复，1 个修复失败（引入回归），剩余 15 个未修复，新增 2 个（#26 + #11回归作为独立条目）

## 🔑 本轮关键发现

1. **Bug #11 修复引入回归** — data 中 `loading` 重复定义，第二个覆盖第一个，实际仍为 `false`
2. **cat-card.js 同样有 data 重复定义问题** — 代码质量问题
3. **P0 问题全部未修复** — Bug #09（前端直连数据库）和 Bug #13（用户身份全部 guest）是上线前必须解决的

## 📋 建议修复优先级

| 优先级 | Bug | 修复建议 |
|--------|-----|----------|
| P0 | #11 回归 | 删除 index.js data 中多余的 `loading: false` |
| P0 | #09 | 全部切换到云函数调用或完善数据库权限 |
| P0 | #13 | 在 app.js onLaunch 中通过云函数获取真实 openId |
| P1 | #05/#06/#25 | 统一字段名（建议统一为前端使用的 `authorId`, `likeCount`, `createTime`） |
| P1 | #10 | 删除帖子时级联删除 comments 集合中相关记录 |
| P2 | #19 | my-posts.wxml 改用 `categoryMap` |
| P2 | #20 | clearCache 改为清除特定缓存 key |
| P3 | #26 | 清理 cat-card.js 重复 data 定义 |
