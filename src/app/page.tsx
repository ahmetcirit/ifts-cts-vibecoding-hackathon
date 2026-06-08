import Link from "next/link";
import { Brain, BarChart3, Layers, Zap, ArrowRight } from "lucide-react";

const features = [
  {
    href: "/planning",
    icon: Brain,
    title: "Akıllı Planlama",
    subtitle: "Predictive Planning",
    description:
      "Backlog'dan task seç, takımın geçmiş velocity'sine göre story point tahmini yap. Sprint kapasitesini AI ile optimize et.",
    gradient: "from-blue-600 to-blue-800",
    border: "hover:border-blue-500/40",
    points: ["Jira backlog okuma", "AI story point tahmini", "Velocity analizi"],
  },
  {
    href: "/decompose",
    icon: Layers,
    title: "Görev Kırılımı & Atama",
    subtitle: "Task Decomposition",
    description:
      "Bir task'ı saniyeler içinde Frontend, Backend, DB, Test alt görevlerine böl. Yetenek matrisine göre akıllı atama öner.",
    gradient: "from-purple-600 to-purple-800",
    border: "hover:border-purple-500/40",
    points: ["Otomatik sub-task üretimi", "Kapasite bazlı atama", "Risk tespiti"],
  },
  {
    href: "/dashboard",
    icon: BarChart3,
    title: "Sprint Dashboard",
    subtitle: "Sprint Review",
    description:
      "Planlanan vs gerçekleşen metrikleri görselleştir. AI ile sprint review raporu oluştur. Sağlık skoru hesapla.",
    gradient: "from-emerald-600 to-emerald-800",
    border: "hover:border-emerald-500/40",
    points: ["Sprint health skoru (1-100)", "AI raporlama (streaming)", "Carryover metrikleri"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-blue-400 text-sm mb-6">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse-slow" />
              IFTS AI Hackathon 2025
            </div>

            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AI Agile Manager
              </h1>
            </div>

            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Sprint planlama ve raporlama iş yükünü yapay zeka ile otomatikleştir.
              Takımın tüm enerjisini kod yazmaya ve değer üretmeye odakla.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {features.map(({ href, icon: Icon, title, subtitle, description, gradient, border, points }) => (
              <Link
                key={href}
                href={href}
                className={`group relative bg-slate-900 border border-slate-800 ${border} rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30`}
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>

                <div className="text-xs font-mono text-slate-500 mb-1">{subtitle}</div>
                <h2 className="text-lg font-semibold text-slate-100 mb-2">{title}</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">{description}</p>

                <ul className="space-y-1 mb-4">
                  {points.map((p) => (
                    <li key={p} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="w-1 h-1 rounded-full bg-slate-600" />
                      {p}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-1 text-sm font-medium text-blue-400 group-hover:gap-2 transition-all">
                  Başla <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
        IFTS AI Hackathon 2025 · Powered by Claude AI + Jira REST API
      </footer>
    </main>
  );
}
