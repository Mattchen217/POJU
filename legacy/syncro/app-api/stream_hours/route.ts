import { NextRequest } from "next/server";

import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import {
  generateSyncroHoursAdvice,
  SyncroLlmHttpError,
  SyncroParseError,
  type SyncroLlmHoursInput,
} from "@/lib/syncro/syncro-llm-batch-core";

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

  let body: SyncroLlmHoursInput;
  try {
    body = (await req.json()) as SyncroLlmHoursInput;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const session_id = body.session_id?.trim();
  if (
    !session_id ||
    !body.hours?.length ||
    body.hours.length > 2 ||
    !body.task_description?.trim()
  ) {
    return new Response("Invalid request", { status: 400 });
  }

  for (const hour of body.hours) {
    if (!hour.hour_id?.trim() || !hour.cells?.length) {
      return new Response("Invalid hour block", { status: 400 });
    }
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
        const result = await generateSyncroHoursAdvice(body, {
          onConnecting: () => send("progress", { phase: "connecting" }),
          onReasoning: () => send("progress", { phase: "reasoning" }),
          onWriting: () => send("progress", { phase: "writing" }),
          onReasoningChunk: (text) => send("reasoning_chunk", { text }),
          onContentChunk: (text) => send("chunk", { text }),
        });

        console.log(
          `[stream_hours] sending complete with ${Object.keys(result.advice).length} cells, from_cache=${result.from_cache}`,
        );
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
          send("error", {
            error: "parse_failed",
            retryable: true,
            detail: e.message,
          });
          controller.close();
          return;
        }

        const message = e instanceof Error ? e.message : String(e);
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
