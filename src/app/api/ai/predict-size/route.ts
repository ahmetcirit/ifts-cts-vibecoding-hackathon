import { NextResponse } from "next/server";
import { anthropic, MODEL, MAX_TOKENS } from "@/lib/claude/client";
import { buildPredictiveSizingPrompt } from "@/lib/claude/prompts";
import type { JiraIssue, JiraSprint } from "@/types";

export async function POST(request: Request) {
  try {
    const { tasks, sprintHistory }: { tasks: JiraIssue[]; sprintHistory: JiraSprint[] } =
      await request.json();

    const prompt = buildPredictiveSizingPrompt(tasks, sprintHistory);

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type from Claude");

    const raw = block.text.replace(/^```json\s*|```$/g, "").trim();
    return NextResponse.json(JSON.parse(raw));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
