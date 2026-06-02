import { NextRequest } from "next/server";

import { getOpenRouterDefaultModel, isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import {
  appendToStream,
  cacheLlmInput,
  cacheLlmOutput,
  clearStream,
  getCachedOutput,
} from "@/lib/syncro/syncro-kv";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface StreamHourBody {
  session_id: string;
  hour_id: string;
  hour_label: string;
  hour_range: string;
  cells: Array<{
    key: string;
    direction: string;
    current_level: string;
    key_hints?: string[];
  }>;
  task_description: string;
  profile_summary: string;
  locale: string;
}

type DirectionAdvice = {
  short?: string;
  detailed?: string;
  rationale?: string;
};

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function extractReasoningDelta(delta: Record<string, unknown> | undefined): string {
  if (!delta) return "";
  if (typeof delta.reasoning_content === "string") return delta.reasoning_content;
  if (typeof delta.reasoning === "string") return delta.reasoning;
  const details = delta.reasoning_details;
  if (Array.isArray(details)) {
    return details
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          if (typeof o.text === "string") return o.text;
          if (typeof o.content === "string") return o.content;
        }
        return "";
      })
      .join("");
  }
  return "";
}

function buildPrompt(body: StreamHourBody) {
  const langInstruction = body.locale === "zh" ? "用简体中文输出。" : "Output in English.";

  const system = `You are Syncro analyzer. For the given hour and 8 directions, generate practical guidance.

# User task
"${body.task_description}"

# Output JSON ONLY - no preamble, no explanation:
{
  "advice": {
    "N": {
      "short": "<50-80 chars, one-sentence direct advice>",
      "detailed": "<150-200 chars, 2-3 sentences action advice>",
      "rationale": "<100-150 chars, why this for the user's task>"
    },
    "NE": { ... },
    "E": { ... },
    "SE": { ... },
    "S": { ... },
    "SW": { ... },
    "W": { ... },
    "NW": { ... }
  }
}

# Rules
${langInstruction}
- All 8 directions MUST be included
- DO NOT use: astrology, divination, fortune-telling, 占卜, 算命, 命理
- Use: pojulife / reading / analysis / 解读 / 分析`;

  const cellsDesc = body.cells
    .map((c) => {
      const hints = c.key_hints?.length ? ` · hints: ${c.key_hints.join("; ")}` : "";
      return `  ${c.direction}: ${c.current_level}${hints}`;
    })
    .join("\n");

  const userMsg = `Hour: ${body.hour_label} (${body.hour_range})

The 8 directions for this hour have these current levels (already computed):
${cellsDesc}

Profile context: ${body.profile_summary}

Generate advice for all 8 directions. Output JSON only.`;

  return { system, user: userMsg };
}

function openRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_TITLE?.trim();
  if (referer) headers["HTTP-Referer"] = referer;
  else headers["HTTP-Referer"] = "https://pojulife.com";
  if (title) headers["X-Title"] = title;
  else headers["X-Title"] = "pojulife";
  return headers;
}

function buildOpenRouterBody(
  model: string,
  system: string,
  user: string,
  includeReasoning: boolean,
): Record<string, unknown> {
  return {
    model,
    stream: true,
    ...(includeReasoning ? { reasoning: { effort: "high" } } : {}),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
}

export async function POST(req: NextRequest) {
  if (!isOpenRouterConfigured()) {
    return new Response("OPENROUTER_API_KEY not configured", { status: 503 });
  }

  let body: StreamHourBody;
  try {
    body = (await req.json()) as StreamHourBody;
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
        const cached = await getCachedOutput(session_id, hour_id);
        if (cached) {
          console.log(`[stream_hour] ${hour_id} 命中 output 缓存,直接返回`);
          send("complete", { advice: cached, from_cache: true });
          controller.close();
          return;
        }

        const { system, user } = buildPrompt(body);
        const model = getOpenRouterDefaultModel();

        await cacheLlmInput(session_id, hour_id, {
          system,
          user,
          model,
        });

        console.log(`[stream_hour] ${hour_id} start, model=${model}`);
        send("progress", { phase: "connecting" });

        let llmRes = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: openRouterHeaders(),
          body: JSON.stringify(buildOpenRouterBody(model, system, user, true)),
        });

        if (!llmRes.ok && llmRes.status >= 400 && llmRes.status < 500) {
          llmRes = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: openRouterHeaders(),
            body: JSON.stringify(buildOpenRouterBody(model, system, user, false)),
          });
        }

        if (!llmRes.ok || !llmRes.body) {
          const errText = await llmRes.text().catch(() => "unknown");
          console.error(`[stream_hour] ${hour_id} LLM HTTP ${llmRes.status}:`, errText.slice(0, 300));
          send("error", {
            error: "llm_http_error",
            status: llmRes.status,
            retryable: llmRes.status === 429 || llmRes.status >= 500,
            detail: errText.slice(0, 200),
          });
          controller.close();
          return;
        }

        const reader = llmRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumContent = "";
        let inReasoning = false;
        let chunkCount = 0;

        send("progress", { phase: "reasoning" });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]" || !payload) continue;

            try {
              const parsed = JSON.parse(payload) as Record<string, unknown>;
              const choice = (parsed.choices as Array<Record<string, unknown>> | undefined)?.[0];
              const delta = choice?.delta as Record<string, unknown> | undefined;
              if (!delta) continue;

              const reasoningText = extractReasoningDelta(delta);
              if (reasoningText) {
                if (!inReasoning) {
                  inReasoning = true;
                  send("progress", { phase: "reasoning" });
                }
                send("reasoning_chunk", { text: reasoningText });
              }

              if (typeof delta.content === "string" && delta.content) {
                if (inReasoning) {
                  inReasoning = false;
                  send("progress", { phase: "writing" });
                }
                accumContent += delta.content;
                chunkCount++;
                send("chunk", { text: delta.content });
                void appendToStream(session_id, hour_id, delta.content).catch((e) => {
                  console.warn(`[stream_hour] ${hour_id} appendToStream failed:`, e);
                });
              }
            } catch {
              console.warn(`[stream_hour] ${hour_id} parse line failed:`, payload.slice(0, 100));
            }
          }
        }

        console.log(
          `[stream_hour] ${hour_id} stream done, chunks=${chunkCount}, content len=${accumContent.length}`,
        );

        let advice: Record<string, DirectionAdvice> | null = null;
        try {
          const parsed = JSON.parse(accumContent) as { advice?: Record<string, DirectionAdvice> };
          advice = parsed.advice ?? null;
          if (!advice) throw new Error("missing advice field");
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          console.error(`[stream_hour] ${hour_id} JSON parse failed:`, accumContent.slice(0, 300));
          send("error", {
            error: "parse_failed",
            retryable: true,
            detail: message,
          });
          controller.close();
          return;
        }

        const adviceByKey: Record<
          string,
          { short_advice: string; detailed_advice: string; rationale: string }
        > = {};

        for (const cell of body.cells) {
          const dirAdvice = advice[cell.direction];
          if (dirAdvice) {
            adviceByKey[cell.key] = {
              short_advice: (dirAdvice.short ?? "").trim(),
              detailed_advice: (dirAdvice.detailed ?? "").trim(),
              rationale: (dirAdvice.rationale ?? "").trim(),
            };
          }
        }

        await cacheLlmOutput(session_id, hour_id, adviceByKey);
        await clearStream(session_id, hour_id);

        send("complete", { advice: adviceByKey });
        controller.close();
      } catch (e: unknown) {
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
