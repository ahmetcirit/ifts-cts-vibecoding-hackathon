"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { fetchCachedJson } from "@/lib/api/client-cache";
import {
  BarChart3,
  Loader2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Minus,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
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

function HealthGauge({ score, color }: { score: number; color: string }) {
  const r = 54;
  const cx = 70;
  const cy = 70;
  const circumference = Math.PI * r; // half circle
  const progress = (score / 100) * circumference;
  return (
    <svg width="140" height="80" viewBox="0 0 140 80">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#1e293b"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${progress} ${circumference}`}
      />
    </svg>
  );
}

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-blue-400",
  C: "text-yellow-400",
  D: "text-orange-400",
  F: "text-red-400",
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
    const avgV =
      closedSprints.length
        ? closedSprints.reduce((a, s) => a + (s.velocity ?? 0), 0) / closedSprints.length
        : 0;
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

  // startDate'e göre en güncelden en eskiye — sadece son 5 sprint
  const velocityChartData = sprints
    .filter((s) => !!s.startDate)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 5)
    .map((s) => ({
      name: s.name.replace("Sprint ", "S"),
      Planlanan: s.plannedPoints,
      Tamamlanan: s.completedPoints,
    }));

  const gaugeColor = healthScore
    ? healthScore.score >= 80 ? "#10b981" : healthScore.score >= 60 ? "#f59e0b" : "#ef4444"
    : "#334155";

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1 font-mono">
              <BarChart3 className="w-4 h-4" /> Sprint Review
            </div>
            <h1 className="text-2xl font-bold text-slate-100">
              {activeSprint?.name ?? "Sprint Dashboard"}
            </h1>
            {activeSprint?.goal && (
              <p className="text-slate-400 text-sm mt-1">Hedef: {activeSprint.goal}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchHealthScore}
              disabled={!activeSprint || loadingHealth}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              {loadingHealth ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Health Skoru
            </button>
            <button
              onClick={generateReport}
              disabled={!activeSprint || loadingReport}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {loadingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {loadingReport ? "Rapor oluşturuluyor…" : "AI Rapor Oluştur"}
            </button>
          </div>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center h-48 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yükleniyor…
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metric Cards */}
            {metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Tamamlanma",
                    value: `${metrics.completionRate}%`,
                    sub: `${metrics.completedPoints}/${metrics.plannedPoints} pts`,
                    color: metrics.completionRate >= 80 ? "text-emerald-400" : metrics.completionRate >= 60 ? "text-yellow-400" : "text-red-400",
                  },
                  {
                    label: "Tamamlanan",
                    value: `${metrics.doneTasks}/${metrics.totalTasks}`,
                    sub: "task",
                    color: "text-blue-400",
                  },
                  {
                    label: "Carryover",
                    value: metrics.carryoverTasks,
                    sub: `${metrics.carryoverRate}% sonraki sprint`,
                    color: metrics.carryoverTasks > 2 ? "text-orange-400" : "text-slate-300",
                  },
                  {
                    label: "Blocker",
                    value: metrics.blockedTasks,
                    sub: "task",
                    color: metrics.blockedTasks > 0 ? "text-red-400" : "text-emerald-400",
                  },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 mb-1">{label}</div>
                    <div className={clsx("text-2xl font-bold", color)}>{value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Velocity Chart */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Planlanan vs Gerçekleşen (Son 5 Sprint)
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={velocityChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Planlanan" fill="#334155" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Tamamlanan" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Health Score Gauge */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Sprint Health
                </h3>
                {!healthScore && !loadingHealth && (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-600 text-xs text-center">
                    <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
                    "Health Skoru" butonuna basın
                  </div>
                )}
                {loadingHealth && (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  </div>
                )}
                {healthScore && !loadingHealth && (
                  <div className="flex flex-col items-center">
                    <HealthGauge score={healthScore.score} color={gaugeColor} />
                    <div className="text-center -mt-2">
                      <div className={clsx("text-4xl font-bold", GRADE_COLOR[healthScore.grade])}>
                        {healthScore.score}
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">/100 · Grade {healthScore.grade}</div>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-3 leading-relaxed">
                      {healthScore.summary}
                    </p>
                    {healthScore.recommendations.length > 0 && (
                      <ul className="mt-3 space-y-1 w-full">
                        {healthScore.recommendations.slice(0, 2).map((r, i) => (
                          <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Issue list */}
            {activeSprint && activeSprint.issues.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-200 mb-4">Sprint Görevleri</h3>
                <div className="space-y-2">
                  {activeSprint.issues.map((issue) => (
                    <div key={issue.id} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
                      <div className="shrink-0">
                        {issue.status === "Done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : issue.status === "Blocked" ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : issue.status === "In Progress" ? (
                          <Clock className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Minus className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-500 w-20 shrink-0">{issue.key}</span>
                      <span className="text-sm text-slate-300 flex-1 truncate">{issue.summary}</span>
                      <span className={clsx(
                        "text-xs px-2 py-0.5 rounded shrink-0",
                        issue.status === "Done" ? "bg-emerald-500/10 text-emerald-400" :
                        issue.status === "Blocked" ? "bg-red-500/10 text-red-400" :
                        issue.status === "In Progress" ? "bg-blue-500/10 text-blue-400" :
                        "bg-slate-800 text-slate-400"
                      )}>
                        {issue.status}
                      </span>
                      {issue.storyPoints && (
                        <span className="text-xs text-slate-500 w-8 text-right shrink-0">{issue.storyPoints}p</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Report */}
            {(reportText || loadingReport) && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  AI Sprint Raporu
                  {loadingReport && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
                </h3>
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-slate-950 rounded-xl p-4 max-h-80 overflow-y-auto scrollbar-thin">
                  {reportText}
                  {loadingReport && <span className="animate-pulse">▋</span>}
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
