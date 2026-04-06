# 福州新能源充电桩智能选址平台 TODO

## 后端 API 层
- [x] 数据库Schema：poiData, trafficFlow, exclusionZones, chargingStations, analysisHistory, reportHistory, memorySessions
- [x] 数据库迁移并初始化种子数据（42 POI、21 道路、12 禁区、6 充电站）
- [x] tRPC路由：maps.getDashboardStats, maps.getPOI, maps.getTrafficFlow, maps.getExclusionZones, maps.getChargingStations
- [x] tRPC路由：analysis.quickScore（10分制综合评分）, analysis.aiAnalysis, analysis.getHistory
- [x] tRPC路由：reports.generate, reports.list
- [x] tRPC路由：memory.getSessions, memory.clearSession

## 前端页面
- [x] 全局深色科技风主题（index.css）
- [x] 侧边栏导航组件（Sidebar.tsx）
- [x] 数据大屏（Dashboard.tsx）- KPI卡片 + ECharts图表 + POI排行榜
- [x] 地图选址（MapAnalysis.tsx）- 高德地图 + 图层控制 + 点击评分
- [x] 热力图分析（HeatMap.tsx）- 交通流量/新能源车热力图
- [x] AI智能分析（AIAnalysis.tsx）- 对话式选址咨询
- [x] 知识图谱（KnowledgeGraph.tsx）- ECharts力导向图
- [x] 选址报告（Reports.tsx）- AI生成 + 下载
- [x] 历史记忆（History.tsx）- 对话/报告历史管理

## 技术集成
- [x] 高德地图API Key配置（VITE_AMAP_KEY / VITE_AMAP_SECURITY_CODE）
- [x] ECharts集成
- [x] 高德地图JS SDK动态加载
- [x] AI分析（调用内置LLM invokeLLM）

## 测试
- [x] Vitest：11/11 全部通过
- [x] 覆盖：getDashboardStats、getPOI、getTrafficFlow、getExclusionZones、getChargingStations、quickScore、auth.logout

## Bug修复 - 数据显示为0

- [ ] 诊断API数据加载失败根因
- [ ] 修复数据库种子脚本确保数据写入成功
- [ ] 修复热力图页面数据加载（道路流量数据）
- [ ] 修复数据大屏统计数据显示
- [ ] 修复AI分析页面数据
- [x] 诊断API数据加载失败根因
- [x] 修复数据库种子脚本确保数据写入成功
- [x] 修复热力图页面数据加载（道路流量数据）
- [x] 修复数据大屏统计数据显示
- [x] 修复AI分析页面数据
- [x] 推送修复到GitHub/Render

## Bug修复 - 功能不可用（第二轮）

- [ ] 修复AI助手对话（"分析服务暂时不可用"）
- [ ] 修复地图道路流量图层无法显示
- [ ] 修复PDF报告生成失败

## 紧急：真实数据替换（第三轮）

- [ ] 通过高德API采集福州真实道路路径坐标（Polyline，含真实走向）
- [ ] 通过高德API采集福州真实POI数据（商场/医院/交通枢纽等）
- [ ] 通过高德API采集福州真实充电站数据
- [ ] 替换staticData.ts中所有模拟/造假数据
- [ ] 修复道路图层渲染（使用真实路径坐标，非水平短横线）
- [ ] 推送到GitHub更新Render生产环境
