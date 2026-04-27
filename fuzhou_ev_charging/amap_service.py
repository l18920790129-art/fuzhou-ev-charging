"""
高德开放平台 Web 服务（V3 REST API）封装
===============================================
仅用于服务端调用。使用 settings.AMAP_WEB_KEY（V3 Web服务 Key）。
该模块被 maps/analysis 视图共用，并提供"水域/林地环境约束检查"能力。

接口依据：https://lbs.amap.com/api/webservice/summary
"""
from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# 缓存 regeo / around 结果，避免重复请求高德（用户频繁选点时会明显加速）
_CACHE: Dict[str, Tuple[float, Any]] = {}
_CACHE_TTL = 300  # 5 分钟


def _get_key() -> str:
    """优先使用 V3 Web 服务 Key（新）"""
    return (
        getattr(settings, "AMAP_WEB_KEY", None)
        or getattr(settings, "AMAP_API_KEY", None)
        or "65e3f384624e6b99a446fba7090c8ea9"
    )


def _cache_get(key: str):
    item = _CACHE.get(key)
    if not item:
        return None
    ts, val = item
    if time.time() - ts > _CACHE_TTL:
        _CACHE.pop(key, None)
        return None
    return val


def _cache_set(key: str, val: Any):
    _CACHE[key] = (time.time(), val)


def _get(url: str, params: Dict[str, Any], timeout: float = 6.0) -> Optional[dict]:
    params = {**params, "key": _get_key()}
    ck = url + "?" + "&".join(f"{k}={params[k]}" for k in sorted(params))
    cached = _cache_get(ck)
    if cached is not None:
        return cached
    try:
        r = requests.get(url, params=params, timeout=timeout)
        data = r.json()
        _cache_set(ck, data)
        return data
    except Exception as e:
        logger.warning("AMap request failed: %s params=%s err=%s", url, params, e)
        return None


# ----------------------------------------------------------------------
# 基础接口
# ----------------------------------------------------------------------
def regeo(lat: float, lng: float, radius: int = 100) -> Optional[dict]:
    """逆地理编码（extensions=all）"""
    return _get(
        "https://restapi.amap.com/v3/geocode/regeo",
        {
            "location": f"{lng:.6f},{lat:.6f}",
            "extensions": "all",
            "radius": radius,
            "roadlevel": 0,
        },
    )


def place_around(
    lat: float,
    lng: float,
    types: str = "",
    keywords: str = "",
    radius: int = 1000,
    offset: int = 20,
) -> Optional[dict]:
    """周边搜索"""
    return _get(
        "https://restapi.amap.com/v3/place/around",
        {
            "location": f"{lng:.6f},{lat:.6f}",
            "types": types,
            "keywords": keywords,
            "radius": radius,
            "offset": offset,
            "page": 1,
            "extensions": "base",
        },
    )


def place_text(keywords: str, city: str = "福州", offset: int = 10) -> Optional[dict]:
    """文本搜索"""
    return _get(
        "https://restapi.amap.com/v3/place/text",
        {"keywords": keywords, "city": city, "citylimit": "true", "offset": offset},
    )


# ----------------------------------------------------------------------
# 环境约束检查（水域 / 林地 / 生态保护区）
# ----------------------------------------------------------------------
# 高德 POI 类型编码参考：
#   190200 自然地名                190204 河流
#   190205 湖泊                    190206 水库 / 水坝
#   110100 风景名胜 / 公园          110101 风景名胜 / 公园广场（含湿地/林地）
_WATER_TYPECODES = {"190200", "190204", "190205", "190206", "190207"}
_FOREST_KEYWORDS = ("森林", "林地", "林场", "自然保护区", "湿地", "国家森林公园")
_WATER_KEYWORDS = (
    "江", "河", "湖", "港", "溪", "渠", "库", "塘", "水域", "水系",
    "运河", "水库", "闽江", "乌龙江", "晋安河", "光明港", "白马河",
)
# 陆地 AOI 大类：住宅、商场、写字楼、学校、医院、政府等 —— 只要命中任一个就强制视为陆地
_LAND_AOI_TYPES = (
    "120000", "120100", "120200", "120201", "120202", "120300", "120301", "120302",
    "120303", "130000", "130100", "140000", "140100", "140200", "140300", "150000",
    "160000", "170000", "170100", "170200", "170300",
)


