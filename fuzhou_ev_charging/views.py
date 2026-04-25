"""
主视图 - 提供前端页面入口 + 高德 REST 代理端点
"""
import os
import time
from django.conf import settings
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

# 部署时生成一个 build_id（进程启动时计算一次），
# 所有 HTML 带上这个参数，指向 app.js / main.css，以强制打破浏览器/CDN 缓存。
BUILD_ID = os.environ.get("RENDER_GIT_COMMIT", "")[:8] or time.strftime("%Y%m%d%H%M", time.localtime())

from .amap_service import (
    environment_check,
    regeo,
    place_around,
    fetch_nearby_pois,
)


def index(request):
    """返回前端主页面（向模板注入高德 JS Key/安全码 + build_id）"""
    resp = render(request, 'index.html', {
        'AMAP_JS_KEY': settings.AMAP_JS_KEY,
        'AMAP_JS_SECURITY': settings.AMAP_JS_SECURITY,
        'BUILD_ID': BUILD_ID,
    })
    resp["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp["Pragma"] = "no-cache"
    return resp


@csrf_exempt
def amap_regeo(request):
    """高德逆地理编码代理（使用 V3 Web服务 Key）"""
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return JsonResponse({"error": "invalid lat/lng"}, status=400)
    radius = int(request.GET.get('radius', 200))
    data = regeo(lat, lng, radius=radius) or {}
    return JsonResponse(data)


@csrf_exempt
def amap_around(request):
    """高德周边搜索代理（V3 Web服务 Key）"""
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return JsonResponse({"error": "invalid lat/lng"}, status=400)
    types = request.GET.get('types', '')
    keywords = request.GET.get('keywords', '')
    radius = int(request.GET.get('radius', 1000))
    offset = int(request.GET.get('offset', 20))
    data = place_around(lat, lng, types=types, keywords=keywords,
                        radius=radius, offset=offset) or {}
    return JsonResponse(data)


@csrf_exempt
def amap_nearby_pois(request):
    """基于高德 V3 API 实时获取周边 POI（不走 DB）"""
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return JsonResponse({"error": "invalid lat/lng"}, status=400)
    radius_m = int(request.GET.get('radius', 2000))
    limit = int(request.GET.get('limit', 30))
    pois = fetch_nearby_pois(lat, lng, radius_m=radius_m, limit=limit)
    return JsonResponse({"data": pois, "total": len(pois), "source": "amap-v3"})


@csrf_exempt
def geo_info(request):
    """
    统一环境语义识别接口（给前端选点用）
    返回高德真实识别结果：地址、行政区、水域/林地判定、依据。
    """
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return JsonResponse({"error": "invalid lat/lng"}, status=400)
    result = environment_check(lat, lng)
    return JsonResponse(result)
