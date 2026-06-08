import { NextResponse } from "next/server";
import { groq, MODEL } from "@/lib/claude/client";
import { buildHealthScorePrompt } from "@/lib/claude/prompts";

export async function POST(request: Request) {
  try {
    const metrics = await request.json();

    const prompt = buildHealthScorePrompt(metrics);

    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
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