def _contains_any(text: str, words: Tuple[str, ...]) -> bool:
    return any(w in text for w in words)


# 明确属于陆地的 AOI / POI 大类（命中即肯定陆地，即使名称包含 江/河 等字）
_LAND_AOI_NAME_HINTS = (
    "公园", "广场", "小区", "花园", "家园", "中心", "大厦",
    "商务", "写字楼", "住宅", "楼宇", "商城", "购物",
    "学校", "学院", "医院", "酒店", "饭店", "景区", "风景",
    "街区", "站", "码头", "男子", "女子", "专区",
)
_LAND_POI_TYPE_PREFIXES = (
    "商务住宅", "购物服务", "科教文化", "医疗保健", "住宿服务",
    "公司企业", "政府机构", "楼宇", "餐饮服务", "生活服务",
    "交通设施服务", "金融保险服务", "体育休闲服务", "汽车相关",
    "风景名胜",  # 公园/景区 明确为陆地
)


def _is_land_aoi(aoi: Dict[str, Any]) -> bool:
    name = aoi.get("name", "") or ""
    t = aoi.get("type", "") or ""
    # 【修复】名称含水域关键字（如“闽江公园”“乌龙江大桥水域”“江滨公园”）的 AOI：
    # 它们的几何往往是沿江狭长条带，位于江面的候选点也会命中；
    # 直接排除出“陆地上下文”，否则会把江心点误判为陆地。
    if _contains_any(name, _WATER_KEYWORDS):
        return False
    if t[:6] in _LAND_AOI_TYPES:
        return True
    # 风景名胜 110101 也算陆地（公园 / 广场）
    if t.startswith("1101"):
        return True
    if _contains_any(name, _LAND_AOI_NAME_HINTS):
        return True
    return False


def _is_land_poi(poi: Dict[str, Any]) -> bool:
    name = poi.get("name", "") or ""
    t = poi.get("type", "") or ""
    # 【修复】同上：名称含水域关键字的 POI 不能当作陆地证据
    if _contains_any(name, _WATER_KEYWORDS):
        return False
    if not t:
        return False
    if any(t.startswith(x) for x in _LAND_POI_TYPE_PREFIXES):
        return True
    return False


