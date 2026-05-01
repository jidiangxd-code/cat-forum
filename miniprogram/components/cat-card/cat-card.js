Component({
  properties: {
    catItem: {
      type: Object,
      value: {}
    }
  },

  data: {
    categoryText: '小猫',
    imageLoadError: false
  },

  observers: {
    'catItem.category': function (val) {
      const map = {
        daily: '日常', rescue: '救助', neuter: '绝育',
        adopt: '领养', lost: '寻猫', other: '其他'
      };
      this.setData({ categoryText: map[val] || '小猫' });
    }
  },

  methods: {
    onCardTap() {
      this.triggerEvent('tap', { id: this.data.catItem._id });
    },

    onLikeTap() {
      this.triggerEvent('like', {
        id: this.data.catItem._id,
        liked: this.data.catItem.liked
      });
    },

    onImageError() {
      this.setData({ imageLoadError: true });
    }
  }
});
