"""
地图相关API视图
"""
import json
import logging
import math
from django.http import JsonResponse


def _no_store(resp):
    """给 JSON 响应加上“不要缓存”头，避免代理/浏览器持久化。"""
    resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp["Pragma"] = "no-cache"
    return resp
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import POIData, TrafficFlow, ExclusionZone, GeoEntity, CandidateLocation

# 高德环境语义检查 + 城市级真实数据拉取（2026-04 新增）
try:
    from fuzhou_ev_charging.amap_service import (
        environment_check as amap_environment_check,
        fetch_city_pois as amap_fetch_city_pois,
        fetch_city_charging_stations as amap_fetch_city_stations,
        fetch_city_exclusions as amap_fetch_city_exclusions,
    )
except Exception:  # pragma: no cover
    amap_environment_check = None
    amap_fetch_city_pois = None
    amap_fetch_city_stations = None
    amap_fetch_city_exclusions = None

logger = logging.getLogger(__name__)


def _amap_confirms_land(amap_info):
    """重写高德“陆地确认”判定，避免原“... or amap_info and not is_restricted”优先级误报。"""
    if not amap_info:
        return False
    if amap_info.get("is_restricted"):
        return False
    if amap_info.get("is_water") or amap_info.get("is_forest"):
        return False
    return bool(amap_info.get("land_aois") or amap_info.get("land_pois") or amap_info.get("address"))


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def point_in_polygon(lat, lng, polygon_coords):
    """射线法判断点是否在多边形内。polygon_coords 格式：[[lng,lat], ...] (GeoJSON顺序)"""
    n = len(polygon_coords)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon_coords[i][0], polygon_coords[i][1]  # lng, lat
        xj, yj = polygon_coords[j][0], polygon_coords[j][1]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def check_zone_conflict(lat, lng, zone):
    """多边形优先 + 圆形兜底的禁区冲突检测"""
    # 优先使用多边形边界（精确）
    try:
        boundary = json.loads(zone.boundary_json)
        if boundary and boundary.get('type') == 'Polygon':
            coords = boundary['coordinates'][0]
            if point_in_polygon(lat, lng, coords):
                return True
    except Exception:
        pass
    # 兜底：圆形距离检测
    dist = haversine(lat, lng, zone.center_lat, zone.center_lng)
    return dist <= zone.radius_km


def geo_entities(request):
    """获取地理实体列表"""
    entity_type = request.GET.get('type', '')
    qs = GeoEntity.objects.all()
    if entity_type:
        qs = qs.filter(entity_type=entity_type)
    data = [{"id": e.id, "name": e.name, "type": e.entity_type, "lat": e.latitude, "lng": e.longitude, "district": e.district} for e in qs[:200]]
    return _no_store(JsonResponse({"data": data, "total": len(data)}))


def poi_list(request):
    """获取POI数据列表（2026-04：数据源改为高德 V3 Web 服务，覆盖整个福州市）

    支持的查询参数保持向后兼容：
        - category: 按前端 category key 过滤
        - district: 按行政区名包含过滤（高德 adname）
        - lat/lng/radius: 以选点为中心筛选半径内 POI
    """
    category = request.GET.get('category', '')
    district = request.GET.get('district', '')
    lat = request.GET.get('lat')
    lng = request.GET.get('lng')
    radius = float(request.GET.get('radius', 2.0))
    # source=local 时强制走数据库 POIData（精选 59 条带评分的种子数据），
    # 用于数据屏 / 排行榜 / 分布图等需要稳定评分梯度的场景；
    # 否则默认走数据库优先（保证 ev_demand_score 有效），仅在数据库为空时降级到高德 raw。
    source = request.GET.get('source', 'local')

    def _from_local():
        qs = POIData.objects.all()
        return [{
            "id": p.id, "name": p.name, "category": p.category,
            "category_display": p.get_category_display(),
            "lat": p.latitude, "lng": p.longitude, "district": p.district,
            "daily_flow": p.daily_flow, "ev_demand_score": p.ev_demand_score,
            "influence_weight": p.influence_weight,
            "type": "", "typecode": "", "address": "", "adname": p.district,
        } for p in qs]

    pois: list = []
    used_source = "local"
    if source == "local":
        pois = _from_local()
    else:
        if amap_fetch_city_pois is not None:
            try:
                pois = amap_fetch_city_pois(city="福州", limit_per_cat=60) or []
                used_source = "amap-v3"
            except Exception as e:
                logger.warning("amap_fetch_city_pois failed: %s", e)
                pois = []
        if not pois:
            pois = _from_local()
            used_source = "local"

        # 关键：哪怕走的是高德 raw 数据，也确保 ev_demand_score 是数字（防止前端显示 0）
        for p in pois:
            try:
                if not p.get("ev_demand_score") or float(p.get("ev_demand_score") or 0) <= 0:
                    # 简单兜底：按 daily_flow 给 5-9 分
                    df = float(p.get("daily_flow") or 5000)
                    p["ev_demand_score"] = round(min(9.5, 5.0 + df / 10000), 1)
            except Exception:
                p["ev_demand_score"] = 6.0

    # 过滤：category
    if category:
        pois = [p for p in pois if (p.get("category") or "") == category]
    # 过滤：district
    if district:
        pois = [p for p in pois if district in (p.get("district") or p.get("adname") or "")]

    # 过滤：半径
    if lat and lng:
        lat, lng = float(lat), float(lng)
        enriched = []
        for p in pois:
            try:
                d = haversine(lat, lng, float(p["lat"]), float(p["lng"]))
            except Exception:
                continue
            if d <= radius:
                pp = dict(p)
                pp["distance_km"] = round(d, 3)
                enriched.append(pp)
        enriched.sort(key=lambda x: x["distance_km"])
        pois = enriched

    return _no_store(JsonResponse({"data": pois, "total": len(pois), "source": used_source}))


