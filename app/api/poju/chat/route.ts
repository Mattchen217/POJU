import { NextResponse } from "next/server";
import { getPojuServiceBusyMessage } from "@/lib/llm/poju-service-busy-message";
import { callPOJULLM } from "@/lib/llm/poju-llm";
import { OpenRouterProviderQueueError } from "@/lib/llm/openrouter-retry";
import { createPojuChatStreamResponse } from "@/lib/poju/poju-chat-stream";
import { pojuLlmToChatPayload } from "@/lib/poju/serialize-chat-payload";
import { attachDevStateLedger } from "@/lib/poju/dev-state-ledger";
import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/**
 * POJU v5: phase-routed chat (`opening` → `collecting` → `confirmation` → `delivered` → `tracking`).
 * Request body: `{ session, profile?, locale? }` (session must include `session_id`).
 */
export const maxDuration = 300;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const streamMode = url.searchParams.get("stream") === "1";

  const body = (await req.json().catch(() => ({}))) as {
    locale?: string;
    userProfile?: UserProfile | null;
    session?: POJUSessionState;
    profile?: UserProfile | null;
    base_analysis?: unknown | null;
    archive_data?: POJUActionRecommendationsData | null;
    tool_injection_context?: string | null;
  };

  if (!body.session || typeof body.session !== "object" || typeof body.session.session_id !== "string") {
    return NextResponse.json(
      { error: "v4 session required: send { session: POJUSessionState, profile?, locale? }" },
      { status: 400 },
    );
  }

  if (streamMode) {
    return createPojuChatStreamResponse(body, req.signal);
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
    });

    const payload = pojuLlmToChatPayload(llm);
    return NextResponse.json(attachDevStateLedger(payload, body.session));
  } catch (error: unknown) {
    console.error("[poju/chat] unhandled error:", error);
    if (
      error instanceof OpenRouterProviderQueueError ||
      (error instanceof Error && error.message === "openrouter_provider_queue")
    ) {
      // Let the client silent-retry (×3) before showing the user-facing retry button.
      return NextResponse.json(
        { error: "openrouter_provider_queue" },
        { status: 503 },
      );
    }
    const locale = String(body.locale ?? "en");
    return NextResponse.json({
      response: getPojuServiceBusyMessage(locale),
      model: "",
      tokens_used: 0,
      user_intent: "unclear",
      current_state: body.session.main_delivery_done ? "tracking" : "collecting_context",
      topic_drift_detected: false,
      contains_delivery: false,
      context_updates: {},
    });
  }
}
