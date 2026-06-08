import { NextResponse } from "next/server";
import { anthropic, MODEL, MAX_TOKENS } from "@/lib/claude/client";
import { buildTaskDecompositionPrompt } from "@/lib/claude/prompts";
import type { JiraIssue, TeamMember } from "@/types";

export async function POST(request: Request) {
  try {
    const { task, teamMembers }: { task: JiraIssue; teamMembers: TeamMember[] } =
      await request.json();

    const prompt = buildTaskDecompositionPrompt(task, teamMembers);

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
