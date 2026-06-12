# Architecture

## Overview

Uygulama Next.js App Router uzerinde calisir. Jira verisi server-side route handler'lar ile cekilir. AI istekleri yine server-side route handler'larda Vercel AI SDK uzerinden Google Gemini'ye gider.

Tarayici asla Gemini API key veya Jira token ile dogrudan haberlesmez.

## Main Areas

- `src/app/`
  - UI sayfalari ve API route'lari
- `src/lib/ai/`
  - Gemini model ayarlari
  - Prompt builder'lar
  - Zod schema'lari
- `src/lib/jira/`
  - Jira fetch client ve mapper mantigi
- `src/lib/mock/`
  - Demo veri
- `src/types/`
  - Ortak tipler

## AI Flow

JSON donen endpoint'ler:

1. Request body route handler'a gelir.
2. Prompt `src/lib/ai/prompts.ts` icinde olusturulur.
3. `generateObject(...)` ile Gemini'den schema uyumlu veri alinir.
4. Sonuc `NextResponse.json(...)` ile donulur.

Streaming endpoint:

1. Route handler prompt'u olusturur.
2. `streamText(...)` ile Gemini cevabi parcali okunur.
3. `ReadableStream` olarak client'a aktarilir.

## Environment

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your_jira_api_token_here
JIRA_PROJECT_KEY=SCRUM
JIRA_BOARD_ID=1
```
