# 数据库索引与超时优化方案（当前代码实际版本）

更新时间：2026-05-05

## 1. 结论

当前控制台里的 `Error: timeout`，从现有代码判断，不太像 `login` 云函数超时。

已确认：

- `miniprogram/app.js` 中的 `login` 云函数调用已经成功返回 `openid`
- 报错更可能发生在页面初始化后的数据加载阶段
- 这个项目当前最需要处理的不是“盲目加长超时时间”，而是：
  - 给高频过滤 + 排序查询补齐索引
  - 减少页面初始化时的串行和 N+1 查询
  - 识别哪些查询模式本身就吃不到普通索引

## 2. 当前最可能的超时来源

### 2.1 首页帖子流

文件：

- `miniprogram/pages/index/index.js`
- `miniprogram/utils/api.js`

调用链：

1. `onLoad()` 调用 `loadPosts(true)`
2. `loadPosts()` 调用 `api.getPostList(...)`
3. 返回帖子后，再对每个未缓存 `catId` 调用一次 `api.getCatProfile(id)`

风险点：

- 首页先查 `posts`
- 再按帖子里的 `catId` 一条条查 `cats_profile`
- 这是典型的 N+1 查询模式

即使数据量不大，网络抖动、权限检查、调试基础库波动，也可能把整体耗时拉长。

### 2.2 猫咪主页

文件：

- `miniprogram/pages/cat-home/cat-home.js`
- `miniprogram/utils/api.js`

调用链：

1. `loadAll()`
2. 并发执行 `loadCatProfile()` 和 `loadTodayVote()`
3. 再执行 `loadPosts(true)`

风险点：

- 页面初始化要打三类查询：猫档案、今日投票、该猫帖子
- `votes`、`posts` 两边如果没索引，容易在页面首次进入时一起拖慢

### 2.3 帖子详情页

文件：

- `miniprogram/pages/detail/detail.js`
- `miniprogram/utils/api.js`

调用链：

1. `loadPostDetail()`
2. 查询帖子详情
3. 查询是否已收藏
4. 查询是否关注作者
5. 如果有 `catId`，继续查猫档案
6. 另一路同时查评论 `loadComments()`

风险点：

- 一个页面打开时要查 `posts`、`favorites`、`follows`、`cats_profile`、`comments`
- 详情页属于“调用链长但单次数据量小”的页面
- 这类页面更怕多个小查询串起来，而不是单个查询特别大

## 3. 当前代码里的查询模式

### 3.1 `cats_profile`

当前代码实际查询模式：

- `isMerged != true` + `createTime desc`
- `isMerged != true` + `totalVote desc`
- `catType = unknown` + `isMerged != true` + `createTime desc`
- `_id in [...]`
- `fullName/codeName/appearance/location/personality` 的模糊匹配

### 3.2 `posts`

当前代码实际查询模式：

- `status = active` + `createTime desc`
- `status = active` + `likeCount desc` + `createTime desc`
- `catId = ?` + `status = active` + `createTime desc`
- `_id in [...]`
- `content/location` 的模糊匹配

### 3.3 `comments`

当前代码实际查询模式：

- `postId = ?` + `status = active` + `createTime asc`

### 3.4 `votes`

当前代码实际查询模式：

- `userOpenid = ?` + `voteDate = ?`

### 3.5 `favorites`

当前代码实际查询模式：

- `postId = ?` + `userOpenid = ?`
- `userOpenid = ?` + `createTime desc`

### 3.6 `follows`

当前代码实际查询模式：

- `fromUserId = ?` + `toUserId = ?`

## 4. 建议立即创建的索引

下面这批索引是按“当前代码真实查询路径”来的，不是泛化建议。

### 4.1 `cats_profile`

建议：

1. 复合索引：`isMerged asc, createTime desc`
2. 复合索引：`isMerged asc, totalVote desc`
3. 复合索引：`catType asc, isMerged asc, createTime desc`

用途：

- 猫列表
- 新猫榜
- 总榜
- 未知猫列表

说明：

- `_id` 默认有索引，不需要额外建

### 4.2 `posts`

建议：

1. 复合索引：`status asc, createTime desc`
2. 复合索引：`status asc, likeCount desc, createTime desc`
3. 复合索引：`catId asc, status asc, createTime desc`
4. 复合索引：`authorId asc, createTime desc`

用途：

- 首页最新
- 首页最热
- 猫主页帖子流
- “我的帖子”类页面

### 4.3 `comments`

建议：

