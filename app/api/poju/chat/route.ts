import { NextResponse } from "next/server";
import { callPOJULLM } from "@/lib/llm/poju-llm";
import { createPojuChatStreamResponse } from "@/lib/poju/poju-chat-stream";
import { pojuLlmToChatPayload } from "@/lib/poju/serialize-chat-payload";
import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/**
 * POJU v5: phase-routed chat (`opening` → `collecting` → `confirmation` → `delivered` → `tracking`).
 * Request body: `{ session, profile?, locale? }` (session must include `session_id`).
 */
export const maxDuration = 180;

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

  const llm = await callPOJULLM({
    session: body.session,
    profile: body.profile ?? body.userProfile ?? null,
    base_analysis: body.base_analysis === undefined ? null : body.base_analysis,
    archive_data: body.archive_data === undefined ? null : body.archive_data,
    locale: String(body.locale ?? "en"),
    tool_injection_context:
      typeof body.tool_injection_context === "string" ? body.tool_injection_context : null,
  });

  return NextResponse.json(pojuLlmToChatPayload(llm));
}
