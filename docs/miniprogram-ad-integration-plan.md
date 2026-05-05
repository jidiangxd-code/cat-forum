# cat-forum 微信小程序广告接入方案

更新时间：2026-05-02

## 目标

在不打断用户看猫、发帖、投票主流程的前提下接入微信小程序流量主广告。第一期只做微信官方广告组件，不引入第三方广告 SDK。

## 前置条件

1. 在微信公众平台开通「流量主」。
2. 按广告类型分别创建广告位，拿到每个广告位的 `adUnitId`。
3. 真机和正式版环境验证广告展示；开发者工具和体验版可能出现无广告返回或展示限制。
4. 发布前完成主流机型适配测试，避免广告外层宽度、层级或遮挡导致审核风险。

## 广告类型与适配判断

| 类型 | 微信能力 | cat-forum 推荐场景 | 接入优先级 |
| --- | --- | --- | --- |
| Banner 广告 | `<ad unit-id="...">` 组件 | 首页帖子流底部、猫咪榜列表底部、详情页评论区上方 | P0 |
| 原生模板广告 | `<ad-custom unit-id="...">` 组件 | 首页信息流每 6-8 条插入一张广告卡、猫咪榜列表中段 | P0 |
| 激励视频广告 | `wx.createRewardedVideoAd({ adUnitId })` | 用户主动点击「看广告多投一票」或「看广告获得一次置顶曝光」 | P1 |
| 插屏广告 | `wx.createInterstitialAd({ adUnitId })` | 发布成功后、分享完成后、从我的页面回首页等有停顿感的位置 | P2 |
| 视频广告 | `<ad ad-type="video" ...>` | 暂不适合第一期，页面内容以图文为主 | P3 |
| 封面/支付后广告 | 后台能力为主 | 当前无支付流程，封面广告需谨慎评估打开体验 | 暂缓 |

## 建议新增文件

### `miniprogram/config/ad.js`

统一配置广告位 ID 和开关，避免广告 ID 散落在页面内。

```js
module.exports = {
  enabled: true,
  units: {
    homeBanner: '替换为首页Banner广告位ID',
    detailBanner: '替换为详情页Banner广告位ID',
    feedNative: '替换为原生模板广告位ID',
    rewardedVote: '替换为激励视频广告位ID',
    publishInterstitial: '替换为插屏广告位ID'
  }
};
```

### `miniprogram/utils/ad.js`

封装激励视频和插屏广告，统一处理 `load/error/close`，页面只关心结果。

```js
const adConfig = require('../config/ad.js');

function canUseAd() {
  return adConfig.enabled && typeof wx !== 'undefined';
}

function showRewardedVideo(unitId) {
  return new Promise((resolve, reject) => {
    if (!canUseAd() || !wx.createRewardedVideoAd) {
      reject(new Error('当前基础库不支持激励视频广告'));
      return;
    }

    const ad = wx.createRewardedVideoAd({ adUnitId: unitId });
    ad.onClose((res) => {
      ad.offClose();
      if (!res || res.isEnded) resolve({ rewarded: true });
      else reject(new Error('广告未完整观看'));
    });
    ad.onError((err) => reject(err));
    ad.show().catch(() => ad.load().then(() => ad.show()));
  });
}

function showInterstitial(unitId) {
  if (!canUseAd() || !wx.createInterstitialAd) return Promise.resolve(false);
  const ad = wx.createInterstitialAd({ adUnitId: unitId });
  ad.onError((err) => console.warn('插屏广告失败', err));
  return ad.show().then(() => true).catch(() => false);
}

module.exports = {
  showRewardedVideo,
  showInterstitial
};
```

## 需要修改的页面

### 首页信息流：`miniprogram/pages/index/index.wxml`

在顶部横幅下方或帖子流每 6-8 条插入原生模板广告。

```xml
<view class="ad-wrap" wx:if="{{showAds}}">
  <ad-custom unit-id="{{adUnits.feedNative}}" bindload="onAdLoad" binderror="onAdError" />
</view>
```