def environment_check(lat: float, lng: float) -> Dict[str, Any]:
    """
    基于高德 Web 服务 API 的环境约束判断。
    判定逻辑（仅当明显为 "水面" 时才视为不可选点）：
        - 周边有陆地 AOI（公园/小区/商场/写字楼/学校/码头等） → 一律视为陆地
        - 周边有陆地类 POI（住宅/商务/风景名胜等） → 一律视为陆地
        - 否则：若 regeo 返回的 aois/pois 均为空，且地址仅到街道级，同时
          周边 100m 内搜到水域类 POI(190204/190205/…) 或 地址包含水域关键字
          且净化后仍为"街道/清名" → 才判为水域
    """
    rg = regeo(lat, lng, radius=200) or {}
    rgcode = rg.get("regeocode") or {}
    addr = (rgcode.get("formatted_address") or "").strip()
    aois_raw = rgcode.get("aois") or []
    pois_raw = rgcode.get("pois") or []
    addr_comp = rgcode.get("addressComponent") or {}

    aois = [
        {"name": a.get("name", ""), "type": a.get("type", ""), "distance": a.get("distance", "")}
        for a in aois_raw
        if isinstance(a, dict)
    ]
    pois = [p for p in pois_raw if isinstance(p, dict)]

    land_aois = [a for a in aois if _is_land_aoi(a)]
    land_pois = [p.get("name", "") for p in pois if _is_land_poi(p)]

    has_land_context = bool(land_aois or land_pois)

    # 林地/保护区特征（优先判定）
    is_forest = False
    forest_reason = []
    for a in aois:
        if _contains_any(a["name"], _FOREST_KEYWORDS):
            is_forest = True
            forest_reason.append(f"AOI：{a['name']}")
            break
    if not is_forest and addr and _contains_any(addr, _FOREST_KEYWORDS) and not has_land_context:
        is_forest = True
        forest_reason.append(f"地址含林地关键字：{addr}")

    # 水域特征——只有在明确缺少陆地上下文时才判为水域
    is_water = False
    water_reason: List[str] = []
    water_evidence: List[Dict[str, Any]] = []

    # 地址是否已细化到“门牌号/街路/AOI”级别
    street_level_only = not any(tag in addr for tag in (
        "号", "路", "市场", "大厦", "小区", "广场", "公园", "站", "新村",
        "家园", "花园", "中心", "学校", "学院", "酒店", "医院",
    ))

    # 【修复】水域判定放宽：即使周边存在陆地 AOI/POI，也要先检查
    # “地址/AOI 名称 是否含明确水域关键字” 这种强证据；
    # 因为高德对江面点经常同时返回沿江公园 AOI（如“闽江公园”），
    # 旧逻辑会让 has_land_context=True 从而完全跳过水域判定。
    addr_is_water_like = bool(addr) and _contains_any(addr, _WATER_KEYWORDS)
    aoi_name_has_water = any(_contains_any(a.get("name", "") or "", _WATER_KEYWORDS) for a in aois)
    strong_water_hint = addr_is_water_like or aoi_name_has_water

    if (not has_land_context) or strong_water_hint:
        # 1) 周边 250m 内搜索水域 POI（自然地名及特殊类型）
        around = place_around(
            lat, lng,
            types="190200|190204|190205|190206|190207|150603|150700",
            radius=250, offset=10,
        ) or {}
        for p in around.get("pois", []) or []:
            if not isinstance(p, dict):
                continue
            tc = p.get("typecode", "")
            name = p.get("name", "")
            try:
                dist = float(p.get("distance", "99999"))
            except Exception:
                dist = 99999
            # 150603 轮渡站、150700 码头 —— 出现在仅有这类 POI 时肯定是水边或水面
            if (tc in _WATER_TYPECODES or _contains_any(name, _WATER_KEYWORDS)
                or tc.startswith("150603") or tc.startswith("150700")) and dist <= 200:
                water_evidence.append({"name": name, "typecode": tc, "distance_m": dist})
        if water_evidence:
            is_water = True
            water_reason.append(f"周边水域/渡口类 POI：{water_evidence[0]['name']}")

        # 2) regeo 地址仅到街道/镇级别且 aois/pois 均为空。
        # 严格起见：只有同时出现“周边 250m 水域证据”或“地址本身含水域关键字”才能被认为是水；
        # 否则只是“陆地盲区”（如郊外/工业地块/在建地区）不该误报。
        # 这一条原本会把“仓山区金山街道”这种陆地盲区误报为水，现以 #1 / #3 为准。
        # if not is_water and street_level_only and not aois_raw and not pois_raw:
        #     is_water = True
        #     water_reason.append(f"无陆地 AOI/POI 且地址退化至“{addr}”（判定为水面/无人区）")

        # 3) regeo 地址已包含水域关键字且没有陆地细粒度信息
        if not is_water and addr and _contains_any(addr, _WATER_KEYWORDS) and street_level_only:
            is_water = True
            water_reason.append(f"地址退化至水域：{addr}")

        # 4) 【新增】regeo 返回的 AOI 名称明确含水域关键字（如“闽江公园”“乌龙江大桥水域”），
        # 且周边 150m 内无任何“纯陆地 POI”反证 → 视为水面。
        if not is_water and aoi_name_has_water:
            # 复用 around 请求结果；若为空再做一次小半径的 around（不限类型）
            land_counter_pois = []
            around_any = place_around(lat, lng, radius=150, offset=15) or {}
            for p in around_any.get("pois", []) or []:
                if not isinstance(p, dict):
                    continue
                nm = p.get("name", "") or ""
                try:
                    dist = float(p.get("distance", "99999"))
                except Exception:
                    dist = 99999
                if dist <= 150 and not _contains_any(nm, _WATER_KEYWORDS) and _is_land_poi(p):
                    land_counter_pois.append(nm)
            if not land_counter_pois:
                is_water = True
                hit_aoi = next((a.get("name", "") for a in aois
                                if _contains_any(a.get("name", "") or "", _WATER_KEYWORDS)), "")
                water_reason.append(f"AOI 指向水域：{hit_aoi or addr}，且 150m 内无陆地 POI 反证")

    is_restricted = is_water or is_forest
    reason = "；".join(water_reason + forest_reason) if is_restricted else ""

    return {
        "is_water": is_water,
        "is_forest": is_forest,
        "is_restricted": is_restricted,
        "reason": reason,
        "address": addr,
        "province": addr_comp.get("province", ""),
        "city": addr_comp.get("city", ""),
        "district": addr_comp.get("district", ""),
        "township": addr_comp.get("township", ""),
        "aois": aois,
        "land_aois": [a["name"] for a in land_aois][:5],
        "land_pois": land_pois[:5],
        "water_evidence": water_evidence,
        "source": "amap-v3",
    }


