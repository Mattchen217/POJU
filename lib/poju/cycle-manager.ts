/**
 * POJU multi-cycle + tool quota (Tool_Linking_Final Step 1).
 */

import { safeRandomUUID } from "@/lib/client/safe-crypto";
import type { POJUCycle, POJUCycleDeliveredAction, POJUSessionState, ToolName, ToolSuggestion } from "@/lib/poju/types";

export function createNewCycle(input: {
  original_question: string;
  question_category?: string;
  cycle_index: number;
  current_summary?: unknown | null;
}): POJUCycle {
  return {
    cycle_id: safeRandomUUID(),
    cycle_index: input.cycle_index,
    original_question: input.original_question.trim(),
    question_category: input.question_category || "unknown",
    current_summary: input.current_summary ?? null,
    started_at: new Date().toISOString(),
    tool_suggestions: [],
    is_delivered: false,
    is_active: true,
  };
}

export function getActiveCycle(state: POJUSessionState): POJUCycle | null {
  if (!state.cycles?.length || !state.active_cycle_id) return null;
  return state.cycles.find((c) => c.cycle_id === state.active_cycle_id) ?? null;
}

export function markCycleDelivered(
  state: POJUSessionState,
  cycle_id: string,
  delivered_actions: POJUCycleDeliveredAction[],
): POJUSessionState {
  return {
    ...state,
    cycles: (state.cycles ?? []).map((c) =>
      c.cycle_id === cycle_id
        ? {
            ...c,
            delivery_completed_at: new Date().toISOString(),
            delivered_actions,
            is_delivered: true,
          }
        : c,
    ),
  };
}

export function startNewCycle(
  state: POJUSessionState,
  new_question: string,
  new_category?: string,
): POJUSessionState {
  const updatedCycles = (state.cycles ?? []).map((c) => ({ ...c, is_active: false }));
  const newCycle = createNewCycle({
    original_question: new_question,
    question_category: new_category,
    cycle_index: updatedCycles.length + 1,
  });

  const agent = state.agent_v2;
  const nextAgent = agent
    ? {
        ...agent,
        current_phase: "collecting_context" as const,
        original_question: new_question.trim(),
        question_category:
          (new_category as typeof agent.question_category) ?? agent.question_category,
        current_summary: null,
        collection_completeness: 0,
        has_situation_analysis: false,
      }
    : agent;

  return {
    ...state,
    original_question: new_question.trim(),
    cycles: [...updatedCycles, newCycle],
    active_cycle_id: newCycle.cycle_id,
    agent_v2: nextAgent,
  };
}

export function checkToolQuota(
  state: POJUSessionState,
  tool: ToolName,
): {
  available: boolean;
  already_suggested: boolean;
  already_declined: boolean;
  already_used: boolean;
} {
  const activeCycle = getActiveCycle(state);
  if (!activeCycle) {
    return {
      available: false,
      already_suggested: false,
      already_declined: false,
      already_used: false,
    };
  }

  const suggestions = activeCycle.tool_suggestions.filter((s) => s.tool === tool);
  const declined = suggestions.some((s) => s.user_action === "declined");
  const used = suggestions.some((s) => s.user_action === "accepted" && s.tool_result_id);
  const suggested = suggestions.length > 0;

  if (used) {
    return {
      available: false,
      already_suggested: true,
      already_declined: false,
      already_used: true,
    };
  }

  if (declined) {
    return {
      available: false,
      already_suggested: true,
      already_declined: true,
      already_used: false,
    };
  }

  if (suggested) {
    return {
      available: false,
      already_suggested: true,
      already_declined: false,
      already_used: false,
    };
  }

  return {
    available: true,
    already_suggested: false,
    already_declined: false,
    already_used: false,
  };
}

export function recordToolSuggestion(
  state: POJUSessionState,
  tool: ToolName,
  message_id: string,
  trigger_context: string,
): POJUSessionState {
  const activeCycle = getActiveCycle(state);
  if (!activeCycle) return state;

  const suggestion: ToolSuggestion = {
    tool,
    suggested_at: new Date().toISOString(),
    suggested_in_message_id: message_id,
    trigger_context,
    user_action: "pending",
  };

  return patchActiveCycle(state, activeCycle.cycle_id, (c) => ({
    ...c,
    tool_suggestions: [...c.tool_suggestions, suggestion],
  }));
}

