# 前端开发工程师 (Frontend Developer)

## 职责
- 微信小程序页面开发
- WXML/WXSS/JS 编写
- 组件封装与复用
- 接口对接与数据渲染

## 当前任务

### 1. 项目初始化
```bash
# 在微信开发者工具中创建项目
项目路径：C:\Users\郭旭东\Desktop\xiao_mao
AppID: (使用测试号或申请正式号)
后端服务：微信云开发
```

### 2. 目录结构搭建
```
xiao_mao/
├── cloudfunctions/     # 云函数
├── miniprogram/        # 小程序代码
│   ├── pages/          # 页面
│   ├── components/     # 组件
│   ├── utils/          # 工具函数
│   ├── assets/         # 静态资源
│   └── app.js/wxss/json
└── project.config.json
```

### 3. 页面开发
**优先级：**
1. 首页 (index) - 猫咪列表展示
2. 详情页 (detail) - 猫咪信息 + 评论
3. 发布页 (publish) - 表单 + 图片上传
4. 个人中心 (profile) - 用户信息

### 4. 组件开发
- 猫咪卡片组件 (CatCard)
- 评论列表组件 (CommentList)
- 图片上传组件 (ImageUploader)

## 验收标准
- [ ] 项目结构搭建完成
- [ ] 4 个核心页面开发完成
- [ ] 组件封装完成
- [ ] 云函数接口对接完成
- [ ] 真机预览正常
