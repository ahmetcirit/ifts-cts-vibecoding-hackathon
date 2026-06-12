# Project Notes

Bu repo IFTS AI Hackathon icin gelistirilmis AI destekli Scrum asistanidir.

## Stack

- Next.js 15
- Vercel AI SDK
- Google Gemini (`gemini-2.5-pro`)
- Jira REST API
- TypeScript

## AI Yapisi

- Ortak model ayarlari: `src/lib/ai/client.ts`
- Prompt builder'lar: `src/lib/ai/prompts.ts`
- Structured output schema'lari: `src/lib/ai/schemas.ts`
- API route'lari:
  - `src/app/api/ai/predict-size/route.ts`
  - `src/app/api/ai/decompose/route.ts`
  - `src/app/api/ai/health-score/route.ts`
  - `src/app/api/ai/sprint-report/route.ts`

## Environment

Gerekli AI degiskeni:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
```

Jira degiskenleri opsiyoneldir. Tanimli degilse mock data kullanilabilir.
