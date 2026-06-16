import { callPOJULLM } from "@/lib/llm/poju-llm";
import { extractStreamingResponseText } from "@/lib/poju/extract-streaming-response";
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
        const llm = await callPOJULLM({
          session: body.session,
          profile: body.profile ?? body.userProfile ?? null,
          base_analysis: body.base_analysis === undefined ? null : body.base_analysis,
          archive_data: body.archive_data === undefined ? null : body.archive_data,
          locale: String(body.locale ?? "en"),
          tool_injection_context:
            typeof body.tool_injection_context === "string" ? body.tool_injection_context : null,
          stream_hooks: {
            onReasoning: (text) => send({ type: "reasoning", text }),
            onContent: (raw) => {
              if (!raw.length) return;
              send({
                type: "content",
                text: extractStreamingResponseText(raw),
                raw_length: raw.length,
              });
            },
          },
          signal: reqSignal,
        });

        send({
          type: "complete",
          response: llm.response,
          model: llm.model,
          tokens_used: llm.tokens_used,
          user_intent: llm.user_intent,
          current_state: llm.current_state,
          action_requested: llm.action_requested,
          topic_drift_detected: llm.topic_drift_detected,
          topic_drift_signal: llm.topic_drift_signal ?? "none",
          should_show_new_session_button: llm.should_show_new_session_button ?? false,
          drift_reason: llm.drift_reason ?? null,
          context_updates: llm.context_updates,
          contains_delivery: llm.contains_delivery,
          main_delivery: llm.main_delivery,
          new_actions: llm.new_actions,
          agent_suggested_phase: llm.agent_suggested_phase,
          current_summary: llm.current_summary,
          question_category: llm.question_category,
          thinking_process: llm.thinking_process,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("abort") || message.includes("AbortError")) {
          send({ type: "aborted" });
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
    },
  });
}