def traffic_flow(request):
    """获取交通流量数据"""
    district = request.GET.get('district', '')
    road_level = request.GET.get('road_level', '')
    qs = TrafficFlow.objects.all()
    if district:
        qs = qs.filter(district__icontains=district)
    if road_level:
        qs = qs.filter(road_level=road_level)

    data = []
    for t in qs:
        item = {
            "id": t.id, "road_name": t.road_name,
            "road_level": t.road_level, "road_level_display": {
                'primary': '主干道', 'secondary': '次干道', 'highway': '高速公路',
                'expressway': '高速公路', 'urban_expressway': '城市快速路',
                'main_road': '主干道', 'secondary_road': '次干道'
            }.get(t.road_level, t.get_road_level_display()),
            "start_lat": t.start_lat, "start_lng": t.start_lng,
            "end_lat": t.end_lat, "end_lng": t.end_lng,
            "center_lat": t.center_lat, "center_lng": t.center_lng,
            "daily_flow": t.daily_flow, "peak_flow": t.peak_flow,
            "ev_ratio": t.ev_ratio, "heat_weight": t.heat_weight,
            "district": t.district,
        }
        if t.path_json:
            try:
                item["path"] = json.loads(t.path_json)
            except:
                item["path"] = [[t.start_lat, t.start_lng], [t.center_lat, t.center_lng], [t.end_lat, t.end_lng]]
        else:
            item["path"] = [[t.start_lat, t.start_lng], [t.center_lat, t.center_lng], [t.end_lat, t.end_lng]]
        data.append(item)

    return _no_store(JsonResponse({"data": data, "total": len(data)}))


def exclusion_zones(request):
    """获取禁止选址区域。

    默认 source=local 只返回本地人工维护的禁区（~8 个，用于数据屏统计与列表）；
    source=full 才拼接高德 V3 水域/森林/机场 POI（~100+，用于地图画圈）。
    """
    source = request.GET.get('source', 'local')
    data: list = []

    # 1) 高德真实数据：河流/湖泊/水库/森林公园/机场
    if source == 'full' and amap_fetch_city_exclusions is not None:
        try:
            for z in amap_fetch_city_exclusions(city="福州") or []:
                data.append({
                    "id": f"amap_{z['id']}",
                    "name": z["name"],
                    "zone_type": z["zone_type"],
                    "zone_type_display": z["zone_type_display"],
                    "center_lat": z["center_lat"],
                    "center_lng": z["center_lng"],
                    "radius_km": z["radius_km"],
                    "description": z.get("description", ""),
                    "boundary": z.get("boundary"),
                    "source": "amap-v3",
                })
        except Exception as e:
            logger.warning("amap_fetch_city_exclusions failed: %s", e)

    # 2) 本地补充：保留原 ExclusionZone 作为人工兜底（例如军事/医疗重地）
    for z in ExclusionZone.objects.all():
        item = {
            "id": f"local_{z.id}", "name": z.name,
            "zone_type": z.zone_type, "zone_type_display": z.get_zone_type_display(),
            "center_lat": z.center_lat, "center_lng": z.center_lng,
            "radius_km": z.radius_km, "description": z.description,
            "source": "local",
        }
        try:
            item["boundary"] = json.loads(z.boundary_json)
        except Exception:
            item["boundary"] = None
        data.append(item)

    return _no_store(JsonResponse({"data": data, "total": len(data), "source": source}))


