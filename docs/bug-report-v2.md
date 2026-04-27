# Bug 报告 v2 - 代码审查

> **审查日期：** 2026-04-19
> **审查范围：** miniprogram/ 全量代码 + cloudfunctions/ 云函数 + 整体架构
> **审查人：** QA Engineer

---

## 🔴 严重（影响功能使用）

### Bug #01: detail 页面「分享」按钮绑定不存在的方法
- **位置：** `miniprogram/pages/detail/detail.wxml` 第 79 行
- **问题描述：** `<view class="action-item" bind:tap="shareCat">` 绑定了 `shareCat` 方法，但 `detail.js` 中不存在该方法。JS 中只有 `onShareAppMessage()` 方法（这是微信分享回调，不是按钮点击事件）。
- **复现步骤：**
  1. 进入猫咪详情页
  2. 点击底部操作栏的「分享」按钮
  3. 控制台报错 `shareCat is not defined`，无任何反应
- **建议修复：** 在 `detail.js` 中新增 `shareCat()` 方法，调用 `wx.showShareMenu()` 或手动触发分享：
  ```js
  shareCat() {
    wx.showShareMenu({ withShareTicket: true });
  }
  ```

### Bug #02: 「我的发布」空状态「立即发布」按钮绑定不存在的方法
- **位置：** `miniprogram/pages/my-posts/my-posts.wxml` 第 16 行 + `my-posts.js`
- **问题描述：** `<view class="empty-btn" bind:tap="goPublish">` 绑定了 `goPublish` 方法，但 `my-posts.js` 中没有定义。点击按钮无任何反应。
- **复现步骤：**
  1. 进入「我的发布」页面（用户无发布内容时）
  2. 点击「立即发布」按钮
  3. 无任何跳转，控制台报错
- **建议修复：** 在 `my-posts.js` 中新增：
  ```js
  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' });
  }
  ```

### Bug #03: 「我的评论」页面参数名大小写不匹配导致无法跳转
- **位置：** `miniprogram/pages/my-comments/my-comments.wxml` + `my-comments.js`
- **问题描述：** wxml 中传递 `data-catid="{{item.catId}}"`（小写 `catid`），但 JS 中读取 `e.currentTarget.dataset.catid`（也是小写）。然而 `catId` 在数据中是 `item.catId`，dataset 会自动转小写为 `catid`。此处**看似正确**，但需验证小程序的 dataset 转换规则。经过核实，小程序会将 `data-catid` 转为 `dataset.catid`，这里恰好匹配，但**命名不规范**，容易出错。更重要的是，当 `catId` 为 `undefined`（猫咪已被删除时）仍会跳转。
- **复现步骤：**
  1. 进入「我的评论」页面
  2. 某条评论对应的猫咪已被删除，`catId` 仍存在但猫咪记录已不存在
  3. 点击跳转到详情页 → 加载失败，页面白屏或一直 loading
- **建议修复：** 
  1. 统一使用 `data-cat-id`（驼峰转短横线）避免大小写混乱
  2. 跳转前检查 `catId` 有效性
  3. detail 页面增加记录不存在的友好提示

### Bug #04: 发布页使用 `navigateBack()` 返回，从 tabBar 进入时会失败
- **位置：** `miniprogram/pages/publish/publish.js` 第 103 行
- **问题描述：** 发布成功后调用 `wx.navigateBack()` 返回上一页。但 publish 是 tabBar 页面，用户可能通过底部导航直接切换到此页，此时页面栈中没有上一页，`navigateBack()` 会失败。
- **复现步骤：**
  1. 底部 tabBar 点击「发布」进入发布页
  2. 填写信息并成功发布
  3. 发布后 `navigateBack()` 无法返回，页面卡住
- **建议修复：**
  ```js
  // 判断页面栈中是否有上一页
  const pages = getCurrentPages();
  if (pages.length > 1) {
    wx.navigateBack();
  } else {
    wx.switchTab({ url: '/pages/index/index' });
  }
  ```

### Bug #05: 云函数与前端字段名严重不一致，数据流断裂
- **位置：** `cloudfunctions/addCat/index.js` vs `miniprogram/pages/publish/publish.js` + `miniprogram/pages/index/index.js`
- **问题描述：** 前端直接操作数据库（不走云函数），但前端写入和读取的字段名与云函数使用的字段名完全不一致：
  | 字段 | 前端使用 | addCat 云函数使用 |
  |------|---------|------------------|
  | 创建者ID | `authorId` | `createdBy` |
  | 点赞数 | `likeCount` | `likes` |
  | 点赞用户列表 | `likedBy` | （无） |
  | 创建时间 | `createTime` | `createdAt` |
  | 浏览量 | `viewCount` | `viewCount` ✓ |
  | 状态 | （无） | `status: 'active'` |
  
  这意味着：如果通过前端发布（当前方式），云函数 `getCatList` 的 `status: 'active'` 过滤条件会让前端发布的帖子不可见。
