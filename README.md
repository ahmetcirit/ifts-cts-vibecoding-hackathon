# AI Agile Manager

> IFTS AI Hackathon 2025 — AI destekli Scrum asistanı

Sprint planlama, görev kırılımı ve raporlama iş yükünü Claude AI ile otomatikleştiren bir yönetim paneli. Jira backlog'unu okur, takım yetkinliklerine göre görev atar ve sprint review raporunu otomatik üretir.

## Özellikler

| Modül | Açıklama |
|---|---|
| **Akıllı Planlama** | Backlog'dan task seç, velocity geçmişine göre AI story point tahmini al |
| **Görev Kırılımı** | Bir task'ı Frontend/Backend/DB/Test alt görevlerine böl, ekibe ata |
| **Sprint Dashboard** | Planlanan vs gerçekleşen metrikler, 1-100 health skoru, streaming AI raporu |

## Gereksinimler

- Node.js 18+
- Anthropic API key (`console.anthropic.com`)
- Jira erişimi (opsiyonel — mock data ile de çalışır)

## Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Ortam dosyasını oluştur
cp .env.local.example .env.local
# .env.local içindeki ANTHROPIC_API_KEY ve Jira değerlerini doldur

# Geliştirme sunucusunu başlat
npm run dev
```

Uygulama `http://localhost:3000` adresinde açılır.

## Ortam Değişkenleri

```bash
# Zorunlu (AI özellikleri için)
ANTHROPIC_API_KEY=sk-ant-...

# Opsiyonel — yoksa mock data kullanılır
JIRA_BASE_URL=https://jira.company.com
JIRA_API_TOKEN=your-personal-access-token
JIRA_PROJECT_KEY=PROJ
JIRA_BOARD_ID=1
```

**Jira bağlantısı olmadan** uygulama tamamen çalışır — `src/lib/mock/data.ts` içindeki demo verisi kullanılır.

## Teknoloji Yığını

- **Frontend & API**: Next.js 15 (App Router, Route Handlers)
- **AI**: Claude API (`claude-sonnet-4-6`) — tahmin, kırılım, raporlama
- **Jira**: REST API v2 — sadece okuma (write işlemi yok)
- **UI**: Tailwind CSS + Recharts + Lucide Icons
- **Tip güvenliği**: TypeScript (strict mod)

## Proje Yapısı

```
src/
├── app/
│   ├── page.tsx                 # Landing
│   ├── planning/                # Predictive Planning sayfası
│   ├── decompose/               # Task Decomposition sayfası
│   ├── dashboard/               # Sprint Review Dashboard
│   └── api/
│       ├── jira/                # backlog · sprints · team
│       └── ai/                  # predict-size · decompose · sprint-report · health-score
├── components/
│   └── Navbar.tsx
├── lib/
│   ├── claude/                  # Anthropic SDK client + prompt builder'ları
│   ├── jira/                    # Jira fetch client + issue mapper
│   └── mock/                    # Demo verisi
└── types/
    └── index.ts                 # Tüm TypeScript arayüzleri
```

## Mock ve Gerçek Jira

Tüm Jira endpoint'leri:
- `JIRA_BASE_URL` tanımlı → gerçek Jira
- `JIRA_BASE_URL` tanımsız → mock data
- `?mock=true` query parametresi → her zaman mock'a zorla

## Geliştirme

```bash
npm run dev          # Turbopack ile hot-reload
npm run build        # Production build
npx tsc --noEmit     # TypeScript kontrolü
npm run lint         # ESLint
```

Yeni özellik eklemek için [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) dosyasına bakın.
