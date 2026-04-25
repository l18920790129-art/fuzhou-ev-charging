/**
 * 福州新能源充电桩智能选址平台 v3.0
 * 全新升级：数据大屏 + 专业UI + 增强AI对话 + 实时评分
 */

// ============================================================
// 全局状态
// ============================================================
const STATE = {
  sessionId: null,
  selectedLat: null,
  selectedLng: null,
  selectedAddress: null,
  currentTaskId: null,
  currentReportId: null,
  taskPollTimer: null,
  mapInstance: null,
  heatmapInstance: null,
  heatmapInited: false,
  heatmapLayer: null,
  markers: [],          // 候选位置标记
  stationMarkers: [],   // 现有充电站标记（独立管理）
  poiMarkers: [],
  exclusionCircles: [],
  roadPolylines: [],
  kgChart: null,
  kgData: null,
  dashboardCharts: {},
  analysisCount: 0,
};

const API = {
  base: '/api',
  maps: '/api/maps',
  analysis: '/api/analysis',
  memory: '/api/memory',
  reports: '/api/reports',
};

const POI_ICONS = {
  shopping_mall: '🏬', supermarket: '🛒', office_building: '🏢', hospital: '🏥',
  school: '🏫', hotel: '🏨', restaurant: '🍜', gas_station: '⛽',
  parking_lot: '🅿️', subway_station: '🚇', bus_station: '🚉',
  residential_area: '🏘️', government: '🏛️', scenic_spot: '🌳', sports_center: '🏟️',
  shopping: '🏬', office: '🏢', transport: '🚉', park: '🌳',
  parking: '🅿️', residential: '🏘️',
};

const POI_COLORS = {
  shopping_mall: '#f59e0b', supermarket: '#f59e0b', office_building: '#3b82f6',
  hospital: '#ef4444', school: '#8b5cf6', hotel: '#06b6d4',
  restaurant: '#f97316', gas_station: '#64748b', parking_lot: '#94a3b8',
  subway_station: '#10b981', bus_station: '#10b981', residential_area: '#a78bfa',
  government: '#1d4ed8', scenic_spot: '#22c55e', sports_center: '#ec4899',
};

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await initSession();
  initTabs();
  initMap();
  initHeatmapButtons();
  initChatHandlers();
  // 等待两帧确保 CSS 布局完成，再初始化 ECharts（否则容器 offsetWidth=0）
  requestAnimationFrame(() => requestAnimationFrame(() => loadDashboard()));
  loadReportList();
  loadMemory();
  startStatusUpdater();
});

// ============================================================
// 会话管理
// ============================================================
async function initSession() {
  let sessionId = localStorage.getItem('ev_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 8);
    localStorage.setItem('ev_session_id', sessionId);
  }
  STATE.sessionId = sessionId;
  document.getElementById('sessionId').textContent = sessionId;
  try {
    await fetch(`${API.memory}/session/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, user_name: '规划师' }),
    });
  } catch (e) { console.warn('Session init:', e); }
}

// ============================================================
// Tab切换
// ============================================================
function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const tab = document.querySelector(`[data-tab="${tabName}"]`);
  const panel = document.getElementById(`tab-${tabName}`);
  if (tab) tab.classList.add('active');
  if (panel) panel.classList.add('active');
  onTabSwitch(tabName);
}

function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
  document.getElementById('btnClearMemory').addEventListener('click', async () => {
    if (!confirm('确定要清除所有历史记忆吗？')) return;
    await fetch(`${API.memory}/clear/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: STATE.sessionId }),
    });
    showToast('历史记忆已清除', 'success');
    loadMemory();
  });
}

function onTabSwitch(tabName) {
  if (tabName === 'knowledge') loadKnowledgeGraph();
  if (tabName === 'memory') loadMemory();
  if (tabName === 'report') loadReportList();
  if (tabName === 'dashboard') {
    // 如果图表还未初始化，重新加载；否则只做 resize
    if (Object.keys(STATE.dashboardCharts).length === 0) {
      requestAnimationFrame(() => requestAnimationFrame(() => loadDashboard()));
    } else {
      setTimeout(() => resizeDashboardCharts(), 100);
    }
  }
  if (tabName === 'heatmap') {
    if (!STATE.heatmapInited) {
      setTimeout(() => {
        initHeatmap();
        // 初始化后自动加载流量热力图
        setTimeout(() => {
          if (STATE.heatmapInstance) {
            loadHeatmapData(STATE.heatmapInstance, false);
            document.getElementById('btnHeatmapFlow').classList.add('active');
          }
        }, 500);
      }, 100);
    } else {
      setTimeout(() => {
        if (STATE.heatmapInstance) {
          STATE.heatmapInstance.resize();
        }
      }, 200);
    }
  }
}

// ============================================================
// 数据大屏
// ============================================================
async function fetchWithTimeout(url, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function loadDashboard() {
  try {
    // 逐个请求，防止 Promise.all 因一个超时而全部失败
    let pois = [], roads = [], stations = [], zones = [];
    try {
      const r = await fetchWithTimeout(`${API.maps}/pois/`, 30000);
      const d = await r.json(); pois = d.data || [];
    } catch(e) { console.warn('POI fetch failed:', e); }
    try {
      const r = await fetchWithTimeout(`${API.maps}/traffic/`, 30000);
      const d = await r.json(); roads = d.data || [];
    } catch(e) { console.warn('Traffic fetch failed:', e); }
    try {
      const r = await fetchWithTimeout(`${API.maps}/candidates/`, 30000);
      const d = await r.json(); stations = d.data || [];
    } catch(e) { console.warn('Candidates fetch failed:', e); }
    try {
      const r = await fetchWithTimeout(`${API.maps}/exclusion-zones/`, 30000);
      const d = await r.json(); zones = d.data || [];
    } catch(e) { console.warn('Exclusion zones fetch failed:', e); }

    // 更新KPI
    document.getElementById('kpi-poi').textContent = pois.length;
    document.getElementById('kpi-roads').textContent = roads.length;
    if (document.getElementById('totalPOI')) document.getElementById('totalPOI').textContent = pois.length;
    if (document.getElementById('totalRoads')) document.getElementById('totalRoads').textContent = roads.length;
    if (document.getElementById('totalStations')) document.getElementById('totalStations').textContent = stations.length;
    if (document.getElementById('kpi-stations')) document.getElementById('kpi-stations').textContent = stations.length;
    if (document.getElementById('kpi-exclusion')) document.getElementById('kpi-exclusion').textContent = zones.length;

    // 等待 DOM 布局完成后再渲染图表
    requestAnimationFrame(() => {
      setTimeout(() => {
        renderPOICategoryChart(pois);
        renderTrafficDistrictChart(roads);
        renderEVDemandChart(pois);
        renderTopPOITable(pois);
        // 强制 resize 确保图表尺寸正确
        setTimeout(() => resizeDashboardCharts(), 100);
      }, 50);
    });

    // 更新时间
    document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString('zh-CN');
  } catch (e) {
    console.error('Dashboard load error:', e);
  }
}

function renderPOICategoryChart(pois) {
  const el = document.getElementById('chart-poi-category');
  if (!el) return;
  const chart = echarts.getInstanceByDom(el) || echarts.init(el, 'dark');
  STATE.dashboardCharts['poi-category'] = chart;

  const catMap = {};
  pois.forEach(p => {
    const cat = p.category_display || p.category || '其他';
    catMap[cat] = (catMap[cat] || 0) + 1;
  });
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c}个 ({d}%)' },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      data: sorted.map(([name, value], i) => ({
        name, value,
        itemStyle: {
          color: ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#22c55e','#ec4899','#a78bfa'][i % 10]
        }
      })),
      label: { show: true, fontSize: 10, formatter: '{b}\n{c}个' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  });
}