- **复现步骤：**
  1. 前端发布帖子（无 `status` 字段）
  2. 通过 `getCatList` 云函数查询（带 `status: 'active'` 条件）
  3. 查询结果为空，帖子"消失"
- **建议修复：** 统一字段命名。建议以云函数的字段名为标准（`createdBy`, `createdAt`, `likes`, `status`），修改前端所有相关代码；或者统一使用前端字段名并更新云函数。

### Bug #06: 云函数 `getCatList` 按 `status` 过滤，但前端不写入 `status` 字段
- **位置：** `cloudfunctions/getCatList/index.js` 第 12 行 + `miniprogram/pages/publish/publish.js`
- **问题描述：** `getCatList` 云函数始终查询 `status: 'active'` 的帖子，但前端发布时不写入 `status` 字段。通过云函数查询列表时，前端发布的帖子会被过滤掉。
- **复现步骤：**
  1. 通过前端发布帖子
  2. 调用 `getCatList` 云函数
  3. 列表为空（因为帖子没有 `status` 字段）
- **建议修复：** 发布时统一写入 `status: 'active'`，或云函数查询时去掉 `status` 过滤。

---

## 🟡 中等（影响体验）

### Bug #07: 图片上传缺少格式和大小限制
- **位置：** `miniprogram/pages/publish/publish.js` 第 31-38 行
- **问题描述：** `wx.chooseMedia` 只限制了 `count` 和 `mediaType`，没有对图片大小和格式做限制。微信 `chooseMedia` 默认最大 100MB，但云存储上传大图片可能失败。同时没有对格式做限制（可能选到非图片文件）。
- **复现步骤：**
  1. 进入发布页
  2. 选择一张超大图片（如 50MB+ 的原图）
  3. 填写内容后发布
  4. 上传可能超时或失败
- **建议修复：** 
  1. 上传前检查文件大小：
  ```js
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    wx.showToast({ title: '图片不能超过10MB', icon: 'none' });
    return;
  }
  ```
  2. `wx.chooseMedia` 中指定 `maxDuration` 等参数限制

### Bug #08: 发表评论后未更新猫咪的 `commentCount`
- **位置：** `miniprogram/pages/detail/detail.js` `submitComment()` 方法
- **问题描述：** 评论成功后只刷新了评论列表，但没有更新猫咪的 `commentCount` 字段。返回列表页时，该猫咪的评论数显示不准确。
- **复现步骤：**
  1. 进入猫咪详情页
  2. 发表一条评论
  3. 返回首页查看该猫咪
  4. 评论数仍为旧值
- **建议修复：** 评论成功后同时更新 `commentCount`：
  ```js
  await db.collection('cats').doc(catId).update({
    data: { commentCount: db.command.inc(1) }
  });
  ```

### Bug #09: 前端直接使用数据库调用，绕过云函数，安全权限缺失
- **位置：** `miniprogram/pages/index/index.js`、`miniprogram/pages/detail/detail.js`、`miniprogram/pages/profile/profile.js`、`miniprogram/pages/my-posts/my-posts.js`、`miniprogram/pages/my-likes/my-likes.js`、`miniprogram/pages/my-comments/my-comments.js`
- **问题描述：** 所有页面都直接使用 `wx.cloud.database()` 操作数据，而没有使用封装好的 `api.js` 或云函数。这意味着：
  1. 云函数（`addCat`, `deleteCat`, `getCatDetail` 等）完全未被使用，是死代码
  2. 数据库权限必须设置为宽松模式（允许所有用户读写），否则操作会失败
  3. 缺乏服务端校验（如删除操作在云函数中验证了创建者身份，前端直接删除没有此验证）
- **建议修复：** 
  - **方案 A（推荐）：** 全部切换到云函数调用，利用 `cloud.getWXContext()` 在服务端验证身份
  - **方案 B：** 删除未使用的云函数，在前端添加必要的权限校验
  - 无论如何，`api.js` 应该被使用，目前它是完全未被引用的死代码

### Bug #10: 删除帖子未关联删除评论和更新统计
- **位置：** `miniprogram/pages/my-posts/my-posts.js` `_deletePost()` 方法
- **问题描述：** 删除帖子时只删除了 `cats` 集合中的记录和云存储图片，但没有：
  1. 删除该猫咪下的所有评论
  2. 从 `likedBy` 列表中移除该记录（导致用户喜欢列表中可能出现死链）
