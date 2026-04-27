# 校园小猫论坛 — UI/UX 设计规范

> 版本：v1.0 | 更新日期：2026-04-19 | 设计师：UI/UX Designer

---

## 一、设计理念

**关键词：温暖 · 可爱 · 社区感**

以校园猫咪为主题，营造轻松、温馨的社区氛围。色彩明快但不刺眼，布局简洁但不空洞，交互流畅且有温度。

---

## 二、色彩体系

### 2.1 主色

| 角色 | 色值 | 说明 |
|------|------|------|
| 主色 - 温暖橙 | `#FF9500` | 按钮、标签、强调文字、TabBar 激活态 |
| 主色 - 清新绿 | `#34C759` | 成功状态、点赞、健康标记、通过标签 |

### 2.2 辅助色

| 角色 | 色值 | 说明 |
|------|------|------|
| 辅助橙浅 | `#FFF3E0` | 卡片背景、标签底色 |
| 辅助绿浅 | `#E8F5E9` | 绿色操作提示底色 |
| 信息蓝 | `#5AC8FA` | 提示、链接、通知 |
| 警告红 | `#FF3B30` | 错误、举报、危险操作 |
| 中性灰-1 | `#F7F7F7` | 页面背景 |
| 中性灰-2 | `#E5E5EA` | 分割线、边框 |
| 中性灰-3 | `#999999` | 次要文字（时间、辅助说明） |
| 中性灰-4 | `#333333` | 主要文字 |
| 纯白 | `#FFFFFF` | 卡片背景、输入框背景 |

### 2.3 渐变色

| 渐变 | 色值 | 使用场景 |
|------|------|----------|
| 顶部渐变 | `#FF9500 → #FF6B00` | 导航栏背景 |
| 按钮渐变 | `#FF9500 → #FFB340` | 主按钮背景 |

---

## 三、字体规范

### 3.1 字体族

```
font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
```

### 3.2 字号阶梯

| 级别 | 字号 | 使用场景 |
|------|------|----------|
| H1 标题 | 36rpx (18px) | 页面大标题 |
| H2 标题 | 32rpx (16px) | 模块标题、卡片标题 |
| H3 标题 | 28rpx (14px) | 小标题、标签 |
| 正文 | 28rpx (14px) | 帖子正文、描述文字 |
| 辅助文字 | 24rpx (12px) | 时间戳、次要信息 |
| 按钮文字 | 30rpx (15px) | 按钮内文字 |
| 小按钮 | 24rpx (12px) | TabBar、筛选标签 |

### 3.3 字重

| 字重 | 值 | 使用场景 |
|------|-----|----------|
| Regular | 400 | 正文、辅助文字 |
| Medium | 500 | 按钮文字、TabBar |
| Semibold | 600 | 标题 |
| Bold | 700 | 大标题、强调数字 |

### 3.4 行高

| 场景 | 行高 | 比例 |
|------|------|------|
| 标题 | 1.3 | 紧凑 |
| 正文 | 1.6 | 舒适阅读 |
| 辅助文字 | 1.4 | 节省空间 |

---

## 四、间距系统

采用 **8px 基准网格系统**，所有间距为 8 的倍数。

| 代号 | 尺寸 (rpx) | 尺寸 (px) | 使用场景 |
|------|-------------|-----------|----------|
| xs | 8rpx | 4px | 图标与文字间距、标签内边距 |
| sm | 16rpx | 8px | 元素之间小间距 |
| md | 24rpx | 12px | 卡片内边距、组件间距 |
| lg | 32rpx | 16px | 模块间距、内容区边距 |
| xl | 48rpx | 24px | 页面区块间距 |
| 2xl | 64rpx | 32px | 大区块间距 |

---

## 五、圆角规范

| 级别 | 圆角值 (rpx) | 使用场景 |
|------|-------------|----------|
| 无 | 0 | 全屏背景、分割线 |
| 小 | 8rpx (4px) | 标签、小按钮、Tag |
| 中 | 16rpx (8px) | 输入框、卡片、按钮 |
| 大 | 24rpx (12px) | 弹窗、Toast、底部弹出层 |
| 胶囊 | 999rpx | Pill 按钮、搜索框 |
| 圆形 | 50% | 头像 |

---

## 六、阴影规范

| 级别 | 阴影值 | 使用场景 |
|------|--------|----------|
| 无 | none | 扁平元素 |
| 轻 | `0 2rpx 8rpx rgba(0,0,0,0.06)` | 卡片、列表项 |
| 中 | `0 4rpx 16rpx rgba(0,0,0,0.1)` | 悬浮按钮、弹窗 |
| 重 | `0 8rpx 24rpx rgba(0,0,0,0.15)` | 模态遮罩层、底部面板 |

---

## 七、组件设计规范

### 7.1 按钮 (Button)

#### 主按钮
```css
height: 80rpx;
border-radius: 16rpx;
background: linear-gradient(135deg, #FF9500, #FFB340);
color: #FFFFFF;
font-size: 30rpx;
font-weight: 600;
```

#### 次要按钮
```css
height: 80rpx;
border-radius: 16rpx;
background: #FFF3E0;
color: #FF9500;
font-size: 30rpx;
font-weight: 500;
border: 2rpx solid #FF9500;
```

