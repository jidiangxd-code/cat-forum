// pages/cat-list/cat-list.js - 猫咪档案列表页（含排行榜）
const api = require('../../utils/api.js');

Page({
  // 当前页面或组件依赖的响应式状态统一维护在这里。
  data: {
    tabs: [
      { id: 'list', name: '全部猫咪' },
      { id: 'rank_total', name: '人气榜' },
      { id: 'rank_new', name: '新晋猫' },
      { id: 'unknown_list', name: '未知猫' },
      { id: 'square', name: '猫广场' }
    ],
    currentTab: 'list',
    catList: [],
    squareCats: [],
    squareView: 'location',
    squareFeed: [],
    squareLoading: false,
    selectedSquareCat: null,
    mapLatitude: 37.8706,
    mapLongitude: 112.5489,
    mapMarkers: [],
    mapPolyline: [],
    mapCircles: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    keyword: '',
    searchMode: false,
    // 深色模式
    isDarkMode: wx.getStorageSync('darkMode') || false
  },

  // 初始化当前页面状态并触发首屏数据加载。
  onLoad() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
    this.loadList();
  },

  // 在页面重新显示时同步最新状态或刷新数据。
  onShow() {
    this.setData({ isDarkMode: wx.getStorageSync('darkMode') || false });
    this._consumeInitialTab();
  },

  // 响应下拉刷新并重置列表或详情数据。
  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true, catList: [] });
    this.loadList().then(() => wx.stopPullDownRefresh());
  },

  // 在可继续加载时触发下一页数据请求。
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList();
    }
  },

  // 切换标签模式并按新配置刷新数据。
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab, page: 1, catList: [], hasMore: true, keyword: '', searchMode: false });
    if (tab === 'square') this.loadCatSquare();
    else this.loadList();
  },

  // 按当前标签、分页和模式加载列表数据。
  async loadList() {
    if (this.data.currentTab === 'square') return this.loadCatSquare();
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await api.getCatProfileList({
        mode: this.data.currentTab,
        page: this.data.page,
        pageSize: this.data.pageSize
      });

      const list = (res.data && res.data.list) || [];
      this.setData({
        catList: this.data.page === 1 ? list : [...this.data.catList, ...list],
        hasMore: list.length >= this.data.pageSize,
        page: this.data.page + 1,
        loading: false
      });
    } catch (e) {
      console.error('加载猫咪列表失败', e);
      this.setData({ loading: false, hasMore: false });
    }
  },

  // 消费页面入口传入的初始标签并切换视图。
  _consumeInitialTab() {
    let tab = '';
    try {
      tab = wx.getStorageSync('catListInitialTab');
      if (tab) wx.removeStorageSync('catListInitialTab');
    } catch (e) {}
    if (!tab || tab === this.data.currentTab) return;
    this.setData({ currentTab: tab, page: 1, catList: [], hasMore: true, keyword: '', searchMode: false });
    if (tab === 'square') this.loadCatSquare();
    else this.loadList();
  },

  // 同步搜索关键词输入状态。
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  // 执行当前页面的搜索流程并刷新结果视图。
  async doSearch() {
    const kw = this.data.keyword.trim();
    if (!kw) {
      this.setData({ searchMode: false, page: 1, catList: [], hasMore: true });
      this.loadList();
      return;
    }
    this.setData({ loading: true, searchMode: true, catList: [] });
    try {
      const results = await api.searchCatProfiles(kw);
      this.setData({ catList: results, loading: false, hasMore: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  // 加载猫广场地图聚合或动态流数据。
  async loadCatSquare() {
    if (this.data.squareLoading) return;
    this.setData({ squareLoading: true, loading: true });
    try {
      if (this.data.squareView === 'circle') {
        await this.loadSquareFeed();
        return;
      }
      const res = await api.getCatLocationPosts(100);
      const posts = res.data || [];
      const grouped = {};
      posts.forEach(post => {
        if (!post.catId || !post.latitude || !post.longitude) return;
        if (!grouped[post.catId]) grouped[post.catId] = [];
        grouped[post.catId].push(post);
      });

      const catIds = Object.keys(grouped);
      const catResults = await Promise.allSettled(catIds.map(id => api.getCatProfile(id)));
      const squareCats = catIds.map((id, idx) => {
        const cat = catResults[idx].status === 'fulfilled' ? catResults[idx].value.data : null;
        const points = grouped[id]
          .map(post => ({
            id: post._id,
            latitude: Number(post.latitude),
            longitude: Number(post.longitude),
            location: post.location || 'GPS 定位',
            content: post.content || '',
            timeText: this._formatTime(post.createTime)
          }))
          .filter(p => !isNaN(p.latitude) && !isNaN(p.longitude));
        return {
          catId: id,
          cat,
          name: (cat && (cat.fullName || cat.codeName)) || '未知猫',
          appearance: (cat && cat.appearance) || '外貌未知',
          coverImage: cat && cat.coverImage,
          points,
          prediction: this._buildLocationPrediction(points)
        };
      }).filter(item => item.points.length > 0);

      const selected = squareCats[0] || null;
      this.setData({
        squareCats,
        selectedSquareCat: selected,
        squareLoading: false,
        loading: false,
        hasMore: false
      });
      this._applySquareMap(selected);
    } catch (e) {
      console.error('加载猫广场失败', e);
      this.setData({ squareLoading: false, loading: false, hasMore: false });
    }
  },

  // 切换猫广场的地图视图与动态流视图。
  onSquareViewChange(e) {
    const view = e.currentTarget.dataset.view;
    if (!view || view === this.data.squareView) return;
    this.setData({ squareView: view });
    this.loadCatSquare();
  },

  // 加载猫广场中的动态流视图数据。
  async loadSquareFeed() {
    const res = await api.getPostList({ page: 1, pageSize: 20, sort: 'latest' });
    const squareFeed = (res.data || []).map(post => ({
      ...post,
      timeStr: this._formatTime(post.createTime)
    }));
    this.setData({
      squareFeed,
      squareLoading: false,
      loading: false,
      hasMore: false
    });
  },

  // 从猫广场动态卡片跳转到帖子详情。
  onSquarePostTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 切换猫广场中当前高亮的猫咪。
  onSquareCatTap(e) {
    const catId = e.currentTarget.dataset.catid;
    const selected = this.data.squareCats.find(item => item.catId === catId);
    this.setData({ selectedSquareCat: selected || null });
    this._applySquareMap(selected);
  },

  // 根据选中的猫咪轨迹刷新地图标记、连线和范围圆。
  _applySquareMap(squareCat) {
    if (!squareCat || !squareCat.points || squareCat.points.length === 0) {
      this.setData({ mapMarkers: [], mapPolyline: [], mapCircles: [] });
      return;
    }
    const points = squareCat.points;
    const prediction = squareCat.prediction;
    const markers = points.slice(0, 12).map((point, index) => ({
      id: index + 1,
      latitude: point.latitude,
      longitude: point.longitude,
      width: index === 0 ? 34 : 24,
      height: index === 0 ? 34 : 24,
      callout: {
        content: index === 0 ? `最新：${point.location}` : point.location,
        color: '#333333',
        bgColor: '#ffffff',
        padding: 8,
        borderRadius: 8,
        display: index === 0 ? 'ALWAYS' : 'BYCLICK'
      }
    }));

    this.setData({
      mapLatitude: prediction.latitude,
      mapLongitude: prediction.longitude,
      mapMarkers: markers,
      mapPolyline: [{
        points: points.slice().reverse().map(p => ({ latitude: p.latitude, longitude: p.longitude })),
        color: '#FF7043',
        width: 4,
        dottedLine: false,
        arrowLine: true
      }],
      mapCircles: [{
        latitude: prediction.latitude,
        longitude: prediction.longitude,
        radius: prediction.radius,
        color: '#FF704355',
        fillColor: '#FF704322',
        strokeWidth: 2
      }]
    });
  },

  // 根据定位点估算猫咪活动中心、半径和可信度。
  _buildLocationPrediction(points) {
    if (!points || points.length === 0) {
      return { latitude: this.data.mapLatitude, longitude: this.data.mapLongitude, radius: 80, confidenceText: '暂无数据' };
    }
    const weighted = points.reduce((acc, point, index) => {
      const weight = Math.max(1, points.length - index);
      acc.lat += point.latitude * weight;
      acc.lng += point.longitude * weight;
      acc.total += weight;
      return acc;
    }, { lat: 0, lng: 0, total: 0 });
    const center = {
      latitude: weighted.lat / weighted.total,
      longitude: weighted.lng / weighted.total
    };
    const distances = points.map(p => this._distanceInMeters(center.latitude, center.longitude, p.latitude, p.longitude));
    const maxDistance = Math.max(...distances, 0);
    const radius = Math.min(300, Math.max(40, Math.round(maxDistance + 20)));
    const confidenceText = points.length >= 5 ? '较高' : points.length >= 3 ? '中等' : '偏低';
    return { ...center, radius, confidenceText };
  },

  // 计算两个经纬度坐标之间的球面距离。
  _distanceInMeters(lat1, lon1, lat2, lon2) {
    const toRad = n => n * Math.PI / 180;
    const earthRadius = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
      * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  // 把时间字段格式化为相对时间或日期文案。
  _formatTime(t) {
    if (!t) return '';
    const d = t instanceof Date ? t : new Date(t);
    if (isNaN(d)) return '';
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  // 退出搜索模式并恢复默认列表视图。
  clearSearch() {
    this.setData({ keyword: '', searchMode: false, page: 1, catList: [], hasMore: true });
    this.loadList();
  },

  // 跳转猫咪主页
  onCatTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/cat-home/cat-home?id=${id}` });
  },

  // 去创建正式猫
  goCreateFormal() {
    wx.navigateTo({ url: '/pages/create-cat/create-cat?type=formal' });
  },

  // 深色模式切换
  toggleDarkMode() {
    const newDark = !this.data.isDarkMode;
    this.setData({ isDarkMode: newDark });
    try {
      if (newDark) wx.setStorageSync('darkMode', true);
      else wx.removeStorageSync('darkMode');
    } catch(e) {}
    try {
      const pages = getCurrentPages();
      pages.forEach(p => { try { p.setData({ isDarkMode: newDark }); } catch(e) {} });
    } catch(e) {}
    try { getApp()._applyDarkMode(newDark); } catch(e) {}
  }
});
