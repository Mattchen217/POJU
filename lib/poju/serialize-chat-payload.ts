import type { POJULLMResponse } from "@/lib/llm/poju-llm";
import { sanitizeReplyOptions } from "@/lib/poju/reply-options";

/** Single whitelist for POJU chat wire payloads — add new fields here only. */
export const CHAT_PAYLOAD_FIELDS = [
  "response",
  "model",
  "tokens_used",
  "user_intent",
  "current_state",
  "action_requested",
  "topic_drift_detected",
  "topic_drift_signal",
  "drift_reason",
  "should_show_new_session_button",
  "context_updates",
  "contains_delivery",
  "main_delivery",
  "new_actions",
  "agent_suggested_phase",
  "current_summary",
  "question_category",
  "thinking_process",
  "investigation_agenda",
  "collection_progress",
  "stall_offer",
  "tool_suggestion",
  "start_new_cycle",
  "new_cycle_question",
  "suggest_refund",
  "scope_signal",
  "attachments_unlocked",
  "locked_provider",
  "understanding",
  "understanding_sufficient",
  "understanding_generation_failed",
  "agenda_updates",
  "options",
  "user_confirms_delivery",
  "confirmation_signal",
  "breakthrough_core",
  "core_dilemma",
  "desired_direction",
  "problem_summary",
  "breakthrough_core_updates",
  "action_status_updates",
  "conversion_envelope_failed",
  "llm_debug",
] as const;

export type ChatPayloadField = (typeof CHAT_PAYLOAD_FIELDS)[number];

export function serializePojuChatPayload(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of CHAT_PAYLOAD_FIELDS) {
    if (src[k] !== undefined) out[k] = src[k];
  }
  return out;
}

/** Server outbound: POJULLMResponse → JSON / SSE complete payload. */
export function pojuLlmToChatPayload(
  llm: POJULLMResponse,
  overrides?: Partial<Record<ChatPayloadField, unknown>>,
): Record<string, unknown> {
  return serializePojuChatPayload({
    response: llm.response,
    model: llm.model,
    tokens_used: llm.tokens_used,
    user_intent: llm.user_intent,
    current_state: llm.current_state,
    action_requested: llm.action_requested,
    topic_drift_detected: llm.topic_drift_detected,
    topic_drift_signal: llm.topic_drift_signal ?? "none",
    drift_reason: llm.drift_reason ?? null,
    should_show_new_session_button: llm.should_show_new_session_button ?? false,
    context_updates: llm.context_updates,
    contains_delivery: llm.contains_delivery,
    main_delivery: llm.main_delivery,
    new_actions: llm.new_actions,
    agent_suggested_phase: llm.agent_suggested_phase,
    current_summary: llm.current_summary,
    question_category: llm.question_category,
    thinking_process: llm.thinking_process,
    investigation_agenda: llm.investigation_agenda ?? null,
    breakthrough_core: llm.breakthrough_core ?? null,
    core_dilemma: llm.core_dilemma ?? null,
    desired_direction: llm.desired_direction ?? null,
    problem_summary: llm.problem_summary ?? null,
    collection_progress: llm.collection_progress ?? null,
    stall_offer: llm.stall_offer ?? false,
    tool_suggestion: llm.tool_suggestion ?? null,
    start_new_cycle: llm.start_new_cycle ?? false,
    new_cycle_question: llm.new_cycle_question ?? null,
    suggest_refund: llm.suggest_refund ?? false,
    scope_signal: (llm as { scope_signal?: unknown }).scope_signal ?? null,
    attachments_unlocked:
      (llm as { attachments_unlocked?: unknown }).attachments_unlocked === true ? true : undefined,
    locked_provider: llm.locked_provider,
    understanding: llm.understanding ?? null,
    understanding_sufficient: llm.understanding_sufficient,
    understanding_generation_failed: llm.understanding_generation_failed,
    agenda_updates: llm.agenda_updates ?? null,
    options: llm.options,
    user_confirms_delivery: llm.user_confirms_delivery,
    confirmation_signal: llm.confirmation_signal,
    breakthrough_core_updates: llm.breakthrough_core_updates ?? null,
    action_status_updates: llm.action_status_updates ?? undefined,
    conversion_envelope_failed: llm.conversion_envelope_failed,
    llm_debug: llm.llm_debug,
    ...overrides,
  });
}

