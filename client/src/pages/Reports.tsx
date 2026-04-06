import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Loader2, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { Streamdown } from "streamdown";
import jsPDF from "jspdf";

const SESSION_KEY = "ev_session_id";
function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) { id = nanoid(12); sessionStorage.setItem(SESSION_KEY, id); }
  return id;
}

export default function Reports() {
  const [sessionId] = useState(getSessionId);
  const [lat, setLat] = useState(26.0756);
  const [lng, setLng] = useState(119.3034);
  const [address, setAddress] = useState("福州市鼓楼区候选位置");
  const [report, setReport] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: historyData } = trpc.reports.list.useQuery({ sessionId });
  const reportMutation = trpc.reports.generate.useMutation();

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const result = await reportMutation.mutateAsync({ lat, lng, address, sessionId });
      setReport(result);
      toast.success("报告生成成功");
    } catch {
      toast.error("报告生成失败，请重试");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadReport = async () => {
    if (!report) return;
    setIsDownloading(true);
    toast.info("正在生成PDF，请稍候...");
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // 标题
      pdf.setFontSize(16);
      pdf.setTextColor(0, 180, 180);
      const titleLines = pdf.splitTextToSize(`${address} - 充电桩选址分析报告`, contentWidth);
      titleLines.forEach((line: string) => {
        pdf.text(line, margin, y);
        y += 9;
      });

      // 分割线
      pdf.setDrawColor(0, 180, 180);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 7;

      // 基本信息
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      pdf.text(`生成时间：${new Date().toLocaleString("zh-CN")}`, margin, y);
      y += 6;
      pdf.text(`位置坐标：纬度 ${lat.toFixed(4)}，经度 ${lng.toFixed(4)}`, margin, y);
      y += 6;

      // 综合评分
      pdf.setFontSize(13);
      pdf.setTextColor(0, 180, 80);
      pdf.text(`综合评分：${report.score?.totalScore ?? "N/A"} / 10（${report.score?.grade ?? ""}）`, margin, y);
      y += 9;

      // 评分详情
      if (report.score?.scoreBreakdown) {
        pdf.setFontSize(11);
        pdf.setTextColor(40, 40, 40);
        pdf.text("评分详情：", margin, y);
        y += 6;
        const breakdown = report.score.scoreBreakdown;
        const items: [string, number, string][] = [
          ["POI密度", breakdown.poi, "35%"],
          ["交通流量", breakdown.traffic, "30%"],
          ["可达性", breakdown.accessibility, "20%"],
          ["竞争分析", breakdown.competition, "15%"],
        ];
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        items.forEach(([name, score, weight]) => {
          pdf.text(`  • ${name}：${score}/10（权重${weight}）`, margin, y);
          y += 5.5;
        });
        y += 4;
      }

      // 分割线
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 7;

      // 报告正文（去除Markdown符号）
      pdf.setFontSize(10);
      pdf.setTextColor(40, 40, 40);
      const rawContent = report.reportContent ?? "";
      const plainText = rawContent
        .replace(/^#{1,6}\s+(.+)$/gm, "【$1】")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^[-*+]\s+/gm, "• ")
        .replace(/\|[^\n]+\|/g, "")
        .replace(/^[-|]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      const lines = pdf.splitTextToSize(plainText, contentWidth);
      lines.forEach((line: string) => {
        if (y > pageHeight - margin - 10) {
          pdf.addPage();
          y = margin;
        }
        // 标题行加粗显示
        if (line.startsWith("【") && line.endsWith("】")) {
          pdf.setFontSize(11);
          pdf.setTextColor(0, 120, 180);
          pdf.text(line, margin, y);
          pdf.setFontSize(10);
          pdf.setTextColor(40, 40, 40);
          y += 7;
        } else {
          pdf.text(line, margin, y);
          y += 5.5;
        }
      });

      // 页脚
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `福州新能源充电桩智能选址平台 | 第 ${i} / ${totalPages} 页`,
          margin,
          pageHeight - 8
        );
        pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      }

      pdf.save(`选址报告_${address}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF已下载");
    } catch (err) {
      console.error("PDF生成失败", err);
      toast.error("PDF生成失败，请重试");
    } finally {
      setIsDownloading(false);
    }
  };

  const gradeColor = !report?.score ? "" : report.score.totalScore >= 8.5 ? "score-excellent"
    : report.score.totalScore >= 7 ? "score-good"
    : report.score.totalScore >= 5.5 ? "score-average" : "score-poor";

  return (
    <div className="flex h-screen p-4 gap-4">
      {/* 左侧：参数 + 历史 */}
      <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <div>
          <h1 className="text-xl font-semibold text-foreground">选址报告</h1>
          <p className="text-xs text-muted-foreground mt-0.5">AI生成完整PDF选址分析报告</p>
        </div>

        {/* 参数 */}
        <div className="tech-card p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            报告参数
          </div>
          <div>
            <label className="text-xs text-muted-foreground">位置名称</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 rounded text-xs text-foreground"
              style={{ background: "oklch(0.18 0.022 240)", border: "1px solid oklch(0.25 0.03 240)" }}
            />
          </div>
          {[
            { label: "纬度", value: lat, setter: setLat },
            { label: "经度", value: lng, setter: setLng },
          ].map(({ label, value, setter }) => (
            <div key={label}>
              <label className="text-xs text-muted-foreground">{label}</label>
              <input
                type="number" value={value} step={0.001}
                onChange={e => setter(parseFloat(e.target.value) || 0)}
                className="w-full mt-0.5 px-2 py-1.5 rounded text-xs text-foreground"
                style={{ background: "oklch(0.18 0.022 240)", border: "1px solid oklch(0.25 0.03 240)" }}
              />
            </div>
          ))}
          <button
            onClick={generateReport}
            disabled={isGenerating}
            className="w-full py-2 rounded text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, oklch(0.62 0.22 200), oklch(0.52 0.24 170))", color: "oklch(0.10 0.018 240)" }}
          >
            {isGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />生成中...</> : <><FileText className="w-3.5 h-3.5" />生成报告</>}
          </button>
        </div>

        {/* 历史报告 */}
        {(historyData ?? []).length > 0 && (
          <div className="tech-card p-3">
            <div className="text-xs font-medium text-foreground mb-2">历史报告</div>
            <div className="space-y-1.5">
              {(historyData ?? []).map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => setReport({ reportContent: r.reportContent, score: { totalScore: r.totalScore } })}
                  className="w-full text-left px-2 py-2 rounded text-xs transition-all hover:bg-secondary"
                  style={{ border: "1px solid oklch(0.22 0.028 240)" }}
                >
                  <div className="text-foreground truncate">{r.address}</div>
                  <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                    <Star className="w-2.5 h-2.5" />
                    {r.totalScore} 分
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 右侧：报告内容 */}
      <div className="flex-1 flex flex-col tech-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "oklch(0.22 0.028 240)" }}>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {report ? `${address} - 选址分析报告` : "等待生成报告"}
            </span>
          </div>
          {report && (
            <div className="flex items-center gap-3">
              <div className={`text-lg font-bold ${gradeColor}`}>{report.score?.totalScore} 分</div>
              <button
                onClick={downloadReport}
                disabled={isDownloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all disabled:opacity-60"
                style={{ background: "oklch(0.62 0.22 200 / 0.2)", border: "1px solid oklch(0.62 0.22 200 / 0.4)", color: "oklch(0.72 0.18 200)" }}
              >
                {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {isDownloading ? "生成中..." : "下载PDF"}
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!report && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileText className="w-16 h-16 text-muted-foreground mb-4 opacity-30" />
              <div className="text-sm font-medium text-foreground mb-1">暂无报告</div>
              <div className="text-xs text-muted-foreground">填写左侧参数后点击"生成报告"</div>
            </div>
          )}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <div className="text-sm text-muted-foreground">AI正在生成选址分析报告...</div>
              <div className="text-xs text-muted-foreground mt-1">通常需要10-30秒</div>
            </div>
          )}
          {report && !isGenerating && (
            <div className="prose prose-invert prose-sm max-w-none"
              style={{ color: "oklch(0.85 0.01 240)" }}>
              <Streamdown>{report.reportContent}</Streamdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
