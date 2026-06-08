"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { Brain, CheckSquare, Square, Loader2, TrendingUp, AlertCircle, ChevronRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { JiraIssue, JiraSprint, PredictiveSizingResult } from "@/types";
import { clsx } from "clsx";

const PRIORITY_COLOR: Record<string, string> = {
  Highest: "text-red-400",
  High: "text-orange-400",
  Medium: "text-yellow-400",
  Low: "text-green-400",
  Lowest: "text-slate-500",
};

const TYPE_BADGE: Record<string, string> = {
  Story: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Task: "bg-slate-700 text-slate-300 border-slate-600",
  Bug: "bg-red-500/10 text-red-400 border-red-500/20",
  Epic: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Sub-task": "bg-slate-700 text-slate-400 border-slate-600",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  high: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  low: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function PlanningPage() {
  const [backlog, setBacklog] = useState<JiraIssue[]>([]);
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<PredictiveSizingResult | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/jira/backlog").then((r) => r.json()),
      fetch("/api/jira/sprints").then((r) => r.json()),
    ])
      .then(([b, s]) => {
        setBacklog(b.issues ?? []);
        setSprints(s.sprints ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingData(false));
  }, []);

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function predictSizes() {
    const tasks = backlog.filter((i) => selected.has(i.key));
    if (!tasks.length) return;
    setLoadingAI(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/predict-size", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks, sprintHistory: sprints }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingAI(false);
    }
  }

  const closedSprints = sprints.filter((s) => s.state === "closed").slice(-5);
  const avgVelocity =
    closedSprints.length
      ? Math.round(closedSprints.reduce((a, s) => a + (s.velocity ?? 0), 0) / closedSprints.length)
      : 0;

  const predictionMap = new Map(
    (result?.predictions ?? []).map((p) => [p.taskKey, p])
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-blue-400 text-sm mb-1 font-mono">
            <Brain className="w-4 h-4" /> Predictive Planning
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Akıllı Sprint Planlama</h1>
          <p className="text-slate-400 text-sm mt-1">
            Backlog'dan task seç → AI ile story point tahmin et → Sprint kapasitesini optimize et
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Backlog */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-200">
                Backlog ({backlog.length} görev)
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {selected.size} seçili
                </span>
                <button
                  onClick={predictSizes}
                  disabled={selected.size === 0 || loadingAI}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  {loadingAI ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Brain className="w-3.5 h-3.5" />
                  )}
                  {loadingAI ? "Tahmin yapılıyor…" : "AI Tahmin Et"}
                </button>
              </div>
            </div>

            {loadingData ? (
              <div className="flex items-center justify-center h-48 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yükleniyor…
              </div>
            ) : (
              <div className="space-y-2">
                {backlog.map((issue) => {
                  const pred = predictionMap.get(issue.key);
                  const isSelected = selected.has(issue.key);
                  return (
                    <div
                      key={issue.key}
                      onClick={() => toggleSelect(issue.key)}
                      className={clsx(
                        "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                        isSelected
                          ? "border-blue-500/40 bg-blue-500/5"
                          : "border-slate-800 bg-slate-900 hover:border-slate-700"
                      )}
                    >
                      <div className="mt-0.5 text-slate-500">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono text-slate-500">{issue.key}</span>
                          <span className={clsx("text-xs px-1.5 py-0.5 rounded border", TYPE_BADGE[issue.issueType])}>
                            {issue.issueType}
                          </span>
                          <span className={clsx("text-xs font-medium", PRIORITY_COLOR[issue.priority])}>
                            {issue.priority}
                          </span>
                        </div>
                        <p className="text-sm text-slate-200 truncate">{issue.summary}</p>
                        {issue.components.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {issue.components.map((c) => (
                              <span key={c} className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {pred && (
                        <div className="text-right shrink-0">
                          <div className="text-xl font-bold text-blue-400">{pred.suggestedPoints}</div>
                          <div className="text-xs text-slate-500">pts</div>
                          <span className={clsx("text-xs px-1.5 py-0.5 rounded border mt-1 inline-block", CONFIDENCE_BADGE[pred.confidence])}>
                            {pred.confidence}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Velocity + AI Insights */}
          <div className="space-y-4">
            {/* Velocity Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-slate-200 text-sm">Velocity Trendi</h3>
              </div>
              <div className="text-2xl font-bold text-emerald-400 mb-4">{avgVelocity} <span className="text-sm text-slate-500 font-normal">ort. pts/sprint</span></div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={closedSprints} barSize={18}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Bar dataKey="completedPoints" radius={[3, 3, 0, 0]} name="Tamamlanan">
                    {closedSprints.map((entry, i) => (
                      <Cell key={i} fill={entry.completedPoints! >= entry.plannedPoints! ? "#10b981" : "#f59e0b"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* AI Insights */}
            {result && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-blue-400" /> AI Öngörüler
                </h3>
                <div className="bg-slate-800/60 rounded-xl p-3 text-sm text-slate-300 leading-relaxed">
                  {result.velocityInsight}
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <div className="text-xs text-blue-400 font-medium mb-1">Sprint Kapasite Önerisi</div>
                  <div className="text-sm text-slate-300">{result.sprintCapacityRecommendation}</div>
                </div>
                {/* Selected tasks summary */}
                <div>
                  <div className="text-xs text-slate-500 mb-2">Seçili görev toplamı</div>
                  <div className="text-2xl font-bold text-slate-100">
                    {result.predictions.reduce((a, p) => a + p.suggestedPoints, 0)}{" "}
                    <span className="text-sm text-slate-500 font-normal">story point</span>
                  </div>
                </div>
              </div>
            )}

            {/* Prediction Details */}
            {result?.predictions.map((p) => (
              <div key={p.taskKey} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-slate-500">{p.taskKey}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-blue-400">{p.suggestedPoints} pts</span>
                    <span className={clsx("text-xs px-1.5 py-0.5 rounded border", CONFIDENCE_BADGE[p.confidence])}>
                      {p.confidence}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{p.reasoning}</p>
              </div>
            ))}

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
