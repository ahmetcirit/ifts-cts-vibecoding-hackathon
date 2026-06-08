import { NextResponse } from "next/server";
import { groq, MODEL, MAX_TOKENS } from "@/lib/claude/client";
import { buildPredictiveSizingPrompt } from "@/lib/claude/prompts";
import type { JiraIssue, JiraSprint } from "@/types";

export async function POST(request: Request) {
  try {
    const { tasks, sprintHistory }: { tasks: JiraIssue[]; sprintHistory: JiraSprint[] } =
      await request.json();

    const prompt = buildPredictiveSizingPrompt(tasks, sprintHistory);

    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("Empty response from Groq");

    const raw = text.replace(/^```json\s*|```$/g, "").trim();
    return NextResponse.json(JSON.parse(raw));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
