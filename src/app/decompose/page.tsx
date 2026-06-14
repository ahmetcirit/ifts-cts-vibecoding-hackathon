"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { fetchCachedJson } from "@/lib/api/client-cache";
import {
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Clock,
  Layers,
  Loader2,
  Sparkles,
  Terminal,
  UserCheck,
} from "lucide-react";
import type {
  DecompositionResult,
  JiraIssue,
  JiraSprint,
  SubTaskType,
  TeamMember,
} from "@/types";
import { clsx } from "clsx";

const TYPE_COLOR: Record<SubTaskType, string> = {
  Frontend: "bg-blue-50 text-blue-700 border-blue-200",
  Backend: "bg-purple-50 text-purple-700 border-purple-200",
  Database: "bg-amber-50 text-amber-800 border-amber-200",
  Test: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DevOps: "bg-slate-100 text-slate-700 border-slate-200",
  Design: "bg-pink-50 text-pink-700 border-pink-200",
};

const IDEAL_MEMBER_CAPACITY_POINTS = 18;

export default function DecomposePage() {
  const [backlog, setBacklog] = useState<JiraIssue[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [activeSprint, setActiveSprint] = useState<JiraSprint | null>(null);
  const [selectedTask, setSelectedTask] = useState<JiraIssue | null>(null);
  const [result, setResult] = useState<DecompositionResult | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchCachedJson<{ issues?: JiraIssue[] }>("/api/jira/backlog"),
      fetchCachedJson<{ members?: TeamMember[] }>("/api/jira/team"),
      fetchCachedJson<{ sprints?: JiraSprint[] }>("/api/jira/sprints"),
    ])
      .then(([b, t, s]) => {
        setBacklog(b.issues ?? []);
        setTeamMembers(t.members ?? []);
        const allSprints = s.sprints ?? [];
        const active =
          allSprints.find((sprint) => sprint.state === "active") ??
          allSprints[allSprints.length - 1] ??
          null;
        setActiveSprint(active);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingData(false));
  }, []);

  function getIssuePoints(issue: JiraIssue) {
    return typeof issue.storyPoints === "number" && issue.storyPoints > 0 ? issue.storyPoints : 0;
  }

  function isOpenCapacityStatus(issue: JiraIssue) {
    return issue.status === "In Progress" || issue.status === "To Do";
  }

  const activeTeamMembers = (() => {
    if (!activeSprint) return teamMembers;

    const activeMemberStats = new Map<string, { openPoints: number }>();

    for (const issue of activeSprint.issues) {
      const assigneeId = issue.assignee?.accountId;
      if (!assigneeId) continue;

      const current = activeMemberStats.get(assigneeId) ?? { openPoints: 0 };
      if (isOpenCapacityStatus(issue)) {
        current.openPoints += getIssuePoints(issue);
      }
      activeMemberStats.set(assigneeId, current);
    }

    const filtered = teamMembers
      .filter((member) => activeMemberStats.has(member.id))
      .map((member) => {
        const stats = activeMemberStats.get(member.id)!;
        return {
          ...member,
          currentLoad: stats.openPoints,
          capacity: IDEAL_MEMBER_CAPACITY_POINTS,
        };
      })
      .sort((a, b) => {
        if (b.currentLoad !== a.currentLoad) return b.currentLoad - a.currentLoad;
        return a.name.localeCompare(b.name, "tr");
      });

    return filtered.length > 0 ? filtered : teamMembers;
  })();

  async function decompose(task: JiraIssue) {
    setSelectedTask(task);
    setResult(null);
    setLoadingAI(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, teamMembers: activeTeamMembers }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "AI decompose failed");
      }
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingAI(false);
    }
  }

  function memberById(id: string) {
    return activeTeamMembers.find((m) => m.id === id);
  }

  const capacityPct = (m: TeamMember) =>
    m.capacity > 0 ? Math.round((m.currentLoad / m.capacity) * 100) : 0;

  const mostLoadedMember = activeTeamMembers[0];

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-800">
      <Navbar />
      <main className="w-full px-4 pb-10 pt-20 sm:px-6 lg:ml-72 lg:max-w-[calc(100%-18rem)] lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="flex flex-col space-y-4">
            <div className="flex flex-col space-y-1.5 text-left">
              <span className="font-mono text-xs font-bold tracking-wide text-[#00509E]" lang="en">
                TASKS LIST
              </span>
              <h1 className="text-xl font-bold text-slate-900">Görevler</h1>
              <p className="text-sm text-slate-600">
                Kırılımını incelemek veya otomatikleştirmek istediğiniz task'ı seçin.
              </p>
            </div>

            {loadingData ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
              </div>
            ) : (
              <div className="max-h-[640px] space-y-2.5 overflow-y-auto pr-2 scrollbar-thin">
                {backlog.map((issue) => {
                  const isActive = selectedTask?.key === issue.key;
                  return (
                    <button
                      key={issue.key}
                      onClick={() => decompose(issue)}
                      className={clsx(
                        "group flex w-full items-center justify-between rounded-xl border p-4 text-left shadow-sm transition-all duration-200",
                        isActive
                          ? "border-[#00509E] bg-blue-50/40"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                      )}
                    >
                      <div className="min-w-0 max-w-[80%]">
                        <span className="font-mono text-[10px] font-bold tracking-wider text-[#00509E]">
                          {issue.key}
                        </span>
                        <h2 className="truncate text-xs font-semibold text-slate-800">
                          {issue.summary}
                        </h2>
                        {issue.components.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {issue.components.slice(0, 3).map((component) => (
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
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
              <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-700">
                Kapasite Metrikleri
              </span>
              <div className="flex items-start gap-2.5 pt-1">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Aktif sprintte görevi olan kişiler listelenir. Değerler açık iş SP / 18 ideal
                  kapasite mantığı ile Jira sprint tasklarından hesaplanır.
                  {mostLoadedMember && (
                    <>
                      {" "}
                      En yuksek acik yuk:{" "}
                      <strong className="text-rose-600">
                        {mostLoadedMember.name} ({mostLoadedMember.currentLoad} SP)
                      </strong>
                      .
                    </>
                  )}
                </p>
              </div>
            </div>
          </section>

          <section className="flex flex-col space-y-6 lg:col-span-2">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
              <div className="absolute right-0 top-0 -z-0 h-40 w-40 rounded-full bg-blue-500/5 blur-[50px]" />
              <div className="relative flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <span className="text-xs font-extrabold tracking-wide text-[#00509E]">
                    {selectedTask?.key ?? "Task seçilmedi"}
                  </span>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {selectedTask?.summary ?? "Görev Kırılımı & Akıllı Atama"}
                  </h2>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {selectedTask?.description ??
                      "Soldaki listeden bir task seçerek AI ile alt görev kırılımı oluşturun."}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5">
                    <span className="text-lg font-black text-[#00509E]">
                      {result?.subtasks.length ?? 0}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase text-slate-700">
                      Alt Görev
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5">
                    <span className="text-lg font-black text-slate-800">
                      {result?.totalEstimatedHours ?? 0}h
                    </span>
                    <span className="text-[10px] font-extrabold uppercase text-slate-700">
                      Toplam
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="max-w-md text-xs leading-relaxed text-slate-500">
                  AI, task detaylarını ve ekip kapasitesini okuyarak mantıksal alt görevler,
                  sorumlu önerisi ve risk listesi üretir.
                </span>
                <button
                  onClick={() => selectedTask && decompose(selectedTask)}
                  disabled={!selectedTask || loadingAI}
                  className="flex items-center justify-center gap-2 rounded-xl border border-blue-600 bg-[#00509E] px-5 py-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#003B75] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {loadingAI ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>{loadingAI ? "AI Kırılım Üretiyor..." : "AI ile Kırılım Oluştur"}</span>
                </button>
              </div>
            </div>

            {loadingAI && (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-[#00509E]" />
                <p className="text-sm text-slate-500">AI alt görevleri oluşturuyor...</p>
              </div>
            )}

            {!loadingAI && result && (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {result.subtasks.map((subtask, index) => {
                    const assignee = memberById(subtask.suggestedAssignee);
                    return (
                      <div
                        key={`${subtask.title}-${index}`}
                        className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50/20"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span
                              className={clsx(
                                "rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase",
                                TYPE_COLOR[subtask.type]
                              )}
                            >
                              {subtask.type}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-500">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {subtask.estimatedHours} saat
                            </span>
                          </div>
                          <h3 className="mt-3.5 text-sm font-bold leading-snug text-slate-800">
                            {subtask.title}
                          </h3>
                          <p className="mt-2 min-h-12 text-[11px] leading-relaxed text-slate-500">
                            {subtask.description}
                          </p>
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-2.5 border-t border-slate-100 pt-3">
                          <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-slate-700">
                            <UserCheck className="h-3 w-3 text-slate-400" />
                            Sorumlu
                          </span>
                          <span className="max-w-[160px] truncate rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                            {assignee?.name ?? "Atanmadi"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm">
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-700">
                    Atama Gerekçesi
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">{result.assignmentRationale}</p>
                </div>

                {result.risks.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left shadow-sm">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" /> Potansiyel Riskler
                    </div>
                    <ul className="space-y-1">
                      {result.risks.map((risk, index) => (
                        <li key={index} className="flex items-start gap-1.5 text-xs text-slate-600">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {!selectedTask && !loadingAI && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                <Terminal className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-4 text-sm font-bold text-slate-800">Alt Görevler Henüz Üretilmedi</h3>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                  Soldaki listeden bir task seçerek AI kırılım sürecini başlatın.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div>
                  <h3 className="text-md font-bold text-slate-800">Ekip Kapasitesi</h3>
                  <p className="text-[11px] leading-none text-slate-500">
                    Aktif sprintteki acik SP yuku. Limit: 18 SP idealdir.
                  </p>
                </div>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1 font-mono text-[9px] font-bold text-slate-600">
                  {activeTeamMembers.length} Uye
                </span>
              </div>

              <div className="space-y-4">
                {activeTeamMembers.map((member) => {
                  const pct = capacityPct(member);
                  const isOverloaded = member.currentLoad > member.capacity;
                  return (
                    <div key={member.id} className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="font-mono tracking-wide text-slate-700">{member.name}</span>
                        <span
                          className={clsx(
                            "rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold",
                            isOverloaded
                              ? "border border-rose-200 bg-rose-50 text-rose-700"
                              : pct >= 80
                                ? "border border-amber-200 bg-amber-50 text-amber-700"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          )}
                        >
                          {member.currentLoad}/{member.capacity} pts
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full border border-slate-200/80 bg-slate-100">
                        <div
                          className={clsx(
                            "h-full rounded-full transition-all",
                            isOverloaded ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-[#00509E]"
                          )}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {activeTeamMembers.length === 0 && (
                  <div className="text-xs text-slate-600">Aktif sprintte atanmış kişi bulunamadı.</div>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
