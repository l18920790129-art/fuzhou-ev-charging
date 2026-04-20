"""
WSGI config for fuzhou_ev_charging project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fuzhou_ev_charging.settings')

application = get_wsgi_application()

# 启动后预热高德城市缓存（POI / 禁区 / 充电站）
try:
    from fuzhou_ev_charging.amap_service import warm_city_caches
    warm_city_caches("福州")
except Exception as _e:  # pragma: no cover
    import logging
    logging.getLogger(__name__).warning("warm_city_caches skipped: %s", _e)
