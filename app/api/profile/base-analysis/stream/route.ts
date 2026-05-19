import { saveBaseAnalysisAudit } from "@/lib/dev/base-analysis-audit";
import { parseBaseAnalysisAuditBody } from "@/lib/dev/parse-base-analysis-audit-body";
import { buildBaseAnalysisPrompt, parseBaseAnalysisResponseText } from "@/lib/llm/deepseek/base-analysis";
import {
  buildOpenRouterMessages,
  openRouterChatCompletionStream,
} from "@/lib/llm/openrouter-stream";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export const maxDuration = 180;

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

  const body = (await req.json().catch(() => ({}))) as unknown;
  const parsed = parseBaseAnalysisAuditBody(body);
  if (!parsed) {
    return new Response(sseLine({ type: "error", message: "Invalid or missing user_profile" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  const { user_profile: profile, stored_profile_id, display_name } = parsed;
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

        const audit = await saveBaseAnalysisAudit({
          user_profile: profile,
          prompts: { system, user },
          analysis,
          model: result.model,
          tokens_used: result.tokens_used,
          stored_profile_id,
          display_name,
          reasoning: result.reasoning ?? "",
          raw_model_text: result.text,
        });

        push({
          type: "done",
          ok: true,
          analysis,
          model: result.model,
          tokens_used: result.tokens_used,
          reasoning: result.reasoning ?? "",
          audit_id: audit?.id ?? null,
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