def check_location(request):
    """检查位置是否在禁止选址区域内

    研判顺序（2026-04 升级）：
        1. 本地 ExclusionZone 圆形约束（侍兼容，原有行为）
        2. 调用高德 V3 Web 服务做语义级别的 "水域/河道/林地" 检测
           （任一命中即视为不可选点，满足用户需求 "选点不能选在水里"）
    """
    if request.method == 'POST':
        body = json.loads(request.body)
        lat, lng = float(body.get('lat')), float(body.get('lng'))
    else:
        lat, lng = float(request.GET.get('lat')), float(request.GET.get('lng'))

    local_conflicts = []

    # 1) 本地禁区：多边形精确检测 + 圆形兜底
    for zone in ExclusionZone.objects.all():
        if check_zone_conflict(lat, lng, zone):
            dist = haversine(lat, lng, zone.center_lat, zone.center_lng)
            local_conflicts.append({
                "name": zone.name,
                "type": zone.get_zone_type_display(),
                "zone_type": zone.zone_type,
                "distance_km": round(dist, 3),
                "source": "local_zone",
            })

    # 2) 高德实时语义检测（水域 / 林地）
    amap_info = None
    if amap_environment_check is not None:
        try:
            amap_info = amap_environment_check(lat, lng)
        except Exception as e:
            logger.warning("amap environment_check failed: %s", e)

    # 3) 合并冲突列表：
    #    - 对于本地水域禁区：若高德明确判定为陆地（is_water=False且has_land_context），则不计入冲突
    #    - 对于非水域禁区（林地/保护区/军事区等）：直接计入冲突
    #    - 高德判定为水域/林地：将高德冲突加入
    conflicts = []
    amap_is_land = _amap_confirms_land(amap_info)

    for c in local_conflicts:
        # 水域禁区：高德确认为陆地则跳过（高德权威更高）
        if c["zone_type"] == "water" and amap_is_land:
            continue
        # 其他禁区（林地/保护区/军事区等）或高德未返回陆地确认：保留冲突
        conflicts.append({k: v for k, v in c.items() if k != "zone_type"})

    if amap_info and amap_info.get("is_restricted"):
        if amap_info.get("is_water"):
            conflicts.append({
                "name": amap_info.get("reason") or "高德识别：水域/河道",
                "type": "水域",
                "distance_km": 0.0,
                "source": "amap",
            })
        elif amap_info.get("is_forest"):
            conflicts.append({
                "name": amap_info.get("reason") or "高德识别：林地/保护区",
                "type": "林地",
                "distance_km": 0.0,
                "source": "amap",
            })

    is_valid = len(conflicts) == 0
    resp = {
        "lat": lat, "lng": lng,
        "is_valid": is_valid,
        "conflicts": conflicts,
        "message": (
            "位置有效，可以选址"
            if is_valid else f"该位置位于禁止区域内：{conflicts[0]['name']}"
        ),
    }
    if amap_info:
        resp["amap"] = {
            "address": amap_info.get("address", ""),
            "district": amap_info.get("district", ""),
            "is_water": amap_info.get("is_water", False),
            "is_forest": amap_info.get("is_forest", False),
            "reason": amap_info.get("reason", ""),
            "source": amap_info.get("source", "amap-v3"),
        }
    return JsonResponse(resp)


def heatmap_data(request):
    """获取热力图数据（主干道流量热力点）"""
    roads = TrafficFlow.objects.all().order_by('-daily_flow')
    heatmap_points = []
    for road in roads:
        # 优先使用path_json中的路径点
        path_points = None
        if road.path_json:
            try:
                path_points = json.loads(road.path_json)
            except:
                pass
        
        if path_points and len(path_points) >= 2:
            # 使用实际路径点
            for pt in path_points:
                heatmap_points.append({
                    "lat": round(pt[0], 6),
                    "lng": round(pt[1], 6),
                    "weight": road.heat_weight,
                    "ev_ratio": road.ev_ratio,
                    "flow": road.daily_flow,
                    "road_name": road.road_name,
                })
        else:
            # 沿路段插値生成热力点
            steps = 6
            for i in range(steps + 1):
                t = i / steps
                point_lat = road.start_lat + (road.end_lat - road.start_lat) * t
                point_lng = road.start_lng + (road.end_lng - road.start_lng) * t
                heatmap_points.append({
                    "lat": round(point_lat, 6),
                    "lng": round(point_lng, 6),
                    "weight": road.heat_weight,
                    "ev_ratio": road.ev_ratio,
                    "flow": road.daily_flow,
                    "road_name": road.road_name,
                })

    return _no_store(JsonResponse({"data": heatmap_points, "total": len(heatmap_points)}))