/** Client inbound: API / SSE complete JSON → whitelisted record (before typed coercion). */
export function chatPayloadFromWire(
  data: Record<string, unknown>,
  defaults: { response: string; current_state: string },
): Record<string, unknown> {
  const topicDriftSignal = data.topic_drift_signal;
  return serializePojuChatPayload({
    ...data,
    response: defaults.response,
    model: data.model ?? "poju-chat-api",
    tokens_used: typeof data.tokens_used === "number" ? data.tokens_used : 0,
    user_intent: data.user_intent ?? "unclear",
    current_state: data.current_state ?? defaults.current_state,
    action_requested: data.action_requested ?? "continue_chat",
    topic_drift_detected: Boolean(data.topic_drift_detected),
    topic_drift_signal:
      topicDriftSignal === "edge" || topicDriftSignal === "off_topic" ? topicDriftSignal : "none",
    drift_reason: typeof data.drift_reason === "string" ? data.drift_reason : null,
    should_show_new_session_button: Boolean(data.should_show_new_session_button),
    context_updates: (data.context_updates as Record<string, unknown>) ?? {},
    contains_delivery: Boolean(data.contains_delivery),
    main_delivery: data.main_delivery,
    new_actions: data.new_actions,
    agent_suggested_phase: data.agent_suggested_phase,
    current_summary: data.current_summary,
    question_category: data.question_category,
    thinking_process: data.thinking_process,
    investigation_agenda: data.investigation_agenda ?? null,
    breakthrough_core: data.breakthrough_core ?? null,
    core_dilemma:
      data.core_dilemma && typeof data.core_dilemma === "object" && !Array.isArray(data.core_dilemma)
        ? data.core_dilemma
        : null,
    desired_direction:
      data.desired_direction &&
      typeof data.desired_direction === "object" &&
      !Array.isArray(data.desired_direction)
        ? data.desired_direction
        : null,
    problem_summary:
      typeof data.problem_summary === "string" ? data.problem_summary : null,
    collection_progress: data.collection_progress ?? null,
    stall_offer: data.stall_offer === true,
    tool_suggestion: data.tool_suggestion ?? null,
    start_new_cycle: data.start_new_cycle === true,
    new_cycle_question:
      typeof data.new_cycle_question === "string" ? data.new_cycle_question : null,
    suggest_refund: data.suggest_refund === true,
    scope_signal:
      data.scope_signal === "in_scope" ||
      data.scope_signal === "unclear" ||
      data.scope_signal === "out_of_scope"
        ? data.scope_signal
        : null,
    attachments_unlocked: data.attachments_unlocked === true ? true : undefined,
    locked_provider: data.locked_provider,
    understanding: data.understanding ?? null,
    understanding_sufficient:
      typeof data.understanding_sufficient === "boolean" ? data.understanding_sufficient : undefined,
    understanding_generation_failed:
      data.understanding_generation_failed === true ? true : undefined,
    agenda_updates:
      data.agenda_updates && typeof data.agenda_updates === "object" && !Array.isArray(data.agenda_updates)
        ? (data.agenda_updates as { completed_in_this_turn?: string[] })
        : undefined,
    options: sanitizeReplyOptions(data.options),
    user_confirms_delivery:
      typeof data.user_confirms_delivery === "boolean" ? data.user_confirms_delivery : undefined,
    confirmation_signal:
      data.confirmation_signal === "confirmed" ||
      data.confirmation_signal === "wants_to_add" ||
      data.confirmation_signal === "unclear"
        ? data.confirmation_signal
        : undefined,
    breakthrough_core_updates: data.breakthrough_core_updates ?? null,
    action_status_updates: data.action_status_updates,
    conversion_envelope_failed:
      typeof data.conversion_envelope_failed === "boolean" ? data.conversion_envelope_failed : undefined,
    llm_debug:
      data.llm_debug && typeof data.llm_debug === "object" && !Array.isArray(data.llm_debug)
        ? (data.llm_debug as import("@/lib/llm/llm-debug").LLMCallDebug)
        : undefined,
  });
}
