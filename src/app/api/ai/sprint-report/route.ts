import { groq, MODEL } from "@/lib/claude/client";
import { buildSprintReportPrompt } from "@/lib/claude/prompts";
import type { JiraSprint } from "@/types";

export async function POST(request: Request) {
  try {
    const { sprint, metrics }: { sprint: JiraSprint; metrics: Record<string, unknown> } =
      await request.json();

    const prompt = buildSprintReportPrompt(sprint, metrics);

    const stream = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
