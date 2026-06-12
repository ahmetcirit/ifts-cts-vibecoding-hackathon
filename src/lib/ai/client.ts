import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type AiProvider = "google" | "openai" | "anthropic";

export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

const DEFAULT_MODELS: Record<AiProvider, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
};

const PROVIDER_ALIASES: Record<string, AiProvider> = {
  gemini: "google",
  google: "google",
  openai: "openai",
  claude: "anthropic",
  anthropic: "anthropic",
};

const REQUIRED_API_KEY_ENV: Record<AiProvider, string> = {
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

function readNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProvider(value: string | null | undefined): AiProvider {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "google";

  const provider = PROVIDER_ALIASES[normalized];
  if (!provider) {
    throw new AiConfigurationError(
      `Unsupported AI provider "${value}". Use one of: gemini, google, openai, claude, anthropic.`
    );
  }

  return provider;
}

function getModelId(provider: AiProvider): string {
  return process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
}

function validateApiKey(provider: AiProvider) {
  const envName = REQUIRED_API_KEY_ENV[provider];
  if (!process.env[envName]) {
    throw new AiConfigurationError(`AI_PROVIDER=${provider} icin ${envName} tanimli degil.`);
  }
}

export function isAiConfigurationError(error: unknown): error is AiConfigurationError {
  return error instanceof AiConfigurationError;
}

function createLanguageModel(provider: AiProvider, modelId: string): LanguageModel {
  validateApiKey(provider);

  switch (provider) {
    case "google":
      return google(modelId);
    case "openai":
      return openai(modelId);
    case "anthropic":
      return anthropic(modelId);
  }
}

function getProviderOptions(provider: AiProvider) {
  if (provider !== "google") return undefined;

  return {
    google: {
      thinkingConfig: {
        thinkingBudget: readNumberEnv("GOOGLE_THINKING_BUDGET", 0),
      },
    },
  } as const;
}

export const TEMPERATURE = readNumberEnv("AI_TEMPERATURE", 0);
export const MAX_OUTPUT_TOKENS = readNumberEnv("AI_MAX_OUTPUT_TOKENS", 4096);

export function getAiRequestConfig() {
  const provider = normalizeProvider(process.env.AI_PROVIDER);
  const modelId = getModelId(provider);

  return {
    provider,
    modelId,
    languageModel: createLanguageModel(provider, modelId),
    providerOptions: getProviderOptions(provider),
    temperature: TEMPERATURE,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };
}

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
