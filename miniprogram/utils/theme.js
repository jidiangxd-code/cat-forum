/**
 * 主题管理器
 * 定义4套主题皮肤：活力橙 / 黑夜 / 小清新 / 粉可爱
 * 
 * 使用方式：
 *   const theme = require('../../utils/theme.js');
 *   theme.apply('dark');       // 应用主题
 *   theme.getCurrent();        // 获取当前主题
 *   theme.onChange(fn);         // 监听主题变化
 */

// ==================== 主题定义 ====================

const THEMES = {
  orange: {
    id: 'orange',
    name: '活力橙',
    icon: '🧡',
    desc: '温暖阳光，活力满满',
    // 背景层
    '--color-bg': '#FFF5EB',
    '--color-bg-card': '#ffffff',
    '--color-bg-input': '#ffffff',
    '--color-bg-hover': '#FFF0E0',
    '--color-bg-tab': '#ffffff',
    '--color-bg-active': '#FFF5EB',
    '--color-bg-disabled': '#f5f5f5',
    '--color-bg-image': '#f0f0f0',
    '--color-bg-divider': '#f0e8e0',
    '--color-bg-tag': '#FFF0E0',
    '--color-bg-tag-health': '#E8F5E9',
    '--color-bg-badge': '#FF9A6A',
    '--color-bg-btn-primary': '#FF9A6A',
    '--color-bg-btn-secondary': '#FFF5EB',
    '--color-bg-btn-danger': '#FF5252',
    // 文字层
    '--color-text-primary': '#333333',
    '--color-text-secondary': '#666666',
    '--color-text-desc': '#999999',
    '--color-text-muted': '#cccccc',
    '--color-text-placeholder': '#c0c0c0',
    '--color-text-accent': '#E87C32',
    '--color-text-accent-light': '#FF8C42',
    '--color-text-tag': '#E67E22',
    '--color-text-tag-health': '#4CAF50',
    '--color-text-white': '#ffffff',
    '--color-text-red': '#FF5252',
    '--color-text-blue': '#4A90E2',
    '--color-text-success': '#4CAF50',
    // 边框
    '--color-border': '#f0e8e0',
    '--color-border-light': '#f5f0eb',
    '--color-border-accent': '#FFB74D',
    // 阴影
    '--color-shadow': 'rgba(255, 154, 106, 0.15)',
    '--color-shadow-card': '0 4rpx 16rpx rgba(255, 154, 106, 0.15)',
    '--color-shadow-btn': 'rgba(255, 140, 66, 0.35)',
    // 导航 & TabBar
    '--nav-bg': '#FF9A6A',
    '--nav-title': '#ffffff',
    '--tab-bar-bg': '#ffffff',
    '--tab-bar-border': '#ffffff',
    '--tab-bar-color': '#999999',
    '--tab-bar-active': '#FF9A6A',
    '--tab-bar-selected-bg': 'rgba(255,154,106,0.1)',
    '--avatar-bg': '#FFE0C0',
    // 渐变
    '--banner-gradient': 'linear-gradient(135deg, #FF9A6A, #FF7043)',
    '--primary-gradient': 'linear-gradient(135deg, #FFB74D, #FF8C42)',
    '--btn-primary-gradient': 'linear-gradient(135deg, #FFB74D, #FF8C42)',
  },
  dark: {
    id: 'dark',
    name: '黑夜',
    icon: '🌙',
    desc: '深邃静谧，护眼舒适',
    '--color-bg': '#18182A',
    '--color-bg-card': '#252545',
    '--color-bg-input': '#2E2E48',
    '--color-bg-hover': '#2E2E48',
    '--color-bg-tab': '#252545',
    '--color-bg-active': '#2E2E48',
    '--color-bg-disabled': '#2E2E48',
    '--color-bg-image': '#2E2E48',
    '--color-bg-divider': '#32324A',
    '--color-bg-tag': '#2E2E48',
    '--color-bg-tag-health': '#1A3A2A',
    '--color-bg-badge': '#6C5CE7',
    '--color-bg-btn-primary': '#6C5CE7',
    '--color-bg-btn-secondary': '#252538',
    '--color-bg-btn-danger': '#E74C3C',
    '--color-text-primary': '#F0F0F8',
    '--color-text-secondary': '#C0C0D8',
    '--color-text-desc': '#9090A8',
    '--color-text-muted': '#686880',
    '--color-text-placeholder': '#585870',
    '--color-text-accent': '#A29BFE',
    '--color-text-accent-light': '#6C5CE7',
    '--color-text-tag': '#A29BFE',
    '--color-text-tag-health': '#6CFF6C',
    '--color-text-white': '#ffffff',
    '--color-text-red': '#ff7675',
    '--color-text-blue': '#74b9ff',
    '--color-text-success': '#6CFF6C',
    '--color-border': '#2A2A40',
    '--color-border-light': '#333350',
    '--color-border-accent': '#A29BFE',
    '--color-shadow': 'rgba(0, 0, 0, 0.4)',
    '--color-shadow-card': '0 4rpx 20rpx rgba(0, 0, 0, 0.4)',
    '--color-shadow-btn': 'rgba(108, 92, 231, 0.4)',
    '--nav-bg': '#1E1E30',
    '--nav-title': '#E8E8F0',
    '--tab-bar-bg': '#1E1E30',
    '--tab-bar-border': '#2A2A40',
    '--tab-bar-color': '#707088',
    '--tab-bar-active': '#A29BFE',
    '--tab-bar-selected-bg': 'rgba(162,155,254,0.12)',
    '--avatar-bg': '#2E2E48',
    '--banner-gradient': 'linear-gradient(135deg, #3D3D6B, #2E2E5A)',
    '--primary-gradient': 'linear-gradient(135deg, #A29BFE, #6C5CE7)',
    '--btn-primary-gradient': 'linear-gradient(135deg, #A29BFE, #6C5CE7)',
  },
  fresh: {
    id: 'fresh',
    name: '小清新',
    icon: '🌿',
    desc: '清新自然，如沐春风',
    '--color-bg': '#F0FAF5',
    '--color-bg-card': '#ffffff',
    '--color-bg-input': '#ffffff',
    '--color-bg-hover': '#E8F5EC',
    '--color-bg-tab': '#ffffff',
    '--color-bg-active': '#F0FAF5',
    '--color-bg-disabled': '#f0f5f0',
    '--color-bg-image': '#e8f0ec',
    '--color-bg-divider': '#e0ece4',
    '--color-bg-tag': '#E8F5EC',
    '--color-bg-tag-health': '#C8E6C9',
    '--color-bg-badge': '#4CAF50',
    '--color-bg-btn-primary': '#4CAF50',
    '--color-bg-btn-secondary': '#F0FAF5',
    '--color-bg-btn-danger': '#FF5252',
    '--color-text-primary': '#1B4A2F',
    '--color-text-secondary': '#2D7A4A',
    '--color-text-desc': '#3A6A4A',
    '--color-text-muted': '#609060',
    '--color-text-placeholder': '#709070',
    '--color-text-accent': '#4CAF50',
    '--color-text-accent-light': '#66BB6A',
    '--color-text-tag': '#2D6A4F',
    '--color-text-tag-health': '#388E3C',
    '--color-text-white': '#ffffff',
    '--color-text-red': '#FF5252',
    '--color-text-blue': '#42A5F5',
    '--color-text-success': '#4CAF50',
    '--color-border': '#C8E6C9',
    '--color-border-light': '#E0F0E8',
    '--color-border-accent': '#81C784',
    '--color-shadow': 'rgba(76, 175, 80, 0.15)',
    '--color-shadow-card': '0 4rpx 16rpx rgba(76, 175, 80, 0.12)',
    '--color-shadow-btn': 'rgba(76, 175, 80, 0.35)',
    '--nav-bg': '#4CAF50',
    '--nav-title': '#ffffff',
    '--tab-bar-bg': '#ffffff',
    '--tab-bar-border': '#C8E6C9',
    '--tab-bar-color': '#7AB896',
    '--tab-bar-active': '#4CAF50',
    '--tab-bar-selected-bg': 'rgba(76,175,80,0.1)',
    '--avatar-bg': '#C8E6C9',
    '--banner-gradient': 'linear-gradient(135deg, #66BB6A, #43A047)',
    '--primary-gradient': 'linear-gradient(135deg, #81C784, #66BB6A)',
    '--btn-primary-gradient': 'linear-gradient(135deg, #81C784, #4CAF50)',
  },
  pink: {
    id: 'pink',
    name: '粉可爱',
    icon: '💗',
    desc: '甜美可爱，少女心满满',
    '--color-bg': '#FFF5F8',
    '--color-bg-card': '#ffffff',
    '--color-bg-input': '#ffffff',
    '--color-bg-hover': '#FFF0F4',
    '--color-bg-tab': '#ffffff',
    '--color-bg-active': '#FFF5F8',
    '--color-bg-disabled': '#f5f0f2',
    '--color-bg-image': '#f5e8ec',
    '--color-bg-divider': '#f5e0e8',
    '--color-bg-tag': '#FFE0EC',
    '--color-bg-tag-health': '#FCE4EC',
    '--color-bg-badge': '#FF6B9D',
    '--color-bg-btn-primary': '#FF6B9D',
    '--color-bg-btn-secondary': '#FFF5F8',
    '--color-bg-btn-danger': '#FF5252',
    '--color-text-primary': '#902050',
    '--color-text-secondary': '#B04060',
    '--color-text-desc': '#C05070',
    '--color-text-muted': '#D06080',
    '--color-text-placeholder': '#D06080',
    '--color-text-accent': '#FF6B9D',
    '--color-text-accent-light': '#FF8FB3',
    '--color-text-tag': '#D45070',
    '--color-text-tag-health': '#E91E63',
    '--color-text-white': '#ffffff',
    '--color-text-red': '#FF5252',
    '--color-text-blue': '#64B5F6',
    '--color-text-success': '#4CAF50',
    '--color-border': '#F8C0CC',
    '--color-border-light': '#FCF0F4',
    '--color-border-accent': '#FF8FB3',
    '--color-shadow': 'rgba(255, 107, 157, 0.15)',
    '--color-shadow-card': '0 4rpx 16rpx rgba(255, 107, 157, 0.12)',
    '--color-shadow-btn': 'rgba(255, 107, 157, 0.4)',
    '--nav-bg': '#FF6B9D',
    '--nav-title': '#ffffff',
    '--tab-bar-bg': '#ffffff',
    '--tab-bar-border': '#FFE0EC',
    '--tab-bar-color': '#F0A0B8',
    '--tab-bar-active': '#FF6B9D',
    '--tab-bar-selected-bg': 'rgba(255,107,157,0.1)',
    '--avatar-bg': '#FFE0EC',
    '--banner-gradient': 'linear-gradient(135deg, #FF8FB3, #FF6B9D)',
    '--primary-gradient': 'linear-gradient(135deg, #FFB3CC, #FF8FB3)',
    '--btn-primary-gradient': 'linear-gradient(135deg, #FFB3CC, #FF6B9D)',
  },
};