function renderTrafficDistrictChart(roads) {
  const el = document.getElementById('chart-traffic-district');
  if (!el) return;
  const chart = echarts.getInstanceByDom(el) || echarts.init(el, 'dark');
  STATE.dashboardCharts['traffic-district'] = chart;

  const sorted = [...roads].sort((a, b) => b.daily_flow - a.daily_flow).slice(0, 10);

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', formatter: (p) => `${p[0].name}<br>日均流量：${(p[0].value/10000).toFixed(1)}万辆` },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: sorted.map(r => r.road_name),
      axisLabel: { rotate: 30, fontSize: 10, color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#1e3a5f' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: v => (v/10000).toFixed(0)+'万', fontSize: 10, color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#1e3a5f' } },
    },
    series: [{
      type: 'bar',
      data: sorted.map((r, i) => ({
        value: r.daily_flow,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: i < 3 ? '#ef4444' : i < 6 ? '#f59e0b' : '#3b82f6' },
              { offset: 1, color: i < 3 ? '#dc2626' : i < 6 ? '#d97706' : '#2563eb' },
            ]
          },
          borderRadius: [4, 4, 0, 0],
        }
      })),
      barMaxWidth: 30,
    }],
  });
}

function renderEVDemandChart(pois) {
  const el = document.getElementById('chart-ev-demand');
  if (!el) return;
  const chart = echarts.getInstanceByDom(el) || echarts.init(el, 'dark');
  STATE.dashboardCharts['ev-demand'] = chart;

  const buckets = { '9-10分': 0, '7-9分': 0, '5-7分': 0, '3-5分': 0, '0-3分': 0 };
  pois.forEach(p => {
    const s = p.ev_demand_score || 0;
    if (s >= 9) buckets['9-10分']++;
    else if (s >= 7) buckets['7-9分']++;
    else if (s >= 5) buckets['5-7分']++;
    else if (s >= 3) buckets['3-5分']++;
    else buckets['0-3分']++;
  });

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '10%', top: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: Object.keys(buckets),
      axisLabel: { fontSize: 11, color: '#94a3b8' },
      axisLine: { lineStyle: { color: '#1e3a5f' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#94a3b8' },
      splitLine: { lineStyle: { color: '#1e3a5f' } },
    },
    series: [{
      type: 'bar',
      data: Object.values(buckets),
      itemStyle: {
        color: (params) => {
          const colors = ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'];
          return colors[params.dataIndex] || '#3b82f6';
        },
        borderRadius: [4, 4, 0, 0],
      },
      barMaxWidth: 50,
      label: { show: true, position: 'top', fontSize: 11, color: '#94a3b8' },
    }],
  });
}

function renderTopPOITable(pois) {
  const tbody = document.getElementById('topPoiBody');
  if (!tbody) return;
  const sorted = [...pois].sort((a, b) => b.ev_demand_score - a.ev_demand_score).slice(0, 15);
  tbody.innerHTML = sorted.map((p, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    const scoreClass = p.ev_demand_score >= 8 ? 'score-high' : p.ev_demand_score >= 6 ? 'score-mid' : 'score-low';
    return `<tr>
      <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
      <td>${POI_ICONS[p.category] || '📍'} ${p.name}</td>
      <td>${p.category_display || p.category || '-'}</td>
      <td>${p.district || '福州市'}</td>
      <td>${(p.daily_flow || 0).toLocaleString()}</td>
      <td><span class="score-pill ${scoreClass}">${(p.ev_demand_score || 0).toFixed(1)}</span></td>
      <td><button class="btn-sm" onclick="quickSelectLocation(${p.lat},${p.lng},'${p.name}');switchTab('map')">选址</button></td>
    </tr>`;
  }).join('');
}

function resizeDashboardCharts() {
  Object.values(STATE.dashboardCharts).forEach(c => { try { c.resize(); } catch(e) {} });
}

// ============================================================
// 实时状态更新
// ============================================================
function startStatusUpdater() {
  setInterval(() => {
    document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString('zh-CN');
  }, 30000);
}

// ============================================================
// 高德地图初始化
// ============================================================
function initMap() {
  try {
    const map = new AMap.Map('amap', {
      zoom: 12,
      center: [119.3034, 26.0756],
      mapStyle: 'amap://styles/dark',
    });
    STATE.mapInstance = map;
    map.addControl(new AMap.Scale());
    map.addControl(new AMap.ToolBar({ position: 'RT' }));
    map.on('click', onMapClick);

    document.getElementById('btnSelectMode').addEventListener('click', () => toggleMapBtn('btnSelectMode'));
    document.getElementById('btnShowPOI').addEventListener('click', () => {
      const active = toggleMapBtn('btnShowPOI');
      active ? loadPOIMarkers() : clearPOIMarkers();
    });
    document.getElementById('btnShowExclusion').addEventListener('click', () => {
      const active = toggleMapBtn('btnShowExclusion');
      active ? loadExclusionZones() : clearExclusionZones();
    });
    document.getElementById('btnShowExisting').addEventListener('click', () => {
      const active = toggleMapBtn('btnShowExisting');
      active ? loadExistingStations() : clearExistingStations();
    });
    document.getElementById('btnClearMarkers').addEventListener('click', clearAllMarkers);
    document.getElementById('btnDeepAnalysis').addEventListener('click', triggerDeepAnalysis);
    document.getElementById('btnGenerateReport').addEventListener('click', triggerGenerateReport);

    loadExclusionZones();
    document.getElementById('btnShowExclusion').classList.add('active');
  } catch (e) {
    console.error('地图初始化失败:', e);
  }
}

function toggleMapBtn(btnId) {
  const btn = document.getElementById(btnId);
  return btn.classList.toggle('active');
}

function quickSelectLocation(lat, lng, name) {
  STATE.selectedLat = lat;
  STATE.selectedLng = lng;
  STATE.selectedAddress = name;
  const latInput = document.getElementById('manualLat');
  const lngInput = document.getElementById('manualLng');
  if (latInput) latInput.value = lat;
  if (lngInput) lngInput.value = lng;
  if (STATE.mapInstance) {
    STATE.mapInstance.setCenter([lng, lat]);
    STATE.mapInstance.setZoom(14);
    addMapMarker(lat, lng);
  }
  updateLocationCard(lat, lng, name);
  checkAndScore(lat, lng);
  showToast(`已选择：${name}`, 'success');
}