- **复现步骤：**
  1. 发布一条帖子并获取评论
  2. 删除该帖子
  3. 评论仍然存在，成为"孤儿评论"
- **建议修复：** 删除帖子时级联删除关联评论。

### Bug #11: 首页列表页首次加载没有 loading 状态
- **位置：** `miniprogram/pages/index/index.js` + `index.wxml`
- **问题描述：** `onLoad` 调用 `loadCatList()` 时设置 `loading: true`，但 wxml 中空状态条件是 `wx:if="{{!loading && catList.length === 0}}"`。首次加载时如果网络慢，会短暂显示空状态（因为 `loading` 是 `false` 初始值，虽然代码中 `loadCatList` 会设置为 `true`，但 setData 是异步的）。
- **更关键的问题：** `data` 中 `loading` 初始值为 `false`，首次渲染时可能闪过空状态。
- **建议修复：** 将 `loading` 初始值改为 `true`：
  ```js
  data: { loading: true, ... }
  ```

### Bug #12: 评论时间显示为 `[object Object]`
- **位置：** `miniprogram/pages/detail/detail.js` `submitComment()` 模拟数据 + `miniprogram/pages/detail/detail.wxml`
- **问题描述：** 云数据库使用 `db.serverDate()` 返回的是一个特殊对象。如果直接在前端渲染（不使用云函数），`{{item.createTime}}` 可能显示为 `[object Object]` 而不是可读时间。当前云函数 `addComment` 用 `new Date()` 但前端不走云函数。
- **复现步骤：**
  1. 发表评论（走前端直接写入）
  2. 查看评论列表
  3. 时间显示异常
- **建议修复：** 在前端写入时使用 `new Date().toLocaleString('zh-CN')` 代替 `db.serverDate()`，或在显示时做格式化。

### Bug #13: `_getOpenId()` 返回硬编码 `'guest'`，不是真正的用户标识
- **位置：** 所有页面的 `_getOpenId()` 方法
- **问题描述：** `wx.getStorageSync('openId')` 在项目中从未被设置过。所有页面获取到的 openId 都是 `'guest'`。这意味着：
  1. 所有用户共享同一个 `'guest'` 身份
  2. "我的发布"会显示所有用户的帖子
  3. "我喜欢的"会显示所有人的点赞
  4. 删除操作可能误删他人的帖子
- **复现步骤：**
  1. 用户 A 发布帖子
  2. 用户 B 进入「我的发布」页面
  3. 能看到用户 A 的帖子（因为 authorId 都是 'guest'）
- **建议修复：** 通过 `wx.cloud.callFunction` 获取真实 openId，或在 `app.js` 中通过 `wx.cloud.callFunction({name: 'getOpenId'})` 获取并存入 Storage。

---

## 🟢 轻微（优化建议）

### Bug #14: 发布页 `wx:for` 缺少 `wx:key`
- **位置：** `miniprogram/pages/publish/publish.wxml` 第 14 行
- **问题描述：** `<view class="image-item" wx:for="{{images}}" wx:key="index">` 使用了 `wx:key="index"`。在列表项会被删除的场景中（删除图片），使用 `index` 作为 key 会导致渲染错乱。
- **建议修复：** 使用唯一值作为 key，如 `wx:key="*this"`（图片路径本身就是唯一的）。

### Bug #15: 默认头像图片路径可能不存在
- **位置：** `miniprogram/pages/detail/detail.wxml`、`miniprogram/components/cat-card/cat-card.wxml`、`miniprogram/pages/my-comments/my-comments.wxml`
- **问题描述：** 代码中多处引用 `/assets/images/default-avatar.png` 和 `/assets/images/default-cat.png` 作为默认图片，但这些文件在 `images/` 目录中不存在。实际存在的文件是 `images/avatar.png`。
- **建议修复：** 统一使用 `{{cat.avatar || '/images/avatar.png'}}` 或将缺失的默认图片添加到 `images/` 目录。

### Bug #16: `api.js` 中 `getUserFavorites` 使用空数组查询，始终返回空
- **位置：** `miniprogram/utils/api.js` 第 155-160 行
- **问题描述：** 
  ```js
  function getUserFavorites(userId) {
    return db.collection('cats')
      .where({ _id: db.command.in([]) })  // 空数组，永远匹配不到
      .get();
  }
  ```
  此函数硬编码了空数组，永远不会返回任何结果。
- **建议修复：** 先查询 users 集合获取 favorites 列表，再用该列表查询 cats。

### Bug #17: `api.js` 中大量函数未被使用（死代码）
- **位置：** `miniprogram/utils/api.js`
- **问题描述：** 以下函数在项目中未被任何页面引用：`searchCats`, `getUserStats`, `toggleFavorite`, `getUserFavorites`, `publishCat`, `uploadImage`, `uploadImages`。
- **建议修复：** 
  - 如果后续需要，保留但添加注释
  - 如果确定不需要，删除以减少维护成本
  - 或者将 `api.js` 改为真正的统一数据层，让所有页面通过它操作数据

