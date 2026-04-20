"""
高德开放平台 Web 服务（V3 REST API）封装
===============================================
仅用于服务端调用。使用 settings.AMAP_WEB_KEY（V3 Web服务 Key）。
该模块被 maps/analysis 视图共用，并提供"水域/林地环境约束检查"能力。

接口依据：https://lbs.amap.com/api/webservice/summary
"""
from __future__ import annotations

import logging
import time
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
    if t[:6] in _LAND_AOI_TYPES:
        return True
    # 风景名胜 110101 也算陆地（公园 / 广场）
    if t.startswith("1101"):
        return True
    if _contains_any(name, _LAND_AOI_NAME_HINTS):
        return True
    return False


def _is_land_poi(poi: Dict[str, Any]) -> bool:
    t = poi.get("type", "") or ""
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

    if not has_land_context:
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

        # 2) regeo 地址仅到街道/镇级别且 aois/pois 均为空（国内江河湖海的典型特征）
        if not is_water and street_level_only and not aois_raw and not pois_raw:
            # 额外用 "闽江/乌龙江/光明港/大樟溪" 主动文本搜索验证一下：
            # 它们是否的确是附近主河道（原则上这一条容错性更强）
            is_water = True
            water_reason.append(f"无陆地 AOI/POI 且地址退化至“{addr}”（判定为水面/无人区）")

        # 3) regeo 地址已包含水域关键字且没有陆地细粒度信息
        if not is_water and addr and _contains_any(addr, _WATER_KEYWORDS) and street_level_only:
            is_water = True
            water_reason.append(f"地址退化至水域：{addr}")

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