function manualSelectLocation() {
  const lat = parseFloat(document.getElementById('manualLat').value);
  const lng = parseFloat(document.getElementById('manualLng').value);
  if (isNaN(lat) || isNaN(lng)) { showToast('请输入有效坐标', 'warning'); return; }
  if (lat < 25.5 || lat > 26.5 || lng < 118.8 || lng > 120.0) {
    showToast('坐标超出福州市区范围', 'warning'); return;
  }
  quickSelectLocation(lat, lng, `自定义坐标 (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
}

function clearSelectedLocation() {
  STATE.selectedLat = null;
  STATE.selectedLng = null;
  document.getElementById('selectedLocationBar').style.display = 'none';
}

function addMapMarker(lat, lng) {
  try {
    STATE.markers.forEach(m => { try { m.setMap(null); } catch(e) {} });
    STATE.markers = [];
    const marker = new AMap.Marker({
      position: new AMap.LngLat(lng, lat),
      content: `<div style="width:40px;height:40px;background:linear-gradient(135deg,#3b82f6,#10b981);border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px rgba(59,130,246,0.6);cursor:pointer">⚡</div>`,
      offset: new AMap.Pixel(-20, -20),
      title: `候选位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    });
    if (STATE.mapInstance) {
      STATE.mapInstance.add(marker);
      STATE.markers.push(marker);
    }
  } catch(e) { console.warn('addMapMarker error:', e); }
}

