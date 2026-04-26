import os, sys, django
sys.path.insert(0, '/home/ubuntu/fec')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fuzhou_ev_charging.settings')
django.setup()

from analysis.views import _build_high_score_fallback, _looks_like_recommendation_query

cases = [
    "推荐一个9.0以上的充电桩",
    "推荐一个9.0",
    "评分8分以上的位置有哪些",
    "今天天气怎么样",   # 不应触发
    "你好",
]
for c in cases:
    print(f"--- {c!r} | intent={_looks_like_recommendation_query(c)} ---")
    if _looks_like_recommendation_query(c):
        out = _build_high_score_fallback(c)
        print(out[:500])
        print('...len=', len(out))
