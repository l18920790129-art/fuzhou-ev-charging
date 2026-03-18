"""
高德地图代理服务
将前端的高德地图API请求通过后端转发，绕过域名白名单限制
"""
import requests
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

AMAP_KEY = '283b21e285a807bf7bda4cf43e838a26'

@csrf_exempt
def amap_proxy(request, path):
    """代理高德地图API请求"""
    # 构建目标URL
    target_url = f'https://restapi.amap.com/{path}'
    
    # 获取查询参数
    params = dict(request.GET)
    # 注入API Key
    params['key'] = [AMAP_KEY]
    
    try:
        if request.method == 'GET':
            resp = requests.get(target_url, params=params, timeout=10)
        elif request.method == 'POST':
            resp = requests.post(target_url, params=params, data=request.body, timeout=10)
        else:
            return JsonResponse({'error': 'Method not allowed'}, status=405)
        
        response = HttpResponse(
            content=resp.content,
            status=resp.status_code,
            content_type=resp.headers.get('Content-Type', 'application/json')
        )
        # 添加CORS头
        response['Access-Control-Allow-Origin'] = '*'
        return response
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt  
def amap_service_proxy(request, path=''):
    """
    高德地图JS API 2.0 安全代理
    对应 _AMapSecurityConfig.serviceHost 配置
    代理路径: /_AMapService/...
    """
    # 高德地图安全服务端点
    amap_service_base = 'https://fservice.amap.com'
    
    target_url = f'{amap_service_base}/{path}'
    
    # 获取查询参数
    params = dict(request.GET)
    
    try:
        headers = {
            'User-Agent': request.META.get('HTTP_USER_AGENT', ''),
            'Referer': 'https://fuzhou-ev-charging.onrender.com/',
        }
        
        resp = requests.get(
            target_url, 
            params=params, 
            headers=headers,
            timeout=15
        )
        
        response = HttpResponse(
            content=resp.content,
            status=resp.status_code,
            content_type=resp.headers.get('Content-Type', 'application/json')
        )
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = 'Content-Type'
        return response
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
