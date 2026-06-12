import { generateText } from "ai";
import { getAiRequestConfig, isAiConfigurationError, TEMPERATURE } from "@/lib/ai/client";
import { buildSprintReportPrompt } from "@/lib/ai/prompts";
import type { JiraSprint } from "@/types";

const REPORT_MAX_CHARS = 800;
type AiRequestConfig = ReturnType<typeof getAiRequestConfig>;

function finalizeReport(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= REPORT_MAX_CHARS) {
    return normalized.replace(/([^.!?])$/, "$1.");
  }

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  let candidate = "";

  for (const sentence of sentences) {
    const next = candidate ? `${candidate} ${sentence}` : sentence;
    if (next.length > REPORT_MAX_CHARS) break;
    candidate = next;
  }

  if (candidate.length >= 260) {
    return candidate.replace(/([^.!?])$/, "$1.");
  }

  const shortened = normalized.slice(0, REPORT_MAX_CHARS);
  const safeBoundary = Math.max(
    shortened.lastIndexOf(". "),
    shortened.lastIndexOf("! "),
    shortened.lastIndexOf("? "),
    shortened.lastIndexOf(" ")
  );
  const trimmed = (safeBoundary > 200 ? shortened.slice(0, safeBoundary) : shortened).trim();

  return trimmed.replace(/[.,;:!?-]*$/, "").concat(".");
}

function isWeakReport(text: string, sprintName: string): boolean {
  const normalizedText = text.trim().toLowerCase();
  const normalizedSprintName = sprintName.trim().toLowerCase();

  return (
    normalizedText.length < 220 ||
    normalizedText === normalizedSprintName ||
    normalizedText === `${normalizedSprintName} sprint` ||
    !/[.!?]/.test(normalizedText) ||
    new Set(normalizedText.split(/\s+/)).size < 25
  );
}

function getMeaningfulThemes(issues: JiraSprint["issues"]): string[] {
  return Array.from(
    new Set(
      issues.flatMap((issue) => [
        ...issue.components,
        ...issue.labels,
      ])
    )
  )
    .map((value) => value.trim())
    .filter((value) => value.length >= 3)
    .slice(0, 2);
}

function buildFallbackReport(sprint: JiraSprint, metrics: Record<string, unknown>) {
  const done = sprint.issues.filter((issue) => issue.status === "Done");
  const active = sprint.issues.filter((issue) => issue.status === "In Progress");
  const blocked = sprint.issues.filter((issue) => issue.status === "Blocked");
  const todo = sprint.issues.filter((issue) => issue.status === "To Do");
  const total = sprint.issues.length;
  const completionRate =
    typeof metrics.completionRate === "number"
      ? metrics.completionRate
      : total > 0
        ? Math.round((done.length / total) * 100)
        : 0;
  const carryoverRate =
    typeof metrics.carryoverRate === "number"
      ? metrics.carryoverRate
      : total > 0
        ? Math.round(((active.length + blocked.length + todo.length) / total) * 100)
        : 0;
  const deliveryThemes = getMeaningfulThemes(done);
  const riskThemes = getMeaningfulThemes([...blocked, ...active, ...todo]);

  const dominantRisk = blocked[0]?.summary || active[0]?.summary || todo[0]?.summary;

  const deliverySentence =
    completionRate >= 60
      ? deliveryThemes.length > 0
        ? `Sprintte ${deliveryThemes.join(" ve ")} tarafinda somut teslimatlar goruldu`
        : "Sprintte belirli islerin kapanisi saglanarak sinirli ama gorunur bir teslimat olustu"
      : completionRate >= 25
        ? deliveryThemes.length > 0
          ? `Sprintte ${deliveryThemes.join(" ve ")} tarafinda kisitli ilerleme saglansa da teslimat kapsami dar kaldi`
          : "Sprintte yalnizca sinirli sayida is kapanabildi ve teslimat kapsami dar kaldi"
        : "Sprintte kapanan is sayisi dusuk kaldigi icin teslimat etkisi beklentinin altinda kaldi";

  const riskSentence =
    dominantRisk
      ? `Kapanisi yavaslatan ana baski ${dominantRisk} etrafinda toplandi${riskThemes.length > 0 ? ` ve ${riskThemes.join(" ile ")} hattinda birikim yaratti` : ""}`
      : carryoverRate >= 50
        ? "Acik is yukunun sprint sonuna tasinmasi kapanis disiplinini zayiflatti"
        : "Acik kalan isler sonraki sprint icin yonetsel takip gerektiriyor";

  const nextSentence =
    carryoverRate >= 50
      ? "Sonraki sprintte daha dar kapsam, daha net onceliklendirme ve kapanisa yakin islerin once bitirilmesi akisi toparlamak icin gerekli gorunuyor"
      : "Sonraki sprintte acik risklerin hizli kapanisi ve mevcut odagin korunmasi akisi dengelemek acisindan daha saglikli olur";

  return `${deliverySentence}. ${riskSentence}. ${nextSentence}.`.slice(0, REPORT_MAX_CHARS);
}

async function generateSprintReport(
  sprint: JiraSprint,
  metrics: Record<string, unknown>,
  mode: "primary" | "retry",
  aiConfig: AiRequestConfig
) {
  const prompt = buildSprintReportPrompt(sprint, metrics, mode);

  const { text } = await generateText({
    model: aiConfig.languageModel,
    temperature: TEMPERATURE,
    maxOutputTokens: 520,
    providerOptions: aiConfig.providerOptions,
    prompt,
  });

  return finalizeReport(text);
}

export async function POST(request: Request) {
  const payload: { sprint: JiraSprint; metrics: Record<string, unknown> } = await request.json();

  try {
    const aiConfig = getAiRequestConfig();
    let report = await generateSprintReport(payload.sprint, payload.metrics, "primary", aiConfig);

    if (isWeakReport(report, payload.sprint.name)) {
      report = await generateSprintReport(payload.sprint, payload.metrics, "retry", aiConfig);
    }

    if (isWeakReport(report, payload.sprint.name)) {
      throw new Error("Weak sprint report");
    }

    return new Response(report, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isAiConfigurationError(error)) {
      return new Response(error.message, {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    return new Response(buildFallbackReport(payload.sprint, payload.metrics), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-AI-Fallback": "true",
      },
    });
  }
}
