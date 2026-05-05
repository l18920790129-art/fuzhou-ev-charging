#!/usr/bin/env bash
# =============================================================
# Render 生产环境构建脚本
# 在 Render Dashboard 中设置 Build Command: cd 1_backend && chmod +x build.sh && ./build.sh
# =============================================================
set -o errexit

echo "=== [1/6] 安装 Python 依赖 ==="
pip install -r requirements.txt
pip install dj-database-url psycopg2-binary gunicorn

echo "=== [2/6] 收集静态文件 ==="
python manage.py collectstatic --no-input

echo "=== [3/6] 执行数据库迁移 ==="
python manage.py migrate

echo "=== [4/6] 初始化福州基础数据 ==="
# 仅在数据库为空时执行初始化（避免重复导入）
python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fuzhou_ev_charging.settings')
django.setup()
from maps.models import POIData
if POIData.objects.count() == 0:
    print('Database is empty, running init scripts...')
    exec(open('data/init_fuzhou_data.py').read())
    exec(open('data/enhance_data.py').read())
    exec(open('data/fix_roads.py').read())
else:
    print(f'Database already has {POIData.objects.count()} POIs, skipping init.')
"

echo "=== [5/6] 更新水域边界多边形 ==="
python manage.py update_water_boundaries || echo "Water boundaries update skipped"

echo "=== [6/6] 预热高德缓存数据 ==="
python data/prefetch_amap_data.py || echo "Prefetch skipped (API may be unavailable)"

echo "=== ✅ Build complete ==="