# ----------------------------------------------------------------------
# POI / 交通 查询（被 maps/analysis 选点时实时调用，不回写 DB）
# ----------------------------------------------------------------------
# 常用类别编码（高德 POI 分类）
CATEGORY_MAP = {
    "shopping_mall": ("060100", "购物中心"),
    "supermarket": ("060400", "超市"),
    "office_building": ("120201", "商务写字楼"),
    "hospital": ("090100", "综合医院"),
    "school": ("141200", "学校"),
    "hotel": ("100000", "住宿服务"),
    "restaurant": ("050000", "餐饮服务"),
    "gas_station": ("010100", "加油站"),
    "parking_lot": ("150904", "停车场"),
    "subway_station": ("150500", "地铁站"),
    "bus_station": ("150700", "公交站"),
    "residential_area": ("120300", "住宅区"),
    "scenic_spot": ("110100", "风景名胜"),
}


def fetch_nearby_pois(lat: float, lng: float, radius_m: int = 2000, limit: int = 30) -> List[dict]:
    """
    调用高德 place/around 获取近邻 POI（纯高德最新数据）。
    radius_m 单位：米。
    """
    data = place_around(lat, lng, radius=radius_m, offset=min(limit, 25)) or {}
    items: List[dict] = []
    for p in data.get("pois", []) or []:
        try:
            loc = (p.get("location") or "").split(",")
            plng, plat = float(loc[0]), float(loc[1])
            dist = float(p.get("distance", "0")) / 1000.0
            items.append({
                "id": p.get("id"),
                "name": p.get("name", ""),
                "type": p.get("type", ""),
                "typecode": p.get("typecode", ""),
                "lat": plat,
                "lng": plng,
                "distance_km": round(dist, 3),
                "address": p.get("address", ""),
                "adname": p.get("adname", ""),
            })
        except Exception:
            continue
    items.sort(key=lambda x: x["distance_km"])
    return items[:limit]


# ======================================================================
# 城市级批量拉取（2026-04 新增）：POI / 充电站 / 水域禁区
# ----------------------------------------------------------------------
# 原则：
#   1. 所有数据来自高德 V3 REST，不读取本地 DB；
#   2. 使用长缓存（15 分钟）避免频繁请求高德；
#   3. 多次分页合并、按 POI id 去重；
#   4. 保证对 "整个福州市" 覆盖（按行政区分批查询）。
# ======================================================================

FUZHOU_DISTRICTS = [
    "鼓楼区", "台江区", "仓山区", "晋安区", "马尾区",
    "长乐区", "闽侯县", "连江县", "福清市", "永泰县",
    "罗源县", "闽清县", "平潭县",
]

# 前端展示用的大类 => (高德 typecode, 展示名, 前端 category key)
POI_BIG_CATEGORIES = [
    ("060100", "购物中心", "shopping_mall"),
    ("060400", "超市",     "supermarket"),
    ("120200", "商务楼宇", "office_building"),
    ("090100", "综合医院", "hospital"),
    ("141200", "学校",     "school"),
    ("100000", "酒店",     "hotel"),
    ("050000", "餐饮",     "restaurant"),
    ("150500", "地铁站",   "subway_station"),
    ("150700", "公交站",   "bus_station"),
    ("120300", "住宅区",   "residential_area"),
    ("110000", "风景名胜", "scenic_spot"),
    ("080000", "体育场馆", "sports_center"),
]

# 水域 / 林地 类别编码（作为禁区来源）
EXCLUSION_WATER_TYPES = ["190204", "190205", "190206", "190207"]
EXCLUSION_FOREST_TYPES = ["110202"]  # 国家级景点 / 森林公园
EXCLUSION_AIRPORT_TYPES = ["150200"]  # 机场相关

_CITY_CACHE: Dict[str, Tuple[float, Any]] = {}
_CITY_CACHE_TTL = 15 * 60  # 15 分钟


