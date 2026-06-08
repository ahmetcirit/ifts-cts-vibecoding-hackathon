"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { Layers, Loader2, AlertCircle, User, Clock, ChevronRight } from "lucide-react";
import type { JiraIssue, TeamMember, DecompositionResult, SubTaskType } from "@/types";
import { clsx } from "clsx";

const TYPE_COLOR: Record<SubTaskType, string> = {
  Frontend: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Backend: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Database: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Test: "bg-green-500/10 text-green-400 border-green-500/20",
  DevOps: "bg-slate-500/10 text-slate-400 border-slate-600",
  Design: "bg-pink-500/10 text-pink-400 border-pink-500/20",
};

export default function DecomposePage() {
  const [backlog, setBacklog] = useState<JiraIssue[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTask, setSelectedTask] = useState<JiraIssue | null>(null);
  const [result, setResult] = useState<DecompositionResult | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/jira/backlog").then((r) => r.json()),
      fetch("/api/jira/team").then((r) => r.json()),
    ])
      .then(([b, t]) => {
        setBacklog(b.issues ?? []);
        setTeamMembers(t.members ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingData(false));
  }, []);

  async function decompose(task: JiraIssue) {
    setSelectedTask(task);
    setResult(null);
    setLoadingAI(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, teamMembers }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingAI(false);
    }
  }

  function memberById(id: string) {
    return teamMembers.find((m) => m.id === id);
  }

  const capacityPct = (m: TeamMember) =>
    Math.round((m.currentLoad / m.capacity) * 100);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-purple-400 text-sm mb-1 font-mono">
            <Layers className="w-4 h-4" /> Task Decomposition
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Görev Kırılımı & Akıllı Atama</h1>
          <p className="text-slate-400 text-sm mt-1">
            Bir görev seç → AI saniyeler içinde alt görevlere böler ve takıma atar
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Task list + team capacity */}
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-200 text-sm">Görevler</h2>
            {loadingData ? (
              <div className="flex items-center text-slate-500 text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor…
              </div>
            ) : (
              <div className="space-y-2">
                {backlog.map((issue) => (
                  <button
                    key={issue.key}
                    onClick={() => decompose(issue)}
                    className={clsx(
                      "w-full text-left p-3 rounded-xl border transition-all flex items-start gap-2",
                      selectedTask?.key === issue.key
                        ? "border-purple-500/40 bg-purple-500/5"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700"
                    )}
                  >
                    <span className="text-xs font-mono text-slate-500 shrink-0 mt-0.5">{issue.key}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{issue.summary}</p>
                      <div className="flex gap-1 mt-1">
                        {issue.components.map((c) => (
                          <span key={c} className="text-xs bg-slate-800 text-slate-400 px-1 py-0.5 rounded">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            )}

            {/* Team Capacity */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">Ekip Kapasitesi</h3>
              <div className="space-y-3">
                {teamMembers.map((m) => {
                  const pct = capacityPct(m);
                  return (
                    <div key={m.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{m.name.split(" ")[0]}</span>
                        <span className={clsx("font-medium", pct >= 80 ? "text-red-400" : pct >= 60 ? "text-yellow-400" : "text-emerald-400")}>
                          {m.currentLoad}/{m.capacity} pts
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={clsx("h-full rounded-full transition-all", pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-yellow-500" : "bg-emerald-500")}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Decomposition Result */}
          <div className="lg:col-span-2">
            {!selectedTask && (
              <div className="h-full flex items-center justify-center text-slate-600 text-sm border border-dashed border-slate-800 rounded-2xl min-h-64">
                ← Soldan bir görev seçin
              </div>
            )}

            {selectedTask && loadingAI && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 bg-slate-900 border border-slate-800 rounded-2xl">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                <p className="text-slate-400 text-sm">AI alt görevleri oluşturuyor…</p>
              </div>
            )}

            {selectedTask && !loadingAI && result && (
              <div className="space-y-4">
                {/* Header */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-mono text-slate-500 mb-1">{selectedTask.key}</div>
                      <h2 className="text-lg font-semibold text-slate-100">{selectedTask.summary}</h2>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-purple-400">{result.subtasks.length}</div>
                      <div className="text-xs text-slate-500">alt görev</div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {result.totalEstimatedHours} saat toplam
                    </div>
                  </div>
                </div>

                {/* Sub-tasks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.subtasks.map((sub, i) => {
                    const assignee = memberById(sub.suggestedAssignee);
                    return (
                      <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={clsx("text-xs px-2 py-0.5 rounded border", TYPE_COLOR[sub.type])}>
                            {sub.type}
                          </span>
                          <span className="text-xs text-slate-500 ml-auto flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {sub.estimatedHours}h
                          </span>
                        </div>
                        <h4 className="text-sm font-medium text-slate-200 mb-1">{sub.title}</h4>
                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">{sub.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1 flex-wrap">
                            {sub.skills.map((s) => (
                              <span key={s} className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                          </div>
                          {assignee && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 ml-2">
                              <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <User className="w-3 h-3 text-purple-400" />
                              </div>
                              {assignee.name.split(" ")[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI Rationale */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 mb-2 font-medium">Atama Gerekçesi</div>
                  <p className="text-sm text-slate-400 leading-relaxed">{result.assignmentRationale}</p>
                </div>

                {/* Risks */}
                {result.risks.length > 0 && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium mb-2">
                      <AlertCircle className="w-3.5 h-3.5" /> Potansiyel Riskler
                    </div>
                    <ul className="space-y-1">
                      {result.risks.map((r, i) => (
                        <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
