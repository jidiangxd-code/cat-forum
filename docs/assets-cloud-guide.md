# 云资源库管理规范

> 根据微信官方建议：超过 200KB 的图片/音视频资源应上传到云存储，使用 `cloud://` ID 引用，不应放在代码包内。

---

## 资源管理规范

### ❌ 错误做法（会导致代码质量扫描不通过）
```html
<!-- 错误：大图片放在代码包内 -->
<image src="/images/photo.png" />
```

### ✅ 正确做法
```html
<!-- 正确：使用云存储 ID 引用 -->
<image src="{{cloudImgUrl}}" />
```

```javascript
// JS 中获取云文件临时链接
wx.cloud.getTempFileURL({
  fileList: ['cloud://xxx/photos/photo.png']
}).then(res => {
  this.setData({ cloudImgUrl: res.fileList[0].tempFileURL });
});
```

---

## 上传资源到云存储的操作步骤

### 方法一：微信开发者工具上传（推荐）

1. 打开微信开发者工具
2. 左侧切换到「云开发」→「云存储」
3. 点击「上传文件」，选择本地图片
4. 上传成功后，复制「文件 ID」（格式：`cloud://xxx/xxx.png`）
5. 在代码中用这个 `cloud://` ID 引用

### 方法二：通过代码上传（适合用户上传的内容）

```javascript
// 用户选择的图片，直接上传到云存储
wx.chooseImage({
  success: async (res) => {
    const filePath = res.tempFilePaths[0];
    const uploadRes = await wx.cloud.uploadFile({
      cloudPath: 'photos/' + Date.now() + '.png',  // 云存储路径
      filePath: filePath
    });
    console.log('云文件 ID:', uploadRes.fileID);  // cloud://xxx/...
  }
});
```

---

## 资源目录规划

建议在云存储中按类型分类存放：

```
cloud://[env]/
├── icons/          # 小图标（< 50KB，可放本地）
├── photos/         # 用户上传的照片
├── cats/           # 猫咪照片
├── posts/          # 帖子配图
└── assets/         # 其他静态资源
    └── guide/      # 引导页/示例图片
```

---

## 本地代码包的图片原则

| 类型 | 大小限制 | 存放位置 |
|------|-----------|----------|
| Tab 图标 | < 30KB | `assets/icons/`（本地） |
| 默认头像/占位图 | < 50KB | `assets/images/`（本地） |
| 用户上传的图片 | 不限 | **必须上传云存储** |
| 示例/引导大图 | 不限 | **必须上传云存储** |

---

## 代码质量扫描前检查清单

提交审核前，执行以下步骤：

1. **扫描大文件**
   ```bash
   # 在项目根目录执行，找出超过 200KB 的图片
   find miniprogram -name "*.png" -o -name "*.jpg" | xargs ls -lh | awk '$5 > 200'
   ```

2. **确认 `app.json` 已开启按需注入**
   ```json
   { "lazyCodeLoading": "requiredComponents" }
   ```

3. **在微信开发者工具中**
   - 「工具」→「构建 npm」→「编译」
   - 确认所有修改已保存
   - 重新提交代码质量扫描

---

## 常见错误处理

### 扫描报告「图片资源超过 200K」
→ 原因：图片未上传云存储，放在了本地代码包  
→ 解决：上传到云存储，用 `cloud://` ID 替换本地路径

### 云图片显示不出来
→ 检查云存储权限是否为「所有用户可读」  
→ 在云开发控制台 → 云存储 → 权限设置

---

*建立时间：2026-05-10*
*维护人：郭旭东*
