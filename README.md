# AI Agile Manager

> IFTS AI Hackathon 2026 - Coklu LLM destekli Scrum asistani

Sprint planlama, gorev kirilimi ve raporlama is yukunu AI ile otomatiklestiren bir yonetim paneli. Jira backlog'unu okur, takim yetkinliklerine gore gorev atar ve sprint review raporunu otomatik uretir.

## Ozellikler

| Modul | Aciklama |
|---|---|
| **Akilli Planlama** | Backlog'dan task sec, velocity gecmisine gore AI story point tahmini al |
| **Gorev Kirilimi** | Bir task'i Frontend/Backend/DB/Test alt gorevlerine bol, ekibe ata |
| **Sprint Dashboard** | Planlanan vs gerceklesen metrikler, 1-100 health skoru, streaming AI raporu |

## Gereksinimler

- Node.js 18+
- Google Gemini, OpenAI veya Anthropic Claude API key
- Jira erisimi (opsiyonel - mock data ile de calisir)

## Kurulum

```bash
npm install
cp .env.local.example .env.local
```

`.env.local` icindeki AI provider/key ve Jira degerlerini doldurun.

```bash
npm run dev
```

Uygulama `http://localhost:3000` adresinde acilir.

AI provider/model secimi sadece server-side `.env.local` uzerinden yapilir. Degisiklikten sonra Next.js dev server'i yeniden baslatin.

Ornek:

```bash
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
```

## Ortam Degiskenleri

```bash
# AI provider: gemini/google, openai, claude/anthropic
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
AI_TEMPERATURE=0
AI_MAX_OUTPUT_TOKENS=4096
GOOGLE_THINKING_BUDGET=0

# Secilen provider icin ilgili key zorunlu
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Opsiyonel - yoksa mock data kullanilir
JIRA_BASE_URL=https://jira.company.com
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your_jira_api_token_here
JIRA_PROJECT_KEY=PROJ
JIRA_BOARD_ID=1
```

## Teknoloji Yigini

- Frontend & API: Next.js 15
- AI: Vercel AI SDK + Google Gemini/OpenAI/Claude
- Validation: Zod
- Jira: REST API v2
- UI: Tailwind CSS + Recharts + Lucide Icons
- Dil: TypeScript

## Proje Yapisi

```text
src/
|-- app/
|   |-- page.tsx
|   |-- planning/
|   |-- decompose/
|   |-- dashboard/
|   `-- api/
|       |-- jira/
|       `-- ai/
|-- components/
|-- lib/
|   |-- ai/
|   |-- jira/
|   `-- mock/
`-- types/
```

## Gelistirme

```bash
npm run dev
npm run build
npx tsc --noEmit
```
