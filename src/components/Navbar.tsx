"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Brain, Home, Layers, User } from "lucide-react";
import { fetchCachedJson } from "@/lib/api/client-cache";
import { clsx } from "clsx";

const nav = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/planning", label: "Akıllı Planlama", icon: Brain },
  { href: "/decompose", label: "Kırılım & Atama", icon: Layers },
  { href: "/dashboard", label: "Sprint Dashboard", icon: BarChart3 },
];

function getPageTitle(path: string) {
  if (path === "/planning") return "Akıllı Planlama";
  if (path === "/decompose") return "Kırılım & Atama";
  if (path === "/dashboard") return "Sprint Dashboard";
  return "Ana Sayfa";
}

export default function Navbar() {
  const path = usePathname();
  const [teamLabel, setTeamLabel] = useState("Jira Takımı");
  const [currentUserName, setCurrentUserName] = useState("");

  useEffect(() => {
    fetchCachedJson<{ project?: { key?: string; name?: string } }>("/api/jira/team")
      .then((data) => {
        const project = data.project;
        const label = project?.name || project?.key;
        if (label) setTeamLabel(label);
      })
      .catch(() => {
        setTeamLabel("Jira Takımı");
      });

    fetchCachedJson<{ user?: { displayName?: string } | null }>("/api/jira/me")
      .then((data) => {
        const displayName = data.user?.displayName?.trim();
        if (displayName) setCurrentUserName(displayName);
      })
      .catch(() => {
        setCurrentUserName("");
      });
  }, []);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 shrink-0 flex-col justify-between border-r border-slate-200 bg-white shadow-sm lg:flex">
        <div className="flex flex-col p-5">
          <Link href="/" className="group mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
              <img src="/logo.png" alt="Turkcell AI Agile Manager" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 transition-colors group-hover:text-[#00509E]">
              AI Agile Manager
            </h1>
          </Link>

          <nav className="flex flex-col gap-1.5">
            {nav.map(({ href, label, icon: Icon }) => {
              const isActive = path === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                    isActive
                      ? "border border-blue-100/70 bg-blue-50 text-[#00509E] font-bold"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-1.5 top-3.5 h-5 w-1 rounded-full bg-[#00509E]" />
                  )}
                  <Icon
                    className={clsx("h-4 w-4", isActive ? "text-[#00509E]" : "text-slate-500")}
                  />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 p-4">
          <Link
            href="/"
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#00509E]/30 hover:text-[#00509E]"
            title="Ana Sayfaya Dön"
          >
            <span>Ana Sayfa</span>
            <Home className="h-4 w-4" />
          </Link>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md lg:left-72 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="flex items-center gap-2 text-slate-900 font-semibold lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
              <img src="/logo.png" alt="Turkcell AI Agile Manager" className="h-full w-full object-contain" />
            </div>
            AI Agile Manager
          </Link>
          <div className="hidden min-w-0 items-center gap-2 lg:flex">
            <span className="max-w-[340px] truncate text-sm font-bold text-slate-900">
              {teamLabel}
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-semibold text-[#00509E]">{getPageTitle(path)}</span>
          </div>
        </div>

        <div className="hidden items-center gap-1 md:flex lg:hidden">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                path === href
                  ? "bg-[#00509E] text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>

        <div className="flex min-w-[160px] justify-end">
          {currentUserName && (
            <div className="flex max-w-[240px] items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#00509E] text-white">
                <User className="h-3.5 w-3.5" />
              </div>
              <span className="truncate text-xs font-semibold text-slate-700">{currentUserName}</span>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
