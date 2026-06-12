import { NextResponse } from "next/server";
import { generateObject } from "ai";
import {
  getAiRequestConfig,
  MAX_OUTPUT_TOKENS,
  repairJsonText,
  TEMPERATURE,
} from "@/lib/ai/client";
import { buildPredictiveSizingPrompt } from "@/lib/ai/prompts";
import { predictiveSizingSchema } from "@/lib/ai/schemas";
import type { JiraIssue, JiraSprint } from "@/types";

export async function POST(request: Request) {
  try {
    const { tasks, sprintHistory }: { tasks: JiraIssue[]; sprintHistory: JiraSprint[] } =
      await request.json();

    const prompt = buildPredictiveSizingPrompt(tasks, sprintHistory);
    const aiConfig = getAiRequestConfig();

    const { object } = await generateObject({
      model: aiConfig.languageModel,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      providerOptions: aiConfig.providerOptions,
      experimental_repairText: repairJsonText,
      schema: predictiveSizingSchema,
      prompt,
    });
    return NextResponse.json(object);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
