import { buildBaseAnalysisPrompt, parseBaseAnalysisResponseText } from "@/lib/llm/deepseek/base-analysis";
import {
  buildOpenRouterMessages,
  openRouterChatCompletionStream,
} from "@/lib/llm/openrouter-stream";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import type { UserProfile } from "@/lib/profile/types";

export const maxDuration = 180;

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function isUserProfile(x: unknown): x is UserProfile {
  if (!isRecord(x)) return false;
  if (typeof x.id !== "string") return false;
  if (!isRecord(x.birth)) return false;
  if (typeof x.birth.year !== "number" || typeof x.birth.month !== "number" || typeof x.birth.day !== "number")
    return false;
  if (typeof x.birth.hour !== "number") return false;
  if (x.birth.gender !== "male" && x.birth.gender !== "female" && x.birth.gender !== "other") return false;
  if (!isRecord(x.bazi)) return false;
  const z = x.bazi;
  if (typeof z.yearPillar !== "string" || typeof z.monthPillar !== "string") return false;
  if (typeof z.dayPillar !== "string" || typeof z.hourPillar !== "string") return false;
  if (!isRecord(x.diagnosis)) return false;
  if (typeof x.diagnosis.dayMaster !== "string") return false;
  if (!Array.isArray(x.diagnosis.favorableElements) || !Array.isArray(x.diagnosis.challengingElements)) return false;
  if (typeof x.diagnosis.patternSummary !== "string") return false;
  if (x.source !== "shunshi" && x.source !== "fallback") return false;
  return true;
}

function sseLine(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/**
 * SSE stream: `reasoning` events (full text so far) → `done` with parsed analysis JSON.
 */
export async function POST(req: Request) {
  if (!isOpenRouterConfigured()) {
    return new Response(
      sseLine({ type: "error", message: "OpenRouter is not configured (OPENROUTER_API_KEY)." }),
      { status: 503, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { user_profile?: unknown };
  if (!isUserProfile(body.user_profile)) {
    return new Response(sseLine({ type: "error", message: "Invalid or missing user_profile" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const profile = body.user_profile;
  const { system, user } = buildBaseAnalysisPrompt(profile);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseLine(obj)));
      };

      try {
        const result = await openRouterChatCompletionStream(
          {
            messages: buildOpenRouterMessages(system, [{ role: "user", content: user }]),
            max_tokens: 15000,
            temperature: 0.55,
            json_mode: true,
            reasoning_effort: "high",
          },
          {
            onReasoning: (full) => push({ type: "reasoning", text: full }),
            onContent: (full) => push({ type: "content", text: full }),
          },
        );

        let analysis: unknown;
        try {
          analysis = parseBaseAnalysisResponseText(result.text);
        } catch {
          push({
            type: "error",
            message: "Model output is not valid JSON",
            preview: result.text.slice(0, 400),
          });
          controller.close();
          return;
        }

        push({
          type: "done",
          ok: true,
          analysis,
          model: result.model,
          tokens_used: result.tokens_used,
          reasoning: result.reasoning ?? "",
        });
      } catch (e: unknown) {
        push({
          type: "error",
          message: e instanceof Error ? e.message : "Base analysis stream failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
