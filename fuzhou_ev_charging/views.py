"""
主视图 - 提供前端页面入口
"""
from django.shortcuts import render


def index(request):
    """返回前端主页面"""
    return render(request, 'index.html')