export function recordUserResponse(
  state: POJUSessionState,
  tool: ToolName,
  action: "accepted" | "declined",
): POJUSessionState {
  const activeCycle = getActiveCycle(state);
  if (!activeCycle) return state;

  return patchActiveCycle(state, activeCycle.cycle_id, (c) => ({
    ...c,
    tool_suggestions: updateLatestPendingSuggestion(c.tool_suggestions, tool, action),
  }));
}

export function injectToolResult(
  state: POJUSessionState,
  tool: ToolName,
  result_id: string,
  result_data: unknown,
): POJUSessionState {
  const activeCycle = getActiveCycle(state);
  if (!activeCycle) return state;

  const already = activeCycle.tool_suggestions.find(
    (s) => s.tool_result_id === result_id && s.injected_to_poju !== true,
  );
  if (already) return state;

  const hasAcceptedSlot = activeCycle.tool_suggestions.some(
    (s) => s.tool === tool && s.user_action === "accepted" && !s.tool_result_id,
  );
  if (hasAcceptedSlot) {
    return patchActiveCycle(state, activeCycle.cycle_id, (c) => ({
      ...c,
      tool_suggestions: c.tool_suggestions.map((s) => {
        if (s.tool === tool && s.user_action === "accepted" && !s.tool_result_id) {
          return {
            ...s,
            tool_result_id: result_id,
            tool_result_data: result_data,
            tool_completed_at: new Date().toISOString(),
            injected_to_poju: false,
          };
        }
        return s;
      }),
    }));
  }

  const suggestion: ToolSuggestion = {
    tool,
    suggested_at: new Date().toISOString(),
    suggested_in_message_id: "external-from-tool",
    trigger_context: "User continued from a tool result page",
    user_action: "accepted",
    tool_result_id: result_id,
    tool_result_data: result_data,
    tool_completed_at: new Date().toISOString(),
    injected_to_poju: false,
  };

  return patchActiveCycle(state, activeCycle.cycle_id, (c) => ({
    ...c,
    tool_suggestions: [...c.tool_suggestions, suggestion],
  }));
}

export function markToolResultInjected(
  state: POJUSessionState,
  tool: ToolName,
  result_id: string,
): POJUSessionState {
  const activeCycle = getActiveCycle(state);
  if (!activeCycle) return state;

  return patchActiveCycle(state, activeCycle.cycle_id, (c) => ({
    ...c,
    tool_suggestions: c.tool_suggestions.map((s) =>
      s.tool === tool && s.tool_result_id === result_id ? { ...s, injected_to_poju: true } : s,
    ),
  }));
}

/** Wrap legacy sessions (no cycles) into a single active cycle. */
export function ensureSessionCycles(state: POJUSessionState): POJUSessionState {
  if (state.cycles?.length && state.active_cycle_id) {
    const hasActive = state.cycles.some((c) => c.cycle_id === state.active_cycle_id);
    if (hasActive) return state;
  }

  const agent = state.agent_v2;
  const category = agent?.question_category ?? "unknown";
  const cycle = createNewCycle({
    original_question: state.original_question,
    question_category: typeof category === "string" ? category : "unknown",
    cycle_index: 1,
    current_summary: agent?.current_summary ?? null,
  });

  if (state.main_delivery_done) {
    cycle.is_delivered = true;
    cycle.delivery_completed_at =
      state.main_delivery?.delivered_at ?? agent?.main_delivery_at ?? cycle.started_at;
    cycle.delivered_actions = state.actions.map((a) => ({
      action_id: a.action_id,
      category: a.category,
      text: a.text,
      status: a.status,
      timing: a.timing,
    }));
  }

  return {
    ...state,
    cycles: [cycle],
    active_cycle_id: cycle.cycle_id,
    shared_context: state.shared_context ?? {},
  };
}

function patchActiveCycle(
  state: POJUSessionState,
  cycle_id: string,
  patch: (cycle: POJUCycle) => POJUCycle,
): POJUSessionState {
  return {
    ...state,
    cycles: (state.cycles ?? []).map((c) => (c.cycle_id === cycle_id ? patch(c) : c)),
  };
}

function updateLatestPendingSuggestion(
  suggestions: ToolSuggestion[],
  tool: ToolName,
  action: "accepted" | "declined",
): ToolSuggestion[] {
  let targetIdx = -1;
  for (let i = suggestions.length - 1; i >= 0; i--) {
    if (suggestions[i].tool === tool && suggestions[i].user_action === "pending") {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx < 0) return suggestions;
  return suggestions.map((s, i) => (i === targetIdx ? { ...s, user_action: action } : s));
}
