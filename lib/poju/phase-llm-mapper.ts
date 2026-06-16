import type { AgentPhase } from "@/lib/poju/agent-state";
import type { PhaseLLMResult } from "@/lib/llm/phases/types";
import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { topicDriftDetected } from "@/lib/poju/topic-drift";
import { applyPojuOutputPolicies } from "@/lib/poju/output-policy-pass";
import type { POJUSessionState, PojuV4ActionRequested } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/** Maps phase-module JSON output → `/api/poju/chat` payload + agent transition hints. */
export function mapPhaseResultToChatPayload(
  phase: PhaseLLMResult,
  ctx: { session: POJUSessionState; profile: UserProfile | null; locale: string; fallbackPhase: AgentPhase },
): Record<string, unknown> {
  const suggested = normalizeAgentPhase(phase.suggested_phase ?? ctx.fallbackPhase) ?? ctx.fallbackPhase;
  let current_state: string = "collecting_context";
  let action_requested: PojuV4ActionRequested = "continue_chat";
  let user_intent = "sharing_situation";

  const phaseAction = phase.action_requested;
  if (
    phaseAction === "continue_chat" ||
    phaseAction === "show_birth_form" ||
    phaseAction === "deliver_main" ||
    phaseAction === "track_progress"
  ) {
    action_requested = phaseAction;
  }

  switch (suggested) {
    case "opening":
      current_state = "opening";
      user_intent = "greeting";
      break;
    case "awaiting_confirmation":
      current_state = "awaiting_confirmation";
      user_intent = "sharing_situation";
      break;
    case "delivered":
      current_state = "delivered";
      break;
    case "tracking":
      current_state = "tracking";
      user_intent = "reporting_progress";
      break;
    default:
      current_state = "collecting_context";
  }

  const driftSignal = phase.topic_drift_signal ?? "none";

  const base = {
    response: phase.response,
    model: phase.model ?? "poju-phase",
    tokens_used: phase.tokens_used,
    user_intent: driftSignal === "off_topic" ? "off_topic" : user_intent,
    current_state,
    action_requested,
    topic_drift_detected: topicDriftDetected(driftSignal),
    topic_drift_signal: driftSignal,
    drift_reason: phase.drift_reason ?? null,
    should_show_new_session_button: Boolean(phase.should_show_new_session_button),
    context_updates: phase.context_updates ?? {},
    contains_delivery: false,
    agent_suggested_phase: suggested,
    current_summary: phase.current_summary ?? null,
    question_category: phase.question_category,
    tool_suggestion: phase.tool_suggestion ?? null,
    start_new_cycle: Boolean(phase.start_new_cycle),
    new_cycle_question: phase.new_cycle_question ?? null,
    collection_progress: phase.collection_progress ?? null,
    stall_offer: Boolean(phase.stall_offer),
  };

  return applyPojuOutputPolicies(base, {
    session: ctx.session,
    profile: ctx.profile,
    locale: ctx.locale,
  });
}
