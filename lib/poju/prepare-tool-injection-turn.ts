import { buildToolResultInjectionMessage } from "@/lib/llm/prompts/tool-result-injection";
import { getActiveCycle, markToolResultInjected } from "@/lib/poju/cycle-manager";
import { extractToolSummary } from "@/lib/poju/extract-tool-summary";
import { findPendingToolInjection, type PendingToolInjection } from "@/lib/poju/find-pending-tool-injection";
import type { POJUMessage, POJUSessionState } from "@/lib/poju/types";

export type ToolInjectionTurnPrep = {
  session: POJUSessionState;
  tool_injection_context: string | null;
  pending: PendingToolInjection | null;
};

/**
 * If a tool result is waiting, append a system record + build LLM injection context.
 * Marks `injected_to_poju` only after caller confirms LLM succeeded (see finalizeToolInjectionTurn).
 */
export function prepareToolInjectionTurn(
  state: POJUSessionState,
  options?: { skipWhenSystemTurn?: boolean },
): ToolInjectionTurnPrep {
  if (options?.skipWhenSystemTurn) {
    return { session: state, tool_injection_context: null, pending: null };
  }

  const pending = findPendingToolInjection(state);
  if (!pending) {
    return { session: state, tool_injection_context: null, pending: null };
  }

  const cycle = getActiveCycle(state);
  const original_question = cycle?.original_question ?? state.original_question;
  const summary = extractToolSummary(pending.tool, pending.tool_result_data);
  const tool_injection_context = buildToolResultInjectionMessage({
    tool: pending.tool,
    result_data: summary,
    original_question,
    delivery_handoff: pending.delivery_handoff,
  });

  const injectionMessage: POJUMessage = {
    role: "system",
    content: tool_injection_context,
    timestamp: new Date().toISOString(),
    meta: { current_state: "collecting_context" },
  };

  return {
    session: { ...state, messages: [...state.messages, injectionMessage] },
    tool_injection_context,
    pending,
  };
}

export function finalizeToolInjectionTurn(
  state: POJUSessionState,
  pending: PendingToolInjection | null,
): POJUSessionState {
  if (!pending) return state;
  return markToolResultInjected(state, pending.tool, pending.tool_result_id);
}
