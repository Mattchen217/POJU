import { createInitialAgentState } from "@/lib/poju/agent-state";
import { buildStateSnapshot, type StateLedgerSnapshot } from "@/lib/poju/state-machine";
import type { POJUSessionState } from "@/lib/poju/types";

export function buildDevStateLedger(session: POJUSessionState): StateLedgerSnapshot {
  const agent =
    session.agent_v2 ??
    createInitialAgentState({ original_question: session.original_question ?? "" });
  return buildStateSnapshot(agent);
}

/** Attach dev-only state ledger snapshot to chat wire payloads (server). */
export function attachDevStateLedger(
  payload: Record<string, unknown>,
  session: POJUSessionState,
): Record<string, unknown> {
  if (process.env.NODE_ENV !== "development") return payload;
  return { ...payload, debug_state_ledger: buildDevStateLedger(session) };
}
