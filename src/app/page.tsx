import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Layers,
  Sparkles,
  Target,
  UserCheck,
} from "lucide-react";

const features = [
  {
    href: "/planning",
    icon: Brain,
    title: "Akıllı Sprint Planlama",
    subtitle: "PREDICTIVE PLANNING",
    description:
      "Backlog'dan taskları seçin, geçmiş velocity ve sprint verisine göre AI destekli story point tahmini alın.",
    iconBg: "bg-blue-50 text-[#00509E] border border-blue-100",
    gradient: "from-blue-50 via-blue-50/20 to-transparent",
    bullets: ["Jira backlog okuma", "AI story point tahmini", "Velocity analizi"],
  },
  {
    href: "/decompose",
    icon: Layers,
    title: "Görev Kırılımı ve Atama",
    subtitle: "TASK DECOMPOSITION",
    description:
      "Taskları Frontend, Backend, DB, Test gibi alt işlere bölün; ekip kapasitesine göre sorumlu önerisi alın.",
    iconBg: "bg-amber-50 text-amber-700 border border-amber-100",
    gradient: "from-amber-50 via-amber-50/10 to-transparent",
    bullets: ["Otomatik sub-task üretimi", "Kapasite bazlı atama", "Risk tespiti"],
  },
  {
    href: "/dashboard",
    icon: BarChart3,
    title: "Sprint Dashboard & Rapor",
    subtitle: "SPRINT REVIEW",
    description:
      "Planlanan/gerçekleşen metrikleri izleyin, health skorunu hesaplayın ve AI sprint raporu üretin.",
    iconBg: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    gradient: "from-emerald-50 via-emerald-50/10 to-transparent",
    bullets: ["Sprint health skoru", "AI sprint raporu", "Carryover metrikleri"],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-800">
      <Navbar />
      <main className="relative w-full overflow-hidden px-4 pb-10 pt-20 sm:px-6 lg:ml-72 lg:max-w-[calc(100%-18rem)] lg:px-8">
        <div className="absolute left-1/4 top-14 -z-0 h-96 w-96 rounded-full bg-blue-500/10 blur-[90px]" />
        <div className="absolute bottom-20 right-1/4 -z-0 h-96 w-96 rounded-full bg-amber-400/10 blur-[90px]" />

        <section className="relative py-6 sm:py-10">
          <div className="relative mt-6 text-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-28 z-0 hidden -translate-x-1/2 select-none text-7xl font-light tracking-[-0.08em] text-slate-300/45 sm:block lg:text-8xl"
            >
              AGILE
            </div>
            <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center">
              <img src="/logo.png" alt="Turkcell AI Agile Manager" className="h-full w-full object-contain" />
            </div>
            <h1 className="relative text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              <span className="text-[#002f66]">AI Agile Manager</span>
            </h1>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Sprint planlama ve raporlama süreçlerinizi AI ile otomatikleştirin
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                value: "Jira",
                label: "Canlı backlog ve sprint verisi",
                icon: Target,
                iconColor: "text-blue-600",
                iconBg: "bg-blue-50 border-blue-100",
              },
              {
                value: "AI",
                label: "Planlama ve kırılım desteği",
                icon: Sparkles,
                iconColor: "text-amber-600",
                iconBg: "bg-amber-50 border-amber-100",
              },
              {
                value: "Scrum",
                label: "Rapor, health ve kapasite takibi",
                icon: UserCheck,
                iconColor: "text-emerald-600",
                iconBg: "bg-emerald-50 border-emerald-100",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.value}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border ${item.iconBg} ${item.iconColor}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-bold leading-none text-slate-900">{item.value}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link
                  key={feature.href}
                  href={feature.href}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                  <div
                    className={`absolute inset-0 -z-0 bg-gradient-to-b ${feature.gradient} opacity-20 transition-opacity duration-300 group-hover:opacity-100`}
                  />
                  <div className="relative flex items-center justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${feature.iconBg}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-[#00509E]" lang="en">
                      {feature.subtitle}
                    </span>
                  </div>

                  <h2 className="relative mt-5 text-left text-lg font-bold tracking-tight text-slate-800">
                    {feature.title}
                  </h2>
                  <p className="relative mt-2 min-h-[72px] text-left text-sm leading-relaxed text-slate-500">
                    {feature.description}
                  </p>

                  <ul className="relative mt-5 space-y-2.5 border-t border-slate-100 pt-5 text-left">
                    {feature.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-center text-xs text-slate-600">
                        <span className="mr-2.5 h-1.5 w-1.5 rounded-full bg-[#00509E] transition-colors group-hover:bg-[#FFCB05]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>

                  <div className="relative mt-6 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700 transition-all group-hover:border-transparent group-hover:bg-[#00509E] group-hover:text-white">
                    <span>Keşfet ve Başla</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
