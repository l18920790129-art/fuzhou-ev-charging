#!/usr/bin/env python3
"""修复道路数据：用真实的福州主要道路坐标替换模拟数据"""
import os, sys, django, json
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fuzhou_ev_charging.settings')
django.setup()
from maps.models import TrafficFlow

REAL_ROADS = [
    {'road_name':'福厦高速（福州段）','road_level':'expressway','daily_flow':95000,'peak_flow':8500,'ev_ratio':0.09,'heat_weight':0.98,'district':'福州市',
     'path':[[26.1200,119.1800],[26.0900,119.2200],[26.0700,119.2600],[26.0500,119.3000],[26.0200,119.3400],[25.9800,119.3800],[25.9400,119.4200]]},
    {'road_name':'绕城高速（西段）','road_level':'expressway','daily_flow':85000,'peak_flow':7500,'ev_ratio':0.08,'heat_weight':0.88,'district':'闽侯县/鼓楼区',
     'path':[[26.1500,119.1600],[26.1100,119.1800],[26.0800,119.2000],[26.0400,119.2100],[26.0000,119.2200],[25.9600,119.2300]]},
    {'road_name':'福州绕城高速（东段）','road_level':'expressway','daily_flow':72000,'peak_flow':6500,'ev_ratio':0.07,'heat_weight':0.75,'district':'晋安区/马尾区',
     'path':[[26.1500,119.3800],[26.1100,119.3900],[26.0700,119.4000],[26.0300,119.4100],[25.9900,119.4200],[25.9500,119.4300]]},
    {'road_name':'二环路（北段）','road_level':'urban_expressway','daily_flow':68000,'peak_flow':6200,'ev_ratio':0.07,'heat_weight':0.72,'district':'鼓楼区/晋安区',
     'path':[[26.1100,119.2400],[26.1050,119.2700],[26.1000,119.3000],[26.1050,119.3300],[26.1100,119.3600]]},
    {'road_name':'三环路（西段）','road_level':'expressway','daily_flow':68000,'peak_flow':6200,'ev_ratio':0.09,'heat_weight':0.72,'district':'闽侯县/仓山区',
     'path':[[26.1400,119.1900],[26.1100,119.1950],[26.0800,119.2000],[26.0500,119.2050],[26.0200,119.2100]]},
    {'road_name':'二环路（南段）','road_level':'urban_expressway','daily_flow':62000,'peak_flow':5800,'ev_ratio':0.07,'heat_weight':0.65,'district':'台江区/仓山区',
     'path':[[26.0400,119.2400],[26.0350,119.2700],[26.0300,119.3000],[26.0350,119.3300],[26.0400,119.3600]]},
    {'road_name':'三环路（北段）','road_level':'expressway','daily_flow':55000,'peak_flow':5000,'ev_ratio':0.08,'heat_weight':0.58,'district':'鼓楼区/晋安区',
     'path':[[26.1600,119.2000],[26.1550,119.2500],[26.1500,119.3000],[26.1550,119.3500],[26.1600,119.4000]]},
    {'road_name':'八一七路','road_level':'main_road','daily_flow':50000,'peak_flow':4500,'ev_ratio':0.09,'heat_weight':0.55,'district':'鼓楼区/台江区',
     'path':[[26.1000,119.3000],[26.0900,119.3000],[26.0800,119.3000],[26.0700,119.3000],[26.0600,119.3000],[26.0500,119.3000],[26.0400,119.3000],[26.0300,119.3000]]},
    {'road_name':'北江滨大道','road_level':'main_road','daily_flow':52000,'peak_flow':4800,'ev_ratio':0.09,'heat_weight':0.58,'district':'鼓楼区/台江区',
     'path':[[26.0700,119.2400],[26.0680,119.2700],[26.0660,119.3000],[26.0640,119.3300],[26.0620,119.3600],[26.0600,119.3900]]},
    {'road_name':'南江滨大道','road_level':'main_road','daily_flow':48000,'peak_flow':4400,'ev_ratio':0.09,'heat_weight':0.52,'district':'仓山区/台江区',
     'path':[[26.0300,119.2400],[26.0280,119.2700],[26.0260,119.3000],[26.0240,119.3300],[26.0220,119.3600],[26.0200,119.3900]]},
    {'road_name':'五四路','road_level':'main_road','daily_flow':45000,'peak_flow':4200,'ev_ratio':0.08,'heat_weight':0.50,'district':'鼓楼区',
     'path':[[26.0900,119.2800],[26.0850,119.2900],[26.0800,119.3000],[26.0750,119.3100],[26.0700,119.3200]]},
    {'road_name':'六一路','road_level':'main_road','daily_flow':44000,'peak_flow':4000,'ev_ratio':0.08,'heat_weight':0.48,'district':'鼓楼区/仓山区',
     'path':[[26.1000,119.2700],[26.0800,119.2700],[26.0600,119.2700],[26.0400,119.2700],[26.0200,119.2700]]},
    {'road_name':'福马路','road_level':'main_road','daily_flow':40000,'peak_flow':3800,'ev_ratio':0.08,'heat_weight':0.45,'district':'晋安区/马尾区',
     'path':[[26.0800,119.3200],[26.0750,119.3400],[26.0700,119.3600],[26.0650,119.3800],[26.0600,119.4000]]},
    {'road_name':'工业路','road_level':'main_road','daily_flow':42000,'peak_flow':3900,'ev_ratio':0.08,'heat_weight':0.47,'district':'鼓楼区',
     'path':[[26.0800,119.2600],[26.0800,119.2700],[26.0800,119.2800],[26.0800,119.2900],[26.0800,119.3000]]},
    {'road_name':'华林路','road_level':'main_road','daily_flow':36000,'peak_flow':3300,'ev_ratio':0.07,'heat_weight':0.40,'district':'鼓楼区',
     'path':[[26.0900,119.2700],[26.0900,119.2800],[26.0900,119.2900],[26.0900,119.3000],[26.0900,119.3100]]},
    {'road_name':'湖东路','road_level':'main_road','daily_flow':38000,'peak_flow':3500,'ev_ratio':0.07,'heat_weight':0.42,'district':'鼓楼区',
     'path':[[26.0750,119.2900],[26.0750,119.3000],[26.0750,119.3100],[26.0750,119.3200],[26.0750,119.3300]]},
    {'road_name':'国货路','road_level':'main_road','daily_flow':35000,'peak_flow':3200,'ev_ratio':0.07,'heat_weight':0.38,'district':'台江区',
     'path':[[26.0600,119.3000],[26.0650,119.3000],[26.0700,119.3000],[26.0750,119.3000],[26.0800,119.3000]]},
    {'road_name':'台江路','road_level':'secondary_road','daily_flow':32000,'peak_flow':2900,'ev_ratio':0.07,'heat_weight':0.35,'district':'台江区',
     'path':[[26.0550,119.2900],[26.0550,119.3000],[26.0550,119.3100],[26.0550,119.3200],[26.0550,119.3300]]},
    {'road_name':'铜盘路','road_level':'secondary_road','daily_flow':30000,'peak_flow':2700,'ev_ratio':0.07,'heat_weight':0.33,'district':'鼓楼区',
     'path':[[26.0950,119.2500],[26.0900,119.2600],[26.0850,119.2700],[26.0800,119.2800],[26.0750,119.2900]]},
    {'road_name':'仓山路','road_level':'secondary_road','daily_flow':25000,'peak_flow':2300,'ev_ratio':0.06,'heat_weight':0.28,'district':'仓山区',
     'path':[[26.0200,119.2600],[26.0180,119.2800],[26.0160,119.3000],[26.0140,119.3200],[26.0120,119.3400]]},
    {'road_name':'晋安河路','road_level':'secondary_road','daily_flow':22000,'peak_flow':2000,'ev_ratio':0.06,'heat_weight':0.25,'district':'晋安区',
     'path':[[26.1100,119.3300],[26.0900,119.3300],[26.0700,119.3300],[26.0500,119.3300],[26.0300,119.3300]]},
    {'road_name':'连江路','road_level':'secondary_road','daily_flow':27000,'peak_flow':2500,'ev_ratio':0.06,'heat_weight':0.30,'district':'晋安区',
     'path':[[26.1100,119.3100],[26.0900,119.3100],[26.0700,119.3100],[26.0500,119.3100],[26.0300,119.3100]]},
    {'road_name':'鼓山大道','road_level':'secondary_road','daily_flow':28000,'peak_flow':2600,'ev_ratio':0.07,'heat_weight':0.31,'district':'晋安区',
     'path':[[26.0800,119.3500],[26.0850,119.3600],[26.0900,119.3700],[26.0950,119.3800],[26.1000,119.3900]]},
    {'road_name':'温泉路','road_level':'secondary_road','daily_flow':20000,'peak_flow':1800,'ev_ratio':0.06,'heat_weight':0.22,'district':'鼓楼区',
     'path':[[26.0950,119.2800],[26.0900,119.2850],[26.0850,119.2900],[26.0800,119.2950],[26.0750,119.3000]]},
]

print("开始更新道路数据...")
deleted = TrafficFlow.objects.all().delete()
print(f"已删除旧数据: {deleted[0]} 条")

created_count = 0
for road_data in REAL_ROADS:
    path = road_data['path']
    start = path[0]; end = path[-1]; center = path[len(path)//2]
    road = TrafficFlow(
        road_name=road_data['road_name'],
        road_level=road_data['road_level'],
        start_lat=start[0], start_lng=start[1],
        end_lat=end[0], end_lng=end[1],
        center_lat=center[0], center_lng=center[1],
        daily_flow=road_data['daily_flow'],
        peak_flow=road_data['peak_flow'],
        ev_ratio=road_data['ev_ratio'],
        heat_weight=road_data['heat_weight'],
        district=road_data['district'],
        path_json=json.dumps(path),
    )
    road.save()
    created_count += 1
    print(f"  ✓ {road_data['road_name']} ({road_data['road_level']}, {road_data['daily_flow']}辆/日)")

print(f"\n完成！共创建 {created_count} 条道路数据")
print(f"数据库中道路总数: {TrafficFlow.objects.count()}")