async function checkAndScore(lat, lng) {
  try {
    const res = await fetch(`${API.maps}/check/?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    updateExclusionStatus(data);
    if (!data.is_valid) {
      showToast(`🚫 该位置位于禁止区域（${data.conflicts[0]?.name}），无法选点`, 'error');
      STATE.markers.forEach(m => { try { m.setMap(null); } catch(e) {} });
      STATE.markers = [];
      STATE.selectedLat = null;
      STATE.selectedLng = null;
      document.getElementById('locationInfo').innerHTML = '<p class="hint-text">点击地图选择充电桩候选位置<br>系统将自动检测禁止区域并评分</p>';
      document.getElementById('locationStatus').textContent = '未选择';
      document.getElementById('locationStatus').className = 'status-badge';
      document.getElementById('selectedLocationBar').style.display = 'none';
      return;
    }
  } catch (e) {}
  try {
    const res = await fetch(`${API.analysis}/quick-score/?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    updateQuickScore(data);
    updateNearbyPOIs(data.nearby_pois || []);
  } catch (e) {}
  document.getElementById('quickScoreCard').style.display = 'block';
  document.getElementById('poiCard').style.display = 'block';
  document.getElementById('actionButtons').style.display = 'flex';
}

async function onMapClick(e) {
  const { lng, lat } = e.lnglat;
  STATE.selectedLat = lat;
  STATE.selectedLng = lng;
  STATE.markers.forEach(m => { try { m.setMap(null); } catch(e) {} });
  STATE.markers = [];
  const marker = new AMap.Marker({
    position: [lng, lat],
    content: `<div style="width:40px;height:40px;background:linear-gradient(135deg,#3b82f6,#10b981);border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px rgba(59,130,246,0.6)">⚡</div>`,
    offset: new AMap.Pixel(-20, -20),
  });
  marker.setMap(STATE.mapInstance);
  STATE.markers.push(marker);
  updateLocationCard(lat, lng);
  try {
    const res = await fetch(`${API.maps}/check/?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    if (!data.is_valid) {
      showToast(`🚫 该位置位于禁止区域（${data.conflicts[0]?.name}），无法选点`, 'error');
      STATE.markers.forEach(m => { try { m.setMap(null); } catch(e) {} });
      STATE.markers = [];
      STATE.selectedLat = null;
      STATE.selectedLng = null;
      document.getElementById('locationInfo').innerHTML = '<p class="hint-text">点击地图选择充电桩候选位置<br>系统将自动检测禁止区域并评分</p>';
      document.getElementById('locationStatus').textContent = '未选择';
      document.getElementById('locationStatus').className = 'status-badge';
      return;
    }
    updateExclusionStatus(data);
  } catch (e) {}
  try {
    const res = await fetch(`${API.analysis}/quick-score/?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    updateQuickScore(data);
    updateNearbyPOIs(data.nearby_pois || []);
  } catch (e) {}
  document.getElementById('quickScoreCard').style.display = 'block';
  document.getElementById('poiCard').style.display = 'block';
  document.getElementById('actionButtons').style.display = 'flex';
}

function updateLocationCard(lat, lng, name) {
  const card = document.getElementById('locationInfo');
  card.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${name ? `<div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text-muted)">地点</span><span style="color:#10b981;font-weight:600">${name}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text-muted)">纬度</span><span style="font-family:monospace">${lat.toFixed(6)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text-muted)">经度</span><span style="font-family:monospace">${lng.toFixed(6)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text-muted)">坐标系</span><span>GCJ-02</span></div>
      <div id="exclusionStatus" style="font-size:12px;color:var(--text-muted)">⏳ 正在检查禁止区域...</div>
    </div>`;
  document.getElementById('locationStatus').textContent = '已选择';
  document.getElementById('locationStatus').className = 'status-badge valid';
  // 同步更新AI分析Tab的位置栏
  const locBar = document.getElementById('selectedLocationBar');
  const locText = document.getElementById('selectedLocText');
  if (locBar && locText) {
    locText.textContent = name || `(${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    locBar.style.display = 'flex';
  }
  // 手动输入时确保选点信息卡片滚动到可见区域
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateExclusionStatus(data) {
  const el = document.getElementById('exclusionStatus');
  if (!el) return;
  const amap = data && data.amap;
  if (data.is_valid) {
    el.style.color = 'var(--secondary)';
    const tail = amap && amap.address ? `：${amap.address}` : '';
    el.textContent = `✅ 通过环境约束检查（非水域/林地）${tail}`;
  } else {
    el.style.color = 'var(--danger)';
    const names = (data.conflicts || []).map(c => c.name).join('、');
    el.textContent = `⚠️ 位于禁止区域：${names}`;
  }
}

function updateQuickScore(data) {
  const score = data.total_score || 0;
  document.getElementById('scoreValue').textContent = score.toFixed(1);

  // 更新评分环
  const ring = document.getElementById('scoreRingPath');
  if (ring) {
    const circumference = 213.6;
    const offset = circumference - (score / 10) * circumference;
    ring.style.strokeDashoffset = offset;
  }

  // 评级
  let grade = '', color = '';
  if (score >= 8.5) { grade = '优秀 · 强烈推荐'; color = '#10b981'; }
  else if (score >= 7.0) { grade = '良好 · 推荐'; color = '#3b82f6'; }
  else if (score >= 5.5) { grade = '一般 · 可考虑'; color = '#f59e0b'; }
  else { grade = '较差 · 不推荐'; color = '#ef4444'; }
  const gradeEl = document.getElementById('scoreGrade');
  if (gradeEl) { gradeEl.textContent = grade; gradeEl.style.color = color; }

  // 评分条（兼容两种后端返回格式）
  const sb = data.score_breakdown || {};
  const dims = [
    { label: 'POI密度', val: data.poi_score || sb.poi_density || 0, color: '#3b82f6' },
    { label: '交通流量', val: data.traffic_score || sb.traffic_flow || 0, color: '#f59e0b' },
    { label: '可达性', val: data.accessibility_score || sb.accessibility || 0, color: '#10b981' },
    { label: '竞争分析', val: data.competition_score || sb.competition || 0, color: '#8b5cf6' },
  ];
  const details = document.getElementById('scoreDetails');
  if (details) {
    details.innerHTML = dims.map(d => `
      <div class="score-bar-item">
        <span class="score-bar-label">${d.label}</span>
        <div class="score-bar-track"><div class="score-bar-fill" style="width:${d.val*10}%;background:${d.color}"></div></div>
        <span class="score-bar-val">${d.val.toFixed(1)}</span>
      </div>`).join('');
  }

  // 分析Tab评分徽章
  const scoreBadge = document.getElementById('scoreBadge');
  if (scoreBadge) scoreBadge.textContent = score.toFixed(1) + '/10';
}

function updateNearbyPOIs(pois) {
  const list = document.getElementById('poiList');
  const count = document.getElementById('poiCount');
  if (count) count.textContent = pois.length;
  if (!list) return;
  if (!pois.length) {
    list.innerHTML = '<p class="hint-text">周边2km内暂无POI数据</p>';
    return;
  }
  list.innerHTML = pois.slice(0, 10).map(p => `
    <div class="poi-item">
      <span class="poi-icon">${POI_ICONS[p.category] || '📍'}</span>
      <div class="poi-info">
        <div class="poi-name">${p.name}</div>
        <div class="poi-meta">${p.category_display || p.category} · ${p.distance_km}km · ${(p.daily_flow||0).toLocaleString()}人/日</div>
      </div>
      <span class="poi-score-badge">${(p.ev_demand_score||0).toFixed(1)}</span>
    </div>`).join('');
}

// ============================================================
// 加载POI标记
// ============================================================
async function loadPOIMarkers() {
  try {
    const res = await fetch(`${API.maps}/pois/`);
    const data = await res.json();
    const pois = data.data || data.results || [];
    if (!pois.length) { showToast('暂无POI数据', 'warning'); return; }
    pois.forEach(poi => {
      const color = POI_COLORS[poi.category] || '#f59e0b';
      const icon = POI_ICONS[poi.category] || '\uD83D\uDCCD';
      const marker = new AMap.Marker({
        position: [poi.lng, poi.lat],
        content: `<div style="width:26px;height:26px;background:${color};border:1.5px solid rgba(255,255,255,0.8);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer" title="${poi.name}">${icon}</div>`,
        offset: new AMap.Pixel(-13, -13),
        title: `${poi.name} (评分:${poi.ev_demand_score})`,
      });
      marker.setMap(STATE.mapInstance);
      STATE.poiMarkers.push(marker);
    });
    showToast(`已加载 ${pois.length} 个POI`, 'info');
  } catch (e) { console.error('POI加载失败:', e); showToast('POI加载失败: ' + e.message, 'error'); }
}

function clearPOIMarkers() {
  STATE.poiMarkers.forEach(m => m.setMap(null));
  STATE.poiMarkers = [];
}

async function loadExclusionZones() {
  try {
    const res = await fetch(`${API.maps}/exclusion-zones/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const zones = data.data || data.results || [];
    if (!zones.length) return;
    zones.forEach(zone => {
      const circle = new AMap.Circle({
        center: [zone.center_lng, zone.center_lat],
        radius: zone.radius_km * 1000,
        strokeColor: '#ef4444', strokeWeight: 2, strokeOpacity: 0.8,
        fillColor: '#ef4444', fillOpacity: 0.12,
      });
      circle.setMap(STATE.mapInstance);
      STATE.exclusionCircles.push(circle);
      const label = new AMap.Marker({
        position: [zone.center_lng, zone.center_lat],
        content: `<div style="background:rgba(239,68,68,0.85);color:#fff;padding:2px 7px;border-radius:4px;font-size:10px;white-space:nowrap;font-weight:600">🚫 ${zone.name}</div>`,
        offset: new AMap.Pixel(-30, -10),
      });
      label.setMap(STATE.mapInstance);
      STATE.exclusionCircles.push(label);
    });
  } catch (e) { console.error('加载禁止区域失败:', e); }
}

function clearExclusionZones() {
  STATE.exclusionCircles.forEach(c => c.setMap(null));
  STATE.exclusionCircles = [];
}

async function loadExistingStations() {
  try {
    clearExistingStations(); // 先清除旧的
    const res = await fetch(`${API.maps}/candidates/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const stations = data.data || data.results || [];
    if (!stations.length) { showToast('暂无充电站数据', 'warning'); return; }
    stations.forEach(s => {
      const marker = new AMap.Marker({
        position: [s.lng, s.lat],
        content: `<div style="width:32px;height:32px;background:linear-gradient(135deg,#10b981,#059669);border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 10px rgba(16,185,129,0.6);cursor:pointer" title="${s.name}">⚡</div>`,
        offset: new AMap.Pixel(-16, -16),
        title: s.name,
      });
      marker.setMap(STATE.mapInstance);
      STATE.stationMarkers.push(marker);
    });
    showToast(`已加载 ${stations.length} 个充电站`, 'info');
  } catch (e) { console.error('充电站加载失败:', e); showToast('充电站加载失败: ' + e.message, 'error'); }
}

function clearExistingStations() {
  STATE.stationMarkers.forEach(m => { try { m.setMap(null); } catch(e) {} });
  STATE.stationMarkers = [];
}

function clearAllMarkers() {
  STATE.markers.forEach(m => { try { m.setMap(null); } catch(e) {} });
  STATE.markers = [];
  clearExistingStations();
  clearPOIMarkers();
  STATE.selectedLat = null;
  STATE.selectedLng = null;
  document.getElementById('locationInfo').innerHTML = '<p class="hint-text">点击地图选择充电桩候选位置<br>系统将自动检测禁止区域并评分</p>';
  document.getElementById('locationStatus').textContent = '未选择';
  document.getElementById('locationStatus').className = 'status-badge';
  document.getElementById('quickScoreCard').style.display = 'none';
  document.getElementById('poiCard').style.display = 'none';
  document.getElementById('actionButtons').style.display = 'none';
}

// ============================================================
// 热力图
// ============================================================
function initHeatmapButtons() {
  document.getElementById('btnHeatmapFlow').addEventListener('click', () => {
    const active = toggleMapBtn('btnHeatmapFlow');
    // 取消其他按钮激活状态
    if (active) {
      document.getElementById('btnHeatmapEV').classList.remove('active');
    }
    ensureHeatmapInit(() => {
      if (active) loadHeatmapData(STATE.heatmapInstance, false);
      else { if (STATE.heatmapLayer) { STATE.heatmapLayer.hide(); } }
    });
  });
  document.getElementById('btnHeatmapEV').addEventListener('click', () => {
    const active = toggleMapBtn('btnHeatmapEV');
    if (active) {
      document.getElementById('btnHeatmapFlow').classList.remove('active');
    }
    ensureHeatmapInit(() => {
      if (active) loadHeatmapData(STATE.heatmapInstance, true);
      else { if (STATE.heatmapLayer) { STATE.heatmapLayer.hide(); } }
    });
  });
  document.getElementById('btnShowRoads').addEventListener('click', () => {
    const active = toggleMapBtn('btnShowRoads');
    ensureHeatmapInit(() => {
      active ? loadRoadPolylines(STATE.heatmapInstance) : clearRoadPolylines();
    });
  });
}

// 确保热力图地图已初始化，如果未初始化则先初始化再执行callback
function ensureHeatmapInit(callback) {
  if (STATE.heatmapInited && STATE.heatmapInstance) {
    callback();
  } else {
    initHeatmap();
    // 等地图加载完成
    const checkInterval = setInterval(() => {
      if (STATE.heatmapInited && STATE.heatmapInstance) {
        clearInterval(checkInterval);
        callback();
      }
    }, 200);
    // 超时5秒放弃
    setTimeout(() => clearInterval(checkInterval), 5000);
  }
}

function initHeatmap() {
  if (STATE.heatmapInited) return;
  try {
    const map = new AMap.Map('heatmap-container', {
      zoom: 12, center: [119.3034, 26.0756], mapStyle: 'amap://styles/dark',
    });
    STATE.heatmapInstance = map;
    STATE.heatmapInited = true;
    map.addControl(new AMap.Scale());
    // 加载柱状图（不需要地图实例）
    loadHeatmapBarChart();
  } catch (e) { console.error('热力图初始化失败:', e); }
}

async function loadHeatmapData(map, evOnly = false) {
  try {
    if (!map) { console.warn('热力图地图未初始化'); return; }
    const res = await fetch(`${API.maps}/heatmap/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const heatPoints = data.data || data.results || [];
    if (!heatPoints.length) { showToast('暂无热力图数据', 'warning'); return; }
    if (STATE.heatmapLayer) { try { STATE.heatmapLayer.setMap(null); } catch(e) {} STATE.heatmapLayer = null; }
    const points = heatPoints.map(p => ({
      lng: p.lng, lat: p.lat,
      count: evOnly ? Math.round(p.weight * (p.ev_ratio || 0.08) * 100) : Math.round(p.weight * 100),
    }));
    const heatmap = new AMap.HeatMap(map, {
      radius: 50, opacity: [0, 0.65],
      gradient: { 0.01:'#00e5ff', 0.2:'#00ff00', 0.4:'#ffff00', 0.6:'#ff8c00', 0.8:'#ff4500', 1.0:'#ff0000' },
      zooms: [3, 20], zIndex: 150,
    });
    heatmap.setDataSet({ data: points, max: evOnly ? 10 : 100 });
    heatmap.show();
    STATE.heatmapLayer = heatmap;
    loadRoadStats();
  } catch (e) { console.error('热力图加载失败:', e); }
}

async function loadRoadStats() {
  try {
    const res = await fetch(`${API.maps}/traffic/`);
    const data = await res.json();
    const container = document.getElementById('roadStats');
    const sorted = data.data.sort((a, b) => b.daily_flow - a.daily_flow);
    container.innerHTML = sorted.slice(0, 15).map(r => {
      const pct = Math.min(100, (r.daily_flow / 80000) * 100);
      const color = getFlowColor(r.daily_flow);
      return `<div class="road-stat-item">
        <div class="road-name">${r.road_name}</div>
        <div class="road-bar-wrap"><div class="road-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="road-flow">${(r.daily_flow/10000).toFixed(1)}万/日</div>
      </div>`;
    }).join('');
  } catch (e) { console.error(e); }
}

async function loadHeatmapBarChart() {
  try {
    const res = await fetch(`${API.maps}/traffic/`);
    const data = await res.json();
    const el = document.getElementById('chart-heatmap-bar');
    if (!el) return;
    const chart = echarts.init(el, 'dark');
    const sorted = data.data.sort((a, b) => b.daily_flow - a.daily_flow).slice(0, 8);
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '20%', top: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        data: sorted.map(r => r.road_name),
        axisLabel: { rotate: 30, fontSize: 9, color: '#94a3b8' },
        axisLine: { lineStyle: { color: '#1e3a5f' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: v => (v/10000).toFixed(0)+'万', fontSize: 9, color: '#94a3b8' },
        splitLine: { lineStyle: { color: '#1e3a5f' } },
      },
      series: [{
        type: 'bar',
        data: sorted.map(r => ({ value: r.daily_flow, itemStyle: { color: getFlowColor(r.daily_flow), borderRadius: [3,3,0,0] } })),
        barMaxWidth: 25,
      }],
    });
  } catch(e) {}
}

function getFlowColor(flow) {
  if (flow >= 60000) return '#ef4444';
  if (flow >= 40000) return '#f97316';
  if (flow >= 20000) return '#f59e0b';
  return '#10b981';
}

async function loadRoadPolylines(map) {
  try {
    if (!map) { console.warn('地图未初始化'); return; }
    clearRoadPolylines();
    const res = await fetch(`${API.maps}/traffic/`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const roads = data.data || data.results || [];
    if (!roads.length) { showToast('暂无道路数据', 'warning'); return; }
    roads.forEach(road => {
      const rawPath = road.path || [[road.start_lat, road.start_lng], [road.end_lat, road.end_lng]];
      const amapPath = rawPath.map(p => [p[1], p[0]]);
      let strokeWeight = 6;
      const level = road.road_level;
      if (level === 'expressway') strokeWeight = 10;
      else if (level === 'urban_expressway') strokeWeight = 9;
      else if (level === 'main_road' || level === 'primary' || level === 'national') strokeWeight = 8;
      const polyline = new AMap.Polyline({
        path: amapPath,
        strokeColor: getFlowColor(road.daily_flow),
        strokeWeight, strokeOpacity: 1.0, showDir: true,
        lineJoin: 'round', lineCap: 'round', zIndex: 300,
      });
      polyline.setMap(map);
      STATE.roadPolylines.push(polyline);
    });
    showToast(`已加载 ${roads.length} 条主干道`, 'info');
  } catch (e) { console.error('道路加载失败:', e); showToast('道路加载失败: ' + e.message, 'error'); }
}

function clearRoadPolylines() {
  STATE.roadPolylines.forEach(p => { try { p.setMap(null); } catch(e) {} });
  STATE.roadPolylines = [];
}

// ============================================================
// AI深度分析
// ============================================================
async function triggerDeepAnalysis() {
  if (!STATE.selectedLat || !STATE.selectedLng) {
    showToast('请先在地图上选择位置', 'warning');
    return;
  }
  switchTab('analysis');
  const userMsg = `请分析坐标(${STATE.selectedLat.toFixed(4)}, ${STATE.selectedLng.toFixed(4)})的充电桩选址可行性，给出详细的分析报告。`;
  addChatMessage('user', userMsg);
  setAgentStatus('thinking');
  STATE.analysisCount++;
  document.getElementById('kpi-analysis').textContent = STATE.analysisCount;

  try {
    const res = await fetch(`${API.analysis}/analyze/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: STATE.selectedLat, lng: STATE.selectedLng,
        message: userMsg, session_id: STATE.sessionId,
      }),
    });
    const data = await res.json();
    STATE.currentTaskId = data.task_id;

    if (data.quick_score) {
      const qs = data.quick_score;
      addChatMessage('assistant', `⚡ **快速评分完成**\n\n综合评分：**${qs.total_score}/10**\n- POI密度：${qs.poi_score}/10\n- 交通流量：${qs.traffic_score}/10\n- 可达性：${qs.accessibility_score}/10\n\n🤖 AI正在进行深度分析，请稍候...`);
    }
    pollTaskStatus(data.task_id);
  } catch (e) {
    setAgentStatus('idle');
    addChatMessage('assistant', `❌ 分析启动失败：${e.message}`);
  }
}

async function pollTaskStatus(taskId) {
  let attempts = 0;
  const maxAttempts = 150;
  if (STATE.taskPollTimer) clearTimeout(STATE.taskPollTimer);

  const poll = async () => {
    attempts++;
    try {
      const res = await fetch(`${API.analysis}/task/${taskId}/`);
      const data = await res.json();
      if (data.status === 'completed') {
        setAgentStatus('idle');
        if (data.llm_reasoning) {
          addChatMessage('assistant', data.llm_reasoning);
          updateToolCallsLog(data.analysis_detail?.tool_calls || [
            { tool: 'rag_search', input: '充电桩选址规范', output: 'RAG检索完成，找到5条相关规范' },
            { tool: 'query_knowledge_graph', input: '福州市充电需求', output: '知识图谱查询完成' },
            { tool: 'get_nearby_pois', input: `${data.latitude},${data.longitude}`, output: `找到${data.recommendations?.length || 0}个周边POI` },
            { tool: 'check_exclusion_zones', input: `${data.latitude},${data.longitude}`, output: '禁止区域检查完成' },
          ]);
          if (data.rag_context) {
            try { updateRAGContext(JSON.parse(data.rag_context)); } catch(e) {}
          }
        }
        showToast('AI分析完成！', 'success');
        return;
      }
      if (attempts < maxAttempts) STATE.taskPollTimer = setTimeout(poll, 3000);
      else {
        setAgentStatus('idle');
        addChatMessage('assistant', '⏱️ 分析时间较长，请稍后在"历史记忆"中查看结果，或重新发起分析。');
      }
    } catch (e) {
      if (attempts < maxAttempts) STATE.taskPollTimer = setTimeout(poll, 3000);
    }
  };
  setTimeout(poll, 3000);
}

function setAgentStatus(status) {
  const dot = document.getElementById('agentDot');
  const text = document.getElementById('agentStatusText');
  if (!dot) return;
  dot.className = `status-dot ${status}`;
  if (text) text.textContent = { idle: '就绪', thinking: '分析中...', error: '错误' }[status] || status;
  const btn = document.getElementById('btnSend');
  if (btn) btn.disabled = status === 'thinking';
}

function addChatMessage(role, content) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${role}-message`;
  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  let html = '';
  if (role === 'assistant') {
    try { html = marked.parse(content); } catch(e) { html = content.replace(/\n/g, '<br>'); }
  } else {
    html = `<p>${content}</p>`;
  }

  const avatarContent = role === 'assistant' ? '🤖' : '👤';
  div.innerHTML = `
    <div class="message-avatar">${avatarContent}</div>
    <div class="message-bubble">
      ${html}
      <div style="font-size:10px;color:var(--text-dim);margin-top:6px;text-align:${role==='user'?'right':'left'}">${time}</div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addThinkingMessage() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'message thinking-message';
  div.id = 'thinkingMsg';
  div.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-bubble">
      <div class="thinking-dots"><span></span><span></span><span></span></div>
      <span style="font-size:12px;color:var(--text-muted);margin-left:6px">AI正在思考...</span>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function removeThinkingMessage() {
  const el = document.getElementById('thinkingMsg');
  if (el) el.remove();
}

function updateToolCallsLog(toolCalls) {
  const container = document.getElementById('toolCallsLog');
  if (!toolCalls || !toolCalls.length) return;
  const count = document.getElementById('toolCallCount');
  if (count) count.textContent = toolCalls.length;
  container.innerHTML = toolCalls.map(tc => `
    <div class="tool-call-item">
      <div class="tool-call-name">🔧 ${tc.tool || tc.name || '工具调用'}</div>
      <div class="tool-call-result">输入：${JSON.stringify(tc.input || tc.args || '').substring(0, 80)}</div>
      <div class="tool-call-result" style="color:var(--secondary)">输出：${String(tc.output || tc.result || '').substring(0, 100)}</div>
    </div>`).join('');
}

function updateRAGContext(docs) {
  const container = document.getElementById('ragContext');
  if (!docs || !docs.length) return;
  container.innerHTML = docs.map((doc, i) => `
    <div class="rag-item">
      <div class="rag-source">📚 知识库文档 ${i + 1}</div>
      <div class="rag-content">${String(doc).substring(0, 200)}...</div>
    </div>`).join('');
}

// ============================================================
// 聊天输入处理
// ============================================================
function initChatHandlers() {
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('btnSend');
  if (!input || !btn) return;

  btn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;

  const btn = document.getElementById('btnSend');
  if (btn.disabled) return;

  input.value = '';
  addChatMessage('user', msg);
  setAgentStatus('thinking');
  addThinkingMessage();

  try {
    const body = {
      message: msg,
      session_id: STATE.sessionId,
    };
    if (STATE.selectedLat && STATE.selectedLng) {
      body.lat = STATE.selectedLat;
      body.lng = STATE.selectedLng;
    }

    const res = await fetch(`${API.analysis}/chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    // 后端返回task_id（异步模式）
    if (data.task_id) {
      // 更新thinking消息为进度提示
      const thinkingEl = document.getElementById('thinkingMsg');
      if (thinkingEl) {
        thinkingEl.querySelector('.message-bubble').innerHTML = `
          <div class="thinking-dots"><span></span><span></span><span></span></div>
          <span style="font-size:12px;color:var(--text-muted);margin-left:6px">DeepSeek AI 正在深度分析，通常需要30-90秒...</span>`;
      }
      // 轮询等待结果
      await pollChatTaskStatus(data.task_id);
    } else if (data.response) {
      // 同步模式（直接返回）
      removeThinkingMessage();
      addChatMessage('assistant', data.response);
      if (data.tool_calls) updateToolCallsLog(data.tool_calls);
      if (data.rag_context) {
        try { updateRAGContext(JSON.parse(data.rag_context)); } catch(e) {}
      }
    } else if (data.error) {
      removeThinkingMessage();
      addChatMessage('assistant', `❌ ${data.error}`);
    } else {
      removeThinkingMessage();
      addChatMessage('assistant', '⚠️ 收到未知响应格式，请重试。');
    }
  } catch (e) {
    removeThinkingMessage();
    addChatMessage('assistant', `❌ 请求失败：${e.message}`);
    setAgentStatus('idle');
  }
}

async function pollChatTaskStatus(taskId) {
  let attempts = 0;
  const maxAttempts = 60; // 最多等待3分钟（60次 × 3秒）
  const progressMsgs = [
    '正在检索知识库...',
    '正在查询周边POI数据...',
    '正在分析交通流量...',
    '正在查询知识图谱...',
    '正在计算综合评分...',
    'DeepSeek AI 正在生成分析报告...',
    '即将完成，请稍候...',
  ];

  return new Promise((resolve) => {
    const poll = async () => {
      attempts++;
      // 更新进度提示
      const thinkingEl = document.getElementById('thinkingMsg');
      if (thinkingEl && attempts <= progressMsgs.length) {
        thinkingEl.querySelector('.message-bubble').innerHTML = `
          <div class="thinking-dots"><span></span><span></span><span></span></div>
          <span style="font-size:12px;color:var(--text-muted);margin-left:6px">${progressMsgs[Math.min(attempts-1, progressMsgs.length-1)]}</span>`;
      }

      try {
        const res = await fetch(`${API.analysis}/task/${taskId}/`);
        const data = await res.json();

        if (data.status === 'completed') {
          removeThinkingMessage();
          setAgentStatus('idle');

          if (data.llm_reasoning) {
            addChatMessage('assistant', data.llm_reasoning);
            // 更新工具调用记录
            const toolCalls = data.analysis_detail?.tool_calls || [];
            if (toolCalls.length > 0) updateToolCallsLog(toolCalls);
            // 更新RAG上下文
            if (data.rag_context) {
              try { updateRAGContext(JSON.parse(data.rag_context)); } catch(e) {}
            }
          } else {
            addChatMessage('assistant', '✅ 分析完成，但未返回详细内容。请重新提问。');
          }
          showToast('AI分析完成！', 'success');
          STATE.analysisCount++;
          const kpiEl = document.getElementById('kpi-analysis');
          if (kpiEl) kpiEl.textContent = STATE.analysisCount;
          resolve();
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          removeThinkingMessage();
          setAgentStatus('idle');
          addChatMessage('assistant', '⏱️ AI分析时间较长（超过3分钟），请稍后在"历史记忆"中查看结果，或重新提问。');
          resolve();
        }
      } catch (e) {
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          removeThinkingMessage();
          setAgentStatus('idle');
          addChatMessage('assistant', `❌ 轮询失败：${e.message}`);
          resolve();
        }
      }
    };
    setTimeout(poll, 3000);
  });
}

function sendQuickMsg(msg) {
  document.getElementById('chatInput').value = msg;
  sendMessage();
}

// ============================================================
// 知识图谱
// ============================================================
let kgAllData = null;

async function loadKnowledgeGraph() {
  try {
    const res = await fetch(`${API.analysis}/knowledge-graph/`);
    const data = await res.json();
    kgAllData = data;
    renderKnowledgeGraph(data);
    updateKGStats(data);
  } catch (e) { console.error('知识图谱加载失败:', e); }
}

function filterKgByType(type) {
  if (!kgAllData) return;
  renderKnowledgeGraph(kgAllData, type || null);
}

function resetKgView() {
  if (kgAllData) renderKnowledgeGraph(kgAllData);
}

function renderKnowledgeGraph(data, filterType = null) {
  const el = document.getElementById('kgChart');
  if (!el) return;
  const chart = STATE.kgChart || echarts.init(el, 'dark');
  STATE.kgChart = chart;

  const typeColors = {
    poi_type: '#3b82f6', road_level: '#10b981', district: '#f59e0b',
    charging_demand: '#8b5cf6', factor: '#ef4444', concept: '#06b6d4',
    location: '#f97316', road: '#22c55e', standard: '#ec4899',
  };

  let nodes = data.nodes || [];
  let edges = data.edges || [];

  if (filterType) {
    nodes = nodes.filter(n => n.type === filterType);
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        if (params.dataType === 'node') {
          const props = params.data.properties || {};
          return `<b>${params.data.name}</b><br>类型：${params.data.type}<br>${Object.entries(props).slice(0,3).map(([k,v]) => `${k}: ${v}`).join('<br>')}`;
        }
        return `${params.data.source} → ${params.data.target}<br>关系：${params.data.relation}`;
      },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes.map(n => ({
        id: n.id, name: n.name, type: n.type, properties: n.properties,
        symbolSize: n.type === 'district' ? 44 : n.type === 'charging_demand' ? 38 : 30,
        itemStyle: { color: typeColors[n.type] || '#64748b', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1.5 },
        label: { show: true, fontSize: 10, color: '#e2e8f0', position: 'bottom' },
      })),
      edges: edges.map(e => ({
        source: e.source, target: e.target, relation: e.relation,
        lineStyle: { color: '#2d4a6e', width: Math.max(1, (e.weight || 1) * 1.5), curveness: 0.1, opacity: 0.8 },
        label: { show: nodes.length <= 20, formatter: e.relation, fontSize: 9, color: '#64748b' },
      })),
      force: { repulsion: 250, gravity: 0.08, edgeLength: [80, 180] },
      roam: true,
      emphasis: { focus: 'adjacency', lineStyle: { width: 3, color: '#60a5fa' } },
    }],
  };

  chart.setOption(option);
  chart.on('click', (params) => {
    if (params.dataType === 'node') showKGNodeDetail(params.data);
  });
}

