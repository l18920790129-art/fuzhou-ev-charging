"""
分析相关API视图 - LangChain Agent接口
"""
import json
import re
import uuid
import threading
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import AnalysisTask, KnowledgeGraphNode, KnowledgeGraphEdge
from .agent import quick_score_location, EVChargingAgent

logger = logging.getLogger(__name__)


# 带 “推荐 / 高分 / 评分 N 以上” 意图的保底检测
RE_REC_INTENT = re.compile(r"(推荐|推薦|推一个|哪里|哪个|高分|高评分|以上|之上|超过|>=|>|≥|评分|带 ?9|高分点位|优质点位)")
# 识别用户话中的阈值数字（例如 "9"、"9.0"、"8.5"、"九分"）
RE_THRESHOLD = re.compile(r"(?<![\d.])((?:10|[5-9])(?:\.[0-9])?)(?![\d])")
# 识别 LLM 输出中的 “找不到 / 暂无 / 无法提供” 否定话术
RE_NEGATIVE = re.compile(r"(找不到|暂无|无法提供|无法推荐|没有足够|不存在|未能找到|没找到|如果您接受|建议放宽|请调低期望)")


def _build_high_score_fallback(user_msg: str) -> str:
    """在 LLM 超时或拒绝推荐时，直接调用 recommend_alternative_locations 拼装保底输出."""
    try:
        from .agent import recommend_alternative_locations
        # 提取阈值
        m = RE_THRESHOLD.search(user_msg or "")
        threshold = float(m.group(1)) if m else 8.5
        if threshold > 10:
            threshold = 9.0
        elif threshold < 6.0:
            threshold = 6.0
        # LangChain @tool 包装后的函数调用需要用 .invoke()
        try:
            tool_text = recommend_alternative_locations.invoke({"location_info": f"推荐,min_score={threshold}"})
        except Exception:
            # 老 LangChain 接口兑底
            tool_text = recommend_alternative_locations.run({"location_info": f"推荐,min_score={threshold}"})
        return (
            f"## 🏆 福州市评分 ≥ {threshold} 的充电站点位推荐\n\n"
            f"_以下结果由系统高分推荐引擎从全域 POI 与现有充电站中企接返回，避免出现“拿不到结果”。_\n\n"
            f"```\n{tool_text}\n```\n\n"
            f"如需针对某个具体点位做深度分析，请在“地图选址”中点击对应坐标后点击“AI 深度分析”。"
        )
    except Exception as e:
        logger.error(f"高分保底拼装失败: {e}")
        return ""


def _looks_like_recommendation_query(msg: str) -> bool:
    if not msg:
        return False
    return bool(RE_REC_INTENT.search(msg))


@csrf_exempt
def analyze_location(request):
    """触发选址分析（异步）"""
    if request.method != 'POST':
        return JsonResponse({"error": "仅支持POST请求"}, status=405)

    try:
        body = json.loads(request.body)
        lat = float(body.get('lat'))
        lng = float(body.get('lng'))
        user_input = body.get('message', f'请分析坐标({lat},{lng})的充电桩选址可行性')
        session_id = body.get('session_id', 'default')
    except Exception as e:
        return JsonResponse({"error": f"参数错误: {e}"}, status=400)

    # 创建任务
    task_id = str(uuid.uuid4())[:8]
    task = AnalysisTask.objects.create(
        task_id=task_id,
        session_id=session_id,
        latitude=lat,
        longitude=lng,
        status='running',
    )

    # 先做快速评分
    quick = quick_score_location(lat, lng)
    task.total_score = quick['total_score']
    task.poi_score = quick['poi_score']
    task.traffic_score = quick['traffic_score']
    task.accessibility_score = quick['accessibility_score']
    task.exclusion_check = quick['exclusion_check']
    task.analysis_detail = quick
    task.save()

    # 异步启动Agent深度分析
    def run_agent():
        try:
            agent = EVChargingAgent(session_id=session_id)
            result = agent.analyze(user_input, lat, lng)
            task.llm_reasoning = result.get('output', '')
            task.rag_context = json.dumps([d['content'][:200] for d in result.get('rag_docs', [])], ensure_ascii=False)
            tool_calls = result.get('tool_calls', [])
            task.analysis_detail = {**quick, "tool_calls": tool_calls}
            task.status = 'completed'
        except Exception as e:
            logger.error(f"Agent分析失败: {e}")
            task.llm_reasoning = f"Agent分析完成（快速模式）：\n\n该位置综合评分 {quick['total_score']}/10\n\n**POI分析**：周边{len(quick.get('nearby_pois', []))}个兴趣点，POI评分{quick['poi_score']}/10\n\n**交通流量**：周边{len(quick.get('nearby_roads', []))}条主干道，流量评分{quick['traffic_score']}/10\n\n**可达性**：可达性评分{quick['accessibility_score']}/10\n\n**环境检查**：{'通过' if quick['exclusion_check'] else '未通过，位于禁止区域'}"
            task.status = 'completed'
        # 保存LocationMemory
        try:
            from memory.models import MemorySession, LocationMemory
            session_obj, _ = MemorySession.objects.get_or_create(session_id=session_id)
            LocationMemory.objects.create(
                session=session_obj,
                latitude=lat, longitude=lng,
                address=f"({lat:.4f}, {lng:.4f})",
                score=quick['total_score']
            )
        except Exception as me:
            logger.warning(f"LocationMemory保存失败: {me}")
        task.save()

    t = threading.Thread(target=run_agent)
    t.daemon = True
    t.start()

    return JsonResponse({
        "task_id": task_id,
        "status": "running",
        "quick_score": quick,
        "message": "分析任务已启动，正在进行深度AI分析..."
    })


