/**
 * Opening phase (segment 1) — control flow.
 * Owns understanding turns + gate supplement/retry.
 * Does NOT run segment-2 xhigh (that stays outside until phases/segment2 exists).
 */
import { advanceStateMachine, extractModelTurnSignals } from "@/lib/poju/state-machine";
import {
  createInitialAgentState,
  normalizeAgentPhase,
  type AgentPhase,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";
import { withSessionProfileFlags } from "@/lib/poju/session-profile";
import { ensureSessionCycles } from "@/lib/poju/cycle-manager";

export function isOpeningControlPhase(phase: AgentPhase | string | null | undefined): boolean {
  const p = normalizeAgentPhase(phase) ?? phase;
  return p === "opening" || p === "awaiting_understanding_confirm";
}

function ensureAgentV2(session: POJUSessionState): POJUAgentState {
  const base = session.agent_v2;
  if (base) {
    const phase = normalizeAgentPhase(base.current_phase) ?? base.current_phase;
    return { ...base, current_phase: phase };
  }
  return createInitialAgentState({
    original_question: session.original_question,
    selected_profile_id: session.selected_stored_profile_id,
  });
}

/** Strip agenda/core side-effects from LLM payload while in opening control. */
export function openingSafeLlmWire<T extends Record<string, unknown>>(llm: T): T {
  return {
    ...llm,
    investigation_agenda: null,
    agenda_updates: undefined,
    breakthrough_core_updates: null,
    breakthrough_core: null,
    problem_summary: null,
  };
}

/** Return to opening for user-typed supplement — no chat messages yet. */
export function applyUnderstandingGateSupplement(session: POJUSessionState): POJUSessionState {
  const baseAgent = ensureAgentV2(session);
  const phase = normalizeAgentPhase(baseAgent.current_phase);
  if (phase !== "awaiting_understanding_confirm") return session;

  const signals = extractModelTurnSignals({ confirmation_signal: "wants_to_add" });
  const advance = advanceStateMachine(baseAgent, signals, "");
  return withSessionProfileFlags({
    ...session,
    agent_v2: advance.next_agent,
    last_interaction_at: new Date().toISOString(),
  });
}

/** Retry segment-1 opening turn after transport resends exhausted (bad JSON / empty). */
export async function handleRetryOpeningUnderstanding(input: {
  session: POJUSessionState;
  locale: string;
}): Promise<POJUSessionState> {
  const session = ensureSessionCycles(input.session);
  let messages: POJUMessage[] = [...session.messages];
  const last = messages[messages.length - 1];
  if (last?.role === "assistant" && last.meta?.understanding_generation_failed) {
    messages = messages.slice(0, -1);
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userMessage = lastUser?.content?.trim() || "__OPENING__";

  // Dynamic import avoids control ↔ agent circular load.
  const { handleUserMessage } = await import("@/lib/poju/agent");
  return handleUserMessage({
    session: { ...session, messages },
    userMessage,
    locale: input.locale,
    userAlreadyAppended: true,
  });
}
