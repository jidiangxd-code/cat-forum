# 后端开发工程师 (Backend Developer)

## 职责
- 云函数开发
- 数据库设计
- API 接口实现
- 数据安全与权限控制

## 当前任务

### 1. 数据库设计
**交付物：** `docs/database.md`

**集合设计：**
```javascript
// cats 集合 (猫咪信息)
{
  _id: String,
  name: String,           // 猫咪名字
  location: String,       // 出现地点
  description: String,    // 描述
  images: Array,          // 图片 URL 数组
  tags: Array,            // 标签
  createdAt: Date,
  createdBy: String,      // 发布者 openid
  likes: Number,          // 点赞数
  comments: Array         // 评论数组
}

// users 集合 (用户信息)
{
  _id: String,
  openid: String,
  nickname: String,
  avatar: String,
  favorites: Array,       // 收藏的猫咪 ID
  createdAt: Date
}
```

### 2. 云函数开发
**需要开发的云函数：**
- `getCatList` - 获取猫咪列表
- `getCatDetail` - 获取猫咪详情
- `addCat` - 添加猫咪
- `updateCat` - 更新猫咪
- `deleteCat` - 删除猫咪
- `addComment` - 添加评论
- `toggleFavorite` - 收藏/取消收藏

**位置：** `cloudfunctions/` 目录

### 3. 权限规则
配置数据库权限，确保：
- 用户只能删除自己发布的内容
- 评论需要登录
- 敏感操作需要云函数代理

## 验收标准
- [ ] 数据库集合创建完成
- [ ] 7 个云函数开发完成
- [ ] 权限规则配置完成
- [ ] 接口测试通过
