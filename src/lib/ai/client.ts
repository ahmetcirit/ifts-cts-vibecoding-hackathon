import { google } from "@ai-sdk/google";

export const MODEL = "gemini-2.5-flash";
export const TEMPERATURE = 0;
export const MAX_OUTPUT_TOKENS = 4096;
export const GOOGLE_PROVIDER_OPTIONS = {
  google: {
    thinkingConfig: {
      thinkingBudget: 0,
    },
  },
} as const;

export const geminiModel = google(MODEL);

export async function repairJsonText({ text }: { text: string }) {
  const cleaned = text
    .replace(/^Here is the JSON requested:\s*/i, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");
  const hasObject = objectStart >= 0;
  const hasArray = arrayStart >= 0;

  if (!hasObject && !hasArray) {
    return cleaned;
  }

  if (hasArray && (!hasObject || arrayStart < objectStart)) {
    const arrayEnd = cleaned.lastIndexOf("]");
    return arrayEnd > arrayStart ? cleaned.slice(arrayStart, arrayEnd + 1).trim() : cleaned;
  }

  const objectEnd = cleaned.lastIndexOf("}");
  return objectEnd > objectStart ? cleaned.slice(objectStart, objectEnd + 1).trim() : cleaned;
}