def candidates_list(request):
    """获取候选位置/现有充电站列表。

    默认 source=local 只返回本地 CandidateLocation（13 条 status 为 existing/candidate）；
    source=full 才拼接高德 V3 现有充电站数据，用于地图展示所有站点。
    """
    from .models import CandidateLocation
    source = request.GET.get('source', 'local')
    data: list = []

    # 1) 高德真实充电站
    if source == 'full' and amap_fetch_city_stations is not None:
        try:
            for s in amap_fetch_city_stations(city="福州", max_pages=4) or []:
                data.append({
                    "id": f"amap_{s['id']}",
                    "name": s["name"],
                    "lat": s["lat"],
                    "lng": s["lng"],
                    "status": "existing",
                    "total_score": 0,
                    "address": s.get("address", ""),
                    "operator": s.get("operator", ""),
                    "district": s.get("adname", ""),
                    "type": s.get("type", ""),
                    "typecode": s.get("typecode", ""),
                    "source": "amap-v3",
                })
        except Exception as e:
            logger.warning("amap_fetch_city_stations failed: %s", e)

    # 2) 本地 CandidateLocation（候选/规划中）
    for c in CandidateLocation.objects.all():
        data.append({
            "id": f"local_{c.id}",
            "name": c.name,
            "lat": c.latitude,
            "lng": c.longitude,
            "status": c.status,
            "total_score": c.total_score,
            "address": c.address,
            "source": "local",
        })

    return _no_store(JsonResponse({"data": data, "total": len(data), "source": source}))


