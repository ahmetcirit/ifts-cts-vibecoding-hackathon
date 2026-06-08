# Mimari Dokümanı

## Genel Akış

```
Tarayıcı (React)
    │
    │  fetch("/api/jira/...")
    ▼
Next.js API Route (server-side)
    │                 │
    │  Jira API       │  Anthropic SDK
    ▼                 ▼
Jira REST API     Claude API
(read-only)       (claude-sonnet-4-6)
```

Tüm Jira çağrıları ve Claude çağrıları **sunucu tarafında** gerçekleşir. Tarayıcı asla Jira veya Claude'a doğrudan bağlanmaz. Token'lar yalnızca `.env.local` ve process.env'de yaşar.

---

## Modüller

### `src/types/index.ts`

Projedeki tüm TypeScript arayüzleri tek dosyada toplanmıştır. Kategoriler:

| Grup | Tipler |
|---|---|
| Jira | `JiraIssue`, `JiraUser`, `JiraSprint` |
| Ekip | `TeamMember` |
| AI Yanıtları | `PredictiveSizingResult`, `DecompositionResult`, `SprintHealthScore`, `SprintReport`, `SprintMetrics` |

Yeni bir veri tipi eklenecekse önce buraya, sonra ilgili prompt'a eklenir.

---

### `src/lib/jira/client.ts`

**Sorumluluğu**: Jira API çağrıları + ham Jira verisini `JiraIssue` tipine dönüştürmek.

#### Önemli Fonksiyonlar

| Fonksiyon | Açıklama |
|---|---|
| `mapJiraIssue(raw)` | Jira ham issue → `JiraIssue`. **Export edilmiş** — API route'larında kullanılır |
| `fetchJiraBacklog(projectKey)` | `/rest/api/2/search` ile backlog sorgusu |
| `fetchJiraSprints(boardId, state)` | `/rest/agile/1.0/board/:id/sprint` |
| `fetchSprintIssues(sprintId)` | `/rest/agile/1.0/sprint/:id/issue` |

#### Story Points Keşif Mantığı

Jira kurulumuna göre story points farklı custom field'larda saklanır. Mapper şu sırayla dener:

```typescript
f.customfield_10016 ?? f.customfield_10028 ?? f.customfield_10106 ?? f.story_points
```

Eğer story point görünmüyorsa doğru field ID'yi bulmak için:
```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://jira.company.com/rest/api/2/issue/PROJ-1?fields=*all" | \
  jq '.fields | to_entries[] | select(.value != null) | select(.key | startswith("customfield"))'
```

#### Auth — Bearer vs Basic

```typescript
// Şu anki: Jira Server/DC PAT
Authorization: `Bearer ${TOKEN}`

// Jira Cloud için değiştir:
Authorization: `Basic ${btoa(EMAIL + ":" + TOKEN)}`
```

---

### `src/lib/claude/client.ts`

```typescript
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const MODEL = "claude-sonnet-4-6";
export const MAX_TOKENS = 4096;
```

Model değiştirmek için sadece `MODEL` sabitini güncelle. Tüm route'lar bu sabiti kullanır.

---

### `src/lib/claude/prompts.ts`

Her AI özelliğinin prompt builder fonksiyonu burada. Tüm promptlar:
- Türkçe yazılmıştır (Turkcell/IFTS bağlamı)
- Structured JSON çıktısı ister ("Sadece geçerli JSON döndür")
- Bağlamı zenginleştirecek dinamik veri enjekte eder

| Fonksiyon | Kullanılan veri | Çıktı tipi |
|---|---|---|
| `buildPredictiveSizingPrompt` | `JiraIssue[]` + `JiraSprint[]` | `PredictiveSizingResult` |
| `buildTaskDecompositionPrompt` | `JiraIssue` + `TeamMember[]` | `DecompositionResult` |
| `buildSprintReportPrompt` | `JiraSprint` + metrikler | `SprintReport` (streaming) |
| `buildHealthScorePrompt` | Metrik objesi | `SprintHealthScore` |

---

### `src/app/api/` — Route Katmanı

#### Jira Route'ları

```
/api/jira/backlog   GET  → JiraIssue[]     (mock veya gerçek Jira)
/api/jira/sprints   GET  → JiraSprint[]    (son 5 closed + active, her biri için issue fetch)
/api/jira/team      GET  → TeamMember[]    (Jira'dan; board'da assignee yoksa mock fallback)
```

Mock mantığı her Jira route'unda aynı:
```typescript
const useMock = !process.env.JIRA_BASE_URL || searchParams.get("mock") === "true";
```

#### AI Route'ları

```
/api/ai/predict-size    POST  body: { tasks, sprintHistory }  → PredictiveSizingResult
/api/ai/decompose       POST  body: { task, teamMembers }     → DecompositionResult
/api/ai/sprint-report   POST  body: { sprint, metrics }       → text/plain (streaming)
/api/ai/health-score    POST  body: { metrics... }            → SprintHealthScore
```

