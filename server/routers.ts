import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";
import { getDb } from "./db";
import { poiData, trafficFlow, exclusionZones, chargingStations, analysisHistory, reportHistory, memorySessions } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { STATIC_POI_DATA, STATIC_TRAFFIC_FLOW, STATIC_EXCLUSION_ZONES, STATIC_CHARGING_STATIONS, getStaticDashboardStats } from "./staticData";

// ─── 地理计算工具 ───────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dlat = (lat2 - lat1) * Math.PI / 180;
  const dlng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dlng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointInPolygon(lat: number, lng: number, coords: number[][]): boolean {
  let inside = false;
  let j = coords.length - 1;
  for (let i = 0; i < coords.length; i++) {
    const xi = coords[i][0], yi = coords[i][1];
    const xj = coords[j][0], yj = coords[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

function getCategoryDisplay(cat: string): string {
  const map: Record<string, string> = {
    mall: "购物中心", hotel: "酒店", hospital: "医院", school: "学校",
    office: "写字楼", residential: "居住区", transport: "交通枢纽",
    gas_station: "加油站", parking: "停车场", restaurant: "餐饮",
    scenic: "景区", government: "政府机构",
  };
  return map[cat] ?? cat;
}

// ─── 智能评分引擎 ───────────────────────────────────────────────
async function quickScore(lat: number, lng: number) {
  const db = await getDb();

  const [pois, roads, zones, stations] = db ? await Promise.all([
    db.select().from(poiData),
    db.select().from(trafficFlow),
    db.select().from(exclusionZones),
    db.select().from(chargingStations),
  ]) : [
    STATIC_POI_DATA.map(p => ({ ...p, influenceWeight: 1.0, boundaryJson: null as string | null, createdAt: new Date() })),
    STATIC_TRAFFIC_FLOW.map(r => ({ ...r, heatWeight: 1.0, centerLat: r.latitude, centerLng: r.longitude, roadLevel: 'arterial', createdAt: new Date() })),
    STATIC_EXCLUSION_ZONES.map(z => ({ ...z, boundaryJson: null as string | null, createdAt: new Date() })),
    STATIC_CHARGING_STATIONS.map(s => ({ ...s, connectors: s.chargerCount, createdAt: new Date() })),
  ];

  // 禁区检查（一票否决）
  const conflicts: string[] = [];
  for (const zone of zones) {
    const dist = haversine(lat, lng, zone.centerLat, zone.centerLng);
    let inZone = dist <= zone.radiusKm;
    if (!inZone && zone.boundaryJson) {
      try {
        const boundary = JSON.parse(zone.boundaryJson);
        if (boundary?.type === "Polygon") {
          inZone = pointInPolygon(lat, lng, boundary.coordinates[0]);
        }
      } catch {}
    }
    if (inZone) conflicts.push(zone.name);
  }

  // POI评分（35%）- 2km范围
  const nearbyPois = pois
    .map(p => ({ ...p, dist: haversine(lat, lng, p.latitude, p.longitude) }))
    .filter(p => p.dist <= 2.0)
    .sort((a, b) => a.dist - b.dist);

  let poiScore = 0;
  if (nearbyPois.length > 0) {
    const weightedSum = nearbyPois.reduce((sum, p) => {
      const decay = Math.exp(-p.dist / 1.0);
      return sum + p.evDemandScore * p.influenceWeight * decay;
    }, 0);
    poiScore = Math.min(10, weightedSum / Math.max(nearbyPois.length * 0.8, 1));
  }

  // 交通评分（30%）- 3km范围
  const nearbyRoads = roads
    .map(r => ({ ...r, dist: haversine(lat, lng, r.centerLat, r.centerLng) }))
    .filter(r => r.dist <= 3.0)
    .sort((a, b) => a.dist - b.dist);

  let trafficScore = 0;
  if (nearbyRoads.length > 0) {
    const maxFlow = Math.max(...nearbyRoads.map(r => r.dailyFlow));
    trafficScore = nearbyRoads.slice(0, 3).reduce((sum, r) => {
      const normalized = r.dailyFlow / maxFlow;
      const evBonus = r.evRatio * 2;
      return sum + (normalized * 8 + evBonus) * r.heatWeight;
    }, 0) / Math.min(nearbyRoads.length, 3);
    trafficScore = Math.min(10, trafficScore);
  }

  // 可达性评分（20%）
  const roadLevelScores: Record<string, number> = {
    expressway: 10, arterial: 8.5, secondary: 7, branch: 5.5, other: 4
  };
  let accessScore = 4;
  if (nearbyRoads.length > 0) {
    const bestRoad = nearbyRoads[0];
    const levelScore = roadLevelScores[bestRoad.roadLevel] ?? 5;
    const distPenalty = Math.max(0, (bestRoad.dist - 0.5) * 2);
    accessScore = Math.min(10, Math.max(3, levelScore - distPenalty));
  }

  // 竞争评分（15%）- 1.5km内已有充电站
  const nearbyStations = stations
    .map(s => ({ ...s, dist: haversine(lat, lng, s.latitude, s.longitude) }))
    .filter(s => s.dist <= 1.5);
  const competitionScore = nearbyStations.length === 0 ? 9.5
    : nearbyStations.length === 1 ? 7.5
    : nearbyStations.length === 2 ? 5.5
    : Math.max(2, 5.5 - (nearbyStations.length - 2) * 1.5);

  const totalScore = conflicts.length > 0 ? 0 :
    Math.round((poiScore * 0.35 + trafficScore * 0.30 + accessScore * 0.20 + competitionScore * 0.15) * 10) / 10;

  const grade = totalScore >= 8.5 ? "优秀" : totalScore >= 7 ? "良好" : totalScore >= 5.5 ? "一般" : totalScore >= 4 ? "较差" : "不可用";

  return {
    totalScore,
    grade,
    exclusionConflicts: conflicts,
    scoreBreakdown: {
      poi: Math.round(poiScore * 10) / 10,
      traffic: Math.round(trafficScore * 10) / 10,
      accessibility: Math.round(accessScore * 10) / 10,
      competition: Math.round(competitionScore * 10) / 10,
    },
    nearbyPois: nearbyPois.slice(0, 8).map(p => ({
      id: p.id, name: p.name, category: p.category,
      categoryDisplay: getCategoryDisplay(p.category),
      dist: Math.round(p.dist * 1000) / 1000,
      dailyFlow: p.dailyFlow, evDemandScore: p.evDemandScore,
    })),
    nearbyRoads: nearbyRoads.slice(0, 5).map(r => ({
      id: r.id, name: r.roadName, level: r.roadLevel,
      dist: Math.round(r.dist * 1000) / 1000,
      dailyFlow: r.dailyFlow, evRatio: r.evRatio,
    })),
    nearbyStations: nearbyStations.map(s => ({
      id: s.id, name: s.name,
      dist: Math.round(s.dist * 1000) / 1000,
      connectors: s.connectors,
    })),
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── 地图数据 ──
  maps: router({
    getPOI: publicProcedure
      .input(z.object({ category: z.string().optional(), district: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        const rows: any[] = db ? await db.select().from(poiData)
          : STATIC_POI_DATA.map(p => ({ ...p, influenceWeight: 1.0, boundaryJson: null, createdAt: new Date() }));
        const filtered = rows.filter((r: any) =>
          (!input?.category || r.category === input.category) &&
          (!input?.district || r.district.includes(input.district ?? ""))
        );
        return { data: filtered, total: filtered.length };
      }),

    getTrafficFlow: publicProcedure.query(async () => {
      // 使用staticData中通过高德JS SDK路径规划API采集的真实道路路径坐标
      const rows = STATIC_TRAFFIC_FLOW.map(r => ({
        ...r,
        heatWeight: Math.min(1.0, r.dailyFlow / 100000),
        centerLat: r.latitude,
        centerLng: r.longitude,
        roadLevel: r.dailyFlow > 80000 ? 'expressway' : r.dailyFlow > 50000 ? 'arterial' : 'secondary',
        name: r.roadName,
        createdAt: new Date(),
      }));
      return { data: rows, total: rows.length };
    }),

    getExclusionZones: publicProcedure.query(async () => {
      const db = await getDb();
      const rows: any[] = db ? await db.select().from(exclusionZones)
        : STATIC_EXCLUSION_ZONES.map(z => ({ ...z, boundaryJson: null, createdAt: new Date() }));
      return { data: rows, total: rows.length };
    }),

    getChargingStations: publicProcedure.query(async () => {
      const db = await getDb();
      const rows: any[] = db ? await db.select().from(chargingStations)
        : STATIC_CHARGING_STATIONS.map(s => ({ ...s, connectors: s.chargerCount, createdAt: new Date() }));
      return { data: rows, total: rows.length };
    }),

    getDashboardStats: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return getStaticDashboardStats();
      const [pois, roads, zones, stations] = await Promise.all([
        db.select().from(poiData),
        db.select().from(trafficFlow),
        db.select().from(exclusionZones),
        db.select().from(chargingStations),
      ]);
      const catMap: Record<string, number> = {};
      pois.forEach(p => { const k = getCategoryDisplay(p.category); catMap[k] = (catMap[k] || 0) + 1; });
      const districtMap: Record<string, number> = {};
      roads.forEach(r => {
        const d = r.district.split("/")[0];
        districtMap[d] = (districtMap[d] || 0) + r.dailyFlow;
      });
      const scoreRanges = [
        { range: "9-10分", count: pois.filter(p => p.evDemandScore >= 9).length },
        { range: "8-9分", count: pois.filter(p => p.evDemandScore >= 8 && p.evDemandScore < 9).length },
        { range: "7-8分", count: pois.filter(p => p.evDemandScore >= 7 && p.evDemandScore < 8).length },
        { range: "6-7分", count: pois.filter(p => p.evDemandScore >= 6 && p.evDemandScore < 7).length },
        { range: "<6分", count: pois.filter(p => p.evDemandScore < 6).length },
      ];
      const topPois = [...pois].sort((a, b) => b.evDemandScore - a.evDemandScore).slice(0, 10);
        const districtSet = new Set(pois.map(p => p.district.split("区")[0] + "区"));
        const districts = Array.from(districtSet);
      return {
        kpi: { districts: districts.length, poiCount: pois.length, roadCount: roads.length, stationCount: stations.length, exclusionCount: zones.length },
        poiCategoryChart: Object.entries(catMap).map(([name, value]) => ({ name, value })),
        trafficDistrictChart: Object.entries(districtMap).map(([name, value]) => ({ name, value: Math.round(value / 1000) })),
        evDemandChart: scoreRanges,
        topPois: topPois.map(p => ({
          id: p.id, name: p.name, category: getCategoryDisplay(p.category),
          district: p.district, dailyFlow: p.dailyFlow, evDemandScore: p.evDemandScore,
          lat: p.latitude, lng: p.longitude,
        })),
      };
    }),
  }),

  // ── 智能分析 ──
  analysis: router({
    quickScore: publicProcedure
      .input(z.object({ lat: z.number(), lng: z.number() }))
      .mutation(async ({ input }) => quickScore(input.lat, input.lng)),

    aiAnalysis: publicProcedure
      .input(z.object({
        lat: z.number(), lng: z.number(),
        userMessage: z.string(), sessionId: z.string(),
        history: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
      }))
      .mutation(async ({ input }) => {
        const score = await quickScore(input.lat, input.lng);
        const systemPrompt = `你是福州市新能源充电桩智能选址助手，专业分析充电桩选址可行性。
当前分析位置：纬度${input.lat.toFixed(4)}，经度${input.lng.toFixed(4)}
快速评分：综合${score.totalScore}/10（${score.grade}）| POI密度${score.scoreBreakdown.poi}/10 | 交通流量${score.scoreBreakdown.traffic}/10 | 可达性${score.scoreBreakdown.accessibility}/10 | 竞争${score.scoreBreakdown.competition}/10
禁区冲突：${score.exclusionConflicts.length > 0 ? score.exclusionConflicts.join("、") : "无"}
周边POI：${score.nearbyPois.slice(0, 5).map(p => `${p.name}(${p.dist}km)`).join("、")}
周边道路：${score.nearbyRoads.slice(0, 3).map(r => `${r.name}(日均${r.dailyFlow}辆)`).join("、")}
请基于以上数据，用专业简洁的中文回答用户问题，给出具体可行的建议。`;

        const messages = [
          { role: "system" as const, content: systemPrompt },
          ...(input.history?.slice(-6).map(h => ({ role: h.role as "user" | "assistant", content: h.content })) ?? []),
          { role: "user" as const, content: input.userMessage },
        ];
        let content: string;
        const withLLMTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
          Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
        try {
          const response = await withLLMTimeout(invokeLLM({ messages }), 25000);
          content = String(response.choices[0]?.message?.content ?? "分析完成，请查看评分结果。");
        } catch {
          // LLM不可用时，使用本地规则引擎生成分析内容
          const q = input.userMessage.toLowerCase();
          if (q.includes("适合") || q.includes("建议") || q.includes("可行")) {
            content = `## 选址可行性分析\n\n**综合评分：${score.totalScore}/10（${score.grade}）**\n\n根据系统评估，该位置${score.totalScore >= 8 ? "**非常适合**建设充电桩" : score.totalScore >= 6 ? "**基本适合**建设充电桩，但需关注部分风险" : "**暂不推荐**建设充电桩，建议选择评分更高的位置"}。\n\n**各维度评分：**\n- POI密度：${score.scoreBreakdown.poi}/10\n- 交通流量：${score.scoreBreakdown.traffic}/10\n- 可达性：${score.scoreBreakdown.accessibility}/10\n- 竞争分析：${score.scoreBreakdown.competition}/10\n\n${score.exclusionConflicts.length > 0 ? "⚠️ **注意：** 该位置与以下禁区存在冲突：" + score.exclusionConflicts.join("、") : "✅ 无禁区冲突"}\n\n**周边POI：** ${score.nearbyPois.slice(0, 5).map((p: any) => p.name + "(" + p.dist + "km)").join("、")}`;
          } else if (q.includes("poi") || q.includes("周边") || q.includes("需求")) {
            content = `## 周边POI分析\n\n**周边主要兴趣点（${score.nearbyPois.length}个）：**\n\n${score.nearbyPois.slice(0, 8).map((p: any, i: number) => (i+1) + ". **" + p.name + "**（" + p.categoryDisplay + "）- 距离" + p.dist + "km，日均流量" + (p.dailyFlow?.toLocaleString() ?? "N/A") + "人次，需求评分" + p.evDemandScore + "/10").join("\n")}\n\n**分析结论：** 该区域POI密度评分${score.scoreBreakdown.poi}/10，${score.scoreBreakdown.poi >= 7 ? "周边人流量充足，充电需求旺盛" : "周边人流量一般，建议进一步调研"}。`;
          } else if (q.includes("竞争") || q.includes("充电站")) {
            content = `## 竞争态势分析\n\n**竞争评分：${score.scoreBreakdown.competition}/10**\n\n${score.scoreBreakdown.competition >= 8 ? "该区域现有充电站较少，市场竞争压力小，是建站的有利条件。" : score.scoreBreakdown.competition >= 6 ? "该区域有少量充电站，竞争适中，建议差异化运营。" : "该区域充电站密度较高，竞争激烈，建议评估盈利空间后谨慎决策。"}\n\n**建议：** ${score.scoreBreakdown.competition >= 7 ? "可考虑建设大功率快充站，满足市场空白" : "建议提升服务质量和充电速度，形成差异化竞争优势"}。`;
          } else if (q.includes("交通") || q.includes("流量")) {
            content = `## 交通流量分析\n\n**交通评分：${score.scoreBreakdown.traffic}/10**\n\n**周边主要道路：**\n${score.nearbyRoads.slice(0, 5).map((r: any, i: number) => (i+1) + ". **" + r.name + "** - 日均流量" + (r.dailyFlow?.toLocaleString() ?? "N/A") + "辆，新能源占比" + (((r.evRatio ?? 0) * 100).toFixed(0)) + "%，高峰时段" + (r.peakHour ?? "N/A")).join("\n")}\n\n**分析结论：** ${score.scoreBreakdown.traffic >= 7 ? "该区域交通流量充足，新能源车占比较高，充电需求有保障。" : "该区域交通流量一般，建议结合周边规划综合评估。"}`;
          } else {
            content = `## 智能选址分析\n\n**位置：** 纬度${input.lat.toFixed(4)}，经度${input.lng.toFixed(4)}\n**综合评分：${score.totalScore}/10（${score.grade}）**\n\n| 评分维度 | 得分 | 说明 |\n|---------|------|------|\n| POI密度 | ${score.scoreBreakdown.poi}/10 | 周边兴趣点密度 |\n| 交通流量 | ${score.scoreBreakdown.traffic}/10 | 道路车流量 |\n| 可达性 | ${score.scoreBreakdown.accessibility}/10 | 交通便利程度 |\n| 竞争分析 | ${score.scoreBreakdown.competition}/10 | 市场竞争程度 |\n\n${score.exclusionConflicts.length > 0 ? "⚠️ **禁区冲突：**" + score.exclusionConflicts.join("、") : "✅ 无禁区冲突"}\n\n**综合建议：** ${score.totalScore >= 8 ? "强烈推荐在此建设充电桩，各项指标均表现优秀。" : score.totalScore >= 6 ? "可以考虑在此建设充电桩，建议重点关注评分较低的维度。" : "不建议在此建设充电桩，请选择综合评分更高的位置。"}`;
          }
        }

        const db = await getDb();
        if (db) {
          const ahValues = {
            sessionId: input.sessionId, lat: input.lat, lng: input.lng,
            userMessage: String(input.userMessage), aiResponse: String(content),
            totalScore: score.totalScore,
            scoreBreakdown: JSON.stringify(score.scoreBreakdown),
          };
          await db.insert(analysisHistory).values(ahValues);
          await db.insert(memorySessions).values({
            sessionId: input.sessionId,
            label: `会话 ${new Date().toLocaleDateString("zh-CN")}`,
          }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
        }
        return { content, score };
      }),

    getHistory: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(analysisHistory)
          .where(eq(analysisHistory.sessionId, input.sessionId))
          .orderBy(desc(analysisHistory.createdAt)).limit(50);
      }),
  }),

  // ── 报告 ──
  reports: router({
    generate: publicProcedure
      .input(z.object({ lat: z.number(), lng: z.number(), address: z.string(), sessionId: z.string() }))
      .mutation(async ({ input }) => {
        const score = await quickScore(input.lat, input.lng);
        const prompt = `请为以下充电桩选址生成专业的分析报告（Markdown格式，结构清晰）：
位置：${input.address}（${input.lat.toFixed(4)}, ${input.lng.toFixed(4)}）
综合评分：${score.totalScore}/10（${score.grade}）
各维度：POI密度${score.scoreBreakdown.poi}/10、交通流量${score.scoreBreakdown.traffic}/10、可达性${score.scoreBreakdown.accessibility}/10、竞争${score.scoreBreakdown.competition}/10
周边POI：${score.nearbyPois.slice(0, 6).map(p => `${p.name}(${p.categoryDisplay},${p.dist}km)`).join("、")}
周边道路：${score.nearbyRoads.slice(0, 4).map(r => `${r.name}(日均${r.dailyFlow}辆,新能源${(r.evRatio * 100).toFixed(0)}%)`).join("、")}
禁区冲突：${score.exclusionConflicts.length > 0 ? score.exclusionConflicts.join("、") : "无"}
请生成包含：1.选址概述 2.评分详析 3.周边环境 4.竞争态势 5.风险评估 6.综合建议 的完整报告。`;

        let reportContent: string;
        const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
          Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
        try {
          const response = await withTimeout(invokeLLM({
            messages: [
              { role: "system", content: "你是专业的新能源充电桦选址顾问，生成结构清晰、数据详实的选址分析报告。" },
              { role: "user", content: prompt },
            ],
          }), 25000);
          reportContent = String(response.choices[0]?.message?.content ?? "报告生成失败，请重试。");
        } catch {
          // LLM不可用时，使用本地模板生成报告
          const s = score;
          const poiGrade = (v: number) => v >= 8 ? "优秀" : v >= 6 ? "良好" : "一般";
          const poiList = s.nearbyPois.slice(0, 8).map((p: any, i: number) =>
            (i+1) + ". **" + p.name + "**（" + p.categoryDisplay + "）- 距离" + p.dist + "km，日均流量" + (p.dailyFlow?.toLocaleString() ?? "N/A") + "人次"
          ).join("\n");
          const roadList = s.nearbyRoads.slice(0, 5).map((r: any, i: number) =>
            (i+1) + ". **" + r.name + "** - 日均流量" + (r.dailyFlow?.toLocaleString() ?? "N/A") + "辆，新能源占比" + (((r.evRatio ?? 0) * 100).toFixed(0)) + "%，高峰时段" + (r.peakHour ?? "N/A")
          ).join("\n");
          const conflictText = s.exclusionConflicts.length > 0
            ? "⚠️ **禁区冲突警告：** 该位置与以下禁区存在冲突，**不建议建站**：\n" + s.exclusionConflicts.join("、")
            : "✅ **无禁区冲突：** 该位置不在任何禁止建设区域内。";
          const riskItems = [
            s.totalScore < 6 ? "- 综合评分偏低，建议重新选址" : "",
            s.scoreBreakdown.poi < 5 ? "- 周边POI密度不足，充电需求可能有限" : "",
            s.scoreBreakdown.traffic < 5 ? "- 交通流量较低，建议评估实际需求" : "",
            s.scoreBreakdown.competition < 5 ? "- 周边竞争激烈，需差异化运营策略" : "",
            (s.totalScore >= 7 && s.exclusionConflicts.length === 0) ? "- 整体风险较低，建议推进可行性研究" : "",
          ].filter(Boolean).join("\n");
          const suggestion = s.totalScore >= 8
            ? "**强烈推荐建站。** 该位置综合评分" + s.totalScore + "/10，各项指标均表现优秀。建议：\n1. 规划建设大功率快充桩（60kW以上），满足商业区高频充电需求\n2. 配置8-12个充电枪位，满足高峰期需求\n3. 建议尽快推进选址报批流程"
            : s.totalScore >= 6
            ? "**可以考虑建站。** 该位置综合评分" + s.totalScore + "/10，基本满足建站条件。建议：\n1. 建设中等规模充电站（4-8枪位）\n2. 重点关注" + (s.scoreBreakdown.poi < 7 ? "提升周边引流" : "") + (s.scoreBreakdown.traffic < 7 ? "交通接入优化" : "") + "等方面\n3. 建议开展为期1个月的实地调研后再决策"
            : "**暂不推荐建站。** 该位置综合评分" + s.totalScore + "/10，存在明显短板。建议：\n1. 在半径2km范围内寻找评分更高的备选位置\n2. 重点关注评分在8分以上的POI密集区域\n3. 参考系统推荐的高需求POI排行榜进行选址";
          reportContent = [
            "# 福州新能源充电桩选址分析报告",
            "",
            "## 一、选址概述",
            "",
            "**位置：** " + input.address + "（" + input.lat.toFixed(4) + ", " + input.lng.toFixed(4) + "）",
            "**报告生成时间：** " + new Date().toLocaleString("zh-CN"),
            "**综合评分：** " + s.totalScore + "/10（" + s.grade + "）",
            "",
            "本报告基于福州市新能源充电桩智能选址系统，综合分析该位置的POI密度、交通流量、可达性及竞争态势，为充电桩建设决策提供数据支撑。",
            "",
            "---",
            "",
            "## 二、评分详析",
            "",
            "| 评分维度 | 得分 | 权重 | 评级 |",
            "|---------|------|------|------|",
            "| POI密度 | " + s.scoreBreakdown.poi + "/10 | 35% | " + poiGrade(s.scoreBreakdown.poi) + " |",
            "| 交通流量 | " + s.scoreBreakdown.traffic + "/10 | 30% | " + poiGrade(s.scoreBreakdown.traffic) + " |",
            "| 可达性 | " + s.scoreBreakdown.accessibility + "/10 | 20% | " + poiGrade(s.scoreBreakdown.accessibility) + " |",
            "| 竞争分析 | " + s.scoreBreakdown.competition + "/10 | 15% | " + poiGrade(s.scoreBreakdown.competition) + " |",
            "| **综合得分** | **" + s.totalScore + "/10** | 100% | **" + s.grade + "** |",
            "",
            "---",
            "",
            "## 三、周边环境分析",
            "",
            "**周边主要POI（" + s.nearbyPois.length + "个）：**",
            "",
            poiList,
            "",
            "---",
            "",
            "## 四、交通态势分析",
            "",
            "**周边主要道路：**",
            "",
            roadList,
            "",
            "---",
            "",
            "## 五、风险评估",
            "",
            conflictText,
            "",
            "**主要风险点：**",
            riskItems,
            "",
            "---",
            "",
            "## 六、综合建议",
            "",
            suggestion,
            "",
            "---",
            "",
            "*本报告由福州新能源充电桩智能选址平台自动生成，数据基于福州市实地调研数据。*",
          ].join("\n");
        }

        const db = await getDb();
        if (db) {
          const rhValues = {
            sessionId: input.sessionId, address: input.address,
            lat: input.lat, lng: input.lng, totalScore: score.totalScore,
            reportContent: String(reportContent), scoreBreakdown: JSON.stringify(score.scoreBreakdown),
          };
          await db.insert(reportHistory).values(rhValues);
        }
        return { reportContent, score, address: input.address };
      }),

    list: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(reportHistory)
          .where(eq(reportHistory.sessionId, input.sessionId))
          .orderBy(desc(reportHistory.createdAt)).limit(20);
      }),
  }),

  // ── 历史记忆 ──
  memory: router({
    getSessions: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(memorySessions).orderBy(desc(memorySessions.updatedAt)).limit(20);
    }),

    clearSession: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await db.delete(analysisHistory).where(eq(analysisHistory.sessionId, input.sessionId));
        await db.delete(reportHistory).where(eq(reportHistory.sessionId, input.sessionId));
        await db.delete(memorySessions).where(eq(memorySessions.sessionId, input.sessionId));
        return { success: true };
      }),

    getKnowledgeGraph: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { nodes: [], links: [] };
      const [pois, roads, zones, stations] = await Promise.all([
        db.select().from(poiData).limit(20),
        db.select().from(trafficFlow).limit(10),
        db.select().from(exclusionZones).limit(8),
        db.select().from(chargingStations),
      ]);
      const nodes: { id: string; name: string; category: number; value: number }[] = [];
      const links: { source: string; target: string; relation: string }[] = [];

      pois.forEach(p => nodes.push({ id: `poi_${p.id}`, name: p.name, category: 0, value: p.evDemandScore }));
      roads.forEach(r => nodes.push({ id: `road_${r.id}`, name: r.roadName, category: 1, value: Math.min(10, r.dailyFlow / 8000) }));
      zones.forEach(z => nodes.push({ id: `zone_${z.id}`, name: z.name, category: 2, value: 5 }));
      stations.forEach(s => nodes.push({ id: `station_${s.id}`, name: s.name, category: 3, value: s.connectors }));

      pois.forEach(p => {
        roads.forEach(r => {
          if (haversine(p.latitude, p.longitude, r.centerLat, r.centerLng) < 2.0)
            links.push({ source: `poi_${p.id}`, target: `road_${r.id}`, relation: "邻近道路" });
        });
        stations.forEach(s => {
          if (haversine(p.latitude, p.longitude, s.latitude, s.longitude) < 1.5)
            links.push({ source: `poi_${p.id}`, target: `station_${s.id}`, relation: "服务覆盖" });
        });
      });
      return { nodes, links };
    }),
  }),
});

export type AppRouter = typeof appRouter;
