"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, BarChart3, Layers, Zap } from "lucide-react";
import { clsx } from "clsx";

const nav = [
  { href: "/planning", label: "Planlama", icon: Brain },
  { href: "/decompose", label: "Kırılım & Atama", icon: Layers },
  { href: "/dashboard", label: "Sprint Dashboard", icon: BarChart3 },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-slate-100 font-semibold">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          AI Agile Manager
        </Link>
        <div className="flex items-center gap-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                path === href
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
