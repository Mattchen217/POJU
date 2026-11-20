import { NextResponse } from "next/server";
import { getPojuServiceBusyMessage } from "@/lib/llm/poju-service-busy-message";
import { OpenRouterProviderQueueError } from "@/lib/llm/openrouter-retry";
import { createPojuChatStreamResponse } from "@/lib/poju/poju-chat-stream";
import { pojuLlmToChatPayload } from "@/lib/poju/serialize-chat-payload";
import { attestChatPayload } from "@/lib/poju/decision-authority/server/assistant-history-attestation";
import { attachDevStateLedger } from "@/lib/poju/dev-state-ledger";
import { resolvePivotSessionLang } from "@/lib/poju/session-lang";
import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import { POJUIntakeTerminalError } from "@/lib/poju/intake-terminal";
import { executeAuthoritativeChatTurn } from "@/lib/poju/session-authority/chat";
import {
  SessionAuthorityError,
  httpStatusForAuthorityError,
} from "@/lib/poju/session-authority/lifecycle";

/**
 * POJU v5: phase-routed chat (`opening` → `collecting` → `confirmation` → `delivered` → `tracking`).
 * Request body: `{ session, profile?, locale? }` (session must include `session_id`).
 * M9: both this entry and the stream entry load the server-authoritative Session,
 * run handleUserMessage(), and confirm the turn only after CAS persistence succeeds.
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
    claimed_stored_profile_id?: string | null;
    archive_data?: POJUActionRecommendationsData | null;
    tool_injection_context?: string | null;
    attachment?: import("@/lib/poju/attachments/types").PojuChatAttachment | null;
    user_message?: string | null;
    client_turn_id?: string | null;
    expected_revision?: number | null;
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
    const turn = await executeAuthoritativeChatTurn(body, { signal: req.signal });
    if (!turn.ok) {
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }
    const llm = turn.llm;
    const payload = attestChatPayload(pojuLlmToChatPayload(llm), body.session.session_id);
    return NextResponse.json(
      attachDevStateLedger(
        {
          ...payload,
          authoritative_session: turn.session,
          session_authority: turn.envelope,
          session_revision: turn.envelope.revision,
          turn_idempotent: turn.idempotent,
        },
        turn.session,
      ),
    );
  } catch (error: unknown) {
    if (error instanceof SessionAuthorityError) {
      return NextResponse.json(error.toBody(), { status: httpStatusForAuthorityError(error) });
    }
    if (error instanceof POJUIntakeTerminalError) {
      return NextResponse.json(
        { error: "poju_intake_terminal", reason: error.reason },
        { status: 409 },
      );
    }
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
    // DI2 client requires authoritative_session + session_authority. A soft 200
    // without the envelope surfaces as a generic "连接异常" with no server code.
    const locale = resolvePivotSessionLang(body.session, String(body.locale ?? "en"));
    return NextResponse.json(
      {
        error: "poju_chat_unhandled",
        message: getPojuServiceBusyMessage(locale),
      },
      { status: 503 },
    );
  }
}