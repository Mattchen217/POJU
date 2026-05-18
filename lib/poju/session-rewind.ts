import { applyPhaseTransition, normalizeAgentPhase } from "@/lib/poju/agent-state";
import { downgradePrematureConfirmationPhase } from "@/lib/poju/summary-readiness";
import type { POJUSessionState } from "@/lib/poju/types";

/**
 * Truncate session at a user message, replace its text, and reset downstream state
 * (delivery, confirmation summary, actions) so the turn can be replayed.
 */
export function rewindSessionToUserMessage(
  session: POJUSessionState,
  messageIndex: number,
  newContent: string,
): POJUSessionState {
  const target = session.messages[messageIndex];
  if (!target || target.role !== "user" || target.is_rejected) {
    return session;
  }

  const trimmed = newContent.trim();
  if (!trimmed) return session;

  const truncated = session.messages.slice(0, messageIndex + 1);
  truncated[messageIndex] = {
    ...target,
    content: trimmed,
    timestamp: new Date().toISOString(),
  };

  const cutCount = session.messages.length - truncated.length;
  const removedDelivery = session.messages
    .slice(messageIndex + 1)
    .some((m) => m.role === "assistant" && m.meta?.contains_delivery);

  let next: POJUSessionState = {
    ...session,
    messages: truncated,
    main_delivery_done: cutCount > 0 || removedDelivery ? false : session.main_delivery_done,
    main_delivery: cutCount > 0 || removedDelivery ? null : session.main_delivery,
    actions: cutCount > 0 || removedDelivery || session.main_delivery_done ? [] : session.actions,
  };

  if (next.agent_v2 && cutCount > 0) {
    const userTurns = truncated.filter((m) => m.role === "user" && !m.is_rejected).length;
    const phase = userTurns < 1 ? "opening" : "collecting_context";

    const agent_v2 = applyPhaseTransition(
      {
        ...next.agent_v2,
        current_summary: null,
        has_situation_analysis: removedDelivery ? false : next.agent_v2.has_situation_analysis,
        main_delivery_at: removedDelivery ? null : next.agent_v2.main_delivery_at,
        main_delivery_data: removedDelivery ? null : next.agent_v2.main_delivery_data,
        turn_count: Math.max(0, userTurns),
        actions: [],
      },
      {
        should_transition: true,
        new_phase: phase,
        reason: "User edited a prior message; downstream turns removed",
      },
    );

    next = { ...next, agent_v2 };
  }

  return downgradePrematureConfirmationPhase(next);
}
