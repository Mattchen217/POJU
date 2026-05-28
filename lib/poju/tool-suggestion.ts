/**
 * Parse + apply POJU tool suggestions / new cycle (Tool_Linking Step 2).
 */

import {
  checkToolQuota,
  ensureSessionCycles,
  recordToolSuggestion,
  startNewCycle,
} from "@/lib/poju/cycle-manager";
import type { PhaseLLMInput } from "@/lib/llm/phases/types";
import type { POJUSessionState, ToolName, ToolSuggestionPayload } from "@/lib/poju/types";

export function getToolSuggestionResponseState(
  session: POJUSessionState,
  tool: ToolName,
  suggestionMessageId: string,
): "accepted" | "declined" | null {
  for (const cycle of session.cycles ?? []) {
    const row = cycle.tool_suggestions.find(
      (s) => s.tool === tool && s.suggested_in_message_id === suggestionMessageId,
    );
    if (row?.user_action === "accepted" || row?.user_action === "declined") {
      return row.user_action;
    }
  }
  return null;
}

const VALID_TOOLS: ToolName[] = ["glyph", "syncro", "match"];

export function resolveTimezoneForToolRules(input: PhaseLLMInput): string {
  const fromProfile = input.profile?.birth?.timezone?.trim();
  if (fromProfile) return fromProfile;
  const shared = input.session.shared_context?.user_timezone;
  if (typeof shared === "string" && shared.trim()) return shared.trim();
  return "UTC";
}

export function parseToolSuggestionFromParsed(parsed: Record<string, unknown>): ToolSuggestionPayload | null {
  const raw = parsed.tool_suggestion;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const tool = typeof o.tool === "string" ? o.tool.trim().toLowerCase() : "";
  if (!VALID_TOOLS.includes(tool as ToolName)) return null;
  const trigger_context = typeof o.trigger_context === "string" ? o.trigger_context.trim() : "";
  if (!trigger_context) return null;
  return {
    tool: tool as ToolName,
    trigger_context,
    value_prop: typeof o.value_prop === "string" ? o.value_prop.trim() : undefined,
    prefill:
      o.prefill && typeof o.prefill === "object" && !Array.isArray(o.prefill)
        ? (o.prefill as Record<string, unknown>)
        : undefined,
  };
}

export function parseStartNewCycleFromParsed(parsed: Record<string, unknown>): {
  start_new_cycle: boolean;
  new_cycle_question: string | null;
} {
  const start = parsed.start_new_cycle === true;
  const q =
    typeof parsed.new_cycle_question === "string" ? parsed.new_cycle_question.trim() : "";
  return {
    start_new_cycle: start && q.length > 0,
    new_cycle_question: start && q.length > 0 ? q : null,
  };
}

export type ToolLinkingApplyResult = {
  session: POJUSessionState;
  tool_suggestion: ToolSuggestionPayload | null;
  start_new_cycle: boolean;
};

/** Apply LLM tool / cycle hints to session (quota-safe). */
export function applyToolLinkingFromLlm(
  session: POJUSessionState,
  parsed: {
    tool_suggestion?: ToolSuggestionPayload | null;
    start_new_cycle?: boolean;
    new_cycle_question?: string | null;
    question_category?: string | null;
  },
  assistantMessageId: string,
): ToolLinkingApplyResult {
  let next = ensureSessionCycles(session);
  let start_new_cycle = false;

  if (parsed.start_new_cycle && parsed.new_cycle_question) {
    next = startNewCycle(
      next,
      parsed.new_cycle_question,
      parsed.question_category ?? undefined,
    );
    start_new_cycle = true;
  }

  let tool_suggestion: ToolSuggestionPayload | null = null;
  const suggestion = parsed.tool_suggestion;
  if (suggestion) {
    const { available } = checkToolQuota(next, suggestion.tool);
    if (available) {
      next = recordToolSuggestion(
        next,
        suggestion.tool,
        assistantMessageId,
        suggestion.trigger_context,
      );
      tool_suggestion = suggestion;
    } else {
      console.warn("[tool-suggestion] LLM suggested tool but quota unavailable:", suggestion.tool);
    }
  }

  return { session: next, tool_suggestion, start_new_cycle };
}
