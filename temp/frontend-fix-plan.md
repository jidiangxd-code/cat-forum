# 前端修复执行计划

创建时间: 2026-04-19 20:48

## 目标
修复校园小猫论坛前端 Bug，优化用户体验，记录修改到 docs/frontend-fixes.md

## 发现的问题清单

### P0 - 功能性 Bug
1. index.js: toggleLike 调用 api.toggleLike 参数缺失 (只传 id，缺少 userId 和 liked)
2. my-posts: 长按删除时 data-name 未绑定，name 为 undefined
3. detail: 评论列表无分页/滚动限制，评论过多会溢出屏幕

### P1 - 图片加载失败处理
4. cat-card: 图片无 onerror 处理
5. detail: 轮播图无 onerror 处理
6. detail: 头像无 onerror 处理
7. profile: 头像无 onerror 处理
8. my-posts: 封面图无 onerror 处理
9. my-likes: 封面图无 onerror 处理
10. my-comments: 猫封面图无 onerror 处理

### P2 - 样式/布局问题
11. filter-bar: 小屏幕溢出，需横向滚动
12. detail: 描述文本无截断，长文本溢出
13. profile: .user-avatar 类名在 WXSS 中拼写正确但需要确认
14. my-likes: 网格布局 nth-child 边距可能溢出
15. my-posts: 删除提示覆盖层与操作冲突
16. detail: 底部评论输入框遮挡内容，需增加底部 padding

### P3 - 交互体验优化
17. 所有列表页缺少上拉加载更多（仅 index 有）
18. publish: 缺少实时表单验证提示
19. publish: 字符计数器无颜色变化（接近上限时）
20. detail: 评论输入框无空内容禁用发送
21. index: 加载状态无骨架屏
22. publish: 图片选择后无加载提示

## 步骤
- [x] 步骤1: 阅读所有源文件，列出问题清单
- [ ] 步骤2: 修复功能性 Bug (P0)
- [ ] 步骤3: 修复图片加载失败处理 (P1)
- [ ] 步骤4: 修复样式/布局问题 (P2)
- [ ] 步骤5: 优化交互体验 (P3)
- [ ] 步骤6: 写入 docs/frontend-fixes.md 和 status/activity-log.json
