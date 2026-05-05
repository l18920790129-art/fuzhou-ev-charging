"""
预缓存高德全量数据到 JSON 文件。

用法：
  python data/prefetch_amap_data.py          # 尝试从高德API拉取并保存
  python data/prefetch_amap_data.py --check  # 仅检查缓存文件是否存在

在 build.sh 中调用：若高德 API 可用且数据量充足则更新缓存文件，否则保留已有缓存。
后端接口始终优先读缓存文件，不依赖实时高德 API。

【重要】覆盖保护策略：
  - POIs 文件：只有拉到 >=700 条才允许覆盖（仓库标准值709条）
  - 高德 API 因 QPS 限制通常只能拉到 400~600 条，不满足覆盖条件，
    因此会保留仓库里的 709 条标准数据，确保线上始终显示709条。
"""
import json
import os
import sys

# Django setup
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fuzhou_ev_charging.settings')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import django
django.setup()

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'amap_cache')
POIS_FILE = os.path.join(CACHE_DIR, 'city_pois.json')
STATIONS_FILE = os.path.join(CACHE_DIR, 'city_stations.json')
EXCLUSIONS_FILE = os.path.join(CACHE_DIR, 'city_exclusions.json')


def check_cache():
    """检查缓存文件是否存在且有效"""
    for f, name in [(POIS_FILE, 'POIs'), (STATIONS_FILE, 'Stations'), (EXCLUSIONS_FILE, 'Exclusions')]:
        if os.path.exists(f):
            with open(f, 'r', encoding='utf-8') as fp:
                data = json.load(fp)
            print(f"  ✅ {name}: {len(data)} 条 ({f})")
        else:
            print(f"  ❌ {name}: 缓存文件不存在 ({f})")


def prefetch():
    """尝试从高德API拉取数据并保存"""
    from fuzhou_ev_charging.amap_service import (
        fetch_city_pois,
        fetch_city_charging_stations,
        fetch_city_exclusions,
    )

    os.makedirs(CACHE_DIR, exist_ok=True)

    # 1) POIs
    # 【关键修复】覆盖阈值从100提高到700：
    #   高德API因QPS限制每次只能拉到400~600条，满足>=100但不满足>=700
    #   这样就不会覆盖仓库里正确的709条数据
    POI_MIN_TO_OVERWRITE = 700
    print("🔄 拉取 POI 数据...")
    try:
        pois = fetch_city_pois(city="福州", limit_per_cat=60) or []
        if len(pois) >= POI_MIN_TO_OVERWRITE:
            with open(POIS_FILE, 'w', encoding='utf-8') as f:
                json.dump(pois, f, ensure_ascii=False, indent=1)
            print(f"  ✅ POIs: {len(pois)} 条已保存（覆盖）")
        elif os.path.exists(POIS_FILE):
            with open(POIS_FILE, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            print(f"  ⚠️ POIs 只拉到 {len(pois)} 条（低于阈值 {POI_MIN_TO_OVERWRITE}），"
                  f"保留现有缓存 {len(existing)} 条")
        else:
            # 缓存文件不存在时才保存低质量数据（总比没有好）
            with open(POIS_FILE, 'w', encoding='utf-8') as f:
                json.dump(pois, f, ensure_ascii=False, indent=1)
            print(f"  ⚠️ POIs: 缓存不存在，保存 {len(pois)} 条")
    except Exception as e:
        print(f"  ❌ POIs 拉取失败: {e}")

    # 2) Charging stations
    print("🔄 拉取充电站数据...")
    try:
        stations = fetch_city_charging_stations(city="福州", max_pages=4) or []
        if len(stations) >= 20:
            with open(STATIONS_FILE, 'w', encoding='utf-8') as f:
                json.dump(stations, f, ensure_ascii=False, indent=1)
            print(f"  ✅ Stations: {len(stations)} 条已保存")
        else:
            print(f"  ⚠️ Stations 只拉到 {len(stations)} 条，保留已有缓存")
    except Exception as e:
        print(f"  ❌ Stations 拉取失败: {e}")

    # 3) Exclusion zones
    print("🔄 拉取禁区数据...")
    try:
        zones = fetch_city_exclusions(city="福州") or []
        if len(zones) >= 20:
            with open(EXCLUSIONS_FILE, 'w', encoding='utf-8') as f:
                json.dump(zones, f, ensure_ascii=False, indent=1)
            print(f"  ✅ Exclusions: {len(zones)} 条已保存")
        else:
            print(f"  ⚠️ Exclusions 只拉到 {len(zones)} 条，保留已有缓存")
    except Exception as e:
        print(f"  ❌ Exclusions 拉取失败: {e}")

    print("\n📋 缓存状态：")
    check_cache()


if __name__ == '__main__':
    if '--check' in sys.argv:
        print("📋 检查缓存文件：")
        check_cache()
    else:
        prefetch()
