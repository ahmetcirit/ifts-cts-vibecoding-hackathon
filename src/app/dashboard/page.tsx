"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { fetchCachedJson } from "@/lib/api/client-cache";
import {
  AlertCircle,
  BadgeAlert,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Minus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  XCircle,
} from "lucide-react";
import type { JiraSprint, SprintHealthScore, TeamMember } from "@/types";
import { clsx } from "clsx";

function calcMetrics(sprint: JiraSprint) {
  const total = sprint.issues.length;
  const done = sprint.issues.filter((i) => i.status === "Done").length;
  const blocked = sprint.issues.filter((i) => i.status === "Blocked").length;
  const carryover = sprint.issues.filter((i) => i.status !== "Done").length;
  const planned = sprint.plannedPoints ?? 0;
  const completed = sprint.completedPoints ?? 0;
  return {
    completionRate: planned > 0 ? Math.round((completed / planned) * 100) : 0,
    plannedPoints: planned,
    completedPoints: completed,
    totalTasks: total,
    doneTasks: done,
    blockedTasks: blocked,
    carryoverTasks: carryover,
    carryoverRate: total > 0 ? Math.round((carryover / total) * 100) : 0,
  };
}

function HealthGauge({ score }: { score: number }) {
  const dashOffset = 125 * (1 - score / 100);
  return (
    <div className="relative h-28 w-44">
      <svg className="absolute inset-0" viewBox="0 0 100 50">
        <path
          d="M 10,45 A 35,35 0 0,1 90,45"
          fill="none"
          stroke="#f1f5f9"
          strokeLinecap="round"
          strokeWidth="10"
        />
        <path
          d="M 10,45 A 35,35 0 0,1 90,45"
          fill="none"
          stroke="url(#healthMeterGlow)"
          strokeDasharray="125"
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth="10"
        />
        <defs>
          <linearGradient id="healthMeterGlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-700 border-emerald-200 bg-emerald-50",
  B: "text-emerald-700 border-emerald-200 bg-emerald-50",
  C: "text-amber-700 border-amber-200 bg-amber-50",
  D: "text-orange-700 border-orange-200 bg-orange-50",
  F: "text-rose-700 border-rose-200 bg-rose-50",
};

export default function DashboardPage() {
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activeSprint, setActiveSprint] = useState<JiraSprint | null>(null);
  const [healthScore, setHealthScore] = useState<SprintHealthScore | null>(null);
  const [reportText, setReportText] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<"All" | "To Do" | "In Progress" | "Done" | "Blocked">(
    "All"
  );

  useEffect(() => {
    Promise.all([
      fetchCachedJson<{ sprints?: JiraSprint[] }>("/api/jira/sprints"),
      fetchCachedJson<{ members?: TeamMember[] }>("/api/jira/team"),
    ])
      .then(([sprintData, teamData]) => {
        const all: JiraSprint[] = sprintData.sprints ?? [];
        setSprints(all);
        setTeamMembers(teamData.members ?? []);
        const active = all.find((s) => s.state === "active") ?? all[all.length - 1];
        setActiveSprint(active ?? null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingData(false));
  }, []);

  async function fetchHealthScore() {
    if (!activeSprint) return;
    const m = calcMetrics(activeSprint);
    const closedSprints = sprints.filter((s) => s.state === "closed");
    const lastV = closedSprints[closedSprints.length - 1]?.velocity ?? 0;
    const prevV = closedSprints[closedSprints.length - 2]?.velocity ?? 0;
    const trend = lastV > prevV ? "up" : lastV < prevV ? "down" : "stable";
    const teamCapacityUsage = teamMembers.length
      ? Math.round(
          (teamMembers.reduce((sum, member) => sum + member.currentLoad, 0) /
            teamMembers.reduce((sum, member) => sum + member.capacity, 0)) *
            100
        )
      : 0;

    setLoadingHealth(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/health-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completionRate: m.completionRate,
          velocityTrend: trend,
          blockerCount: m.blockedTasks,
          carryoverRate: m.carryoverRate,
          teamCapacityUsage,
          sprintGoalMet: m.completionRate >= 80,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setHealthScore(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingHealth(false);
    }
  }

  async function generateReport() {
    if (!activeSprint) return;
    const m = calcMetrics(activeSprint);
    setLoadingReport(true);
    setReportText("");
    setError(null);
    try {
      const res = await fetch("/api/ai/sprint-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprint: activeSprint, metrics: m }),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text);
      }
      setReportText(text.trim());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingReport(false);
    }
  }

  const metrics = activeSprint ? calcMetrics(activeSprint) : null;
  const velocityChartData = sprints
    .filter((s) => !!s.startDate)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5)
    .reverse()
    .map((s) => ({
      name: s.name.replace("Sprint ", "S"),
      Planlanan: s.plannedPoints,
      Tamamlanan: s.completedPoints,
    }));
  const maxChartPoints = Math.max(
    ...velocityChartData.flatMap((item) => [item.Planlanan ?? 0, item.Tamamlanan ?? 0]),
    1
  );
  const filteredIssues =
    activeSprint?.issues.filter((issue) => taskFilter === "All" || issue.status === taskFilter) ?? [];

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-800">
      <Navbar />
      <main className="w-full px-4 pb-10 pt-20 sm:px-6 lg:ml-72 lg:max-w-[calc(100%-18rem)] lg:px-8">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
            <div className="text-left">
              <span className="font-mono text-xs font-bold tracking-wider text-[#00509E]" lang="en">
                SPRINT REVIEW
              </span>
              <h1 className="mt-1 text-3xl font-medium text-slate-900">
                {activeSprint?.name ?? "Sprint Dashboard"}
              </h1>
              {activeSprint?.goal && (
                <p className="mt-1 text-sm text-slate-500">Hedef: {activeSprint.goal}</p>
              )}
            </div>

            <div className="flex items-center gap-3 self-start md:self-center">
              <button
                onClick={fetchHealthScore}
                disabled={!activeSprint || loadingHealth}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
              >
                {loadingHealth ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00509E]" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-[#00509E]" />
                )}
                Health Skoru
              </button>
              <button
                onClick={generateReport}
                disabled={!activeSprint || loadingReport}
                className="flex items-center gap-2 rounded-xl border border-blue-600 bg-[#00509E] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#003B75] hover:shadow-md disabled:opacity-50"
              >
                {loadingReport ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {loadingReport ? "Rapor oluşturuluyor..." : "AI Rapor Oluştur"}
              </button>
            </div>
          </div>

          {loadingData ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yükleniyor...
            </div>
          ) : (
            <>
              {metrics && (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    {
                      title: "Tamamlanma",
                      value: `${metrics.completionRate}%`,
                      subText: `${metrics.completedPoints}/${metrics.plannedPoints} Pts`,
                      subTextColor: metrics.completionRate >= 80 ? "text-emerald-600" : "text-amber-600",
                    },
                    {
                      title: "Tamamlanan",
                      value: `${metrics.doneTasks}/${metrics.totalTasks}`,
                      subText: "Task",
                      subTextColor: "text-slate-500",
                    },
                    {
                      title: "Carryover",
                      value: metrics.carryoverTasks,
                      subText: `${metrics.carryoverRate}% Sonraki Sprinte Devreden Tasklar`,
                      subTextColor: "text-[#00509E]",
                    },
                    {
                      title: "Blocker",
                      value: metrics.blockedTasks,
                      subText: "Task",
                      subTextColor:
                        metrics.blockedTasks > 0 ? "text-rose-600" : "text-slate-500",
                    },
                  ].map((metric) => (
                    <div
                      key={metric.title}
                      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm"
                    >
                      <span className="mb-2 block text-xs font-medium text-slate-600">
                        {metric.title}
                      </span>
                      <div className="text-3xl font-medium leading-none text-slate-800">
                        {metric.value}
                      </div>
                      <span className={clsx("mt-1.5 block text-xs font-medium", metric.subTextColor)}>
                        {metric.subText}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm lg:col-span-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <ShieldCheck className="h-4.5 w-4.5 text-[#00509E]" />
                    Planlanan vs Gerceklesen (Son 5 Sprint)
                  </span>
                  <div className="mt-6 h-64">
                    <div className="relative flex h-full items-end gap-6 border-b border-slate-200 px-4">
                      <div className="absolute inset-x-4 top-6 border-t border-slate-100" />
                      <div className="absolute inset-x-4 top-20 border-t border-slate-100" />
                      <div className="absolute inset-x-4 top-36 border-t border-slate-100" />
                      {velocityChartData.map((item) => {
                        const planned = item.Planlanan ?? 0;
                        const completed = item.Tamamlanan ?? 0;
                        const plannedHeight = Math.max(8, Math.round((planned / maxChartPoints) * 180));
                        const completedHeight = Math.max(8, Math.round((completed / maxChartPoints) * 180));
                        return (
                          <div key={item.name} className="relative z-10 flex flex-1 flex-col items-center gap-3">
                            <div className="flex h-48 items-end gap-1.5">
                              <div
                                className="w-5 rounded-t bg-slate-300"
                                style={{ height: plannedHeight }}
                                title={`${item.name} planlanan: ${planned}`}
                              />
                              <div
                                className="w-5 rounded-t bg-emerald-500"
                                style={{ height: completedHeight }}
                                title={`${item.name} tamamlanan: ${completed}`}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-700">
                              {item.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-6 text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                        Planlanan
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                        Tamamlanan
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <TrendingDown className="h-4.5 w-4.5 text-rose-500" />
                    Sprint Health
                  </span>

                  <div className="my-auto flex flex-col items-center py-6">
                    {loadingHealth ? (
                      <div className="flex flex-col items-center gap-4 py-8">
                        <Loader2 className="h-10 w-10 animate-spin text-[#00509E]" />
                        <span className="text-xs font-semibold text-slate-700">
                          Sağlık skoru analiz ediliyor...
                        </span>
                      </div>
                    ) : healthScore ? (
                      <div className="flex w-full flex-col items-center text-center">
                        <div className="relative">
                          <HealthGauge score={healthScore.score} />
                          <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
                            <span className="text-4xl font-black tracking-tight text-slate-800">
                              {healthScore.score}
                            </span>
                            <span
                              className={clsx(
                                "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                GRADE_COLOR[healthScore.grade]
                              )}
                            >
                              Grade {healthScore.grade}
                            </span>
                          </div>
                        </div>
                        <p className="mt-3 max-w-xs text-[11px] font-semibold leading-normal text-slate-600">
                          {healthScore.summary}
                        </p>
                        {healthScore.recommendations.length > 0 && (
                          <div className="mt-4 w-full space-y-2 border-t border-slate-100 pt-3.5 text-left">
                            {healthScore.recommendations.slice(0, 2).map((rec, index) => (
                              <div
                                key={index}
                                className="flex items-start gap-2 text-[10.5px] leading-relaxed text-slate-600"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                                <span>{rec}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-10 text-center">
                        <BadgeAlert className="h-8 w-8 text-slate-400" />
                        <p className="max-w-xs text-xs leading-relaxed text-slate-500">
                          Health Skoru butonuna basarak sprint risk değerlendirmesini başlatın.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {activeSprint && activeSprint.issues.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-md font-bold text-slate-800">Sprint Tasklari</h3>
                    <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-[11px]">
                      {(["All", "To Do", "In Progress", "Done", "Blocked"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setTaskFilter(tab)}
                          className={clsx(
                            "rounded-lg px-3 py-1.5 font-bold transition-all",
                            taskFilter === tab
                              ? "bg-[#00509E] text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          {tab === "All" ? "Tümü" : tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto scrollbar-thin">
                    {filteredIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm hover:bg-slate-50/50"
                      >
                        <div className="flex max-w-[80%] items-center gap-3.5">
                          {issue.status === "Done" ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          ) : issue.status === "Blocked" ? (
                            <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                          ) : issue.status === "In Progress" ? (
                            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                          ) : (
                            <Minus className="h-4 w-4 shrink-0 text-slate-400" />
                          )}
                          <span className="min-w-[75px] shrink-0 font-mono text-[10.5px] font-bold text-[#00509E]">
                            {issue.key}
                          </span>
                          <span className="truncate text-xs font-semibold text-slate-800">
                            {issue.summary}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3.5 pl-3">
                          <span
                            className={clsx(
                              "rounded-lg px-2 py-0.5 text-[10px] font-bold",
                              issue.status === "Done"
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                : issue.status === "Blocked"
                                  ? "border border-rose-200 bg-rose-50 text-rose-700"
                                  : issue.status === "In Progress"
                                    ? "border border-amber-200 bg-amber-50 text-amber-700"
                                    : "border border-slate-200 bg-slate-100 text-slate-600"
                            )}
                          >
                            {issue.status}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <span className="text-xs font-black text-slate-800">
                              {issue.storyPoints ?? 0}
                            </span>
                            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#00509E]">
                              p
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
                <div className="absolute left-0 top-0 -z-0 h-48 w-48 rounded-full bg-blue-500/5 blur-[60px]" />
                <div className="relative flex items-center gap-2 border-b border-slate-100 pb-3">
                  <FileText className="h-5 w-5 text-[#00509E]" />
                  <h3 className="text-md font-bold text-slate-800">AI Sprint Raporu</h3>
                  {loadingReport && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
                </div>

                <div className="relative mt-5">
                  {loadingReport ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-16">
                      <Loader2 className="h-10 w-10 animate-spin text-[#00509E]" />
                      <div className="space-y-1 text-center text-xs font-semibold text-slate-700">
                        <p>Sprint verileri işleniyor...</p>
                        <p className="text-xs text-slate-600">
                          Scrum Master odaklı durum raporu yazılıyor...
                        </p>
                      </div>
                    </div>
                  ) : reportText ? (
                    <div className="max-w-4xl rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-700 shadow-inner">
                      {reportText}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                      <FileText className="mx-auto h-8 w-8 text-slate-400" />
                      <h4 className="mt-4 text-sm font-bold text-slate-800">Sprint Raporu Boş</h4>
                      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                        AI Rapor Oluştur butonuna tıklayarak sprintin teslimat, akışkanlık ve
                        takip ihtiyacını yorumlatabilirsiniz.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