@csrf_exempt
@require_http_methods(["GET", "POST"])
def quick_score_location(request):
    """快速评分：基于POI密度、交通流量、可达性、竞争分析（支持GET和POST）"""
    try:
        if request.method == 'GET':
            lat = float(request.GET.get('lat'))
            lng = float(request.GET.get('lng'))
        else:
            body = json.loads(request.body)
            lat = float(body.get('lat'))
            lng = float(body.get('lng'))
    except (ValueError, TypeError, json.JSONDecodeError):
        return JsonResponse({"error": "Invalid parameters"}, status=400)

    # 1. 检查禁止区域（与 check_location 保持一致的合并逻辑）
    zones = ExclusionZone.objects.all()
    local_conflicts = []
    for zone in zones:
        if check_zone_conflict(lat, lng, zone):
            dist = haversine(lat, lng, zone.center_lat, zone.center_lng)
            local_conflicts.append({
                "name": zone.name, "type": zone.get_zone_type_display(),
                "zone_type": zone.zone_type, "distance_km": round(dist, 3),
            })

    amap_info = None
    if amap_environment_check is not None:
        try:
            amap_info = amap_environment_check(lat, lng)
        except Exception as e:
            logger.warning("amap environment_check failed in quick_score: %s", e)

    # 合并冲突：高德确认陆地时，本地水域禁区不计入冲突
    conflicts = []
    amap_is_land = _amap_confirms_land(amap_info)

    for c in local_conflicts:
        if c["zone_type"] == "water" and amap_is_land:
            continue
        conflicts.append({k: v for k, v in c.items() if k != "zone_type"})

    if amap_info and amap_info.get("is_restricted"):
        if amap_info.get("is_water"):
            conflicts.append({
                "name": amap_info.get("reason") or "高德识别：水域/河道",
                "type": "水域", "distance_km": 0.0,
            })
        elif amap_info.get("is_forest"):
            conflicts.append({
                "name": amap_info.get("reason") or "高德识别：林地/保护区",
                "type": "林地", "distance_km": 0.0,
            })

    if conflicts:
        payload = {
            "is_valid": False,
            "conflicts": conflicts,
            "message": f"该位置位于禁止区域内：{conflicts[0]['name']}",
            "total_score": 0,
            "poi_score": 0,
            "traffic_score": 0,
            "accessibility_score": 0,
            "competition_score": 0,
        }
        if amap_info:
            payload["amap"] = {
                "address": amap_info.get("address", ""),
                "district": amap_info.get("district", ""),
                "is_water": amap_info.get("is_water", False),
                "is_forest": amap_info.get("is_forest", False),
                "reason": amap_info.get("reason", ""),
                "source": amap_info.get("source", "amap-v3"),
            }
        return JsonResponse(payload)

    # 2. POI密度评分（2km范围内）
    all_pois = POIData.objects.all()
    nearby_pois = []
    for p in all_pois:
        dist = haversine(lat, lng, p.latitude, p.longitude)
        if dist <= 2.0:
            nearby_pois.append({
                "id": p.id, "name": p.name, "category": p.category,
                "category_display": p.get_category_display(),
                "lat": p.latitude, "lng": p.longitude,
                "ev_demand_score": p.ev_demand_score,
                "daily_flow": p.daily_flow,
                "distance_km": round(dist, 3)
            })
    nearby_pois.sort(key=lambda x: x['distance_km'])

    poi_count = len(nearby_pois)
    avg_ev_demand = sum(p['ev_demand_score'] for p in nearby_pois) / poi_count if poi_count > 0 else 0
    poi_score = min(10.0, (poi_count / 8.0) * 5.0 + avg_ev_demand * 0.5)

    # 3. 交通流量评分（3km范围内主干道）
    all_roads = TrafficFlow.objects.all()
    nearby_roads = []
    for r in all_roads:
        dist = haversine(lat, lng, r.center_lat, r.center_lng)
        if dist <= 3.0:
            nearby_roads.append({
                "road_name": r.road_name, "road_level": r.road_level,
                "daily_flow": r.daily_flow, "heat_weight": r.heat_weight,
                "distance_km": round(dist, 3)
            })
    nearby_roads.sort(key=lambda x: x['distance_km'])

    if nearby_roads:
        max_flow = max(r['daily_flow'] for r in nearby_roads)
        traffic_score = min(10.0, (max_flow / 60000.0) * 10.0)
    else:
        traffic_score = 3.0

    # 4. 可达性评分（基于周边道路等级）
    highway_count = sum(1 for r in nearby_roads if r['road_level'] in ['expressway', 'urban_expressway', 'highway'])
    main_road_count = sum(1 for r in nearby_roads if r['road_level'] in ['main_road', 'primary'])
    accessibility_score = min(10.0, highway_count * 2.0 + main_road_count * 1.5 + 4.0)

    # 5. 竞争分析（现有充电站数量）
    from maps.models import CandidateLocation
    existing_stations = CandidateLocation.objects.filter(status='existing')
    competition_count = 0
    for s in existing_stations:
        dist = haversine(lat, lng, s.latitude, s.longitude)
        if dist <= 1.5:
            competition_count += 1
    competition_score = max(0.0, 10.0 - competition_count * 2.5)

    # 综合评分（加权平均）
    total_score = round(
        poi_score * 0.35 +
        traffic_score * 0.30 +
        accessibility_score * 0.20 +
        competition_score * 0.15, 2
    )

    # 评级
    if total_score >= 8.5:
        rating = "优秀·强烈推荐"
        rating_level = "excellent"
    elif total_score >= 7.0:
        rating = "良好·推荐"
        rating_level = "good"
    elif total_score >= 5.5:
        rating = "一般·可考虑"
        rating_level = "fair"
    else:
        rating = "较差·不推荐"
        rating_level = "poor"

    return JsonResponse({
        "is_valid": True,
        "lat": lat, "lng": lng,
        "total_score": total_score,
        "rating": rating,
        "rating_level": rating_level,
        # 前端直接读取的顶层字段
        "poi_score": round(poi_score, 2),
        "traffic_score": round(traffic_score, 2),
        "accessibility_score": round(accessibility_score, 2),
        "competition_score": round(competition_score, 2),
        # 兼容旧的 score_breakdown 结构
        "score_breakdown": {
            "poi_density": round(poi_score, 2),
            "traffic_flow": round(traffic_score, 2),
            "accessibility": round(accessibility_score, 2),
            "competition": round(competition_score, 2)
        },
        "nearby_pois": nearby_pois[:10],
        "nearby_roads": nearby_roads[:5],
        "poi_count": poi_count,
        "road_count": len(nearby_roads),
        "message": f"综合评分 {total_score}/10，{rating}"
    })