def get_task(request, task_id):
    """获取分析任务状态和结果"""
    try:
        task = AnalysisTask.objects.get(task_id=task_id)
    except AnalysisTask.DoesNotExist:
        return JsonResponse({"error": "任务不存在"}, status=404)

    data = {
        "task_id": task.task_id,
        "status": task.status,
        "latitude": task.latitude,
        "longitude": task.longitude,
        "total_score": task.total_score,
        "poi_score": task.poi_score,
        "traffic_score": task.traffic_score,
        "accessibility_score": task.accessibility_score,
        "exclusion_check": task.exclusion_check,
        "llm_reasoning": task.llm_reasoning,
        "rag_context": task.rag_context,
        "analysis_detail": task.analysis_detail,
        "recommendations": task.recommendations,
        "created_at": task.created_at.isoformat(),
    }
    return JsonResponse(data)


def knowledge_graph(request):
    """获取知识图谱数据"""
    nodes = KnowledgeGraphNode.objects.all()
    edges = KnowledgeGraphEdge.objects.all().select_related('source', 'target')

    nodes_data = [{"id": n.node_id, "name": n.name, "type": n.node_type, "properties": n.properties} for n in nodes]
    edges_data = [{"source": e.source.node_id, "target": e.target.node_id, "relation": e.relation, "weight": e.weight} for e in edges]

    return JsonResponse({"nodes": nodes_data, "edges": edges_data})


@csrf_exempt
def agent_chat(request):
    """与Agent对话接口（异步模式，立即返回task_id）"""
    if request.method != 'POST':
        return JsonResponse({"error": "仅支持POST请求"}, status=405)

    try:
        body = json.loads(request.body)
        message = body.get('message', '')
        session_id = body.get('session_id', 'default')
        lat = body.get('lat')
        lng = body.get('lng')
    except Exception as e:
        return JsonResponse({"error": f"参数错误: {e}"}, status=400)

    # 创建聊天任务
    task_id = 'chat_' + str(uuid.uuid4())[:8]
    task = AnalysisTask.objects.create(
        task_id=task_id,
        session_id=session_id,
        latitude=float(lat) if lat else 26.0756,
        longitude=float(lng) if lng else 119.3034,
        status='running',
    )

    def run_chat():
        try:
            agent = EVChargingAgent(session_id=session_id)
            if lat and lng:
                result = agent.analyze(message, float(lat), float(lng))
            else:
                result = agent.chat(message)
            output = result.get('output', '') or ''
            tool_calls = result.get('tool_calls', [])
            task.analysis_detail = {"tool_calls": tool_calls}
            rag_docs = result.get('rag_docs', [])
            task.rag_context = json.dumps([d['content'][:200] for d in rag_docs], ensure_ascii=False)

            # 高分推荐保底：如果用户说“推荐 9.0”但 LLM 输出为空、
            # 或 LLM 输出中含“找不到 / 暂无”且未含具体点位名称，则服务端拼装保底回复。
            need_fallback = (
                _looks_like_recommendation_query(message)
                and (
                    not output.strip()
                    or (RE_NEGATIVE.search(output) and "评分" not in output[:200])
                )
            )
            if need_fallback:
                fb = _build_high_score_fallback(message)
                if fb:
                    output = (output + "\n\n---\n\n" + fb) if output.strip() else fb
                    task.analysis_detail = {
                        "tool_calls": tool_calls + [{
                            "tool": "server_high_score_fallback",
                            "input": {"message": message[:120]},
                            "output": fb[:500],
                        }]
                    }
            task.llm_reasoning = output
            task.status = 'completed'
        except Exception as e:
            logger.error(f"Agent对话失败: {e}")
            # 异常也走保底：用户意图识别为推荐时，直接拼装全域推荐
            try:
                if _looks_like_recommendation_query(message):
                    fb = _build_high_score_fallback(message)
                    task.llm_reasoning = (fb or f"抱歉，分析服务遇到问题：{str(e)[:100]}")
                else:
                    task.llm_reasoning = f"抱歉，分析服务遇到问题：{str(e)[:100]}"
            except Exception:
                task.llm_reasoning = f"抱歉，分析服务遇到问题：{str(e)[:100]}"
            task.status = 'completed'
        task.save()

    t = threading.Thread(target=run_chat)
    t.daemon = True
    t.start()

    return JsonResponse({"success": True, "task_id": task_id, "status": "running", "message": "分析任务已启动"})


def quick_score_api(request):
    """快速评分API（GET请求）"""
    try:
        lat = float(request.GET.get('lat'))
        lng = float(request.GET.get('lng'))
    except (TypeError, ValueError):
        return JsonResponse({"error": "参数错误"}, status=400)
    result = quick_score_location(lat, lng)
    return JsonResponse(result)
