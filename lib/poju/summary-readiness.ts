import type { POJUSessionState } from "@/lib/poju/types";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";

export function countUserTurns(session: POJUSessionState): number {
  return session.messages.filter((m) => m.role === "user" && !m.is_rejected).length;
}

/** Context summary form only at interview wrap-up — not greeting / thin sessions. */
export function shouldShowContextSummaryForm(session: POJUSessionState): boolean {
  const agent = session.agent_v2;
  if (!agent || agent.current_phase !== "awaiting_confirmation") return false;
  if (session.main_delivery_done) return false;
  if (!agent.current_summary?.sections?.length) return false;

  const userTurns = countUserTurns(session);
  if (userTurns < 2) return false;

  const completeness = agent.collection_completeness ?? 0;
  if (completeness < 0.45) return false;

  if (!resolveSessionHasProfile(session) && !session.profile_skipped) return false;

  return true;
}

/** Downgrade mistaken early `awaiting_confirmation` (e.g. restored thin session). */
export function downgradePrematureConfirmationPhase(session: POJUSessionState): POJUSessionState {
  const agent = session.agent_v2;
  if (!agent || agent.current_phase !== "awaiting_confirmation") return session;
  if (shouldShowContextSummaryForm(session)) return session;

  return {
    ...session,
    agent_v2: {
      ...agent,
      current_phase: "collecting_context",
      current_summary: null,
    },
  };
}