def _city_cache_get(k: str):
    v = _CITY_CACHE.get(k)
    if not v:
        return None
    ts, val, ttl = v if len(v) == 3 else (v[0], v[1], _CITY_CACHE_TTL)
    if time.time() - ts > ttl:
        _CITY_CACHE.pop(k, None)
        return None
    return val


def _city_cache_set(k: str, val: Any, ttl: Optional[float] = None):
    _CITY_CACHE[k] = (time.time(), val, ttl if ttl is not None else _CITY_CACHE_TTL)


def _city_cache_set_short(k: str, val: Any, ttl: float = 60):
    _city_cache_set(k, val, ttl=ttl)


def _place_text_paged(keywords: str, types: str, city: str,
                      max_pages: int = 3, offset: int = 25) -> List[dict]:
    """多页拉取并合并，单次出错立即结束（高德 V3 强制 page*offset<=2000 + count<=900）"""
    out: List[dict] = []
    for page in range(1, max_pages + 1):
        params = {
            "keywords": keywords or "",
            "types": types or "",
            "city": city,
            "citylimit": "true",
            "offset": offset,
            "page": page,
            "extensions": "base",
        }
        data = _get("https://restapi.amap.com/v3/place/text", params) or {}
        pois = data.get("pois") or []
        if not pois:
            break
        out.extend(pois)
        if len(pois) < offset:
            break  # 已经最后一页
    return out


# 各类POI的充电需求评分映射（基于高德类型编码对应充电需求强度）
_EV_DEMAND_SCORE_MAP = {
    "shopping_mall":    8.5,   # 购物中心 - 高停留时间
    "supermarket":      7.5,   # 超市
    "office_building":  8.8,   # 商务楼宇 - 通勤充电
    "hospital":         7.2,   # 医院
    "school":           7.8,   # 学校
    "hotel":            7.0,   # 酒店
    "restaurant":       6.0,   # 餐饮
    "gas_station":      6.5,   # 加油站
    "parking_lot":      8.0,   # 停车场
    "subway_station":   9.2,   # 地铁站 - 最高需求
    "bus_station":      8.0,   # 公交站
    "residential_area": 7.5,   # 住宅区
    "scenic_spot":      6.5,   # 景区
    "sports_center":    7.0,   # 体育场馆
}

# 日均人流默认值（各类型平均估算）
_DAILY_FLOW_MAP = {
    "shopping_mall":    25000,
    "supermarket":      12000,
    "office_building":  15000,
    "hospital":         10000,
    "school":           18000,
    "hotel":            5000,
    "restaurant":       3000,
    "gas_station":      800,
    "parking_lot":      8000,
    "subway_station":   35000,
    "bus_station":      20000,
    "residential_area": 6000,
    "scenic_spot":      12000,
    "sports_center":    5000,
}


def _normalize_poi(p: dict, fe_category: str = "", fe_cat_label: str = "") -> Optional[dict]:
    try:
        loc = (p.get("location") or "").split(",")
        plng, plat = float(loc[0]), float(loc[1])
    except Exception:
        return None
    ev_score = _EV_DEMAND_SCORE_MAP.get(fe_category, 5.0)
    daily_flow = _DAILY_FLOW_MAP.get(fe_category, 5000)
    return {
        "id": p.get("id") or f"{plng:.5f},{plat:.5f}",
        "name": p.get("name", ""),
        "type": p.get("type", ""),
        "typecode": p.get("typecode", ""),
        "lat": plat,
        "lng": plng,
        "address": p.get("address") or "",
        "adname": p.get("adname") or "",
        "cityname": p.get("cityname") or "",
        "category": fe_category,
        "category_display": fe_cat_label,
        # 以下字段是为兼容老前端代码（POIData 结构）
        "district": p.get("adname") or "",
        "daily_flow": daily_flow,
        "ev_demand_score": ev_score,
        "influence_weight": round(ev_score / 10.0 * 3.0, 1),
    }


