from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from . import views
from .amap_proxy import amap_service_proxy

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.index, name='index'),
    path('api/maps/', include('maps.urls')),
    path('api/analysis/', include('analysis.urls')),
    path('api/memory/', include('memory.urls')),
    path('api/reports/', include('reports.urls')),
    # 高德 V3 Web 服务代理（从后端派发，使用新 Key）
    path('api/amap/regeo/', views.amap_regeo, name='amap_regeo'),
    path('api/amap/around/', views.amap_around, name='amap_around'),
    path('api/amap/nearby-pois/', views.amap_nearby_pois, name='amap_nearby_pois'),
    path('api/amap/geo-info/', views.geo_info, name='amap_geo_info'),
    # 高德地图安全代理（绕过域名白名单限制）
    re_path(r'^_AMapService/(?P<path>.*)$', amap_service_proxy, name='amap_service_proxy'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) \
  + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
