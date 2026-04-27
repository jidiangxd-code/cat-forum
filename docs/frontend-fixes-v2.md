# 前端修复记录 v2

> 修复日期：2026-04-19
> 修复人：龙虾管家（前端开发工程师）

---

## 修复概览

本次修复了 6 个 Bug（#05/#06、#09、#10、#13、#19、#20），涉及字段名统一、云函数登录、级联删除、缓存清理、api.js 统一调用等问题。

---

## Bug #05/#06: 字段名不一致

### 问题描述
- 前端发布使用 `authorId`, `likeCount`, `createTime`, `commentCount`
- 云函数使用 `createdBy`, `likes`, `createdAt`
- 导致前后端数据不匹配，查询和显示异常

### 修复方案
**统一为前端字段名**：`authorId`, `likeCount`, `createTime`, `commentCount`

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `cloudfunctions/addCat/index.js` | `createdBy` → `authorId`, `likes` → `likeCount`, 新增 `commentCount: 0`, `likedBy: []` |
| `cloudfunctions/getCatList/index.js` | `createdAt` → `createTime`, 查询参数 `tag` → `category` |
| `cloudfunctions/getCatDetail/index.js` | `createdAt` → `createTime` (评论排序) |
| `cloudfunctions/deleteCat/index.js` | `createdBy` → `authorId` (权限校验) |
| `cloudfunctions/addComment/index.js` | `userId` → `authorId`, `nickname` → `authorName`, `createdAt` → `createTime` |

### 字段映射表

| 旧字段名 | 新字段名 | 说明 |
|----------|----------|------|
| `createdBy` | `authorId` | 帖子作者 ID |
| `likes` | `likeCount` | 点赞数 |
| `createdAt` | `createTime` | 创建时间 |
| `userId` (评论) | `authorId` | 评论作者 ID |
| `nickname` (评论) | `authorName` | 评论作者昵称 |

---

## Bug #09: 前端直接操作数据库

### 问题描述
多个页面直接使用 `wx.cloud.database()` 操作数据库，缺乏统一管理，难以维护和扩展。

### 修复方案
将所有页面的直接数据库操作改为通过 `api.js` 调用。如果云函数未部署，前端直接调用作为降级方案。

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `miniprogram/utils/api.js` | 重写，新增 `getMyPosts`, `getMyLikes`, `deleteCat`(含级联), `getMyComments`, `deleteComment`, `getUserStats`, `getOpenId` 等方法 |
| `miniprogram/pages/index/index.js` | 移除直接 db 调用，使用 `api.getCatList()`, `api.getOpenId()` |
| `miniprogram/pages/publish/publish.js` | 移除直接 db.add，使用 `api.publishCat()` |
| `miniprogram/pages/my-posts/my-posts.js` | 移除直接 db 调用，使用 `api.getMyPosts()`, `api.deleteCat()` |
| `miniprogram/pages/my-likes/my-likes.js` | 移除直接 db 调用，使用 `api.getMyLikes()` |
| `miniprogram/pages/my-comments/my-comments.js` | 移除直接 db 调用，使用 `api.getMyComments()`, `api.getCatDetail()`, `api.deleteComment()` |
| `miniprogram/pages/profile/profile.js` | 移除直接 db 调用，使用 `api.getUserStats()`, `api.getOpenId()` |
| `miniprogram/pages/detail/detail.js` | `_getOpenId()` 改为调用 `api.getOpenId()` |

### api.js 新增方法清单

- `getDB()` - 获取数据库实例
- `getOpenId()` - 获取用户 OpenID
- `getMyPosts(authorId)` - 获取我发布的帖子
- `getMyLikes(userId)` - 获取我喜欢的猫咪
- `deleteCat(id)` - 删除猫咪（含级联删除评论）
- `getMyComments(authorId)` - 获取我的评论
- `deleteComment(id)` - 删除评论
- `getUserStats(userId)` - 获取用户统计数据（异步）

---

## Bug #10: 删除帖子未关联删除评论

### 问题描述
删除帖子时只删除了 `cats` 集合的记录，没有删除 `comments` 集合中关联的评论，导致脏数据残留。

### 修复方案
删除帖子时，先删除该帖子下的所有评论，再删除帖子本身。

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `miniprogram/pages/my-posts/my-posts.js` | `_deletePost()` 方法中，先调用 `api.getDB().collection('comments').where({ catId: id }).remove()` |
| `miniprogram/utils/api.js` | `deleteCat()` 方法增加级联删除评论逻辑 |
| `cloudfunctions/deleteCat/index.js` | 云函数删除时也级联删除评论 |

### 修复代码

```js
// Bug #10: 先删除该帖子下的所有评论
await db.collection('comments').where({ catId: id }).remove();

// 再删除帖子
await db.collection('cats').doc(id).remove();
```

---

## Bug #13: 用户身份全部为 'guest'

### 问题描述
app.js 中没有调用 login 云函数获取真实 openid，导致所有用户身份都是 'guest'。

