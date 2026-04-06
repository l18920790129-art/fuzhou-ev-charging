import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { MapPin, Layers, Eye, EyeOff, Target, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { toast } from "sonner";

const AMAP_KEY = import.meta.env.VITE_AMAP_KEY ?? "";
const AMAP_SECURITY_CODE = import.meta.env.VITE_AMAP_SECURITY_CODE ?? "";

declare global {
  interface Window {
    AMap: any;
    _AMapSecurityConfig: any;
  }
}

function ScorePanel({ score, onClose }: { score: any; onClose: () => void }) {
  if (!score) return null;
  const isBlocked = score.exclusionConflicts?.length > 0;
  const gradeColor = score.totalScore >= 8.5 ? "score-excellent"
    : score.totalScore >= 7 ? "score-good"
    : score.totalScore >= 5.5 ? "score-average"
    : score.totalScore > 0 ? "score-poor" : "score-na";

  return (
    <div
      className="absolute top-4 right-4 w-72 tech-card-glow p-4 z-10"
      style={{ background: "oklch(0.13 0.022 240 / 0.95)", backdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isBlocked ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <CheckCircle className="w-4 h-4 text-accent" />}
          <span className="text-sm font-semibold text-foreground">选址评分</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
      </div>

      {isBlocked ? (
        <div className="p-3 rounded-lg mb-3" style={{ background: "oklch(0.60 0.22 25 / 0.15)", border: "1px solid oklch(0.60 0.22 25 / 0.3)" }}>
          <div className="text-sm font-semibold text-destructive mb-1">⚠ 禁区冲突</div>
          <div className="text-xs text-muted-foreground">{score.exclusionConflicts.join("、")}</div>
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-3">
          <div className={`text-4xl font-bold ${gradeColor}`}>{score.totalScore}</div>
          <div>
            <div className={`text-sm font-semibold ${gradeColor}`}>{score.grade}</div>
            <div className="text-xs text-muted-foreground">综合评分 / 10</div>
          </div>
        </div>
      )}

      {/* 维度评分 */}
      <div className="space-y-2 mb-3">
        {[
          { label: "POI密度", key: "poi", weight: "35%" },
          { label: "交通流量", key: "traffic", weight: "30%" },
          { label: "可达性", key: "accessibility", weight: "20%" },
          { label: "竞争分析", key: "competition", weight: "15%" },
        ].map(({ label, key, weight }) => (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{label} <span className="opacity-50">({weight})</span></span>
              <span className="text-foreground font-medium">{score.scoreBreakdown?.[key] ?? 0}</span>
            </div>
            <div className="score-bar">
              <div className="score-bar-fill" style={{ width: `${(score.scoreBreakdown?.[key] ?? 0) * 10}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* 周边信息 */}
      {score.nearbyPois?.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="text-foreground font-medium">周边POI：</span>
          {score.nearbyPois.slice(0, 3).map((p: any) => `${p.name}(${p.dist}km)`).join("、")}
          {score.nearbyPois.length > 3 && ` 等${score.nearbyPois.length}个`}
        </div>
      )}
    </div>
  );
}

export default function MapAnalysis() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [layers, setLayers] = useState({ poi: true, roads: true, zones: true, stations: true });
  const [selectedScore, setSelectedScore] = useState<any>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const { data: poiResult } = trpc.maps.getPOI.useQuery();
  const { data: trafficResult } = trpc.maps.getTrafficFlow.useQuery();
  const { data: zonesResult } = trpc.maps.getExclusionZones.useQuery();
  const { data: stationsResult } = trpc.maps.getChargingStations.useQuery();
  const scoreMutation = trpc.analysis.quickScore.useMutation();

  const loadAMap = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (window.AMap) { resolve(); return; }
      window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE };
      const script = document.createElement("script");
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.HeatMap`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("高德地图加载失败"));
      document.head.appendChild(script);
    });
  }, []);

  useEffect(() => {
    let map: any;
    loadAMap().then(() => {
      if (!mapRef.current || mapInstance.current) return;
      map = new window.AMap.Map(mapRef.current, {
        zoom: 12,
        center: [119.3012, 26.0756],
        mapStyle: "amap://styles/dark",
        features: ["bg", "road", "building", "point"],
      });
      mapInstance.current = map;
      // 地图初始化完成后触发图层渲染
      map.on('complete', () => setMapReady(true));
      // 备用：如果complete事件没有触发，1.5秒后强制设置
      setTimeout(() => setMapReady(true), 1500);

      map.on("click", async (e: any) => {
        const { lat, lng } = e.lnglat;
        setIsScoring(true);
        try {
          const result = await scoreMutation.mutateAsync({ lat, lng });
          setSelectedScore(result);
          // 添加点击标记
          const marker = new window.AMap.Marker({
            position: [lng, lat],
            content: `<div style="width:14px;height:14px;border-radius:50%;background:oklch(0.62 0.22 200);border:2px solid white;box-shadow:0 0 8px oklch(0.62 0.22 200)"></div>`,
            offset: new window.AMap.Pixel(-7, -7),
          });
          map.add(marker);
          markersRef.current.push(marker);
        } catch (err) {
          toast.error("评分失败，请重试");
        } finally {
          setIsScoring(false);
        }
      });
    }).catch(() => toast.error("地图加载失败，请检查API Key配置"));

    return () => { if (map) map.destroy(); mapInstance.current = null; };
  }, []);

  // 渲染POI图层
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady || !poiResult?.data) return;
    const catColors: Record<string, string> = {
      // 旧分类名
      mall: "#00d4ff", hotel: "#a78bfa", hospital: "#f87171", school: "#34d399",
      office: "#60a5fa", residential: "#fbbf24", transport: "#fb923c",
      gas_station: "#94a3b8", parking: "#c084fc", restaurant: "#f472b6",
      scenic: "#4ade80", government: "#64748b",
      // 新分类名（高德API返回）
      shopping_mall: "#00d4ff", transport_hub: "#fb923c",
    };
    poiResult.data.forEach(poi => {
      if (!layers.poi) return;
      const color = catColors[poi.category] ?? "#94a3b8";
      const marker = new window.AMap.Marker({
        position: [poi.longitude, poi.latitude],
        content: `<div title="${poi.name}" style="width:8px;height:8px;border-radius:50%;background:${color};border:1px solid rgba(255,255,255,0.5);cursor:pointer"></div>`,
        offset: new window.AMap.Pixel(-4, -4),
        extData: { type: "poi", data: poi },
      });
      marker.on("click", (e: any) => e.stopPropagation());
      map.add(marker);
      markersRef.current.push(marker);
    });
  }, [poiResult, layers.poi, mapReady]);

  // 渲染充电站图层
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady || !stationsResult?.data || !layers.stations) return;
    stationsResult.data.forEach(s => {
      const marker = new window.AMap.Marker({
        position: [s.longitude, s.latitude],
        content: `<div title="${s.name}(${s.connectors}枪)" style="width:12px;height:12px;border-radius:2px;background:#fbbf24;border:2px solid rgba(255,255,255,0.8);transform:rotate(45deg);cursor:pointer"></div>`,
        offset: new window.AMap.Pixel(-6, -6),
      });
      map.add(marker);
      markersRef.current.push(marker);
    });
  }, [stationsResult, layers.stations, mapReady]);

  // 渲染禁区图层
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady || !zonesResult?.data || !layers.zones) return;
    zonesResult.data.forEach(zone => {
      const circle = new window.AMap.Circle({
        center: [zone.centerLng, zone.centerLat],
        radius: zone.radiusKm * 1000,
        strokeColor: "#ef4444",
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: "#ef4444",
        fillOpacity: 0.12,
      });
      map.add(circle);
      markersRef.current.push(circle);
    });
  }, [zonesResult, layers.zones, mapReady]);

  // 渲染道路交通流量图层
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapReady || !trafficResult?.data) return;
    if (!layers.roads) return;
    const getTrafficColor = (intensity: number) => {
      if (intensity >= 8) return "#ef4444"; // 高流量 - 红色
      if (intensity >= 6) return "#f97316"; // 中高流量 - 橙色
      if (intensity >= 4) return "#eab308"; // 中等流量 - 黄色
      return "#a78bfa"; // 低流量 - 紫色
    };
    trafficResult.data.forEach((road: any) => {
      if (!road.path || road.path.length < 2) return;
      const intensity = road.trafficIntensity ?? Math.min(10, (road.dailyFlow ?? 0) / 5000);
      const color = getTrafficColor(intensity);
      const weight = Math.max(2, Math.min(6, 2 + intensity * 0.4));
      try {
        const polyline = new window.AMap.Polyline({
          path: road.path.map((p: any) => Array.isArray(p) ? [p[0], p[1]] : [p.lng, p.lat]),
          strokeColor: color,
          strokeOpacity: 0.85,
          strokeWeight: weight,
          strokeStyle: "solid",
          extData: { type: "road", data: road },
        });
        map.add(polyline);
        markersRef.current.push(polyline);
      } catch (e) {
        // 忽略单条道路渲染错误
      }
    });
  }, [trafficResult, layers.roads, mapReady]);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
    // 简单实现：切换时清除并重绘（生产环境可用图层管理）
    if (mapInstance.current) {
      markersRef.current.forEach(m => mapInstance.current.remove(m));
      markersRef.current = [];
    }
  };

  return (
    <div className="flex flex-col h-screen p-4 gap-4">
      {/* 页头 */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">地图选址分析</h1>
          <p className="text-sm text-muted-foreground mt-0.5">点击地图任意位置进行智能选址评分</p>
        </div>
        <div className="flex items-center gap-2">
          {isScoring && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              评分中...
            </div>
          )}
        </div>
      </div>

      {/* 图层控制 */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <span className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="w-3 h-3" />图层：</span>
        {[
          { key: "poi" as const, label: "POI点位", color: "#00d4ff" },
          { key: "roads" as const, label: "道路流量", color: "#a78bfa" },
          { key: "zones" as const, label: "禁止区域", color: "#ef4444" },
          { key: "stations" as const, label: "充电站", color: "#fbbf24" },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
            style={{
              background: layers[key] ? `${color}22` : "oklch(0.18 0.022 240)",
              border: `1px solid ${layers[key] ? color + "66" : "oklch(0.25 0.03 240)"}`,
              color: layers[key] ? color : "oklch(0.55 0.02 240)",
            }}
          >
            {layers[key] ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="w-3 h-3" />
          点击地图评分
        </div>
      </div>

      {/* 地图 */}
      <div className="relative flex-1 rounded-lg overflow-hidden" style={{ border: "1px solid oklch(0.22 0.028 240)" }}>
        <div ref={mapRef} className="w-full h-full" />
        {!AMAP_KEY && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm">
            <div className="text-center p-6">
              <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <div className="text-sm text-muted-foreground">高德地图 API Key 未配置</div>
              <div className="text-xs text-muted-foreground mt-1">请在环境变量中配置 VITE_AMAP_KEY</div>
            </div>
          </div>
        )}
        <ScorePanel score={selectedScore} onClose={() => setSelectedScore(null)} />
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 shrink-0 flex-wrap">
        {[
          { color: "#00d4ff", label: "购物/商业" }, { color: "#f87171", label: "医院" },
          { color: "#fb923c", label: "交通枢纽" }, { color: "#34d399", label: "学校" },
          { color: "#fbbf24", label: "充电站" }, { color: "#ef4444", label: "禁区" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
