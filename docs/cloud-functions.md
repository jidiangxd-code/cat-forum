# 云函数设计文档 - 校园小猫论坛

> 基于微信云开发（CloudBase）云函数，Node.js 运行环境。

---

## 一、云函数总览

| 云函数名         | 功能         | 触发方式 | 认证要求 |
| ---------------- | ------------ | -------- | -------- |
| `getCatList`     | 获取猫咪列表 | 客户端调用 | 否       |
| `getCatDetail`   | 获取猫咪详情 | 客户端调用 | 否       |
| `addCat`         | 添加猫咪帖子 | 客户端调用 | 是       |
| `deleteCat`      | 删除猫咪帖子 | 客户端调用 | 是       |
| `addComment`     | 添加评论     | 客户端调用 | 是       |
| `toggleFavorite` | 收藏/取消收藏| 客户端调用 | 是       |

---

## 二、云函数详细设计

### 2.1 getCatList - 获取猫咪列表

**功能描述：** 分页获取猫咪帖子列表，支持按标签、地点筛选，按时间倒序排列。

**请求参数：**

| 参数名     | 类型   | 必填 | 默认值 | 说明                    |
| ---------- | ------ | ---- | ------ | ----------------------- |
| `page`     | Number | 否   | `1`    | 页码                    |
| `pageSize` | Number | 否   | `10`   | 每页数量                |
| `tag`      | String | 否   | -      | 按标签筛选              |
| `location` | String | 否   | -      | 按地点筛选              |

**返回值：**

```javascript
{
  success: true,
  data: {
    list: [       // 猫咪列表
      {
        _id: "xxx",
        name: "大黄",
        location: "三食堂门口",
        description: "...",
        images: ["fileID1", "fileID2"],
        tags: ["橘猫", "亲人"],
        createdAt: Date,
        createdBy: "openid_xxx",
        likes: 42,
        viewCount: 128
      }
    ],
    total: 100,   // 总数
    page: 1,      // 当前页
    pageSize: 10  // 每页数量
  }
}
```

---

### 2.2 getCatDetail - 获取猫咪详情

**功能描述：** 获取单条猫咪帖子的详细信息，同时增加浏览次数。

**请求参数：**

| 参数名  | 类型   | 必填 | 说明           |
| ------- | ------ | ---- | -------------- |
| `catId` | String | 是   | 猫咪帖子 _id   |

**返回值：**

```javascript
{
  success: true,
  data: {
    _id: "xxx",
    name: "大黄",
    location: "三食堂门口",
    description: "...",
    images: ["fileID1", "fileID2"],
    tags: ["橘猫", "亲人"],
    createdAt: Date,
    updatedAt: Date,
    createdBy: "openid_xxx",
    likes: 42,
    viewCount: 129,
    comments: [       // 内联评论列表
      {
        _id: "cmt_xxx",
        userId: "openid_xxx",
        nickname: "小明",
        avatar: "...",
        content: "好可爱！",
        createdAt: Date
      }
    ]
  }
}
```

---

### 2.3 addCat - 添加猫咪帖子

**功能描述：** 发布一条新的猫咪帖子，包含图片、描述、标签等信息。

**请求参数：**

| 参数名        | 类型      | 必填 | 说明             |
| ------------- | --------- | ---- | ---------------- |
| `name`        | String    | 是   | 猫咪名字         |
| `location`    | String    | 是   | 出现地点         |
| `description` | String    | 否   | 详细描述         |
| `images`      | String[]  | 否   | 图片 fileID 数组 |
| `tags`        | String[]  | 否   | 标签数组         |

**返回值：**

```javascript
{
  success: true,
  data: {
    _id: "新生成的文档ID"
  }
}
```

**权限校验：** 需要用户登录（`auth.openid` 存在）。

---

### 2.4 deleteCat - 删除猫咪帖子

**功能描述：** 删除一条猫咪帖子，仅帖子发布者本人可操作。

**请求参数：**

| 参数名  | 类型   | 必填 | 说明           |
| ------- | ------ | ---- | -------------- |
| `catId` | String | 是   | 猫咪帖子 _id   |

**返回值：**

```javascript
{
  success: true,
  message: "删除成功"
}
// 失败时
{
  success: false,
  message: "无权删除他人帖子"
}
```

**权限校验：** 仅 `createdBy` 与当前用户 openid 匹配时可删除。

---

### 2.5 addComment - 添加评论

**功能描述：** 在一条猫咪帖子下添加评论。

**请求参数：**

| 参数名    | 类型   | 必填 | 说明           |
| --------- | ------ | ---- | -------------- |
| `catId`   | String | 是   | 猫咪帖子 _id   |
| `content` | String | 是   | 评论内容       |

**返回值：**

```javascript
{
  success: true,
  data: {
    _id: "新评论ID",
    catId: "xxx",
    userId: "openid_xxx",
    nickname: "小明",
    content: "好可爱！",
    createdAt: Date
  }
}
```

**权限校验：** 需要用户登录。

---

### 2.6 toggleFavorite - 收藏/取消收藏

**功能描述：** 切换对某条猫咪帖子的收藏状态。

**请求参数：**

| 参数名  | 类型   | 必填 | 说明           |
| ------- | ------ | ---- | -------------- |
| `catId` | String | 是   | 猫咪帖子 _id   |

**返回值：**

```javascript
{
  success: true,
  data: {
    action: "added",   // "added" 或 "removed"
    favorites: ["catId1", "catId2"]  // 当前收藏列表
  }
}
```

**权限校验：** 需要用户登录。

---

## 三、通用错误码

| 错误码 | 说明             |
| ------ | ---------------- |
| `400`  | 参数错误         |
| `401`  | 未登录/无权操作  |
| `403`  | 权限不足         |
| `404`  | 资源不存在       |
| `500`  | 服务器内部错误   |

**错误返回格式：**

```javascript
{
  success: false,
  code: 401,
  message: "错误描述信息"
}
```

---

## 四、部署说明

每个云函数是一个独立目录，结构如下：

```
cloudfunctions/
├── getCatList/
│   ├── index.js
│   └── package.json
├── getCatDetail/
│   ├── index.js
│   └── package.json
├── addCat/
│   ├── index.js
│   └── package.json
├── deleteCat/
│   ├── index.js
│   └── package.json
├── addComment/
│   ├── index.js
│   └── package.json
└── toggleFavorite/
    ├── index.js
    └── package.json
```

**部署方式：**
1. 在微信开发者工具中右键云函数目录 → 「上传并部署：云端安装依赖」
2. 或使用 CLI：`cloudbase functions:deploy <functionName>`
