# CLAUDE.md — AI Agile Manager

Bu dosya Claude Code'un proje bağlamını hızlıca anlaması için yazılmıştır.

## Proje Özeti

IFTS AI Hackathon için geliştirilmiş **AI destekli Scrum asistanı**. Next.js 15 + Claude API + Jira REST API üçlüsüyle çalışır. Üç ana özellik:
1. **Predictive Planning** — Backlog'dan seçilen task'lar için AI story point tahmini
2. **Task Decomposition** — Tek task'ı Frontend/Backend/DB/Test alt görevlerine bölme + akıllı atama
3. **Sprint Dashboard** — Velocity chart, sprint health skoru (1-100), streaming AI raporu

## Komutlar

```bash
npm run dev      # Turbopack ile geliştirme sunucusu (genellikle :3000, bazen :3001)
npm run build    # Production build
npx tsc --noEmit # TypeScript kontrol (hata yoksa çıktı yok)
npm run lint     # ESLint
```

## Kritik Mimari Kararlar

### Mock vs Gerçek Jira
Tüm Jira API route'larında şu mantık geçerli:
```typescript
const useMock = !process.env.JIRA_BASE_URL || searchParams.get("mock") === "true";
```
- `JIRA_BASE_URL` set ise → gerçek Jira
- `?mock=true` query param ile her zaman mock'a zorlanabilir
- Mock data: `src/lib/mock/data.ts`

### Jira Auth — Bearer Token (PAT)
Turkcell Jira, Jira Server/DC Personal Access Token kullanır. Basic Auth değil:
```
Authorization: Bearer <JIRA_API_TOKEN>
```
Jira Cloud (`*.atlassian.net`) için Basic Auth gerekir — `client.ts`'deki `authHeaders()` fonksiyonunu güncelle.

### Jira API Versiyonu
- Issue search: `/rest/api/2/search` (Server uyumlu)
- Sprint/Board: `/rest/agile/1.0/...` (her versiyonda aynı)
- Jira Cloud'a geçince `/rest/api/3/` kullan (description formatı ADF olur — mapper zaten destekliyor)

### Story Points Custom Field
Jira kuruluma göre farklı field ID'leri kullanır. `mapJiraIssue()` şunları sırayla dener:
- `customfield_10016` (Cloud standart)
- `customfield_10028`
- `customfield_10106`

Eğer story point görünmüyorsa Jira admin'den field ID'yi öğren ve `ISSUE_FIELDS` listesine ekle.

### AI Streaming
Sprint raporu (`/api/ai/sprint-report`) Claude'un yanıtını stream eder. Frontend `ReadableStream` ile okur.
Diğer AI endpoint'leri (`predict-size`, `decompose`, `health-score`) tam yanıt bekler.

## Dosya Yapısı

```
src/
├── types/index.ts              — Tüm TypeScript tipleri (JiraIssue, JiraSprint, TeamMember, AI response'ları)
├── lib/
│   ├── jira/client.ts          — Jira fetch wrapper + mapJiraIssue() mapper
│   ├── claude/
│   │   ├── client.ts           — Anthropic SDK instance (MODEL sabiti burada)
│   │   └── prompts.ts          — Tüm AI prompt builder fonksiyonları
│   └── mock/data.ts            — Demo verisi (4 team member, 5 backlog issue, 4 sprint)
├── app/
│   ├── page.tsx                — Landing page
│   ├── planning/page.tsx       — Backlog seç + AI tahmin
│   ├── decompose/page.tsx      — Task kırılımı + ekip kapasitesi
│   ├── dashboard/page.tsx      — Sprint metrikler + health gauge + streaming rapor
│   └── api/
│       ├── jira/               — backlog, sprints, team route'ları
│       └── ai/                 — predict-size, decompose, sprint-report, health-score
└── components/Navbar.tsx       — Sticky navbar (tüm sayfalarda)
```

## Yeni AI Özelliği Eklerken

1. `src/lib/claude/prompts.ts` — `buildXxxPrompt(...)` fonksiyonu ekle
2. `src/app/api/ai/xxx/route.ts` — POST endpoint oluştur, `anthropic.messages.create()` çağır
3. İlgili sayfaya buton + state ekle
4. Streaming gerekiyorsa `sprint-report/route.ts`'i örnek al

## Yeni Jira Endpoint Eklerken

1. `src/lib/jira/client.ts` — `jiraFetch()` kullanan yeni fonksiyon ekle
2. `src/app/api/jira/xxx/route.ts` — mock mantığını kopyala, `mapJiraIssue()` ile map et
3. Frontend'de `useMock` query param geçmeye gerek yok — JIRA_BASE_URL varsa otomatik gerçek

## Ekip Verisini Güncelleme

`src/lib/mock/data.ts` → `mockTeamMembers` dizisini düzenle.
Gerçek implementasyon için: Jira'da `/rest/api/2/group/member?groupname=...` endpoint'i veya LDAP/AD entegrasyonu gerekir.

## Ortam Değişkenleri

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI özellikleri için | claude.ai/settings → API Keys |
| `JIRA_BASE_URL` | Jira için | `https://jira.company.com` |
| `JIRA_API_TOKEN` | Jira için | Jira → Profile → Personal Access Tokens |
| `JIRA_PROJECT_KEY` | Jira için | Örn: `PA472151` |
| `JIRA_BOARD_ID` | Jira için | Board URL'den alınır |
| `JIRA_EMAIL` | Opsiyonel | Şu an kullanılmıyor (PAT auth) |

## Dikkat Edilecekler

- **Jira read-only**: Hiçbir Jira write işlemi yoktur ve yapılmamalıdır (hackathon kuralı)
- **ANTHROPIC_API_KEY olmadan**: AI butonları 500 döndürür — uygulama yine de başlar
- `src/lib/claude/client.ts` içindeki `MODEL` sabitini değiştirerek farklı Claude modeli kullanılabilir
- Sprint issues fetch'i sprint başına bir API call yapar — çok sayıda sprint varsa yavaşlayabilir
