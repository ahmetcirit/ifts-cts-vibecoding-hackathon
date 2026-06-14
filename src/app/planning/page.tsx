"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { fetchCachedJson } from "@/lib/api/client-cache";
import {
  AlertCircle,
  BrainCircuit,
  CheckSquare,
  Info,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { JiraIssue, JiraSprint, PredictiveSizingResult } from "@/types";
import { clsx } from "clsx";

const PRIORITY_BADGE: Record<string, string> = {
  Highest: "bg-rose-50 text-rose-600 border border-rose-200",
  High: "bg-orange-50 text-orange-600 border border-orange-200",
  Medium: "bg-amber-50 text-amber-700 border border-amber-200",
  Low: "bg-blue-50 text-blue-600 border border-blue-200",
  Lowest: "bg-slate-100 text-slate-600 border border-slate-200",
};

const TYPE_BADGE: Record<string, string> = {
  Story: "bg-blue-50 text-[#00509E] border border-blue-100",
  Task: "bg-slate-100 text-slate-600 border border-slate-200",
  Bug: "bg-rose-50 text-rose-600 border border-rose-200",
  Epic: "bg-purple-50 text-purple-700 border border-purple-200",
  "Sub-task": "bg-slate-100 text-slate-600 border border-slate-200",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  low: "bg-rose-50 text-rose-700 border border-rose-200",
};

export default function PlanningPage() {
  const [backlog, setBacklog] = useState<JiraIssue[]>([]);
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeTaskKey, setActiveTaskKey] = useState<string>("");
  const [result, setResult] = useState<PredictiveSizingResult | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchCachedJson<{ issues?: JiraIssue[] }>("/api/jira/backlog"),
      fetchCachedJson<{ sprints?: JiraSprint[] }>("/api/jira/sprints"),
    ])
      .then(([b, s]) => {
        const issues = b.issues ?? [];
        setBacklog(issues);
        setSprints(s.sprints ?? []);
        setActiveTaskKey(issues[0]?.key ?? "");
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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "AI predict-size failed");
      }
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingAI(false);
    }
  }

  const closedSprints = sprints.filter((s) => s.state === "closed").slice(-5);
  const maxVelocity = Math.max(...closedSprints.map((s) => s.completedPoints ?? 0), 1);
  const avgVelocity =
    closedSprints.length
      ? Math.round(closedSprints.reduce((a, s) => a + (s.velocity ?? 0), 0) / closedSprints.length)
      : 0;

  const predictionMap = new Map((result?.predictions ?? []).map((p) => [p.taskKey, p]));
  const selectedPointTotal = useMemo(
    () =>
      backlog
        .filter((issue) => selected.has(issue.key))
        .reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0),
    [backlog, selected]
  );
  const activeTask = backlog.find((issue) => issue.key === activeTaskKey) ?? backlog[0];
  const activePrediction = activeTask ? predictionMap.get(activeTask.key) : undefined;

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-800">
      <Navbar />
      <main className="w-full px-4 pb-10 pt-20 sm:px-6 lg:ml-72 lg:max-w-[calc(100%-18rem)] lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="flex flex-col space-y-4 lg:col-span-2">
            <div className="flex flex-col space-y-1.5">
              <div className="flex items-center gap-2 text-[#00509E]">
                <BrainCircuit className="h-4 w-4" />
                <span className="font-mono text-xs font-bold tracking-wider" lang="en">
                  PREDICTIVE PLANNING
                </span>
              </div>
              <h1 className="text-left text-2xl font-bold tracking-tight text-slate-900">
                Akıllı Sprint Planlama
              </h1>
              <p className="text-left text-sm text-slate-500">
                Backlog'dan tahmin etmek istediğiniz taskları seçin; Jira verisi ve sprint
                geçmişi korunarak AI story point tahmini alın.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-[#00509E]" />
                <span className="text-sm font-semibold text-slate-800">
                  Backlog
                  <span className="ml-2 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] text-slate-700">
                    {backlog.length} task
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden font-mono text-xs text-slate-500 sm:inline">
                  {selected.size} seçili
                </span>
                <button
                  onClick={predictSizes}
                  disabled={selected.size === 0 || loadingAI}
                  className={clsx(
                    "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all",
                    selected.size === 0 || loadingAI
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-blue-600 bg-[#00509E] text-white shadow-sm hover:bg-[#003B75] hover:shadow-md active:scale-95"
                  )}
                >
                  {loadingAI ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>{loadingAI ? "AI Tahmin Ediyor..." : "AI Tahmin Et"}</span>
                </button>
              </div>
            </div>

            {loadingData ? (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yükleniyor...
              </div>
            ) : (
              <div className="max-h-[640px] space-y-3 overflow-y-auto pr-2 scrollbar-thin">
                {backlog.map((issue) => {
                  const pred = predictionMap.get(issue.key);
                  const isSelected = selected.has(issue.key);
                  const isActive = activeTaskKey === issue.key;

                  return (
                    <div
                      key={issue.key}
                      onClick={() => setActiveTaskKey(issue.key)}
                      className={clsx(
                        "group relative flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all duration-200",
                        isActive
                          ? "border-[#00509E] bg-blue-50/40 shadow-sm"
                          : "border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-50/50"
                      )}
                    >
                      <div className="flex max-w-[80%] items-center gap-4">
                        <button
                          type="button"
                          className="relative flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white hover:border-[#00509E]"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSelect(issue.key);
                          }}
                          aria-label={`${issue.key} seç`}
                        >
                          {isSelected && <span className="h-3 w-3 rounded-sm bg-[#00509E]" />}
                        </button>

                        <div className="min-w-0 text-left">
                          <div className="mb-1 flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-xs font-bold tracking-wide text-[#00509E]">
                              {issue.key}
                            </span>
                            <span
                              className={clsx(
                                "rounded-md px-2 py-0.5 font-mono text-[9px] font-bold uppercase",
                                TYPE_BADGE[issue.issueType]
                              )}
                            >
                              {issue.issueType}
                            </span>
                            <span
                              className={clsx(
                                "rounded-md px-2 py-0.5 text-[9px] font-bold",
                                PRIORITY_BADGE[issue.priority]
                              )}
                            >
                              {issue.priority}
                            </span>
                          </div>
                          <h2 className="truncate text-sm font-semibold text-slate-800">
                            {issue.summary}
                          </h2>
                          {issue.components.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {issue.components.map((component) => (
                                <span
                                  key={component}
                                  className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-slate-500"
                                >
                                  {component}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 pl-4 text-right">
                        <div className="flex min-w-14 flex-col items-center justify-center">
                          <span className="text-xl font-black leading-none text-slate-800">
                            {pred?.suggestedPoints ?? issue.storyPoints ?? 0}
                          </span>
                          <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-wide text-[#00509E]">
                            {pred ? "AI SP" : "SP"}
                          </span>
                          {pred && (
                            <span
                              className={clsx(
                                "mt-2 rounded-md px-2 py-0.5 text-[9px] font-bold",
                                CONFIDENCE_BADGE[pred.confidence]
                              )}
                            >
                              {pred.confidence}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="flex flex-col space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <TrendingUp className="h-4 w-4 text-[#FFCB05]" />
                  Velocity Trendi
                </span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-800">{avgVelocity}</span>
                <span className="text-xs font-medium text-slate-500">ort. pts/sprint</span>
              </div>
              <div className="mt-6 h-36">
                <div className="flex h-full items-end gap-4 border-b border-slate-200 px-2">
                  {closedSprints.map((sprint) => {
                    const completed = sprint.completedPoints ?? 0;
                    const planned = sprint.plannedPoints ?? 0;
                    const height = Math.max(10, Math.round((completed / maxVelocity) * 100));
                    return (
                      <div key={sprint.id} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-28 w-full items-end justify-center">
                          <div
                            className={clsx(
                              "w-7 rounded-t-md",
                              completed >= planned ? "bg-[#00509E]" : "bg-[#FFCB05]"
                            )}
                            style={{ height: `${height}%` }}
                            title={`${sprint.name}: ${completed} SP`}
                          />
                        </div>
                        <span className="max-w-16 truncate font-mono text-[9px] font-bold text-slate-500">
                          {sprint.name.replace("Sprint ", "S")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <BrainCircuit className="h-4.5 w-4.5 text-[#00509E]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  AI Öngörü
                </h3>
              </div>
              <div className="mt-4 space-y-4">
                {result ? (
                  <>
                    <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-[#003B75]">
                      <Info className="h-5 w-5 shrink-0 text-[#00509E]" />
                      <div>
                        <span className="text-xs font-bold text-slate-800">Velocity yorumu</span>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                          {result.velocityInsight}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3.5">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                        Seçili task toplamı
                      </div>
                      <div className="mt-1 text-lg font-bold text-[#00509E]">
                        {result.predictions.reduce((sum, p) => sum + p.suggestedPoints, 0)} Story Point
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
                    AI tahmini çalıştığında velocity yorumu, kapasite önerisi ve task bazlı
                    gerekçeler burada görünecek.
                  </div>
                )}
              </div>
            </div>

            {activeTask && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <span className="text-xs font-extrabold text-slate-700">
                      {activeTask.key}
                    </span>
                    <h3 className="truncate text-sm font-bold text-slate-800">
                      {activeTask.summary}
                    </h3>
                  </div>
                  <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#00509E]">
                    {activePrediction?.suggestedPoints ?? activeTask.storyPoints ?? 0} SP
                  </span>
                </div>
                <div className="mt-4">
                  <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-700">
                    AI analiz gerekçesi
                  </span>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
                    {activePrediction?.reasoning ??
                      "Task seçildi. AI tahmini çalıştırıldığında modelin story point gerekçesi burada gösterilecek."}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
