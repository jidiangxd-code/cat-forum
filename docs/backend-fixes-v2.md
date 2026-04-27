# 后端代码修复记录 v2

> **修复日期：** 2026-04-19
> **执行者：** 后端开发工程师
> **范围：** cloudfunctions/ 全量云函数

---

## 一、修复概述

本次修复基于 `docs/bug-report-v2.md` 和 `docs/backend-optimization.md` 中的建议，完成以下工作：

1. 新增 login 云函数
2. 修复所有云函数的字段名一致性
3. 新增 deleteComment 云函数
4. 修复所有云函数的输入校验
5. 新增 contentCheck 云函数

---

## 二、字段名一致性修复（Bug #05 / #06 / #25）

### 问题描述

云函数使用 `createdBy`, `likes`, `createdAt`，而前端使用 `authorId`, `likeCount`, `createTime`，导致数据流断裂。

### 统一规则

所有云函数**写入数据库时**统一使用前端字段名：

| 旧字段名 | 新字段名 | 说明 |
|---------|---------|------|
| `createdBy` | `authorId` | 创建者 openid |
| `likes` | `likeCount` | 点赞数 |
| `createdAt` | `createTime` | 创建时间 |
| — | `likedBy` | 点赞用户列表（新增） |
| — | `commentCount` | 评论数（新增） |
| — | `updateTime` | 更新时间（替代 updatedAt） |

### 删除操作兼容

`deleteCat` 和 `deleteComment` 在验证权限时兼容新旧字段名：

```js
const authorId = cat.authorId || cat.createdBy;
const authorId = comment.authorId || comment.userId;
```

### 修改清单

| 云函数 | 修改内容 |
|--------|---------|
| `addCat` | `createdBy→authorId`, `likes→likeCount`, `createdAt→createTime`, 新增 `likedBy`, `commentCount`, `updateTime` |
| `getCatList` | 排序字段 `createdAt→createTime` |
| `getCatDetail` | 评论排序字段 `createdAt→createTime` |
| `addComment` | `userId→authorId`, `createdAt→createTime`, 新增 `commentCount` 原子递增 |
| `deleteCat` | 验证权限时兼容 `authorId` / `createdBy` |
| `toggleFavorite` | `createdAt→createTime`, `updatedAt→updateTime` |

---

## 三、新增云函数

### 3.1 login 云函数

- **路径：** `cloudfunctions/login/`
- **功能：** 获取用户 openid 和 unionid
- **返回格式：**
```json
{
  "success": true,
  "code": 200,
  "data": {
    "openid": "xxx",
    "unionid": "yyy"
  }
}
```

### 3.2 deleteComment 云函数

- **路径：** `cloudfunctions/deleteComment/`
- **功能：**
  - 验证 commentId 参数（类型、长度）
  - 验证用户身份（通过 openid）
  - 验证评论所有权（兼容 authorId/userId）
  - 软删除评论（status→'deleted'）
  - 递减猫咪的 commentCount
- **错误码：** 400 / 401 / 403 / 404 / 500

### 3.3 contentCheck 云函数

- **路径：** `cloudfunctions/contentCheck/`
- **功能：**
  - 调用微信 `msgSecCheck` API 审核文本
  - 输入校验：类型检查、长度限制（≤2000字符）
  - 处理审核结果：通过(0) / 违规(87014) / 服务异常
- **返回格式：**
```json
{
  "success": true,
  "code": 200,
  "data": {
    "pass": true,
    "label": 0,
    "suggestion": "pass"
  },
  "message": "内容审核通过"
}
```

---

## 四、输入校验修复

### 4.1 所有云函数统一校验规则

每个云函数都添加了：

| 校验项 | 规则 |
|--------|------|
| **类型检查** | 字符串类型校验、数组类型校验 |
| **必填检查** | 空值/trim 后空值检查 |
| **长度限制** | ID ≤ 64, 名称 ≤ 50, 地点 ≤ 100, 描述 ≤ 2000, 评论 ≤ 1000 |
| **格式校验** | 图片路径长度 ≤ 500, 标签 ≤ 20 字符 |
| **分页限制** | page ≥ 1, pageSize 1-50, 最大页数 100 |

### 4.2 ReDoS 修复

在 `getCatList` 和 `addCat` 中添加正则转义函数：

```js
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

所有用户输入的字符串用于 RegExp 前，必须先经过 `escapeRegex()` 转义。

### 4.3 各云函数具体校验

#### addCat
- name: 必填, string, trim后 ≤50
- location: 必填, string, trim后 ≤100
- description: string, trim后 ≤2000
- images: 数组, ≤9张, 每项 string ≤500
- tags: 数组, ≤10个, 每项 string 1-20字符

#### addComment
- catId: 必填, string, ≤64
- content: 必填, string, trim后 1-1000字符

#### getCatList
- page: 正整数, ≤100
- pageSize: 1-50 整数
- tag: string, 1-50字符（可选）
- location: string, 1-50字符（可选），正则转义

#### getCatDetail
- catId: 必填, string, ≤64
- commentPage: ≥1（默认1）
- commentPageSize: 1-50（默认20）

#### deleteCat
- catId: 必填, string, ≤64

#### deleteComment
- commentId: 必填, string, ≤64

#### toggleFavorite
- catId: 必填, string, ≤64

#### contentCheck
- text: 必填, string, trim后 1-2000字符

#### login
- 无需输入参数

---

## 五、错误返回格式统一

所有云函数统一返回格式：

**成功：**
```json
{ "success": true, "code": 200, "data": { ... }, "message": "操作成功" }
```

**失败：**
```json
{ "success": false, "code": 400|401|403|404|500, "message": "错误描述" }
```

---

## 六、修改文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 🆕 新增 | `cloudfunctions/login/index.js` | 登录云函数 |
| 🆕 新增 | `cloudfunctions/login/package.json` | 依赖配置 |
| 🆕 新增 | `cloudfunctions/deleteComment/index.js` | 删除评论云函数 |
| 🆕 新增 | `cloudfunctions/deleteComment/package.json` | 依赖配置 |
| 🆕 新增 | `cloudfunctions/contentCheck/index.js` | 内容审核云函数 |
| 🆕 新增 | `cloudfunctions/contentCheck/package.json` | 依赖配置 |
| ✏️ 修改 | `cloudfunctions/addCat/index.js` | 字段名 + 输入校验 |
| ✏️ 修改 | `cloudfunctions/addComment/index.js` | 字段名 + 输入校验 + 评论数递增 |
| ✏️ 修改 | `cloudfunctions/getCatList/index.js` | 排序字段 + 分页校验 + ReDoS修复 |
| ✏️ 修改 | `cloudfunctions/getCatDetail/index.js` | 字段名 + catId校验 + 评论分页 |
| ✏️ 修改 | `cloudfunctions/deleteCat/index.js` | catId校验 + 字段名兼容 |
| ✏️ 修改 | `cloudfunctions/toggleFavorite/index.js` | 字段名 + catId校验 + 并发优化 |

---

## 七、注意事项

1. **数据库已有数据兼容：** deleteCat 和 deleteComment 中的权限验证已兼容新旧字段名，老数据（使用 createdBy/userId 字段）仍可正常操作
2. **contentCheck 需要权限：** 需在微信云开发控制台开通「内容安全」API 权限
3. **前端需适配：** 前端应切换到云函数调用，不再直接操作数据库（这是前端侧的工作，不在本次修复范围内）
4. **数据库索引建议：** 建议创建以下复合索引以提升查询性能：
   - `cats`: status(asc) + createTime(desc)
   - `comments`: catId(asc) + status(asc) + createTime(desc)

---

*文档结束*
