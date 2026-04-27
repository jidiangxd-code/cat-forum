Component({
  properties: {
    catItem: {
      type: Object,
      value: {}
    }
  },

  data: {
    categoryText: '小猫'
  },

  observers: {
    'catItem.category': function (val) {
      const map = { stray: '流浪猫', pet: '家养猫', lost: '寻猫' };
      this.setData({ categoryText: map[val] || '小猫' });
    }
  },

  methods: {
    // 点击卡片
    onCardTap() {
      this.triggerEvent('tap', { id: this.data.catItem._id });
    },

    // 点击点赞
    onLikeTap() {
      this.triggerEvent('like', {
        id: this.data.catItem._id,
        liked: this.data.catItem.liked
      });
    },

    // 图片加载失败，显示默认图
    onImageError() {
      this.setData({ imageLoadError: true });
    }
  },

  data: {
    categoryText: '小猫',
    imageLoadError: false
  },
});