#### 文字按钮
```css
color: #FF9500;
font-size: 28rpx;
font-weight: 500;
```

#### 状态
- **默认**：正常色值
- **按下**：透明度 `0.8` 或背景变深 5%
- **禁用**：透明度 `0.4`，不可点击

---

### 7.2 卡片 (Card)

```css
background: #FFFFFF;
border-radius: 16rpx;
padding: 24rpx;
box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
margin-bottom: 24rpx;
```

**内部元素间距**：
- 卡片标题与内容：`16rpx`
- 卡片内容与底部信息：`24rpx`

---

### 7.3 输入框 (Input)

```css
height: 80rpx;
border-radius: 16rpx;
background: #F7F7F7;
padding: 0 24rpx;
font-size: 28rpx;
border: 2rpx solid transparent;
```

**聚焦状态**：
```css
border-color: #FF9500;
background: #FFFFFF;
```

**多行输入框 (Textarea)**：
```css
min-height: 200rpx;
border-radius: 16rpx;
background: #F7F7F7;
padding: 24rpx;
font-size: 28rpx;
line-height: 1.6;
```

---

### 7.4 标签 (Tag)

```css
display: inline-flex;
align-items: center;
height: 48rpx;
padding: 0 16rpx;
border-radius: 8rpx;
font-size: 24rpx;
font-weight: 500;
```

**变体**：
- 橙色标签：`background: #FFF3E0; color: #FF9500;`
- 绿色标签：`background: #E8F5E9; color: #34C759;`
- 灰色标签：`background: #F7F7F7; color: #999999;`

---

### 7.5 头像 (Avatar)

| 尺寸 | 圆角 | 使用场景 |
|------|------|----------|
| 大 96rpx | 50% | 个人中心、作者展示 |
| 中 72rpx | 50% | 帖子作者 |
| 小 56rpx | 50% | 评论列表 |
| 超小 40rpx | 50% | 头像列表、群聊 |

---

### 7.6 图片展示

```css
border-radius: 16rpx;
overflow: hidden;
aspect-ratio: 1 / 1;  /* 方形展示 */
```

**帖子图片**：
- 单图：宽度 `100%`，高度自适应，最大高度 `600rpx`
- 多图网格：3列布局，间距 `8rpx`，每张圆角 `8rpx`

---

### 7.7 TabBar

```css
height: 100rpx;
background: #FFFFFF;
border-top: 1rpx solid #E5E5EA;
```

**Tab 项**：
- 图标大小：`48rpx × 48rpx`
- 文字大小：`20rpx`
- 激活色：`#FF9500`
- 默认色：`#999999`

---

### 7.8 空状态 (Empty State)

```css
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
padding: 120rpx 0;
```

- 图标大小：`200rpx × 200rpx`
- 提示文字：`28rpx`, `#999999`, `margin-top: 32rpx`

---

### 7.9 加载状态 (Loading)

- 页面级加载：顶部进度条（微信小程序自带 `wx.showLoading`）
- 列表加载：底部骨架屏，高度与卡片一致
- 骨架屏背景：`#F7F7F7`，动画 `pulse` 渐变

---

## 八、页面布局规范

### 8.1 页面结构

```
┌──────────────────────┐
│    NavigationBar     │  自定义或原生导航栏
├──────────────────────┤
│                      │
│    Content Area      │  主内容区，padding: 32rpx
│                      │
├──────────────────────┤
│      TabBar          │  底部导航栏（100rpx 高）
└──────────────────────┘
```

### 8.2 安全区域

- 顶部适配：`env(safe-area-inset-top)` — iPhone 刘海屏适配
- 底部适配：`env(safe-area-inset-bottom)` — iPhone 底部横条适配
- TabBar 底部留出：`padding-bottom: calc(24rpx + env(safe-area-inset-bottom))`

---

## 九、动效规范

| 类型 | 时长 | 曲线 | 使用场景 |
|------|------|------|----------|
| 快速 | 150ms | ease-out | 点击反馈、状态切换 |
| 标准 | 300ms | ease-in-out | 页面切换、卡片展开 |
| 慢速 | 500ms | ease-in-out | 弹窗出现、面板滑入 |

**点赞动效**：❤️ 放大 1.3 倍 → 缩小到 1.0，带粒子效果

---

## 十、暗黑模式预留

> 当前版本暂不支持暗黑模式，但设计规范需预留扩展能力。

| 角色 | 亮色 | 暗色（预留） |
|------|------|-------------|
| 页面背景 | `#F7F7F7` | `#1C1C1E` |
| 卡片背景 | `#FFFFFF` | `#2C2C2E` |
| 主要文字 | `#333333` | `#F5F5F5` |
| 次要文字 | `#999999` | `#8E8E93` |
| 分割线 | `#E5E5EA` | `#38383A` |

---

## 十一、设计交付物清单

| 文件 | 路径 | 状态 |
|------|------|------|
| 设计规范 | `design/guidelines.md` | ✅ 已完成 |
| 首页设计 | `design/pages/index.md` | 🔄 进行中 |
| 详情页设计 | `design/pages/detail.md` | 🔄 进行中 |
| 发布页设计 | `design/pages/publish.md` | 🔄 进行中 |
| 个人中心设计 | `design/pages/profile.md` | 🔄 进行中 |
| 资源描述 | `design/assets.md` | 🔄 进行中 |
