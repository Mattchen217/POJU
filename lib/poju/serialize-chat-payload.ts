import type { POJULLMResponse } from "@/lib/llm/poju-llm";

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
  "locked_provider",
  "understanding",
  "breakthrough_core_updates",
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
    collection_progress: llm.collection_progress ?? null,
    stall_offer: llm.stall_offer ?? false,
    tool_suggestion: llm.tool_suggestion ?? null,
    start_new_cycle: llm.start_new_cycle ?? false,
    new_cycle_question: llm.new_cycle_question ?? null,
    suggest_refund: llm.suggest_refund ?? false,
    locked_provider: llm.locked_provider,
    understanding: llm.understanding ?? null,
    breakthrough_core_updates: llm.breakthrough_core_updates ?? null,
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
    collection_progress: data.collection_progress ?? null,
    stall_offer: data.stall_offer === true,
    tool_suggestion: data.tool_suggestion ?? null,
    start_new_cycle: data.start_new_cycle === true,
    new_cycle_question:
      typeof data.new_cycle_question === "string" ? data.new_cycle_question : null,
    suggest_refund: data.suggest_refund === true,
    locked_provider: data.locked_provider,
    understanding: data.understanding ?? null,
    breakthrough_core_updates: data.breakthrough_core_updates ?? null,
  });
}
