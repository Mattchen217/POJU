import { callPOJULLM } from "@/lib/llm/poju-llm";
import { OpenRouterProviderQueueError } from "@/lib/llm/openrouter-retry";
import { logPojuError } from "@/lib/poju/base-analysis-diagnostics";
import { resolveStreamedCompleteResponse } from "@/lib/llm/phases/phase-transport";
import { extractStreamingResponseText } from "@/lib/poju/extract-streaming-response";
import { pojuLlmToChatPayload } from "@/lib/poju/serialize-chat-payload";
import { attachDevStateLedger } from "@/lib/poju/dev-state-ledger";
import { resolvePivotSessionLang } from "@/lib/poju/session-lang";
import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

type ChatBody = {
  locale?: string;
  userProfile?: UserProfile | null;
  session?: POJUSessionState;
  profile?: UserProfile | null;
  base_analysis?: unknown | null;
  archive_data?: POJUActionRecommendationsData | null;
  tool_injection_context?: string | null;
  attachment?: import("@/lib/poju/attachments/types").PojuChatAttachment | null;
};

function sseEncode(encoder: TextEncoder, payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/** SSE stream for POJU chat — reasoning ticker + partial response + final JSON payload. */
export function createPojuChatStreamResponse(body: ChatBody, reqSignal?: AbortSignal): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(sseEncode(encoder, payload));
      };

      if (!body.session || typeof body.session.session_id !== "string") {
        send({ type: "error", message: "session required" });
        controller.close();
        return;
      }

      try {
        let lastContentText = "";
        const sessionLang = resolvePivotSessionLang(
          body.session,
          String(body.locale ?? "en"),
        );
        const llm = await callPOJULLM({
          session: body.session,
          profile: body.profile ?? body.userProfile ?? null,
          base_analysis: body.base_analysis === undefined ? null : body.base_analysis,
          archive_data: body.archive_data === undefined ? null : body.archive_data,
          locale: sessionLang,
          tool_injection_context:
            typeof body.tool_injection_context === "string" ? body.tool_injection_context : null,
          signal: reqSignal,
          attachment: body.attachment ?? null,
        });

        send({
          type: "complete",
          ...attachDevStateLedger(
            pojuLlmToChatPayload(llm, {
              response: resolveStreamedCompleteResponse(
                llm.response,
                lastContentText,
                sessionLang,
              ),
            }),
            body.session,
          ),
        });
      } catch (e) {
        logPojuError("poju-chat-stream:callPOJULLM", e);
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("abort") || message.includes("AbortError")) {
          send({ type: "aborted" });
        } else if (e instanceof OpenRouterProviderQueueError) {
          send({ type: "error", code: "provider_queue", message: e.message });
        } else {
          send({ type: "error", message });
        }
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
      "X-Accel-Buffering": "no",
    },
  });
}