Tüm AI route'ları:
1. Prompt builder'ı çağırır
2. `anthropic.messages.create()` veya `anthropic.messages.stream()` yapar
3. Claude'un döndürdüğü JSON'daki markdown fence'leri (`\`\`\`json`) soyar
4. Parse edip döndürür

---

### `src/lib/mock/data.ts`

Demo ve fallback verisi. Gerçek Jira bağlantısı olmadığında veya `?mock=true` geçildiğinde kullanılır.

| Değişken | İçerik |
|---|---|
| `mockTeamMembers` | 4 kişilik ekip (frontend, backend, full-stack, QA) |
| `mockBacklogIssues` | 5 backlog görevi |
| `mockSprintHistory` | Sprint 8-11 (3 closed, 1 active — issues dahil) |

Ekip üyelerini güncellemek: sadece `mockTeamMembers` dizisini düzenle. Yetkinlik, kapasite ve mevcut yük değerleri AI prompt'larına direkt aktarılır.

---

## Yeni Özellik Ekleme Rehberi

### Yeni Bir AI Özelliği

**Örnek: "Blocker Çözüm Önerisi"**

**1. Tip tanımla** (`src/types/index.ts`):
```typescript
export interface BlockerResolution {
  blocker: string;
  rootCause: string;
  solutions: { title: string; effort: "low" | "medium" | "high"; description: string }[];
}
```

**2. Prompt yaz** (`src/lib/claude/prompts.ts`):
```typescript
export function buildBlockerResolutionPrompt(issue: JiraIssue): string {
  return `...${issue.summary}... JSON formatında yanıt ver: { "blocker": "...", ... }`;
}
```

**3. API route oluştur** (`src/app/api/ai/unblock/route.ts`):
```typescript
import { anthropic, MODEL, MAX_TOKENS } from "@/lib/claude/client";
import { buildBlockerResolutionPrompt } from "@/lib/claude/prompts";

export async function POST(request: Request) {
  const { issue } = await request.json();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: buildBlockerResolutionPrompt(issue) }],
  });
  const raw = (message.content[0] as { text: string }).text
    .replace(/^```json\s*|```$/g, "").trim();
  return Response.json(JSON.parse(raw));
}
```

**4. Sayfaya ekle**: İlgili `page.tsx`'te `useState` + `fetch("/api/ai/unblock", ...)` + UI.

---

### Yeni Bir Jira Endpoint

**1. Client'a fonksiyon ekle** (`src/lib/jira/client.ts`):
```typescript
export async function fetchJiraEpics(projectKey: string) {
  const jql = encodeURIComponent(`project="${projectKey}" AND issuetype=Epic AND status!=Done`);
  return jiraFetch(`/rest/api/2/search?jql=${jql}&fields=${ISSUE_FIELDS}`);
}
```

**2. Route oluştur** (`src/app/api/jira/epics/route.ts`):
```typescript
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const useMock = !process.env.JIRA_BASE_URL || searchParams.get("mock") === "true";
  if (useMock) return NextResponse.json({ epics: [] }); // veya mock data

  const { fetchJiraEpics, mapJiraIssue } = await import("@/lib/jira/client");
  const projectKey = searchParams.get("project") ?? process.env.JIRA_PROJECT_KEY ?? "PROJ";
  const data = await fetchJiraEpics(projectKey);
  return NextResponse.json({ epics: (data.issues ?? []).map(mapJiraIssue) });
}
```

---

## Performans Notları

- **Sprint issues**: `/api/jira/sprints` her sprint için ayrı bir issue çağrısı yapar (N+1). Çok sayıda sprint varsa (>10) yavaşlayabilir. Çözüm: batch JQL ile tek sorguda çek.
- **Prompt boyutu**: Büyük backlog'lar (>50 issue) predict-size prompt'unu şişirir. `fetchJiraBacklog` içindeki `maxResults` değerini sınırla.
- **Streaming**: Sprint raporu gerçek zamanlı akar, kullanıcı beklemez. Diğer AI çağrıları ~2-5 sn sürer.

---

## Bilinen Kısıtlamalar

| Kısıt | Açıklama |
|---|---|
| Jira write yok | Hackathon kuralı — alt görevler sadece rapor olarak sunulur, Jira'ya yazılmaz |
| Ekip skills sınırlı | Skills ve role, issue özeti/label/component keyword'lerinden çıkarılır; proje bunları kullanmıyorsa boş kalır |
| Story point field ID | Kuruluma göre değişir; `client.ts`'deki `ISSUE_FIELDS`'a ekle |
| Claude rate limit | Çok sayıda eş zamanlı istek olursa 429 alınabilir — retry mekanizması eklenmemiştir |
