/**
 * 福州充电桩智能选址系统 - 主应用逻辑
 * 集成：高德地图 + LangChain Agent + RAG + 知识图谱 + 长期记忆
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
  heatmapInited: false,   // 热力图是否已初始化
  heatmapLayer: null,
  markers: [],
  poiMarkers: [],
  exclusionCircles: [],
  roadPolylines: [],
  kgChart: null,
  kgData: null,
};

const API = {
  base: '/api',
  maps: '/api/maps',
  analysis: '/api/analysis',
  memory: '/api/memory',
  reports: '/api/reports',
};

// POI类别图标映射（与models.py POI_CATEGORIES保持一致）
const POI_ICONS = {
  shopping_mall: '🏬', supermarket: '🛒', office_building: '🏢', hospital: '🏥',
  school: '🏫', hotel: '🏨', restaurant: '🍜', gas_station: '⛽',
  parking_lot: '🅿️', subway_station: '🚇', bus_station: '🚉',
  residential_area: '🏘️', government: '🏛️', scenic_spot: '🌳', sports_center: '🏟️',
  // 旧版兼容
  shopping: '🏬', office: '🏢', transport: '🚉', park: '🌳',
  parking: '🅿️', residential: '🏘️',
};

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await initSession();
  initTabs();
  initMap();
  // 注意：initHeatmap() 改为懒加载，切换到热力图Tab时才初始化
  initHeatmapButtons(); // 只绑定按钮事件，不初始化地图
  initChatHandlers();
  loadReportList();
  loadMemory();
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
  } catch (e) { console.warn('Session init failed:', e); }
}

// ============================================================
// Tab切换
// ============================================================
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tabName}`).classList.add('active');

      // 懒加载
      if (tabName === 'knowledge') loadKnowledgeGraph();
      if (tabName === 'memory') loadMemory();
      if (tabName === 'report') loadReportList();
      if (tabName === 'heatmap') {
        // 热力图懒加载：切换到热力图Tab时才初始化地图
        if (!STATE.heatmapInited) {
          // 等待DOM渲染完成后再初始化
          setTimeout(() => initHeatmap(), 100);
        } else {
          // 已初始化则只刷新尺寸
          setTimeout(() => {
            if (STATE.heatmapInstance) {
              STATE.heatmapInstance.resize();
            }
          }, 200);
        }
      }
    });
  });

  // 清除记忆按钮
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

// ============================================================
// 高德地图初始化（地图选址Tab）
// ============================================================
function initMap() {
  try {
    const map = new AMap.Map('amap', {
      zoom: 12,
      center: [119.3034, 26.0756],  // 福州市中心
      mapStyle: 'amap://styles/dark',  // 使用高德暗色主题，稳定可靠
    });
    STATE.mapInstance = map;

    // 添加比例尺和工具栏
    map.addControl(new AMap.Scale());
    map.addControl(new AMap.ToolBar({ position: 'RT' }));

    // 点击选点
    map.on('click', onMapClick);

    // 工具栏按钮绑定
    document.getElementById('btnSelectMode').addEventListener('click', () => {
      toggleMapBtn('btnSelectMode');
    });
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

    // 深度分析按钮
    document.getElementById('btnDeepAnalysis').addEventListener('click', triggerDeepAnalysis);
    document.getElementById('btnGenerateReport').addEventListener('click', triggerGenerateReport);

    // 默认加载禁止区域
    loadExclusionZones();
    document.getElementById('btnShowExclusion').classList.add('active');

  } catch (e) {
    console.error('地图初始化失败:', e);
  }
}

function toggleMapBtn(btnId) {
  const btn = document.getElementById(btnId);
  const isActive = btn.classList.toggle('active');
  return isActive;
}

// 快捷选点（预设地标）
function quickSelectLocation(lat, lng, name) {
  STATE.selectedLat = lat;
  STATE.selectedLng = lng;
  STATE.selectedAddress = name;
  // 更新坐标输入框
  const latInput = document.getElementById('manualLat');
  const lngInput = document.getElementById('manualLng');
  if (latInput) latInput.value = lat;
  if (lngInput) lngInput.value = lng;
  // 地图定位并添加标记
  if (STATE.mapInstance) {
    STATE.mapInstance.setCenter([lng, lat]);
    STATE.mapInstance.setZoom(14);
    addMapMarker(lat, lng);
  }
  updateLocationCard(lat, lng, name);
  // 快速检查和评分
  checkAndScore(lat, lng);
  showToast(`已选择：${name}`, 'success');
}

// 手动输入坐标选点
function manualSelectLocation() {
  const lat = parseFloat(document.getElementById('manualLat').value);
  const lng = parseFloat(document.getElementById('manualLng').value);
  if (isNaN(lat) || isNaN(lng)) { showToast('请输入有效坐标', 'warning'); return; }
  if (lat < 25.5 || lat > 26.5 || lng < 118.8 || lng > 120.0) {
    showToast('坐标超出福州市区范围', 'warning'); return;
  }
  quickSelectLocation(lat, lng, `自定义坐标 (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
}

// 添加地图标记
function addMapMarker(lat, lng) {
  try {
    STATE.markers.forEach(m => { try { m.setMap(null); } catch(e) {} });
    STATE.markers = [];
    const marker = new AMap.Marker({
      position: new AMap.LngLat(lng, lat),
      title: `候选位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      label: {
        content: `<div style="background:#2563eb;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;white-space:nowrap">⚡ 候选选址</div>`,
        offset: new AMap.Pixel(-30, -50),
      },
    });
    if (STATE.mapInstance) {
      STATE.mapInstance.add(marker);
      STATE.markers.push(marker);
    }
  } catch(e) {
    console.warn('addMapMarker error:', e);
  }
}

// 检查禁止区域并快速评分
async function checkAndScore(lat, lng) {
  try {
    const res = await fetch(`${API.maps}/check/?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    updateExclusionStatus(data);
    if (!data.is_valid) showToast(`⚠️ 该位置位于禁止区域：${data.conflicts[0]?.name}`, 'warning');
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

// ============================================================
// 地图点击选点
// ============================================================
async function onMapClick(e) {
  const { lng, lat } = e.lnglat;
  STATE.selectedLat = lat;
  STATE.selectedLng = lng;

  // 清除之前的选点标记
  STATE.markers.forEach(m => m.setMap(null));
  STATE.markers = [];

  // 添加选点标记（使用content方式，避免btoa不支持emoji的问题）
  const marker = new AMap.Marker({
    position: [lng, lat],
    content: `<div style="width:36px;height:36px;background:#2563eb;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.4)">⚡</div>`,
    offset: new AMap.Pixel(-18, -18),
    title: `候选位置 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
  });
  marker.setMap(STATE.mapInstance);
  STATE.markers.push(marker);

  // 显示位置信息
  updateLocationCard(lat, lng);

  // 快速检查禁止区域
  try {
    const res = await fetch(`${API.maps}/check/?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    updateExclusionStatus(data);
    if (!data.is_valid) {
      showToast(`⚠️ 该位置位于禁止区域：${data.conflicts[0]?.name}`, 'warning');
    }
  } catch (e) { console.error(e); }

  // 快速评分
  try {
    const res = await fetch(`${API.analysis}/quick-score/?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    updateQuickScore(data);
    updateNearbyPOIs(data.nearby_pois || []);
  } catch (e) { console.error(e); }

  // 显示操作按钮
  document.getElementById('quickScoreCard').style.display = 'block';
  document.getElementById('poiCard').style.display = 'block';
  document.getElementById('actionButtons').style.display = 'flex';
}

function updateLocationCard(lat, lng, name) {
  const card = document.getElementById('locationInfo');
  card.innerHTML = `
    <div class="location-detail">
      ${name ? `<div class="location-row"><span class="location-label">地点</span><span class="location-value" style="color:#10b981">${name}</span></div>` : ''}
      <div class="location-row">
        <span class="location-label">纬度</span>
        <span class="location-value">${lat.toFixed(6)}</span>
      </div>
      <div class="location-row">
        <span class="location-label">经度</span>
        <span class="location-value">${lng.toFixed(6)}</span>
      </div>
      <div class="location-row">
        <span class="location-label">坐标系</span>
        <span class="location-value">GCJ-02</span>
      </div>
      <div id="exclusionStatus" class="exclusion-ok">✅ 正在检查禁止区域...</div>
    </div>`;
  document.getElementById('locationStatus').textContent = '已选择';
  document.getElementById('locationStatus').className = 'status-badge valid';
}

function updateExclusionStatus(data) {
  const el = document.getElementById('exclusionStatus');
  if (!el) return;
  if (data.is_valid) {
    el.className = 'exclusion-ok';
    el.textContent = '✅ 通过环境约束检查（非水域/林地）';
  } else {
    el.className = 'exclusion-warning';
    el.textContent = `⚠️ 位于禁止区域：${data.conflicts.map(c => c.name).join('、')}`;
  }
}

function updateQuickScore(data) {
  const scoreVal = document.getElementById('scoreValue');
  const scoreCircle = document.getElementById('scoreCircle');
  const scoreGrade = document.getElementById('scoreGrade');
  const scoreDetails = document.getElementById('scoreDetails');

  const score = data.total_score || 0;
  scoreVal.textContent = score.toFixed(1);

  scoreCircle.className = 'score-circle';
  let grade = '';
  if (score >= 8.5) { scoreCircle.classList.add('excellent'); grade = '优秀 · 强烈推荐'; }
  else if (score >= 7.0) { scoreCircle.classList.add('good'); grade = '良好 · 推荐'; }
  else if (score >= 5.5) { grade = '一般 · 可考虑'; }
  else { scoreCircle.classList.add('poor'); grade = '较差 · 不推荐'; }
  scoreGrade.textContent = grade;

  const dims = [
    { label: 'POI密度', val: data.poi_score || 0, color: '#3b82f6' },
    { label: '交通流量', val: data.traffic_score || 0, color: '#f59e0b' },
    { label: '可达性', val: data.accessibility_score || 0, color: '#10b981' },
    { label: '竞争分析', val: data.competition_score || 0, color: '#8b5cf6' },
  ];
  scoreDetails.innerHTML = dims.map(d => `
    <div class="score-item">
      <span class="score-item-label">${d.label}</span>
      <div class="score-bar-wrap">
        <div class="score-bar" style="width:${d.val*10}%;background:${d.color}"></div>
      </div>
      <span class="score-item-val">${d.val.toFixed(1)}</span>
    </div>`).join('');
}

function updateNearbyPOIs(pois) {
  const list = document.getElementById('poiList');
  const count = document.getElementById('poiCount');
  count.textContent = pois.length;
  if (!pois.length) {
    list.innerHTML = '<p class="hint-text">周边1km内暂无POI数据</p>';
    return;
  }
  list.innerHTML = pois.slice(0, 8).map(p => `
    <div class="poi-item">
      <span class="poi-cat">${POI_ICONS[p.category] || '📍'}</span>
      <div class="poi-info">
        <div class="poi-name">${p.name}</div>
        <div class="poi-meta">${p.category_display || p.category} · ${p.distance_km}km · ${p.daily_flow}人/日</div>
      </div>
      <span class="poi-score">${p.ev_demand_score}</span>
    </div>`).join('');
}

// ============================================================
// 加载POI标记
// ============================================================
async function loadPOIMarkers() {
  try {
    const res = await fetch(`${API.maps}/pois/`);
    const data = await res.json();
    data.data.forEach(poi => {
      const marker = new AMap.Marker({
        position: [poi.lng, poi.lat],
        content: `<div style="width:24px;height:24px;background:#f59e0b;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:pointer" title="${poi.name}">${POI_ICONS[poi.category] || '📍'}</div>`,
        offset: new AMap.Pixel(-12, -12),
        title: `${poi.name} (评分:${poi.ev_demand_score})`,
      });
      marker.setMap(STATE.mapInstance);
      STATE.poiMarkers.push(marker);
    });
    showToast(`已加载 ${data.data.length} 个POI`, 'info');
  } catch (e) { showToast('POI加载失败', 'error'); }
}

function clearPOIMarkers() {
  STATE.poiMarkers.forEach(m => m.setMap(null));
  STATE.poiMarkers = [];
}

// ============================================================
// 加载禁止区域
// ============================================================
async function loadExclusionZones() {
  try {
    const res = await fetch(`${API.maps}/exclusion-zones/`);
    const data = await res.json();
    data.data.forEach(zone => {
      const circle = new AMap.Circle({
        center: [zone.center_lng, zone.center_lat],
        radius: zone.radius_km * 1000,
        strokeColor: '#ef4444',
        strokeWeight: 2,
        strokeOpacity: 0.8,
        fillColor: '#ef4444',
        fillOpacity: 0.15,
      });
      circle.setMap(STATE.mapInstance);
      STATE.exclusionCircles.push(circle);

      // 添加标签
      const label = new AMap.Marker({
        position: [zone.center_lng, zone.center_lat],
        content: `<div style="background:rgba(239,68,68,0.8);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;white-space:nowrap">${zone.name}</div>`,
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

// ============================================================
// 加载已有充电站
// ============================================================
async function loadExistingStations() {
  try {
    const res2 = await fetch(`${API.maps}/candidates/`);
    const data = await res2.json();
    (data.data || []).forEach(s => {
      const marker = new AMap.Marker({
        position: [s.lng, s.lat],
        content: `<div style="width:28px;height:28px;background:#10b981;border:1.5px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🔌</div>`,
        offset: new AMap.Pixel(-14, -14),
        title: s.name,
      });
      marker.setMap(STATE.mapInstance);
      STATE.markers.push(marker);
    });
    showToast(`已加载 ${(data.data || []).length} 个候选站点`, 'info');
  } catch (e) { console.error(e); }
}

function clearExistingStations() {
  // 清除候选站点标记（在markers数组中）
  STATE.markers.forEach(m => m.setMap(null));
  STATE.markers = [];
}

function clearAllMarkers() {
  STATE.markers.forEach(m => m.setMap(null));
  STATE.markers = [];
  clearPOIMarkers();
  STATE.selectedLat = null;
  STATE.selectedLng = null;
  document.getElementById('locationInfo').innerHTML = '<p class="hint-text">点击地图选择充电桩候选位置<br>系统将自动避开水域、林地等禁止区域</p>';
  document.getElementById('locationStatus').textContent = '未选择';
  document.getElementById('locationStatus').className = 'status-badge';
  document.getElementById('quickScoreCard').style.display = 'none';
  document.getElementById('poiCard').style.display = 'none';
  document.getElementById('actionButtons').style.display = 'none';
}

// ============================================================
// 热力图按钮事件绑定（与地图初始化分离，在DOMContentLoaded时绑定）
// ============================================================
function initHeatmapButtons() {
  document.getElementById('btnHeatmapFlow').addEventListener('click', () => {
    toggleMapBtn('btnHeatmapFlow');
    if (STATE.heatmapInstance) loadHeatmapData(STATE.heatmapInstance);
  });
  document.getElementById('btnHeatmapEV').addEventListener('click', () => {
    toggleMapBtn('btnHeatmapEV');
    if (STATE.heatmapInstance) loadHeatmapData(STATE.heatmapInstance, true);
  });
  document.getElementById('btnShowRoads').addEventListener('click', () => {
    const active = toggleMapBtn('btnShowRoads');
    if (STATE.heatmapInstance) {
      active ? loadRoadPolylines(STATE.heatmapInstance) : clearRoadPolylines();
    }
  });
}

// ============================================================
// 热力图初始化（懒加载，切换到热力图Tab时才调用）
// ============================================================
function initHeatmap() {
  if (STATE.heatmapInited) return;
  try {
    const map = new AMap.Map('heatmap-container', {
      zoom: 12,
      center: [119.3034, 26.0756],
      mapStyle: 'amap://styles/dark',  // 使用高德暗色主题
    });
    STATE.heatmapInstance = map;
    STATE.heatmapInited = true;

    // 添加比例尺
    map.addControl(new AMap.Scale());

    // 加载热力图数据
    loadHeatmapData(map);

  } catch (e) {
    console.error('热力图初始化失败:', e);
  }
}

async function loadHeatmapData(map, evOnly = false) {
  try {
    const res = await fetch(`${API.maps}/heatmap/`);
    const data = await res.json();
    // 移除旧热力图层
    if (STATE.heatmapLayer) {
      STATE.heatmapLayer.setMap(null);
      STATE.heatmapLayer = null;
    }
    const points = data.data.map(p => ({
      lng: p.lng,
      lat: p.lat,
      count: evOnly ? (p.ev_ratio != null ? Math.round(p.weight * p.ev_ratio * 100) : Math.round(p.weight * 8)) : Math.round(p.weight * 100),
    }));
    AMap.plugin('AMap.HeatMap', () => {
      const heatmap = new AMap.HeatMap(map, {
        radius: 50,
        opacity: [0, 0.9],
        gradient: {
          0.05: '#00e5ff',
          0.2:  '#00ff00',
          0.4:  '#ffff00',
          0.6:  '#ff8c00',
          0.8:  '#ff4500',
          1.0:  '#ff0000',
        },
        zooms: [3, 20],
      });
      heatmap.setDataSet({ data: points, max: evOnly ? 20 : 100 });
      STATE.heatmapLayer = heatmap;
    });
    // 加载道路统计
    loadRoadStats();
  } catch (e) { console.error('热力图加载失败:', e); }
}

async function loadRoadStats() {
  try {
    const res = await fetch(`${API.maps}/traffic/`);
    const data = await res.json();
    const container = document.getElementById('roadStats');
    const sorted = data.data.sort((a, b) => b.daily_flow - a.daily_flow);
    container.innerHTML = sorted.slice(0, 15).map(r => `
      <div class="road-item" style="border-left-color:${getFlowColor(r.daily_flow)}">
        <div class="road-name">${r.road_name}</div>
        <div class="road-meta">
          <span>${r.road_level_display}</span>
          <span class="road-flow">${(r.daily_flow/10000).toFixed(1)}万辆/日</span>
          <span>EV占比 ${r.ev_ratio != null ? (r.ev_ratio*100).toFixed(0) : '--'}%</span>
        </div>
      </div>`).join('');
  } catch (e) { console.error(e); }
}

function getFlowColor(flow) {
  if (flow >= 60000) return '#ff0000';
  if (flow >= 40000) return '#ff4500';
  if (flow >= 20000) return '#ffcc00';
  return '#00cc44';
}

async function loadRoadPolylines(map) {
  try {
    const res = await fetch(`${API.maps}/traffic/`);
    const data = await res.json();
    data.data.forEach(road => {
      // path字段格式为[[lat, lng], ...]，高德地图需要[lng, lat]格式
      const rawPath = road.path || [[road.start_lat, road.start_lng], [road.end_lat, road.end_lng]];
      const amapPath = rawPath.map(p => [p[1], p[0]]);  // [lat,lng] -> [lng,lat]

      // 根据道路等级设置线宽（兼容旧值primary/secondary）
      let strokeWeight = 3;
      const level = road.road_level;
      if (level === 'expressway') strokeWeight = 6;
      else if (level === 'urban_expressway') strokeWeight = 5;
      else if (level === 'main_road' || level === 'primary' || level === 'national') strokeWeight = 4;
      else if (level === 'secondary_road' || level === 'secondary' || level === 'provincial') strokeWeight = 3;

      const polyline = new AMap.Polyline({
        path: amapPath,
        strokeColor: getFlowColor(road.daily_flow),
        strokeWeight: strokeWeight,
        strokeOpacity: 0.9,
        showDir: true,
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 10,
      });
      polyline.setMap(map);
      STATE.roadPolylines.push(polyline);
    });
    showToast(`已加载 ${data.data.length} 条主干道`, 'info');
  } catch (e) { console.error('道路加载失败:', e); }
}

function clearRoadPolylines() {
  STATE.roadPolylines.forEach(p => p.setMap(null));
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

  // 切换到分析Tab
  document.querySelector('[data-tab="analysis"]').click();

  const userMsg = `请分析坐标(${STATE.selectedLat.toFixed(4)}, ${STATE.selectedLng.toFixed(4)})的充电桩选址可行性，给出详细的分析报告。`;
  addChatMessage('user', userMsg);
  setAgentStatus('thinking');

  // 显示任务状态卡片
  document.getElementById('taskStatusCard').style.display = 'block';
  document.getElementById('taskStatusBody').innerHTML = `<div class="task-status-running"><div class="loading-spinner" style="width:16px;height:16px;margin:0"></div> 正在启动AI分析任务...</div>`;

  try {
    const res = await fetch(`${API.analysis}/analyze/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: STATE.selectedLat,
        lng: STATE.selectedLng,
        message: userMsg,
        session_id: STATE.sessionId,
      }),
    });
    const data = await res.json();
    STATE.currentTaskId = data.task_id;

    // 显示快速评分结果
    if (data.quick_score) {
      const qs = data.quick_score;
      addChatMessage('assistant', `⚡ **快速评分完成**\n\n综合评分：**${qs.total_score}/10**\n- POI密度：${qs.poi_score}/10\n- 交通流量：${qs.traffic_score}/10\n- 可达性：${qs.accessibility_score}/10\n\n🤖 AI正在进行深度分析，请稍候...`);
    }

    // 开始轮询任务状态
    pollTaskStatus(data.task_id);

  } catch (e) {
    setAgentStatus('error');
    addChatMessage('assistant', `❌ 分析启动失败：${e.message}`);
  }
}

async function pollTaskStatus(taskId) {
  let attempts = 0;
  const maxAttempts = 150; // 最多5分钟
  if (STATE.taskPollTimer) clearTimeout(STATE.taskPollTimer);

  const poll = async () => {
    attempts++;
    try {
      const res = await fetch(`${API.analysis}/task/${taskId}/`);
      const data = await res.json();

      const elapsed = attempts * 3;
      document.getElementById('taskStatusBody').innerHTML = data.status === 'completed'
        ? `<div class="task-status-completed">✅ 分析完成 | 评分：${data.total_score}/10</div>`
        : `<div class="task-status-running"><div class="loading-spinner" style="width:16px;height:16px;margin:0"></div> Agent分析中... (${elapsed}s)</div>`;

      if (data.status === 'completed') {
        setAgentStatus('idle');
        // 显示AI分析结果
        if (data.llm_reasoning) {
          addChatMessage('assistant', data.llm_reasoning);
          // 显示工具调用记录
          if (data.analysis_detail?.tool_calls) {
            updateToolCallsLog(data.analysis_detail.tool_calls);
          } else {
            updateToolCallsLog([
              { tool: 'rag_search', input: '充电桩选址规范', output: 'RAG检索完成' },
              { tool: 'query_knowledge_graph', input: '鼓楼区', output: '知识图谱查询完成' },
              { tool: 'get_nearby_pois', input: `${data.latitude},${data.longitude}`, output: `找到${data.recommendations?.length || 0}个周边POI` },
            ]);
          }
          // 显示RAG结果
          if (data.rag_context) {
            try {
              const ragDocs = JSON.parse(data.rag_context);
              updateRAGResults(ragDocs);
            } catch (e) {}
          }
        }
        showToast('AI分析完成！', 'success');
        return;
      }

      if (attempts < maxAttempts) {
        STATE.taskPollTimer = setTimeout(poll, 3000);
      } else {
        setAgentStatus('idle');
        const finalRes = await fetch(`${API.analysis}/task/${taskId}/`);
        const finalData = await finalRes.json();
        if (finalData.llm_reasoning) {
          addChatMessage('assistant', finalData.llm_reasoning);
          showToast('AI分析完成！', 'success');
        } else {
          addChatMessage('assistant', '⏱️ 分析时间较长，请稍后在"历史记忆"中查看结果，或重新发起分析。');
        }
      }
    } catch (e) {
      console.error('轮询失败:', e);
      if (attempts < maxAttempts) STATE.taskPollTimer = setTimeout(poll, 3000);
    }
  };

  setTimeout(poll, 3000);
}

function setAgentStatus(status) {
  const dot = document.querySelector('.status-dot');
  const text = dot?.nextElementSibling;
  if (!dot) return;
  dot.className = `status-dot ${status}`;
  if (text) {
    text.textContent = { idle: '就绪', thinking: '分析中...', error: '错误' }[status] || status;
  }
  document.getElementById('btnSend').disabled = status === 'thinking';
}

function addChatMessage(role, content) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${role}-message`;
  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  let html = '';
  if (role === 'assistant') {
    try {
      html = marked.parse(content);
    } catch (e) {
      html = content.replace(/\n/g, '<br>');
    }
  } else {
    html = `<p>${content}</p>`;
  }

  div.innerHTML = `
    <div class="message-content">${html}</div>
    <div class="message-time">${time}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function updateToolCallsLog(toolCalls) {
  const container = document.getElementById('toolCallsLog');
  if (!toolCalls || !toolCalls.length) return;
  container.innerHTML = toolCalls.map(tc => `
    <div class="tool-call-item">
      <div class="tool-call-name">🔧 ${tc.tool}</div>
      <div class="tool-call-input">输入：${JSON.stringify(tc.input).substring(0, 100)}</div>
      <div class="tool-call-output">${tc.output}</div>
    </div>`).join('');
}

function updateRAGResults(docs) {
  const container = document.getElementById('ragResults');
  if (!docs || !docs.length) return;
  container.innerHTML = docs.map((doc, i) => `
    <div class="rag-item">
      <div class="rag-source">📚 知识库文档 ${i + 1}</div>
      <div class="rag-content">${doc.substring(0, 200)}...</div>
    </div>`).join('');
}

// ============================================================
// 聊天输入处理
// ============================================================
function initChatHandlers() {
  const input = document.getElementById('chatInput');
  const btnSend = document.getElementById('btnSend');

  btnSend.addEventListener('click', sendMessage);
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

  input.value = '';
  addChatMessage('user', msg);
  setAgentStatus('thinking');

  try {
    const body = { message: msg, session_id: STATE.sessionId };
    if (STATE.selectedLat) { body.lat = STATE.selectedLat; body.lng = STATE.selectedLng; }

    const res = await fetch(`${API.analysis}/chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (data.task_id) {
      addChatMessage('assistant', '🔍 AI正在分析中，正在调用RAG知识库和知识图谱...');
      pollChatTask(data.task_id);
    } else if (data.response) {
      addChatMessage('assistant', data.response);
      if (data.tool_calls?.length) updateToolCallsLog(data.tool_calls);
      setAgentStatus('idle');
    } else {
      addChatMessage('assistant', '抱歉，分析服务暂时不可用。');
      setAgentStatus('idle');
    }
  } catch (e) {
    addChatMessage('assistant', `❌ 请求失败：${e.message}`);
    setAgentStatus('error');
  }
}

async function pollChatTask(taskId) {
  let attempts = 0;
  const maxAttempts = 90;
  const poll = async () => {
    attempts++;
    try {
      const res = await fetch(`${API.analysis}/task/${taskId}/`);
      const data = await res.json();
      if (data.status === 'completed') {
        setAgentStatus('idle');
        const msgs = document.querySelectorAll('.message.assistant-message');
        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1];
          if (last.textContent.includes('正在分析中') || last.textContent.includes('正在调用RAG')) {
            last.remove();
          }
        }
        if (data.llm_reasoning) {
          addChatMessage('assistant', data.llm_reasoning);
          if (data.analysis_detail?.tool_calls?.length) {
            updateToolCallsLog(data.analysis_detail.tool_calls);
          }
          if (data.rag_context) {
            try { updateRAGResults(JSON.parse(data.rag_context)); } catch(e) {}
          }
        } else {
          addChatMessage('assistant', '分析已完成，请查看结果。');
        }
        return;
      }
      if (attempts < maxAttempts) setTimeout(poll, 2000);
      else { setAgentStatus('idle'); addChatMessage('assistant', '分析超时，请重试。'); }
    } catch(e) {
      if (attempts < maxAttempts) setTimeout(poll, 3000);
    }
  };
  setTimeout(poll, 2000);
}

function sendQuickMsg(msg) {
  document.getElementById('chatInput').value = msg;
  sendMessage();
}

// ============================================================
// 知识图谱
// ============================================================
async function loadKnowledgeGraph() {
  if (STATE.kgData) return;
  try {
    const res = await fetch(`${API.analysis}/knowledge-graph/`);
    const data = await res.json();
    STATE.kgData = data;
    renderKnowledgeGraph(data);
  } catch (e) { console.error('知识图谱加载失败:', e); }
}

function renderKnowledgeGraph(data, filterType = null) {
  const chart = STATE.kgChart || echarts.init(document.getElementById('knowledgeGraph'), 'dark');
  STATE.kgChart = chart;

  const typeColors = {
    poi_type: '#3b82f6',
    road_level: '#10b981',
    district: '#f59e0b',
    charging_demand: '#8b5cf6',
    factor: '#ef4444',
    concept: '#06b6d4',
  };

  let nodes = data.nodes;
  let edges = data.edges;

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
          return `<b>${params.data.name}</b><br>类型：${params.data.type}<br>${Object.entries(props).map(([k,v]) => `${k}: ${v}`).join('<br>')}`;
        }
        return `${params.data.source} → ${params.data.target}<br>关系：${params.data.relation}`;
      },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes.map(n => ({
        id: n.id,
        name: n.name,
        type: n.type,
        properties: n.properties,
        symbolSize: n.type === 'district' ? 40 : n.type === 'charging_demand' ? 35 : 28,
        itemStyle: { color: typeColors[n.type] || '#64748b', borderColor: '#fff', borderWidth: 1.5 },
        label: { show: true, fontSize: 10, color: '#f1f5f9', position: 'bottom' },
      })),
      edges: edges.map(e => ({
        source: e.source,
        target: e.target,
        relation: e.relation,
        lineStyle: { color: '#475569', width: Math.max(1, e.weight * 2), curveness: 0.1, opacity: 0.7 },
        label: { show: nodes.length <= 20, formatter: e.relation, fontSize: 9, color: '#94a3b8' },
      })),
      force: { repulsion: 200, gravity: 0.1, edgeLength: [80, 150] },
      roam: true,
      emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
    }],
  };

  chart.setOption(option);
  chart.on('click', (params) => {
    if (params.dataType === 'node') showKGNodeDetail(params.data);
  });

  // 工具栏按钮
  document.getElementById('btnKGAll').onclick = () => renderKnowledgeGraph(data);
  document.getElementById('btnKGPOI').onclick = () => renderKnowledgeGraph(data, 'poi_type');
  document.getElementById('btnKGRoad').onclick = () => renderKnowledgeGraph(data, 'road_level');
  document.getElementById('btnKGDistrict').onclick = () => renderKnowledgeGraph(data, 'district');
}

function showKGNodeDetail(node) {
  const card = document.getElementById('kgNodeDetail');
  const body = document.getElementById('kgNodeDetailBody');
  card.style.display = 'block';
  const props = node.properties || {};
  body.innerHTML = `
    <div class="location-detail">
      <div class="location-row"><span class="location-label">节点名称</span><span class="location-value">${node.name}</span></div>
      <div class="location-row"><span class="location-label">节点类型</span><span class="location-value">${node.type}</span></div>
      ${Object.entries(props).map(([k,v]) => `<div class="location-row"><span class="location-label">${k}</span><span class="location-value">${v}</span></div>`).join('')}
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

    document.querySelector('[data-tab="report"]').click();
    await loadReportList();
    showReportDetail(data);
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
      container.innerHTML = '<p class="hint-text">暂无报告<br>在地图选点并AI分析后可生成</p>';
      return;
    }
    container.innerHTML = data.data.map(r => `
      <div class="report-list-item" onclick="loadReportById('${r.report_id}')">
        <div class="report-item-title">${r.title}</div>
        <div class="report-item-meta">
          <span class="report-item-score">${r.total_score}/10</span>
          <span> · ${new Date(r.created_at).toLocaleString('zh-CN')}</span>
        </div>
      </div>`).join('');
  } catch (e) { console.error(e); }
}

async function loadReportById(reportId) {
  try {
    const res = await fetch(`${API.reports}/${reportId}/`);
    const data = await res.json();
    showReportDetail(data);
    document.querySelectorAll('.report-list-item').forEach(el => el.classList.remove('active'));
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

  document.getElementById('reportTitle').textContent = data.title || '选址报告';
  document.getElementById('reportActions').style.display = 'flex';

  const body = document.getElementById('reportBody');
  body.innerHTML = `
    <div class="report-section">
      <h3>📍 选址位置</h3>
      <div class="location-detail">
        <div class="location-row"><span class="location-label">坐标</span><span class="location-value">${(sel.lat||0).toFixed(6)}, ${(sel.lng||0).toFixed(6)}</span></div>
        <div class="location-row"><span class="location-label">地址</span><span class="location-value">${sel.address || data.title || '-'}</span></div>
        <div class="location-row"><span class="location-label">综合评分</span><span class="location-value" style="color:#10b981;font-weight:600">${data.total_score || 0}/10</span></div>
      </div>
    </div>

    <div class="report-section">
      <h3>📊 评分详情</h3>
      <div class="score-details">
        ${[
          { label: 'POI密度', val: scoring.poi || 0, color: '#3b82f6' },
          { label: '交通流量', val: scoring.traffic || 0, color: '#f59e0b' },
          { label: '可达性', val: scoring.accessibility || 0, color: '#10b981' },
          { label: '竞争分析', val: scoring.competition || 0, color: '#8b5cf6' },
        ].map(d => `
          <div class="score-item">
            <span class="score-item-label">${d.label}</span>
            <div class="score-bar-wrap"><div class="score-bar" style="width:${d.val*10}%;background:${d.color}"></div></div>
            <span class="score-item-val">${(d.val||0).toFixed(1)}</span>
          </div>`).join('')}
      </div>
    </div>

    ${poi.items?.length ? `
    <div class="report-section">
      <h3>🏪 周边POI分析（共${poi.count || poi.items.length}个）</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="color:var(--text-muted)"><th style="text-align:left;padding:4px">名称</th><th>类型</th><th>距离</th><th>评分</th></tr></thead>
        <tbody>${poi.items.slice(0,8).map(p => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:4px">${p.name}</td>
            <td style="text-align:center">${p.category_display || p.category}</td>
            <td style="text-align:center">${p.distance_km}km</td>
            <td style="text-align:center;color:#10b981">${p.ev_demand_score}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${traffic.items?.length ? `
    <div class="report-section">
      <h3>🚗 交通流量分析</h3>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">${traffic.summary || ''}</p>
      ${traffic.items.slice(0,6).map(r => `
        <div class="road-item" style="border-left-color:${getFlowColor(r.daily_flow || 0)}">
          <div class="road-name">${r.road_name}</div>
          <div class="road-meta">
            <span>${r.road_level_display || r.road_level}</span>
            <span class="road-flow">${((r.daily_flow||0)/10000).toFixed(1)}万辆/日</span>
          </div>
        </div>`).join('')}
    </div>` : ''}

    ${alts.length ? `
    <div class="report-section">
      <h3>📌 备选位置推荐</h3>
      ${alts.slice(0,5).map((a,i) => `
        <div style="padding:8px;background:var(--surface);border-radius:6px;margin-bottom:6px">
          <div style="font-weight:600;font-size:13px">备选${i+1}：${a.name || a.address || `(${(a.lat||0).toFixed(4)}, ${(a.lng||0).toFixed(4)})`}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${a.reason || ''}</div>
        </div>`).join('')}
    </div>` : ''}

    ${llm ? `
    <div class="report-section">
      <h3>🤖 AI综合分析</h3>
      <div style="font-size:12px;line-height:1.7;color:var(--text-secondary)">${
        (() => { try { return marked.parse(llm); } catch(e) { return llm.replace(/\n/g,'<br>'); } })()
      }</div>
    </div>` : ''}
  `;

  // PDF下载按钮
  document.getElementById('btnDownloadPDF').onclick = () => {
    window.open(`${API.reports}/${data.report_id}/pdf/`, '_blank');
  };
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
    document.getElementById('memoryCount').textContent = `${msgCount}条对话`;

    document.getElementById('memoryStats').innerHTML = `
      <div class="memory-stat"><div class="memory-stat-val">${msgCount}</div><div class="memory-stat-label">对话记录</div></div>
      <div class="memory-stat"><div class="memory-stat-val">${locCount}</div><div class="memory-stat-label">选址记录</div></div>
      <div class="memory-stat"><div class="memory-stat-val">${STATE.sessionId}</div><div class="memory-stat-label">会话ID</div></div>`;

    const timeline = document.getElementById('memoryTimeline');
    if (!data.messages?.length) {
      timeline.innerHTML = '<p class="hint-text">暂无对话历史</p>';
    } else {
      timeline.innerHTML = data.messages.map(m => `
        <div class="memory-item">
          <span class="memory-role ${m.role}">${m.role === 'user' ? '用户' : 'AI'}</span>
          <span class="memory-text">${m.content}</span>
          <span class="memory-time">${new Date(m.created_at).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}</span>
        </div>`).join('');
    }

    const locHistory = document.getElementById('locationHistory');
    if (!data.locations?.length) {
      locHistory.innerHTML = '<p class="hint-text">暂无选址历史</p>';
    } else {
      locHistory.innerHTML = data.locations.map(l => `
        <div class="location-item">
          <div class="location-addr">${l.address || `(${l.lat?.toFixed(4)}, ${l.lng?.toFixed(4)})`}</div>
          <div class="location-meta">评分：${l.score}/10 · ${new Date(l.created_at).toLocaleString('zh-CN')}</div>
        </div>`).join('');
    }
  } catch (e) { console.error('加载记忆失败:', e); }
}

// ============================================================
// 工具函数
// ============================================================
function showLoading(text = 'AI正在分析中...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// 刷新报告列表按钮
document.getElementById('btnRefreshReports')?.addEventListener('click', loadReportList);
