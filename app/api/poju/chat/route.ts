import { NextResponse } from "next/server";
import { callPOJULLM } from "@/lib/llm/poju-llm";
import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/**
 * POJU v5: phase-routed chat (`opening` → `collecting` → `confirmation` → `delivered` → `tracking`).
 * Request body: `{ session, profile?, locale? }` (session must include `session_id`).
 */
export const maxDuration = 180;

export async function POST(req: Request) {
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

  const llm = await callPOJULLM({
    session: body.session,
    profile: body.profile ?? body.userProfile ?? null,
    base_analysis: body.base_analysis === undefined ? null : body.base_analysis,
    archive_data: body.archive_data === undefined ? null : body.archive_data,
    locale: String(body.locale ?? "en"),
    tool_injection_context:
      typeof body.tool_injection_context === "string" ? body.tool_injection_context : null,
  });

  return NextResponse.json({
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
}
