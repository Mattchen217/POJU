import { NextRequest } from "next/server";

import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import {
  generateSyncroHourAdvice,
  SyncroLlmHttpError,
  SyncroParseError,
  type SyncroLlmHourInput,
} from "@/lib/syncro/syncro-llm-core";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  if (!isOpenRouterConfigured()) {
    return new Response("OPENROUTER_API_KEY not configured", { status: 503 });
  }

  let body: SyncroLlmHourInput;
  try {
    body = (await req.json()) as SyncroLlmHourInput;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const session_id = body.session_id?.trim();
  const hour_id = body.hour_id?.trim();
  if (!session_id || !hour_id || !body.cells?.length || !body.task_description?.trim()) {
    return new Response("Invalid request", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          // client disconnected
        }
      };

      try {
        const result = await generateSyncroHourAdvice(body, {
          onConnecting: () => send("progress", { phase: "connecting" }),
          onReasoning: () => send("progress", { phase: "reasoning" }),
          onWriting: () => send("progress", { phase: "writing" }),
          onReasoningChunk: (text) => send("reasoning_chunk", { text }),
          onContentChunk: (text) => send("chunk", { text }),
        });

        if (result.from_cache) {
          console.log(`[stream_hour] ${hour_id} 命中 output 缓存,直接返回`);
        }

        send("complete", { advice: result.advice, from_cache: result.from_cache });
        controller.close();
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") {
          controller.close();
          return;
        }

        if (e instanceof SyncroLlmHttpError) {
          send("error", {
            error: "llm_http_error",
            status: e.status,
            retryable: e.retryable,
            detail: e.detail,
          });
          controller.close();
          return;
        }

        if (e instanceof SyncroParseError) {
          console.error(`[stream_hour] ${hour_id} JSON parse failed:`, e.raw_content.slice(0, 300));
          send("error", {
            error: "parse_failed",
            retryable: true,
            detail: e.message,
          });
          controller.close();
          return;
        }

        const message = e instanceof Error ? e.message : String(e);
        console.error("═══ [stream_hour] EXCEPTION ═══");
        console.error("Session:", session_id);
        console.error("Hour:", hour_id);
        console.error("Error:", message);
        console.error("Stack:", e instanceof Error ? e.stack?.slice(0, 500) : "");
        console.error("═══════════════════════════════");

        send("error", {
          error: "exception",
          retryable: true,
          message,
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
