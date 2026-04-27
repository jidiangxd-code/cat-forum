# Bug 修复记录 v2 - 代码审查

## 已修复 Bug

### ✅ Bug #01: shareCat 方法不存在
- **文件：** detail.js
- **修复：** 新增 shareCat() 方法调用 wx.showShareMenu()

### ✅ Bug #02: goPublish 方法不存在
- **文件：** my-posts.js
- **修复：** 新增 goPublish() 方法跳转发布页

### ✅ Bug #03: 我的评论 catId 跳转未校验
- **文件：** my-comments.js
- **修复：** 跳转前检查 catId 有效性

### ✅ Bug #04: 发布页 navigateBack 从 tabBar 进入时失败
- **文件：** publish.js
- **修复：** 判断页面栈长度，无上一页时 switchTab 到首页

### ✅ Bug #08: 评论成功后未更新 commentCount
- **文件：** detail.js
- **修复：** 评论成功后同步更新 cat.commentCount +1

### ✅ Bug #11: 首页 loading 初始值为 false，首次加载闪过空状态
- **文件：** index.js
- **修复：** loading 初始值改为 true

### ✅ Bug #12: 评论时间显示 [object Object]
- **文件：** detail.js
- **修复：** 本地模拟评论时间使用格式化字符串

### ✅ Bug #15: 默认图片路径不存在
- **文件：** 多处
- **修复：** 创建 assets/images/default-avatar.png 和 default-cat.png

### ✅ Bug #18: previewImage 缺少空值保护
- **文件：** detail.js
- **修复：** 增加 cat.images 空检查

### ✅ Bug #22: Mock 数据使用 placekitten.com（中国无法访问）
- **文件：** index.js, detail.js
- **修复：** 替换为本地图片 /images/default-cat.png

## 待修复 Bug（非紧急）

### Bug #13: _getOpenId 返回硬编码 'guest'
- **影响：** 所有用户共享同一身份
- **建议：** 接入微信授权登录，获取真实 openid
- **优先级：** 高（上线前必须修复）

### Bug #09: 前端直接操作数据库，绕过云函数
- **影响：** 缺乏服务端权限校验
- **建议：** 全部切换到云函数调用
- **优先级：** 高（上线前必须修复）

### Bug #05/#06: 前端与云函数字段名不一致
- **影响：** 如果切换到云函数会数据不兼容
- **建议：** 统一字段命名
- **优先级：** 中

### Bug #10: 删除帖子未关联删除评论
- **影响：** 产生孤儿评论
- **建议：** 删除帖子时级联删除评论
- **优先级：** 中

### Bug #19: my-posts.wxml 分类文本硬编码
- **影响：** 与详情页不一致
- **建议：** 统一使用 categoryMap
- **优先级：** 低

### Bug #20: clearCache 清除所有本地存储
- **影响：** 清除后丢失 openId 等数据
- **建议：** 改为清除特定缓存 key
- **优先级：** 低
