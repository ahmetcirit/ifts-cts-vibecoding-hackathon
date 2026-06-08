import { NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/claude/client";
import { buildHealthScorePrompt } from "@/lib/claude/prompts";

export async function POST(request: Request) {
  try {
    const metrics = await request.json();

    const prompt = buildHealthScorePrompt(metrics);

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
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
