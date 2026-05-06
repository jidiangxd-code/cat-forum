// miniprogram/components/cloudTipModal/index.js - 云开发提示弹层组件逻辑
Component({
  // 组件内部只维护一个显隐状态，和外部属性保持同步。
  data: {
    showTip: false,
  },
  // 外部传入弹层标题、正文和显隐控制。
  properties: {
    showTipProps: Boolean,
    title: String,
    content: String,
  },
  // 当父层修改 showTipProps 时，组件内部同步更新展示状态。
  observers: {
    showTipProps: function (showTipProps) {
      this.setData({
        showTip: showTipProps,
      });
    },
  },
  // 组件内只处理关闭动作，不承接额外业务逻辑。
  methods: {
    // 点击关闭按钮时收起弹层。
    onClose() {
      this.setData({
        showTip: !this.data.showTip,
      });
    },
  },
});