1. 复合索引：`postId asc, status asc, createTime asc`
2. 复合索引：`authorId asc, createTime desc`
3. 可选复合索引：`parentId asc, createTime asc`

用途：

- 帖子评论列表
- 我的评论
- 回复树排序

### 4.4 `votes`

建议：

1. 复合索引：`userOpenid asc, voteDate asc`
2. 可选复合索引：`catId asc, voteDate asc`

用途：

- 判断用户今天是否投过票
- 统计某天某猫投票情况

### 4.5 `favorites`

建议：

1. 复合索引：`postId asc, userOpenid asc`
2. 复合索引：`userOpenid asc, createTime desc`

用途：

- 判断某帖是否已收藏
- 收藏列表按时间倒序

### 4.6 `follows`

建议：

1. 复合索引：`fromUserId asc, toUserId asc`
2. 可选复合索引：`toUserId asc, createTime desc`

用途：

- 判断是否已关注
- 粉丝列表

### 4.7 `notifications`

如果通知页启用，建议预先建：

1. 复合索引：`userId asc, createTime desc`
2. 复合索引：`userId asc, isRead asc, createTime desc`

## 5. 哪些查询即使建索引也收益有限

### 5.1 当前模糊搜索

文件：

- `miniprogram/utils/api.js`

问题点：

- `cats_profile` 的 `fullName/codeName/appearance/location/personality`
- `posts` 的 `content/location`
- 当前都用了 `RegExp(..., 'i')`

这类“包含式模糊匹配”通常不能稳定吃到普通 B-Tree 索引收益，尤其不是前缀匹配时。

这意味着：

- 你给 `content` 建普通索引，不代表当前搜索会明显变快
- 你给 `appearance` 建普通索引，也不代表当前模糊搜索一定快

如果后面数据量上来，应该改为：

1. 前缀搜索
2. 关键词拆词字段，比如 `searchTokens`
3. 专门的搜索服务，而不是继续靠正则扫集合

## 6. 这次超时不一定只是索引问题

数据量少时，单次全表扫描通常不至于稳定打满 30 秒。

所以这次错误更要怀疑下面几类问题：

1. 页面初始化链路过长
2. N+1 查询过多
3. 某个 Promise 没有正常收口
4. 某个云函数调用失败后，被上层再次重试或等待
5. 调试基础库灰度版的波动

当前最明显的结构性问题是首页：

- 先查帖子
- 再按 `catId` 一条条查猫档案

这比“单表没索引”更容易在小数据量时也出现“看起来像超时”的体验问题。

## 7. 优化顺序

不要一上来只改超时时间。建议顺序如下：

1. 先补齐上面列出的复合索引
2. 再把首页的 N+1 猫档案查询改成批量 `_id in [...]`
3. 详情页把可并行的查询并行化
4. 给关键请求加耗时日志，定位到底是哪一段慢
5. 最后才考虑微调客户端超时

## 8. 关于“索引最大持续时长”

这个说法需要纠正。

索引没有“最大持续时长”这个概念。

真正会变化的是：

- 查询耗时
- 写入耗时
- 索引维护成本
- 索引占用存储

应该根据数据量和查询模式变化，定期复核索引，而不是理解成“索引会自己过期或超时”。

## 9. 按数据量的索引调整建议

### 9.1 小于 1000 条

重点：

- 先查调用链
- 先消灭 N+1
- 补核心复合索引即可

### 9.2 1000 到 10000 条

重点：

- 首页、评论、收藏、投票索引必须完整
- 深分页要谨慎使用 `skip`

### 9.3 10000 到 100000 条

重点：

- 模糊搜索必须改造
- 榜单和列表页尽量改游标分页
- 热门排序字段要固定，避免临时拼查询

### 9.4 大于 100000 条

重点：

- 帖子搜索和猫搜索不要继续直接正则扫库
- 评论、通知、收藏建议拆冷热数据
- 榜单统计可考虑预聚合

## 10. 官方参考

腾讯云官方资料可参考：

- 云开发数据库管理文档：
  `https://cloud.tencent.com/document/product/876/19370`
- 云开发团队关于自动索引设计的文章：
  `https://cloud.tencent.com/developer/article/1662493`
- CloudBase 数据库常见问题 PDF：
  `https://main.qcloudimg.com/raw/document/debug/product/pdf/876_18428_cn.pdf`

其中官方明确表达过两个方向：

1. 数据量和流量增长后，缺索引会让查询显著变慢
2. 地理位置查询必须建立地理索引

本项目当前还没用到地理位置查询 API，但如果后续真按经纬度做附近猫咪或地图检索，就要单独补地理索引，而不是普通索引。