同步修改 `index.js`：

```js
const adConfig = require('../../config/ad.js');

data: {
  adUnits: adConfig.units,
  showAds: adConfig.enabled
}
```

### 猫咪详情页：`miniprogram/pages/detail/detail.wxml`

评论区前放 Banner，避免插在图片轮播和正文之间影响阅读。

```xml
<view class="ad-wrap" wx:if="{{showAds}}">
  <ad unit-id="{{adUnits.detailBanner}}" bindload="onAdLoad" binderror="onAdError" />
</view>
```

同步修改 `detail.js` 引入 `adConfig` 并设置 `adUnits/showAds`。

### 猫咪榜：`miniprogram/pages/cat-list/cat-list.wxml`

列表底部放 Banner；人气榜中段可二期再插原生模板广告，避免榜单连续性被打断。

### 猫咪主页：`miniprogram/pages/cat-home/cat-home.js`

激励视频只放在用户主动行为上，不默认弹出。建议二期把「今日投票」旁边新增「看广告加一次助力」按钮，并新增云函数记录激励奖励，防止前端伪造。

需要新增云函数：

1. `cloudfunctions/grantAdReward`：校验登录态、广告奖励频率、当日次数。
2. 数据库新增 `ad_rewards`：`openid`、`adUnitId`、`scene`、`rewardType`、`createTime`、`status`。

### 发布成功后：`miniprogram/pages/publish/publish.js`

发帖成功、完成跳转前可以尝试展示插屏广告。失败时静默跳过，不能阻塞发布结果。

```js
const ad = require('../../utils/ad.js');
const adConfig = require('../../config/ad.js');

await ad.showInterstitial(adConfig.units.publishInterstitial);
```

## 样式建议

新增或复用页面 wxss：

```css
.ad-wrap {
  width: 100%;
  box-sizing: border-box;
  padding: 16rpx 24rpx;
}
```

Banner 外层宽度不要小于 300px；视频广告外层宽度不要小于屏幕宽度 90%。原生模板广告应按后台模板预览确认实际高度，避免列表滚动跳动。

## 收益与体验优化

1. 优先接入原生模板广告和 Banner：它们和图文社区的信息流更贴合，用户感知较低。
2. 插屏只放在流程结束点：发布成功、分享完成、Tab 切换后的自然停顿，不在打开小程序、下拉刷新、连续浏览中强行弹出。
3. 激励视频必须有真实奖励：例如额外投票、限时置顶、活动参与机会；用户中途关闭不发奖励。
4. 广告位分场景创建：`homeBanner/detailBanner/feedNative/rewardedVote/publishInterstitial` 分开统计，后续才能判断收益和留存影响。
5. 记录广告事件：`load/error/show/rewarded/closed` 打点到 `ad_events` 集合或后续统计服务，用于发现无填充、频控和机型问题。
6. 控制密度：信息流原生模板每 6-8 条一条；详情页最多一个 Banner；插屏同一用户至少间隔数分钟。
7. 设置远程开关：广告审核失败、收益低或用户投诉时，可以通过云数据库配置或 `ad.js` 开关快速关闭。

## 参考资料

- 微信官方开发文档：`https://developers.weixin.qq.com/miniprogram/dev/component/ad.html`
- 微信官方开发文档：`https://developers.weixin.qq.com/miniprogram/dev/component/ad-custom.html`
- 微信官方开发文档：`https://developers.weixin.qq.com/miniprogram/dev/api/ad/wx.createRewardedVideoAd.html`
- 微信官方开发文档：`https://developers.weixin.qq.com/miniprogram/dev/api/ad/wx.createInterstitialAd.html`
- 腾讯广告《小程序广告组件详解与接入指引》：`https://training.tencentads.com/uploads/202406/EPLBpxYt_5dDA71.pdf`
- 腾讯云《小程序广告接入指引》：`https://cloud.tencent.com/document/product/1301/103788`