// ==================== 主题管理器核心 ====================

let currentThemeId = 'orange';
const changeListeners = [];

const ThemeManager = {
  // 获取所有主题列表
  getAll() {
    return Object.values(THEMES);
  },

  // 获取当前主题
  getCurrent() {
    return THEMES[currentThemeId] || THEMES.orange;
  },

  // 获取当前主题ID（兼容别名）
  getCurrentId() {
    return currentThemeId;
  },

  // getThemeId 是 getCurrentId 的别名，方便页面直接调用
  getThemeId() {
    return currentThemeId;
  },

  // 获取 pageClass 字符串，用于 WXML 根元素 class 绑定
  getPageClass() {
    return 'page theme-' + currentThemeId;
  },

  // 应用主题
  apply(themeId) {
    if (!THEMES[themeId]) {
      console.warn('[ThemeManager] 未知主题:', themeId);
      return;
    }
    currentThemeId = themeId;

    // 1. 持久化到本地存储
    try {
      wx.setStorageSync('themeId', themeId);
    } catch (e) {}

    // 2. 通知所有页面更新
    this._notifyPages(themeId);

    // 3. 更新 page 根元素背景色（CSS选择器只能控制view层，page根元素需要JS设置）
    this._updatePageStyle(THEMES[themeId]);

    // 4. 更新 TabBar 颜色
    this._updateTabBar(THEMES[themeId]);

    // 5. 更新 NavigationBar
    this._updateNavBar(THEMES[themeId]);

    // 6. 通知监听器
    changeListeners.forEach(fn => {
      try { fn(THEMES[themeId]); } catch (e) {}
    });

    console.log('[ThemeManager] 已切换到主题:', themeId, THEMES[themeId].name);
  },

  // 加载保存的主题
  loadSaved() {
    try {
      const saved = wx.getStorageSync('themeId');
      if (saved && THEMES[saved]) {
        return saved;
      }
    } catch (e) {}
    return 'orange';
  },

  // 监听主题变化
  onChange(fn) {
    if (typeof fn === 'function') {
      changeListeners.push(fn);
    }
  },

  // 移除监听
  offChange(fn) {
    const idx = changeListeners.indexOf(fn);
    if (idx > -1) changeListeners.splice(idx, 1);
  },

  // ==================== 内部方法 ====================

  // 通知所有已打开的页面更新主题
  // 每个页面需要在 data 中定义 pageClass 字段，
  // WXML 中绑定 class="{{pageClass}}" 到根元素
  _notifyPages(themeId) {
    try {
      const pages = getCurrentPages();
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (typeof page.setData !== 'function') continue;
        try {
          // 批量更新页面主题数据，触发 WXML 重渲染
          page.setData({
            themeId: themeId,
            themeName: THEMES[themeId].name,
            themeIcon: THEMES[themeId].icon,
            // pageClass 用于 WXML 根元素 class 绑定：class="{{pageClass}}"
            // 格式：page theme-orange / page theme-dark / ...
            pageClass: 'page theme-' + themeId,
          });
        } catch (e) {
          console.warn('[ThemeManager] 更新页面失败:', page.route, e.message || e);
        }
      }
    } catch (e) {
      console.warn('[ThemeManager] _notifyPages 出错:', e.message || e);
    }
  },

  // 更新 TabBar 样式
  _updateTabBar(theme) {
    try {
      wx.setTabBarStyle({
        color: theme['--tab-bar-color'],
        selectedColor: theme['--tab-bar-active'],
        backgroundColor: theme['--tab-bar-bg'],
        borderStyle: 'white',
        fail: () => {
          // 忽略失败（可能在 tabBar 页面外调用）
        }
      });
      // 图标色跟随选中色（通过更新 app.json 的方式不可行，
      // 图标颜色需在图标本身设计，这里只更新背景/文字色）
    } catch (e) {}
  },

  // 更新 page 根元素背景色和前景色
  _updatePageStyle(theme) {
    const bgColor = theme['--color-bg'];
    console.log('[ThemeManager] 设置页面背景色:', bgColor);
    
    try {
      // 使用 wx.setBackgroundColor 设置页面背景色
      wx.setBackgroundColor({
        backgroundColor: bgColor,
        backgroundColorTop: bgColor,
        backgroundColorBottom: bgColor,
        success: () => {
          console.log('[ThemeManager] 背景色设置成功:', bgColor);
        },
        fail: (err) => {
          console.warn('[ThemeManager] setBackgroundColor 失败:', err);
          // 备用方案：尝试设置页面样式
          try {
            wx.setPageStyle({
              style: { backgroundColor: bgColor }
            });
          } catch (e) {
            console.warn('[ThemeManager] setPageStyle 也失败:', e);
          }
        }
      });
    } catch (e) {
      console.warn('[ThemeManager] setBackgroundColor 调用异常:', e);
    }
  },

  // 更新 NavigationBar 颜色
  _updateNavBar(theme) {
    try {
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: theme['--nav-bg'],
        animation: { duration: 0, timingFunc: 'linear' },
        fail: () => {}
      });
      // 标题颜色固定白色，背景色跟随主题
    } catch (e) {}
  },

  /**
   * applyTheme(page)
   * 页面 onLoad 中调用：初始化 pageClass/themeId，注册主题监听，同步导航栏 & 背景色
   * 
   * 用法：
   *   onLoad() {
   *     theme.applyTheme(this);
   *   }
   */
  applyTheme(page) {
    if (!page || typeof page.setData !== 'function') return;

    const id = currentThemeId;
    const t = THEMES[id] || THEMES.orange;

    // 1. 初始化页面数据
    page.setData({
      pageClass: 'page theme-' + id,
      themeId: id,
      themeName: t.name,
      themeIcon: t.icon,
    });

    // 2. 注册主题变化监听
    this.onChange((newTheme) => {
      if (page.setData) {
        page.setData({
          pageClass: 'page theme-' + newTheme.id,
          themeId: newTheme.id,
          themeName: newTheme.name,
          themeIcon: newTheme.icon,
        });
      }
    });

    // 3. 立即同步导航栏颜色（覆盖 .json 中的静态值）
    this._updateNavBar(t);

    // 4. 同步页面背景色
    this._updatePageStyle(t);
  },
};

module.exports = ThemeManager;