### 修复方案
在 `app.js` 的 `onLaunch` 中通过 `wx.cloud.callFunction({ name: 'login' })` 获取真实 openid，并存储到本地。

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `miniprogram/app.js` | `onLaunch` 改为 async，添加 login 云函数调用，将 openid 存入 `wx.setStorageSync('openId', openid)` |
| `cloudfunctions/login/index.js` | 新建，简单返回 `wxContext.OPENID` |
| `cloudfunctions/login/package.json` | 新建，云函数配置 |

### 修复代码

```js
// app.js onLaunch 中
try {
  const res = await wx.cloud.callFunction({ name: 'login' });
  if (res.result && res.result.openid) {
    wx.setStorageSync('openId', res.result.openid);
  } else {
    wx.setStorageSync('openId', 'guest');
  }
} catch (err) {
  console.error('获取 openid 失败，fallback 为 guest:', err);
  wx.setStorageSync('openId', 'guest');
}
```

### 注意事项
- 如果 login 云函数未部署，会自动 fallback 到 'guest'
- 需要上传 login 云函数到微信云开发环境才能生效

---

## Bug #19: my-posts.wxml 分类文本硬编码

### 问题描述
`my-posts.wxml` 第 42 行使用三元表达式硬编码分类文本：
```html
{{item.category === 'stray' ? '流浪猫' : item.category === 'pet' ? '家养猫' : '寻猫'}}
```

### 修复方案
在 `my-posts.js` 中添加 `categoryMap`，wxml 中统一使用映射。

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `miniprogram/pages/my-posts/my-posts.js` | `data` 中新增 `categoryMap: { stray: '流浪猫', pet: '家养猫', lost: '寻猫启事' }` |
| `miniprogram/pages/my-posts/my-posts.wxml` | 改为 `{{categoryMap[item.category] || '未知'}}` |

### 修复代码

**my-posts.js:**
```js
data: {
  // ...
  categoryMap: {
    stray: '流浪猫',
    pet: '家养猫',
    lost: '寻猫启事'
  }
}
```

**my-posts.wxml:**
```html
<text>{{categoryMap[item.category] || '未知'}}</text>
```

---

## Bug #20: clearCache 清除所有本地存储

### 问题描述
`profile.js` 的 `clearCache()` 方法使用 `wx.clearStorageSync()` 清除所有本地存储，包括 openId 等关键数据，导致用户需要重新登录。

### 修复方案
改为只清除非关键缓存（图片缓存、临时数据、搜索历史），保留 openId 等关键数据。

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `miniprogram/pages/profile/profile.js` | `clearCache()` 改为只调用 `wx.removeStorageSync()` 删除非关键键 |

### 修复代码

```js
clearCache() {
  wx.showModal({
    title: '清除缓存',
    content: '确定要清除临时缓存数据吗？（不会删除登录信息）',
    success: (res) => {
      if (res.confirm) {
        wx.removeStorageSync('imageCache');
        wx.removeStorageSync('tempData');
        wx.removeStorageSync('searchHistory');
        wx.showToast({ title: '缓存已清除', icon: 'success' });
      }
    }
  });
}
```

---

## 修改文件汇总

| 文件 | 修复 Bug | 状态 |
|------|----------|------|
| `cloudfunctions/login/index.js` | #13 | ✅ 新建 |
| `cloudfunctions/login/package.json` | #13 | ✅ 新建 |
| `cloudfunctions/addCat/index.js` | #05/#06 | ✅ 已修复 |
| `cloudfunctions/getCatList/index.js` | #05/#06 | ✅ 已修复 |
| `cloudfunctions/getCatDetail/index.js` | #05/#06 | ✅ 已修复 |
| `cloudfunctions/deleteCat/index.js` | #05/#06, #10 | ✅ 已修复 |
| `cloudfunctions/addComment/index.js` | #05/#06 | ✅ 已修复 |
| `miniprogram/app.js` | #13 | ✅ 已修复 |
| `miniprogram/utils/api.js` | #09, #10 | ✅ 已重写 |
| `miniprogram/pages/index/index.js` | #05/#06, #09 | ✅ 已修复 |
| `miniprogram/pages/detail/detail.js` | #05/#06, #09 | ✅ 已修复 |
| `miniprogram/pages/publish/publish.js` | #09 | ✅ 已修复 |
| `miniprogram/pages/my-posts/my-posts.js` | #09, #10, #19 | ✅ 已修复 |
| `miniprogram/pages/my-posts/my-posts.wxml` | #19 | ✅ 已修复 |
| `miniprogram/pages/my-likes/my-likes.js` | #09 | ✅ 已修复 |
| `miniprogram/pages/my-comments/my-comments.js` | #09 | ✅ 已修复 |
| `miniprogram/pages/profile/profile.js` | #09, #20 | ✅ 已修复 |

---

## 后续建议

1. **上传云函数**：需要将 `login` 云函数上传到微信云开发环境
2. **数据库迁移**：如果已有数据使用旧字段名，需要进行数据迁移
3. **测试验证**：在微信开发者工具中全面测试所有修复的功能