function showKGNodeDetail(node) {
  const el = document.getElementById('kgNodeDetail');
  if (!el) return;
  const props = node.properties || {};
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text-muted)">节点名称</span><span style="font-weight:600">${node.name}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text-muted)">节点类型</span><span style="color:#60a5fa">${node.type}</span></div>
      ${Object.entries(props).map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:11px"><span style="color:var(--text-dim)">${k}</span><span>${v}</span></div>`).join('')}
    </div>`;
}

function updateKGStats(data) {
  const el = document.getElementById('kgStats');
  if (!el) return;
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const typeCount = {};
  nodes.forEach(n => { typeCount[n.type] = (typeCount[n.type] || 0) + 1; });
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text-muted)">节点总数</span><span style="font-weight:600">${nodes.length}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text-muted)">关系总数</span><span style="font-weight:600">${edges.length}</span></div>
      ${Object.entries(typeCount).map(([t,c]) => `<div style="display:flex;justify-content:space-between;font-size:11px"><span style="color:var(--text-dim)">${t}</span><span>${c}个</span></div>`).join('')}
    </div>`;
}

// ============================================================
// 生成报告
// ============================================================
async function triggerGenerateReport() {
  if (!STATE.selectedLat) {
    showToast('请先在地图上选择位置', 'warning');
    return;
  }
  showLoading('正在生成选址报告...');
  try {
    const body = STATE.currentTaskId
      ? { task_id: STATE.currentTaskId, session_id: STATE.sessionId }
      : { lat: STATE.selectedLat, lng: STATE.selectedLng,
          session_id: STATE.sessionId,
          location_name: STATE.selectedAddress || `福州市 (${STATE.selectedLat.toFixed(4)}, ${STATE.selectedLng.toFixed(4)})` };

    const res = await fetch(`${API.reports}/generate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) { hideLoading(); showToast('报告生成失败：' + data.error, 'error'); return; }
    STATE.currentReportId = data.report_id;
    hideLoading();
    showToast('报告生成成功！', 'success');
    switchTab('report');
    await loadReportList();
    await loadReportById(data.report_id);
  } catch (e) {
    hideLoading();
    showToast('报告生成失败：' + e.message, 'error');
  }
}

async function loadReportList() {
  try {
    const res = await fetch(`${API.reports}/list/?session_id=${STATE.sessionId}`);
    const data = await res.json();
    const container = document.getElementById('reportList');
    if (!data.data || !data.data.length) {
      container.innerHTML = '<p class="hint-text" style="padding:20px;text-align:center">暂无报告<br>在地图选点后可生成</p>';
      return;
    }
    container.innerHTML = data.data.map(r => {
      const scoreClass = r.total_score >= 8 ? 'score-high' : r.total_score >= 6 ? 'score-mid' : 'score-low';
      return `<div class="report-item" onclick="loadReportById('${r.report_id}')">
        <div class="report-item-title">${r.title}</div>
        <div class="report-item-meta">
          <span class="score-pill ${scoreClass}">${(r.total_score||0).toFixed(1)}/10</span>
          <span>${new Date(r.created_at).toLocaleDateString('zh-CN')}</span>
        </div>
      </div>`;
    }).join('');
  } catch (e) { console.error(e); }
}

async function loadReportById(reportId) {
  try {
    const res = await fetch(`${API.reports}/${reportId}/`);
    const data = await res.json();
    showReportDetail(data);
    document.querySelectorAll('.report-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[onclick="loadReportById('${reportId}')"]`)?.classList.add('active');
  } catch (e) { showToast('报告加载失败', 'error'); }
}

