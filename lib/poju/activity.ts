import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import type { POJUSessionState } from "@/lib/poju/types";

export type PojuActivity =
  | "understanding"
  | "deep_reckoning"
  | "collecting"
  | "summarizing"
  | "delivering"
  | "tracking"
  | "degraded_delivering";

/** Activity for call-1 while waiting (before assistant message renders). */
export function resolveActivityForSend(session: POJUSessionState): PojuActivity {
  const phase = normalizeAgentPhase(session.agent_v2?.current_phase);
  if (phase === "opening") return "understanding";
  if (phase === "collecting_context") return "collecting";
  if (phase === "awaiting_confirmation") return "summarizing";
  if (phase === "tracking") return "tracking";
  if (phase === "delivered") return "tracking";
  return "understanding";
}

/** Post call-1 orchestration will run breakthrough-core (trailing indicator). */
export function willTriggerDeepReckoning(session: POJUSessionState): boolean {
  return (
    session.agent_v2?.current_phase === "collecting_context" &&
    session.agent_v2.breakthrough_core == null &&
    resolveSessionHasProfile(session)
  );
}

export function willRunDegradedDelivery(session: POJUSessionState): boolean {
  return (
    session.agent_v2?.delivery_mode === "degraded" &&
    session.agent_v2?.current_phase === "delivered" &&
    !session.main_delivery_done
  );
}