def _fetch_one_category(typecode: str, label: str, fe_cat: str,
                        city: str, limit_per_cat: int) -> List[dict]:
    pages = max(1, (limit_per_cat + 24) // 25)
    out: List[dict] = []
    for p in _place_text_paged("", typecode, city, max_pages=pages, offset=25):
        np = _normalize_poi(p, fe_cat, label)
        if np:
            out.append(np)
            if len(out) >= limit_per_cat:
                break
    return out


def fetch_city_pois(city: str = "福州", limit_per_cat: int = 60) -> List[dict]:
    """按类别并行拉取整个福州市 POI，合并去重。

    对任何一个类别，若首次拉取结果 < 0.6 * limit_per_cat 则再试一次
    （例如高德偶发的 QPS 拖油/网络抖动），保证总量稳定。
    """
    ck = f"city_pois:{city}:{limit_per_cat}"
    cached = _city_cache_get(ck)
    if cached is not None:
        return cached

    def _one(args):
        tc, label, fe_cat = args
        out = _fetch_one_category(tc, label, fe_cat, city=city, limit_per_cat=limit_per_cat)
        if len(out) < max(5, int(limit_per_cat * 0.6)):
            time.sleep(0.3)
            retry = _fetch_one_category(tc, label, fe_cat, city=city, limit_per_cat=limit_per_cat)
            if len(retry) > len(out):
                out = retry
        return out

    with ThreadPoolExecutor(max_workers=6) as ex:
        results = list(ex.map(_one, POI_BIG_CATEGORIES))

    seen = set()
    merged: List[dict] = []
    for batch in results:
        for np in batch:
            if np["id"] in seen:
                continue
            seen.add(np["id"])
            merged.append(np)

    # 优质门槛：总量达到理论值的 85% 才写入 10 分钟优质缓存；
    # 否则写入更短的临时缓存（60秒），避免频繁打高德又不会闷在小量数据上
    total_target = limit_per_cat * len(POI_BIG_CATEGORIES)
    if len(merged) >= int(total_target * 0.85):
        _city_cache_set(ck, merged)
    elif len(merged) >= 100:
        _city_cache_set_short(ck, merged, ttl=60)
    return merged


def fetch_city_charging_stations(city: str = "福州", max_pages: int = 4) -> List[dict]:
    """整市充电站 (typecode=011100)"""
    ck = f"city_charging:{city}:{max_pages}"
    cached = _city_cache_get(ck)
    if cached is not None:
        return cached
    raw = _place_text_paged("充电站", "011100", city, max_pages=max_pages, offset=25)
    if len(raw) < max_pages * 10:
        time.sleep(0.3)
        retry = _place_text_paged("充电站", "011100", city, max_pages=max_pages, offset=25)
        if len(retry) > len(raw):
            raw = retry
    seen = set()
    out: List[dict] = []
    for p in raw:
        np = _normalize_poi(p, "charging_station", "充电站")
        if not np:
            continue
        if np["id"] in seen:
            continue
        seen.add(np["id"])
        np.update({
            "status": "existing",
            "total_score": 0,
            "operator": np["name"].split("(")[0].split("汽车")[0] or "",
        })
        out.append(np)
    if len(out) >= 40:
        _city_cache_set(ck, out)
    return out


def fetch_city_exclusions(city: str = "福州") -> List[dict]:
    """
    获取禁区：主要的水域 / 森林公园 / 机场。
    高德返回 POI 是点，我们将其近似为半径=0.5~1.5km 的圆形禁区。并行拉取。
    """
    ck = f"city_exclusions:{city}"
    cached = _city_cache_get(ck)
    if cached is not None:
        return cached

    # 【修复】不同 typecode 的水体宽度差很多，统一 0.5km 会把河道画成一大块；
    # 190204 河流 0.35km / 190205 湖泊 0.8km / 190206 水库 1.2km / 190207 海洋 0.6km
    _WATER_RADIUS = {"190204": 0.35, "190205": 0.8, "190206": 1.2, "190207": 0.6}
    jobs: List[Tuple[str, str, str, int, str, float, str]] = []
    # (keywords, types, city, max_pages, ztype, radius_km, label)
    for tc in EXCLUSION_WATER_TYPES:
        jobs.append(("", tc, city, 3, "water", _WATER_RADIUS.get(tc, 0.5), "水域/河道"))
    jobs.append(("森林公园", "", city, 2, "forest", 1.0, "林地/保护区"))
    jobs.append(("自然保护区", "", city, 1, "forest", 1.2, "自然保护区"))
    jobs.append(("机场", "150200", city, 1, "airport", 2.0, "机场管控区"))

    def run(job):
        kw, tc, city_, pages, ztype, radius_km, label = job
        out = _place_text_paged(kw, tc, city_, max_pages=pages, offset=25)
        # 短量重试一次，例如高德 QPS 拖油
        if len(out) < max(10, pages * 8):
            time.sleep(0.3)
            retry = _place_text_paged(kw, tc, city_, max_pages=pages, offset=25)
            if len(retry) > len(out):
                out = retry
        return ztype, radius_km, label, out

    with ThreadPoolExecutor(max_workers=6) as ex:
        batches = list(ex.map(run, jobs))

    # 【修复】名称黑名单：桥不是水域禁区，渡口/码头也不算
    _NAME_BLOCK = ("大桥", "大桥北", "大桥南", "大桥西", "大桥东",
                   "码头", "渡口", "停车场", "服务区",
                   "音乐厅", "博物馆", "公园", "广场",
                   "海滨", "海岸", "海域",  # 海岸线不用禁，有需要也由官方数据盖
                   )
    # 【修复】水域名称必须含水体字，避免“福州鼓楼区水域禁区1”这种伪造模板
    _REAL_WATER_HINTS = ("江", "河", "湖", "港", "溪", "渠", "库", "塘", "洋", "海", "水库")

    _EXPLICIT_WATER_NAMES = ("左海", "东湖", "西湖", "西库")

    def _is_valid_water_name(name: str) -> bool:
        # 拒绝“福州水域禁区N”模板、“XX大桥水域”、“XX公园水域”、“XX海滨/海域”
        if "水域禁区" in name:
            return False
        # 中文“水域”后缀很多是伪造；除非前缀是已知真水体名称
        if name.endswith("水域") and not any(h in name for h in ("江", "河", "湖", "渠", "库")):
            return False
        # 陆地设施名出现在水域名称里 → 伪造
        if any(bw in name for bw in ("大桥", "公园", "广场", "服务区", "停车场")):
            return False
        # 显式放行已知内巷水体（左海/东湖/西湖…）
        if any(name.startswith(h) for h in _EXPLICIT_WATER_NAMES):
            return True
        # 必须命中至少一个真实水体特征字
        return any(h in name for h in _REAL_WATER_HINTS)

    out: List[dict] = []
    seen_names = set()
    for ztype, radius_km, label, pois in batches:
        for p in pois:
            np = _normalize_poi(p)
            if not np:
                continue
            name = np["name"]
            if not name or name in seen_names:
                continue
            # 【修复】类型码白名单：水域必须在 190204〜190207 内；除森林/机场用关键字命中外，其他一律丢弃
            tc = (np.get("typecode") or "")[:6]
            if ztype == "water":
                if tc not in {"190204", "190205", "190206", "190207"}:
                    continue
                if not _is_valid_water_name(name):
                    continue
            elif ztype == "forest":
                # 森林名称含“森林/保护区/湿地/风景区”之一才算
                if not any(h in name for h in ("森林", "保护区", "湿地", "风景区", "自然")):
                    continue
            elif ztype == "airport":
                if "机场" not in name:
                    continue
            if any(bw in name for bw in _NAME_BLOCK) and ztype != "forest" and ztype != "airport":
                continue
            seen_names.add(name)
            out.append({
                "id": np["id"],
                "name": name,
                "zone_type": ztype,
                "zone_type_display": label,
                "center_lat": np["lat"],
                "center_lng": np["lng"],
                "radius_km": radius_km,
                "description": np.get("address") or np.get("adname"),
                "boundary": None,
                "source": "amap-v3",
                "typecode": np.get("typecode", ""),
            })

    # 门槛：总量太少（通常高德抽风）不写缓存
    if len(out) >= 30:
        _city_cache_set(ck, out)
    return out


# ----------------------------------------------------------------------
# 启动预热：在后台线程里将三类城市级数据提前装缓存
# ----------------------------------------------------------------------
_warmup_lock = threading.Lock()
_warmup_done = False


def warm_city_caches(city: str = "福州"):
    """后台预热：Django 启动时调用，用户首次打开地图即命中缓存。"""
    global _warmup_done
    with _warmup_lock:
        if _warmup_done:
            return
        _warmup_done = True

    def _work():
        try:
            logger.info("AMap warmup start for %s", city)
            fetch_city_charging_stations(city)
            fetch_city_exclusions(city)
            fetch_city_pois(city)
            logger.info("AMap warmup done")
        except Exception as e:
            logger.warning("AMap warmup failed: %s", e)

    threading.Thread(target=_work, daemon=True, name="amap-warmup").start()
