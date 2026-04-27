# 详情页 (Detail) — 页面设计文档

> 版本：v1.0 | 更新日期：2026-04-19

---

## 一、页面概述

**页面路径**：`/pages/detail/detail`

**页面定位**：展示单个帖子的完整内容，包括图片轮播、正文、作者信息、互动功能和评论区。

---

## 二、页面结构

```
┌──────────────────────────────────────┐
│  [←]       帖子详情         [⋯]      │  ← 导航栏 (白色背景)
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │     [图片轮播 / 单图展示]       │  │  ← 图片区 (600rpx 高)
│  │     ←  ●○○  →                │  │  ← 轮播指示器
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  🐱 小橘   ·   📍 食堂附近     │  │  ← 作者 & 位置
│  │  标题：食堂门口的小橘猫超可爱！  │  │
│  │                                │  │
│  │  正文内容...                    │  │  ← 可展开/收起
│  │  今天中午在食堂门口遇到一只小橘  │  │
│  │  猫，超级亲人，一直蹭我的腿...   │  │
│  │                                │  │
│  │  🏷 #小橘 #食堂 #亲人          │  │  ← 标签
│  └────────────────────────────────┘  │
│                                      │
│  ❤️ 128   💬 32   ⭐ 收藏   📤 分享  │  ← 互动操作栏
│  ────────────────────────────────   │
│                                      │
│  评论区 (32)                         │  ← 评论区标题
│  ┌────────────────────────────────┐  │
│  │  [头像] 小明                    │  │
│  │  我也见过！每天中午都在那      │  │  ← 评论项
│  │  2h 前  ❤️ 12   💬 回复        │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  ...                          │  │
│  └────────────────────────────────┘  │
│                                      │
├──────────────────────────────────────┤
│  [  说点什么...  ]    [发送]          │  ← 底部评论输入栏 (96rpx)
└──────────────────────────────────────┘
```

---

## 三、组件详细设计

### 3.1 导航栏

| 属性 | 值 |
|------|-----|
| 背景 | `#FFFFFF` |
| 标题 | "帖子详情"，`32rpx`, `#333333` |
| 返回按钮 | 左侧 `←` 图标 |
| 更多操作 | 右侧 `⋯`，点击弹出（举报、分享） |
| 底部线条 | `1rpx solid #E5E5EA` |

### 3.2 图片展示区

#### 单图模式
```css
.image-single {
  width: 100%;
  max-height: 600rpx;
  object-fit: cover;
}
```

#### 多图轮播模式
```css
.swiper {
  width: 100%;
  height: 600rpx;
}
.swiper-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}
.swiper-dot-active {
  background: #FF9500;
}
.swiper-dot-inactive {
  background: rgba(255,255,255,0.6);
}
```

- 指示器位置：图片底部居中，距离底部 `24rpx`
- 支持左右滑动切换
- 点击可全屏查看

### 3.3 内容区

```css
.content-section {
  padding: 32rpx;
  background: #FFFFFF;
  margin-bottom: 16rpx;
}
```

#### 作者信息行
```css
.author-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
```

| 元素 | 样式 |
|------|------|
| 作者头像 | `72rpx` 圆形，点击跳转作者主页 |
| 作者昵称 | `28rpx`, `#333333`, `font-weight: 600` |
| 位置标签 | `24rpx`, `#34C759`, `background: #E8F5E9` |
| 发布时间 | `24rpx`, `#999999` |

#### 标题
```css
.title {
  font-size: 32rpx;
  font-weight: 700;
  color: #333333;
  margin-bottom: 16rpx;
  line-height: 1.4;
}
```

#### 正文
```css
.body {
  font-size: 28rpx;
  color: #333333;
  line-height: 1.6;
  /* 超过 5 行显示"展开"按钮 */
}
```

- 超过 5 行时截断，显示 `...展开` 按钮
- 展开按钮样式：`24rpx`, `#FF9500`

#### 标签
```css
.tags {
  margin-top: 24rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
```

### 3.4 互动操作栏

```css
.action-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 24rpx 32rpx;
  background: #FFFFFF;
  margin-bottom: 16rpx;
  border-top: 1rpx solid #F7F7F7;
  border-bottom: 1rpx solid #F7F7F7;
}
```

| 操作 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| 点赞 | ❤️ | 默认 `#999999`，已赞 `#FF3B30` | 带动画反馈 |
| 评论 | 💬 | `#999999` | 滚动到评论区 |
| 收藏 | ⭐ | 默认 `#999999`，已收藏 `#FF9500` | — |
| 分享 | 📤 | `#999500` | 微信原生分享 |

### 3.5 评论区

```css
.comment-section {
  padding: 0 32rpx;
}
```

#### 评论标题
```css
.comment-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333333;
  padding: 24rpx 0 16rpx;
}
```

#### 单条评论
```css
.comment-item {
  display: flex;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #F7F7F7;
}
```

| 元素 | 样式 |
|------|------|
| 评论者头像 | `56rpx` 圆形 |
| 评论者昵称 | `26rpx`, `#333333`, `font-weight: 500` |
| 评论内容 | `28rpx`, `#333333`, `line-height: 1.6`, `margin-top: 8rpx` |
| 评论时间 | `24rpx`, `#999999` |
| 点赞 | `24rpx`, `#999999`，已赞 `#FF3B30` |

### 3.6 底部评论输入栏

```css
.comment-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 96rpx;
  padding-bottom: env(safe-area-inset-bottom);
  background: #FFFFFF;
  border-top: 1rpx solid #E5E5EA;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  z-index: 100;
}
```

| 元素 | 样式 |
|------|------|
| 输入框 | `flex: 1`, `height: 64rpx`, `border-radius: 32rpx`, `background: #F7F7F7` |
| 发送按钮 | `height: 64rpx`, `width: 120rpx`, `border-radius: 32rpx`, `background: #FF9500`, `color: #FFFFFF` |
| 输入框内文字 | "说点什么...", `28rpx`, `#999999` |

---

## 四、交互说明

| 操作 | 反馈 |
|------|------|
| 点击图片 | 全屏查看，支持左右滑动和双指缩放 |
| 点击作者头像/昵称 | 跳转作者主页 |
| 点赞 | ❤️ 变红 + 数字 +1 + 弹跳动画 |
| 展开正文 | 平滑展开，按钮文字变为"收起" |
| 点击回复 | 底部输入栏聚焦，显示 `@用户名` |
| 发送评论 | 评论插入列表顶部，显示成功 Toast |
| 长按评论 | 弹出菜单（删除、举报、复制） |
| 点击更多操作 | 底部弹出面板（举报、分享给朋友、分享到朋友圈） |

---

## 五、特殊状态

### 5.1 帖子已删除

```
┌──────────────────────────────────────┐
│                                      │
│          [🗑️ 图标]                   │
│          该帖子已被删除               │
│                                      │
└──────────────────────────────────────┘
```

### 5.2 图片加载失败

- 显示默认占位图
- 右下角显示 🔄 重试按钮

---

## 六、数据来源

| 数据项 | 来源 |
|--------|------|
| 帖子详情 | 云函数 `getPostDetail` |
| 图片列表 | 云存储 CDN 地址 |
| 评论列表 | 云函数 `getComments` (分页) |
| 互动状态 | 本地缓存 + 云函数 |