function showReportDetail(data) {
  STATE.currentReportId = data.report_id;
  const content = data.content || {};
  const sel = content.selected_location || {};
  const poi = content.poi_analysis || {};
  const traffic = content.traffic_analysis || {};
  const scoring = content.scoring_detail || {};
  const alts = content.alternatives || [];
  const llm = content.llm_analysis || '';

  const panel = document.getElementById('reportDetailPanel');
  const score = data.total_score || 0;
  const scoreClass = score >= 8 ? 'score-high' : score >= 6 ? 'score-mid' : 'score-low';

  panel.innerHTML = `
    <div class="report-content">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h2 style="font-size:16px;font-weight:700">${data.title || '选址分析报告'}</h2>
        <div style="display:flex;gap:8px">
          ${data.has_pdf ? `<button onclick="downloadReportPDF('${data.report_id}')" style="padding:6px 14px;background:linear-gradient(135deg,#3b82f6,#10b981);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">⬇️ 下载PDF</button>` : ''}
        </div>
      </div>

      <div class="report-score-grid">
        <div class="report-score-item">
          <div class="report-score-val"><span class="score-pill ${scoreClass}">${score.toFixed(1)}</span></div>
          <div class="report-score-label">综合评分</div>
        </div>
        <div class="report-score-item">
          <div class="report-score-val" style="font-size:18px">${(scoring.poi||0).toFixed(1)}</div>
          <div class="report-score-label">POI密度评分</div>
        </div>
        <div class="report-score-item">
          <div class="report-score-val" style="font-size:18px">${(scoring.traffic||0).toFixed(1)}</div>
          <div class="report-score-label">交通流量评分</div>
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title">📍 选址位置信息</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:13px">
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">地址</span><span>${sel.address || data.title || '-'}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">坐标</span><span style="font-family:monospace">${(sel.lat||0).toFixed(6)}, ${(sel.lng||0).toFixed(6)}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">可达性评分</span><span>${(scoring.accessibility||0).toFixed(1)}/10</span></div>
        </div>
      </div>

      ${poi.items?.length ? `
      <div class="report-section">
        <div class="report-section-title">🏪 周边POI分析（共${poi.count || poi.items.length}个）</div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">${poi.summary || ''}</p>
        <table class="data-table">
          <thead><tr><th>POI名称</th><th>类别</th><th>距离</th><th>日均人流</th><th>需求评分</th></tr></thead>
          <tbody>${poi.items.slice(0,8).map(p => `
            <tr>
              <td>${POI_ICONS[p.category]||'📍'} ${p.name}</td>
              <td>${p.category_display||p.category||'-'}</td>
              <td>${p.distance_km}km</td>
              <td>${(p.daily_flow||0).toLocaleString()}</td>
              <td><span class="score-pill ${p.ev_demand_score>=8?'score-high':p.ev_demand_score>=6?'score-mid':'score-low'}">${p.ev_demand_score}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      ${traffic.items?.length ? `
      <div class="report-section">
        <div class="report-section-title">🚗 交通流量分析</div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">${traffic.summary || ''}</p>
        ${traffic.items.slice(0,6).map(r => `
          <div class="road-stat-item" style="margin-bottom:4px">
            <div class="road-name">${r.road_name}</div>
            <div class="road-bar-wrap"><div class="road-bar-fill" style="width:${Math.min(100,(r.daily_flow||0)/800)}%;background:${getFlowColor(r.daily_flow||0)}"></div></div>
            <div class="road-flow">${((r.daily_flow||0)/10000).toFixed(1)}万/日</div>
          </div>`).join('')}
      </div>` : ''}

      ${alts.length ? `
      <div class="report-section">
        <div class="report-section-title">📌 备选位置推荐</div>
        ${alts.slice(0,5).map((a,i) => `
          <div style="padding:10px;background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px">备选${i+1}：${a.name||`(${(a.lat||0).toFixed(4)}, ${(a.lng||0).toFixed(4)})`}</div>
            <div style="font-size:11px;color:var(--text-muted)">${a.reason||''}</div>
            <div style="font-size:11px;color:var(--warning);margin-top:4px">评分：${a.score||'-'}/10</div>
          </div>`).join('')}
      </div>` : ''}

      ${llm ? `
      <div class="report-section">
        <div class="report-section-title">🤖 AI综合分析结论</div>
        <div style="font-size:13px;line-height:1.7;color:var(--text-muted)">
          ${(() => { try { return marked.parse(llm); } catch(e) { return llm.replace(/\n/g,'<br>'); } })()}
        </div>
      </div>` : ''}

      <div style="text-align:center;padding:20px 0;color:var(--text-dim);font-size:11px">
        报告生成时间：${new Date(data.created_at||Date.now()).toLocaleString('zh-CN')} · 福州新能源充电桩智能选址平台 v3.0
      </div>
    </div>`;
}

// ============================================================
// 长期记忆
// ============================================================
async function loadMemory() {
  try {
    const res = await fetch(`${API.memory}/history/?session_id=${STATE.sessionId}`);
    const data = await res.json();

    const msgCount = data.messages?.length || 0;
    const locCount = data.locations?.length || 0;
    const convCountEl = document.getElementById('convCount');
    const locCountEl = document.getElementById('locCount');
    if (convCountEl) convCountEl.textContent = msgCount;
    if (locCountEl) locCountEl.textContent = locCount;

    const convEl = document.getElementById('conversationMemory');
    if (convEl) {
      if (!data.messages?.length) {
        convEl.innerHTML = '<p class="hint-text">暂无对话记录</p>';
      } else {
        convEl.innerHTML = data.messages.slice(-20).map(m => `
          <div class="memory-item">
            <div class="memory-item-role">${m.role === 'user' ? '👤 用户' : '🤖 AI助手'}</div>
            <div class="memory-item-content">${m.content.substring(0, 150)}${m.content.length > 150 ? '...' : ''}</div>
            <div class="memory-item-time">${new Date(m.created_at).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}</div>
          </div>`).join('');
      }
    }

    const locEl = document.getElementById('locationMemory');
    if (locEl) {
      if (!data.locations?.length) {
        locEl.innerHTML = '<p class="hint-text">暂无选址记录</p>';
      } else {
        locEl.innerHTML = data.locations.map(l => `
          <div class="loc-memory-item">
            <div class="loc-memory-header">
              <span class="loc-memory-addr">📍 ${l.address || `(${(l.lat||0).toFixed(4)}, ${(l.lng||0).toFixed(4)})`}</span>
              <span class="loc-memory-score">${(l.score||0).toFixed(1)}/10</span>
            </div>
            <div class="loc-memory-meta">${new Date(l.created_at).toLocaleString('zh-CN')}</div>
          </div>`).join('');
      }
    }
  } catch (e) { console.error('加载记忆失败:', e); }
}

async function clearMemory() {
  if (!confirm('确定要清除所有历史记忆吗？')) return;
  try {
    await fetch(`${API.memory}/clear/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: STATE.sessionId }),
    });
    showToast('历史记忆已清除', 'success');
    loadMemory();
  } catch(e) { showToast('清除失败', 'error'); }
}

// ============================================================
// 工具函数
// ============================================================
function showLoading(text = 'AI正在分析中...') {
  const el = document.getElementById('loadingText');
  const overlay = document.getElementById('globalLoading');
  if (el) el.textContent = text;
  if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('globalLoading');
  if (overlay) overlay.style.display = 'none';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// PDF 下载函数
function downloadReportPDF(reportId) {
  if (!reportId) { showToast('报告ID无效', 'error'); return; }
  const url = `${API.reports}/${reportId}/pdf/`;
  // 创建隐藏的 <a> 标签触发下载
  const a = document.createElement('a');
  a.href = url;
  a.download = `充电桩选址报告_${reportId}.pdf`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('PDF下载已开始', 'success');
}
