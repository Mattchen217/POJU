import { OpenRouterProviderQueueError } from "@/lib/llm/openrouter-retry";
import { logPojuError } from "@/lib/poju/base-analysis-diagnostics";
import { resolveStreamedCompleteResponse } from "@/lib/llm/phases/phase-transport";
import { pojuLlmToChatPayload } from "@/lib/poju/serialize-chat-payload";
import { attestChatPayload } from "@/lib/poju/decision-authority/server/assistant-history-attestation";
import { attachDevStateLedger } from "@/lib/poju/dev-state-ledger";
import { resolvePivotSessionLang } from "@/lib/poju/session-lang";
import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import { POJUIntakeTerminalError } from "@/lib/poju/intake-terminal";
import { executeAuthoritativeChatTurn } from "@/lib/poju/session-authority/chat";
import { SessionAuthorityError } from "@/lib/poju/session-authority/lifecycle";

type ChatBody = {
  locale?: string;
  userProfile?: UserProfile | null;
  session?: POJUSessionState;
  profile?: UserProfile | null;
  base_analysis?: unknown | null;
  archive_data?: POJUActionRecommendationsData | null;
  tool_injection_context?: string | null;
  attachment?: import("@/lib/poju/attachments/types").PojuChatAttachment | null;
  user_message?: string | null;
  client_turn_id?: string | null;
  expected_revision?: number | null;
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
        const turn = await executeAuthoritativeChatTurn(body, { signal: reqSignal });
        if (!turn.ok) {
          send({ type: "aborted" });
          return;
        }
        const llm = turn.llm;

        send({
          type: "complete",
          ...attachDevStateLedger(
            attestChatPayload(
              pojuLlmToChatPayload(llm, {
                response: resolveStreamedCompleteResponse(
                  llm.response,
                  lastContentText,
                  sessionLang,
                ),
              }),
              body.session.session_id,
            ),
            turn.session,
          ),
          authoritative_session: turn.session,
          session_authority: turn.envelope,
          session_revision: turn.envelope.revision,
          turn_idempotent: turn.idempotent,
        });
      } catch (e) {
        logPojuError("poju-chat-stream:callPOJULLM", e);
        if (e instanceof SessionAuthorityError) {
          send({ type: "error", ...e.toBody() });
          controller.close();
          return;
        }
        if (e instanceof POJUIntakeTerminalError) {
          send({ type: "error", code: "poju_intake_terminal", reason: e.reason });
          controller.close();
          return;
        }
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