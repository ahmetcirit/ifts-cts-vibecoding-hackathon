import { NextResponse } from "next/server";
import { generateObject } from "ai";
import {
  geminiModel,
  GOOGLE_PROVIDER_OPTIONS,
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

    const { object } = await generateObject({
      model: geminiModel,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      providerOptions: GOOGLE_PROVIDER_OPTIONS,
      experimental_repairText: repairJsonText,
      schema: predictiveSizingSchema,
      prompt,
    });
    return NextResponse.json(object);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