### Bug #18: 详情页 `previewImage` 缺少空值保护
- **位置：** `miniprogram/pages/detail/detail.js` `previewImage()` 方法
- **问题描述：** 如果 `cat.images` 为 `null` 或空数组，`this.data.cat.images[index]` 会报错。
- **建议修复：**
  ```js
  previewImage(e) {
    if (!this.data.cat || !this.data.cat.images) return;
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.cat.images[index],
      urls: this.data.cat.images
    });
  }
  ```

### Bug #19: 分类文本在 my-posts.wxml 中硬编码
- **位置：** `miniprogram/pages/my-posts/my-posts.wxml` 第 42 行
- **问题描述：** 分类文本 `'流浪猫'`、`'家养猫'`、`'寻猫'` 直接写在 wxml 模板中，而非从 data 的 `categoryMap` 读取。与 detail 页面使用 `categoryMap[cat.category]` 的方式不一致。
- **建议修复：** 统一使用 data 中的 `categoryMap` 对象映射。

### Bug #20: `clearCache` 清除所有本地存储，可能丢失重要数据
- **位置：** `miniprogram/pages/profile/profile.js` `clearCache()` 方法
- **问题描述：** `wx.clearStorageSync()` 会清除所有本地存储，包括 `openId` 等关键数据。清除后用户状态丢失，但页面没有跳转或刷新提示。
- **建议修复：** 改为 `wx.removeStorageSync('缓存相关key')` 或清除后引导用户重新登录。

### Bug #21: `onReachBottom` 上拉加载更多时，新数据追加但无去重逻辑
- **位置：** `miniprogram/pages/index/index.js` `loadCatList()` + `onReachBottom()`
- **问题描述：** 如果用户在加载过程中快速上拉，可能导致同一批数据被重复追加。虽然有 `loading` 锁，但 `setData` 是异步的，存在竞态条件。
- **建议修复：** 使用 `_id` 去重后再合并：
  ```js
  const existingIds = new Set(this.data.catList.map(c => c._id));
  const uniqueNewCats = newCats.filter(c => !existingIds.has(c._id));
  ```

### Bug #22: `index.js` 中 `_loadMockData` 使用外部图片 URL（placekitten.com）
- **位置：** `miniprogram/pages/index/index.js` `_loadMockData()` 方法
- **问题描述：** 模拟数据使用 `https://placekitten.com/400/300` 等外部 URL。该网站在中国可能无法访问，导致模拟数据图片全部加载失败。
- **建议修复：** 使用本地占位图片 `../../images/default-cat.png`。

### Bug #23: `app.js` 中 `baseUrl` 无实际用途
- **位置：** `miniprogram/app.js` 第 4 行
- **问题描述：** `globalData.baseUrl: 'https://example.com'` 定义了但整个项目中没有任何地方引用。
- **建议修复：** 删除或添加注释说明用途。

### Bug #24: `cloudTipModal` 组件未被任何页面使用
- **位置：** `miniprogram/components/cloudTipModal/`
- **问题描述：** 该组件完整存在（js/json/wxml/wxss），但没有任何页面的 json 文件引用它。
- **建议修复：** 删除或在需要的页面中引入使用。

### Bug #25: 云函数 `addCat` 的字段命名与前端不一致
- **位置：** `cloudfunctions/addCat/index.js`
- **问题描述：** 云函数写入 `createdBy`, `likes`, `createdAt`，但前端代码使用 `authorId`, `likeCount`, `createTime`。如果未来切换到云函数发布，会导致数据不兼容。
- **建议修复：** 统一命名规范，建议与前端保持一致（因为前端是当前实际使用的）。

---

## 📊 统计

| 严重程度 | 数量 |
|----------|------|
| 🔴 严重 | 6 |
| 🟡 中等 | 7 |
| 🟢 轻微 | 12 |
| **合计** | **25** |

## 🔑 最关键问题汇总

1. **字段名不一致（Bug #05, #06, #25）** — 前端和云函数使用完全不同的字段名，是整个项目最大的架构风险
2. **用户身份缺失（Bug #13）** — 所有用户都是 `'guest'`，多人使用时数据完全混乱
3. **方法绑定缺失（Bug #01, #02）** — 页面按钮点击无任何反应
4. **绕过云函数（Bug #09）** — 所有安全校验都在前端，缺乏服务端验证
5. **发布页返回逻辑（Bug #04）** — 从 tabBar 进入后发布成功会卡住
