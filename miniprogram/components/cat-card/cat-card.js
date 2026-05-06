// miniprogram/components/cat-card/cat-card.js - 猫咪卡片组件逻辑
Component({
  // 父页面传入的猫咪/帖子卡片数据从这里进入组件。
  properties: {
    catItem: {
      type: Object,
      value: {}
    }
  },

  // 组件内部只维护类目文案和图片兜底状态，不持有业务数据源。
  data: {
    categoryText: '小猫',
    imageLoadError: false
  },

  // 根据传入的 category 自动切换成更适合展示的中文标签。
  observers: {
    'catItem.category': function (val) {
      const map = {
        daily: '日常', rescue: '救助', neuter: '绝育',
        adopt: '领养', lost: '寻猫', other: '其他'
      };
      this.setData({ categoryText: map[val] || '小猫' });
    }
  },

  // 组件只负责派发交互事件，真正的页面跳转和状态更新由父层处理。
  methods: {
    // 把卡片点击事件透传给父组件。
    onCardTap() {
      this.triggerEvent('tap', { id: this.data.catItem._id });
    },

    // 单独透传点赞动作，避免和整卡点击混在一起。
    onLikeTap() {
      this.triggerEvent('like', {
        id: this.data.catItem._id,
        liked: this.data.catItem.liked
      });
    },

    // 封面图加载失败后改用默认猫咪图片，避免卡片留白。
    onImageError() {
      this.setData({ imageLoadError: true });
    }
  }
});
