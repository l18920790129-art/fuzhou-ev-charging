#!/bin/bash
# Render构建脚本
set -e

echo "=== 安装依赖 ==="
pip install -r requirements.txt

echo "=== 收集静态文件 ==="
python manage.py collectstatic --noinput

echo "=== 数据库迁移 ==="
python manage.py migrate

echo "=== 初始化数据 ==="
DJANGO_SETTINGS_MODULE=fuzhou_ev_charging.settings python data/init_fuzhou_data.py
DJANGO_SETTINGS_MODULE=fuzhou_ev_charging.settings python data/enhance_data.py

echo "=== 构建知识库 ==="
DJANGO_SETTINGS_MODULE=fuzhou_ev_charging.settings python knowledge_base/build_knowledge_base.py || echo "知识库构建跳过（已存在）"

echo "=== 构建完成 ==="
