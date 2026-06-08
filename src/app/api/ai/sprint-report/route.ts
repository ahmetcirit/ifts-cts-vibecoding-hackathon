import { anthropic, MODEL } from "@/lib/claude/client";
import { buildSprintReportPrompt } from "@/lib/claude/prompts";
import type { JiraSprint } from "@/types";

export async function POST(request: Request) {
  try {
    const { sprint, metrics }: { sprint: JiraSprint; metrics: Record<string, unknown> } =
      await request.json();

    const prompt = buildSprintReportPrompt(sprint, metrics);

    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
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
