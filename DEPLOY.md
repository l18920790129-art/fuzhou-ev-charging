# 福州充电桩智能选址系统 - 部署指南

## 🚀 方案一：Render.com 免费永久部署（推荐）

### 步骤（约5分钟）

1. **访问** [https://render.com](https://render.com)
2. **点击** "Sign in with GitHub" 用 GitHub 账号登录
3. **点击** "New +" → "Blueprint"
4. **选择仓库** `l18920790129-art/fuzhou-ev-charging`
5. **点击** "Apply" — Render 会自动读取 `render.yaml` 并创建服务
6. **设置环境变量**（在服务设置页面）：
   - `DEEPSEEK_API_KEY` = 您的 DeepSeek API Key
7. **等待** 约3-5分钟构建完成
8. **访问** `https://fuzhou-ev-charging.onrender.com`

> ✅ 完全免费，永久可访问，自动 HTTPS

---

## 🐳 方案二：Docker 本地/服务器部署

### 前提条件
- 安装 Docker 和 Docker Compose

### 一键启动
```bash
# 克隆仓库
git clone https://github.com/l18920790129-art/fuzhou-ev-charging.git
cd fuzhou-ev-charging

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY

# 启动服务
docker-compose up -d

# 访问
open http://localhost:8000
```

---

## ☁️ 方案三：任意 Linux 服务器部署

### 一键安装脚本
```bash
# 安装依赖
sudo apt-get update && sudo apt-get install -y python3.11 python3-pip postgresql

# 克隆代码
git clone https://github.com/l18920790129-art/fuzhou-ev-charging.git
cd fuzhou-ev-charging

# 安装 Python 依赖
pip3 install -r requirements.txt

# 配置环境变量
export DEEPSEEK_API_KEY="your-key-here"
export SECRET_KEY="your-secret-key"

# 初始化数据库
python manage.py migrate
python data/init_fuzhou_data.py
python data/enhance_data.py
python knowledge_base/build_knowledge_base.py

# 启动服务
gunicorn fuzhou_ev_charging.wsgi:application --bind 0.0.0.0:8000 --workers 2 --daemon
```

---

## 🔑 必需的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek AI API密钥（必须） | `sk-xxx` |
| `SECRET_KEY` | Django密钥（自动生成） | 随机字符串 |
| `AMAP_API_KEY` | 高德地图API Key（已内置） | `283b21e...` |
| `DATABASE_URL` | 数据库连接（Render自动提供） | `postgresql://...` |

---

## 📊 系统架构

```
前端（HTML/CSS/JS + 高德地图）
    ↓ HTTP API
后端（Django + DRF）
    ├── LangChain Agent（DeepSeek LLM）
    ├── ChromaDB（向量知识库）
    ├── PostgreSQL（地理实体数据）
    └── ReportLab（PDF报告生成）
```

---

## 🌐 GitHub 仓库

https://github.com/l18920790129-art/fuzhou-ev-charging
