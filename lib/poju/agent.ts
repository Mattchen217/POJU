import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { loadSessionProfileBundle, resolveSessionHasProfile, withSessionProfileFlags } from "@/lib/poju/session-profile";
import { logBaseAnalysisPayload } from "@/lib/poju/base-analysis-diagnostics";
import type { POJUAction, POJUSessionState, POJUMessage } from "@/lib/poju/types";
import { checkRuleViolation, getRuleRejectionMessage } from "@/lib/poju/rules";
import {
  applyPhaseTransition,
  calculateCompleteness,
  createInitialAgentState,
  decidePhaseTransition,
  normalizeAgentPhase,
  type AgentPhase,
  type ContextSummary,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import { countUserTurns } from "@/lib/poju/summary-readiness";
import {
  applyCollectingTurnCounters,
  evaluateStopLoss,
  parseCollectionProgress,
} from "@/lib/poju/collection-progress";
import { ensureSessionCycles } from "@/lib/poju/cycle-manager";
import { finalizeToolInjectionTurn, prepareToolInjectionTurn } from "@/lib/poju/prepare-tool-injection-turn";
import { findPendingToolInjection } from "@/lib/poju/find-pending-tool-injection";
import { extractQuestionCategory, mergeContextUpdates, recordToLLMContextUpdates } from "@/lib/poju/context-extractor";
import {
  applyAgendaStatusUpdates,
  extractAgendaStatusUpdates,
  parseInvestigationAgenda,
  stripAgendaFieldsFromContextUpdates,
  getNextAgendaFocus,
} from "@/lib/poju/investigation-agenda";
import { applyToolLinkingFromLlm } from "@/lib/poju/tool-suggestion";
import type { ToolSuggestionPayload } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import { chatPayloadFromWire } from "@/lib/poju/serialize-chat-payload";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
/** Session uses default `userProfiles` slot from device. */
const SESSION_PROFILE_SLOT = "active_user_profile";

function resolveSelectedProfileId(session: POJUSessionState, agent: POJUAgentState): string | null {
  const sid = session.selected_stored_profile_id?.trim();
  if (sid) return sid;
  if (session.has_profile) return agent.selected_profile_id ?? SESSION_PROFILE_SLOT;
  return null;
}

export interface HandleInput {
  session: POJUSessionState;
  userMessage: string;
  locale: string;
  /** Session already includes this user turn (optimistic UI); skip rule re-check and duplicate append. */
  userAlreadyAppended?: boolean;
  signal?: AbortSignal;
  onStream?: {
    onReasoning?: (text: string) => void;
    /** First JSON/content byte from the model (reasoning phase ended). */
    onContentStreamStart?: () => void;
    onPartialResponse?: (text: string) => void;
  };
}

type LLMApiPayload = {
  response?: string;
  reply?: string;
  model?: string;
  tokens_used?: number;
  user_intent?: POJUMessage["meta"] extends { user_intent?: infer U } ? U : string;
  current_state?: string;
  action_requested?: string;
  topic_drift_detected?: boolean;
  topic_drift_signal?: "none" | "edge" | "off_topic";
  drift_reason?: string | null;
  should_show_new_session_button?: boolean;
  context_updates?: Record<string, unknown>;
  contains_delivery?: boolean;
  main_delivery?: unknown;
  new_actions?: unknown[];
  error?: string;
  agent_suggested_phase?: string;
  current_summary?: ContextSummary | null;
  question_category?: string | null;
  thinking_process?: string;
  tool_suggestion?: ToolSuggestionPayload | null;
  start_new_cycle?: boolean;
  new_cycle_question?: string | null;
  collection_progress?: "advancing" | "stalled" | "resistant" | null;
  stall_offer?: boolean;
  investigation_agenda?: unknown;
  suggest_refund?: boolean;
  locked_provider?: string;
};

function ensureAgentV2(session: POJUSessionState): POJUAgentState {
  const merge = (base: POJUAgentState): POJUAgentState => {
    const defaults = createInitialAgentState({
      original_question: base.original_question || session.original_question,
      selected_profile_id: base.selected_profile_id ?? session.selected_stored_profile_id,
    });
    const phase = normalizeAgentPhase(base.current_phase) ?? base.current_phase;
    return {
      ...defaults,
      ...base,
      current_phase: phase,
      profile_skipped: session.profile_skipped,
      has_base_analysis: session.has_profile || base.has_base_analysis,
      selected_profile_id: resolveSelectedProfileId(session, base),
    };
  };
  if (session.agent_v2) return merge(session.agent_v2);
  const init = createInitialAgentState({
    original_question: session.original_question,
    selected_profile_id: session.selected_stored_profile_id,
  });
  return merge(init);
}

function mapLlmHintToAgentPhase(hint: string | undefined): AgentPhase | null {
  const normalized = normalizeAgentPhase(hint);
  if (normalized) return normalized;
  switch (hint) {
    case "analyzing":
      return "awaiting_confirmation";
    default:
      return null;
  }
}

function finalizeAgentV2(
  base: POJUAgentState,
  session: POJUSessionState,
  llm: {
    context_updates: Record<string, unknown>;
    tokens_used?: number;
    current_state?: string;
    agent_suggested_phase?: string;
    current_summary?: ContextSummary | null;
    question_category?: string | null;
    contains_delivery?: boolean;
    main_delivery?: unknown;
    collection_progress?: "advancing" | "stalled" | "resistant" | null;
    stall_offer?: boolean;
    investigation_agenda?: unknown;
  },
  userMessage: string,
  isSystemMessage: boolean,
): POJUAgentState {
  const flat = llm.context_updates ?? {};
  const agendaStatusUpdates = extractAgendaStatusUpdates(flat);
  const contextFlat = stripAgendaFieldsFromContextUpdates(flat);
  const structured = recordToLLMContextUpdates(contextFlat);
  let investigation_agenda = base.investigation_agenda ?? [];
  let agenda_generated = base.agenda_generated ?? false;

  if (!agenda_generated) {
    const parsedAgenda = parseInvestigationAgenda(llm.investigation_agenda);
    if (parsedAgenda) {
      investigation_agenda = parsedAgenda;
      agenda_generated = true;
    }
  } else if (agendaStatusUpdates) {
    investigation_agenda = applyAgendaStatusUpdates(investigation_agenda, agendaStatusUpdates);
  }

  if (investigation_agenda.length > 0) {
    const focus = getNextAgendaFocus(investigation_agenda);
    const focusIds = focus.map((a) => a.id).join(", ") || "—";
    console.info(`[agent] agenda: ${investigation_agenda.length} items, next focus = ${focusIds}`);
  }

  let merged: POJUAgentState = {
    ...base,
    context_collected: mergeContextUpdates(base.context_collected, structured),
    question_category:
      extractQuestionCategory(contextFlat) ??
      (llm.question_category as POJUAgentState["question_category"]) ??
      base.question_category,
    profile_skipped: session.profile_skipped,
    has_base_analysis: session.has_profile,
    selected_profile_id: resolveSelectedProfileId(session, base),
    investigation_agenda,
    agenda_generated,
  };
  merged = {
    ...merged,
    collection_completeness: calculateCompleteness(merged),
    has_situation_analysis: calculateCompleteness(merged) >= 0.4,
  };
  const llmPhase =
    normalizeAgentPhase(llm.agent_suggested_phase) ?? mapLlmHintToAgentPhase(llm.current_state);
  const phaseUserMessage =
    userMessage.trim() === "__OPENING__"
      ? "__OPENING__"
      : isSystemMessage
        ? ""
        : userMessage;

  const currentPhase = normalizeAgentPhase(base.current_phase) ?? base.current_phase;
  const collectionProgress = parseCollectionProgress(llm.collection_progress);
  const isCollectingTurn = currentPhase === "collecting_context" && !isSystemMessage;
  const counters = applyCollectingTurnCounters(base, {
    isCollectingTurn,
    collection_progress: collectionProgress,
  });
  const stopLoss = isCollectingTurn
    ? evaluateStopLoss({
        stall_count: counters.stall_count,
        collection_progress: collectionProgress,
        collecting_turn_count: counters.collecting_turn_count,
      })
    : { triggered: false, reason: null };

  const stallOffer = Boolean((llm as { stall_offer?: boolean }).stall_offer);

  const userTurns = countUserTurns(session);
  merged = { ...merged, turn_count: userTurns };

  const transition = decidePhaseTransition({
    current_state: merged,
    llm_suggested_phase: llmPhase,
    user_message: phaseUserMessage,
    user_turn_count: userTurns,
    collection_progress: collectionProgress,
    stall_count: counters.stall_count,
    collecting_turn_count: counters.collecting_turn_count,
    stop_loss: stopLoss,
    stall_offer: stallOffer,
  });
  let after = applyPhaseTransition(merged, transition);
  after = {
    ...after,
    stall_count: transition.reset_stall_count ? 0 : counters.stall_count,
    collecting_turn_count: counters.collecting_turn_count,
  };
  if (isCollectingTurn && after.resume_collecting_low_barrier) {
    after = { ...after, resume_collecting_low_barrier: false };
  }
  if (stopLoss.triggered && stallOffer) {
    console.info("[agent] Stall offer presented:", stopLoss.reason, {
      stall_count: counters.stall_count,
      collecting_turn_count: counters.collecting_turn_count,
    });
  }
  if (llm.current_summary && after.current_phase === "awaiting_confirmation") {
    after = { ...after, current_summary: llm.current_summary };
  }
  const nowIso = new Date().toISOString();
  if (llm.contains_delivery) {
    after = {
      ...after,
      main_delivery_at: nowIso,
      main_delivery_data: llm.main_delivery ?? after.main_delivery_data,
    };
  }
  const tokenDelta = typeof llm.tokens_used === "number" ? llm.tokens_used : 0;
  return {
    ...after,
    turn_count: userTurns,
    tokens_used: after.tokens_used + tokenDelta,
  };
}

function normalizeNewActions(raw: unknown[] | undefined): POJUAction[] {
  if (!Array.isArray(raw)) return [];
  const now = new Date().toISOString();
  return raw.map((item: unknown) => {
    const a = item as Record<string, unknown>;
    const category = ["traditional", "modern_decisive", "modern_reflective"].includes(String(a?.category))
      ? (a.category as POJUAction["category"])
      : "modern_reflective";
    const timing = ["immediate", "this_week", "this_month", "ongoing"].includes(String(a?.timing))
      ? (a.timing as POJUAction["timing"])
      : "this_week";
    const status = ["pending", "completed", "modified", "skipped"].includes(String(a?.status))
      ? (a.status as POJUAction["status"])
      : "pending";
    return {
      action_id: typeof a?.action_id === "string" && a.action_id ? a.action_id : safeRandomUUID(),
      given_at: typeof a?.given_at === "string" ? a.given_at : now,
      text: String(a?.text ?? "—"),
      title: typeof a?.title === "string" && a.title.trim() ? a.title.trim() : undefined,
      category,
      timing,
      rationale: String(a?.rationale ?? ""),
      status,
    };
  });
}

/**
 * Step 3 dynamic agent skeleton:
 * - appends user/system message
 * - prepares profile context
 * - calls /api/poju/chat (Gemini via server, same models as Glyph oracle full-reading)
 * - appends assistant message
 */
export async function handleUserMessage(input: HandleInput): Promise<POJUSessionState> {
  const { session: sessionIn, userMessage, locale, userAlreadyAppended, signal, onStream } = input;
  const session = ensureSessionCycles(sessionIn);
  const isOpeningSignal = userMessage.trim() === "__OPENING__";
  const isSystemMessage = userMessage.startsWith("[SYSTEM:") || isOpeningSignal;

  const externalHandoffPending = findPendingToolInjection(session);
  const injectionPrep = prepareToolInjectionTurn(session, {
    skipWhenSystemTurn: isSystemMessage && !externalHandoffPending,
  });
  let sessionBase = injectionPrep.session;

  if (!isSystemMessage && !userAlreadyAppended) {
    const ruleCheck = checkRuleViolation(userMessage, sessionBase);
    if (ruleCheck.violated && ruleCheck.type) {
      return handleRuleRejection(sessionBase, userMessage, ruleCheck.type, locale);
    }
  }

  const newUserMessage: POJUMessage = {
    role: isSystemMessage ? "system" : "user",
    content: userMessage,
    timestamp: new Date().toISOString(),
  };

  let messagesWithUser: POJUMessage[];
  if (isOpeningSignal) {
    messagesWithUser = sessionBase.messages;
  } else if (!isSystemMessage && userAlreadyAppended) {
    const last = sessionBase.messages[sessionBase.messages.length - 1];
    if (last?.role === "user" && last.content.trim() === userMessage.trim()) {
      messagesWithUser = sessionBase.messages;
    } else {
      messagesWithUser = [...sessionBase.messages, newUserMessage];
    }
  } else {
    messagesWithUser = [...sessionBase.messages, newUserMessage];
  }
  let sessionForLlm = withSessionProfileFlags({ ...session, messages: messagesWithUser });
  if (isOpeningSignal) {
    sessionForLlm = {
      ...sessionForLlm,
      messages: [
        ...messagesWithUser,
        { role: "user", content: "__OPENING__", timestamp: new Date().toISOString() },
      ],
    };
  }
  const { profile, base_analysis } = await loadSessionProfileBundle(sessionForLlm);
  logBaseAnalysisPayload("callLLMViaAPI:before-fetch", base_analysis, {
    session_id: sessionForLlm.session_id,
    has_profile: resolveSessionHasProfile(sessionForLlm),
  });

  let archive_data: import("@/lib/archive/archive-service").POJUActionRecommendationsData | null = null;
  if (sessionForLlm.main_delivery_done && sessionForLlm.session_id) {
    const { loadArchiveDataForSession } = await import("@/lib/archive/archive-service");
    archive_data = await loadArchiveDataForSession(sessionForLlm.session_id);
  }

  let workingSession = sessionBase;

  const llmResponse = await callLLMViaAPI({
    session: sessionForLlm,
    profile,
    base_analysis,
    archive_data,
    locale,
    signal,
    tool_injection_context: injectionPrep.tool_injection_context,
    onStream,
  });

  workingSession = finalizeToolInjectionTurn(workingSession, injectionPrep.pending);

  const normalizedNewActions = normalizeNewActions(llmResponse.new_actions);
  const assistantMessageId = safeRandomUUID();

  const linking = applyToolLinkingFromLlm(
    { ...workingSession, messages: messagesWithUser },
    {
      tool_suggestion: llmResponse.tool_suggestion ?? null,
      start_new_cycle: llmResponse.start_new_cycle,
      new_cycle_question: llmResponse.new_cycle_question ?? null,
      question_category: llmResponse.question_category,
    },
    assistantMessageId,
  );

  workingSession = linking.session;
  const mergedActions =
    normalizedNewActions.length > 0
      ? [...workingSession.actions, ...normalizedNewActions]
      : workingSession.actions;

  const sessionForAgent: POJUSessionState = { ...workingSession, messages: messagesWithUser };
  const agentCore = finalizeAgentV2(
    ensureAgentV2(sessionForAgent),
    sessionForAgent,
    {
      context_updates: llmResponse.context_updates ?? {},
      tokens_used: llmResponse.tokens_used,
      current_state: llmResponse.current_state,
      agent_suggested_phase: llmResponse.agent_suggested_phase,
      current_summary: llmResponse.current_summary,
      question_category: llmResponse.question_category,
      contains_delivery: llmResponse.contains_delivery,
      main_delivery: llmResponse.main_delivery,
      collection_progress: llmResponse.collection_progress,
      stall_offer: llmResponse.stall_offer,
      investigation_agenda: llmResponse.investigation_agenda,
    },
    userMessage,
    isSystemMessage,
  );
  const agent_v2: POJUAgentState = { ...agentCore, actions: mergedActions };

  const assistantMessage: POJUMessage = {
    role: "assistant",
    content: llmResponse.response,
    timestamp: new Date().toISOString(),
    meta: {
      llm_model: llmResponse.model,
      tokens_used: llmResponse.tokens_used,
      user_intent: llmResponse.user_intent,
      current_state: llmResponse.current_state,
      action_requested: llmResponse.action_requested,
      topic_drift_detected: llmResponse.topic_drift_detected,
      topic_drift_signal: llmResponse.topic_drift_signal,
      drift_reason: llmResponse.drift_reason ?? undefined,
      should_show_new_session_button: llmResponse.should_show_new_session_button,
      suggest_refund: llmResponse.suggest_refund,
      contains_delivery: llmResponse.contains_delivery,
      tool_suggestion: linking.tool_suggestion ?? undefined,
      tool_suggestion_message_id: linking.tool_suggestion ? assistantMessageId : undefined,
      thinking_process: llmResponse.thinking_process,
    },
  };

  const nowIso = new Date().toISOString();
  const rollingExpiry = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();

  return withSessionProfileFlags({
    ...workingSession,
    messages: [...messagesWithUser, assistantMessage],
    context_collected: {
      ...sessionBase.context_collected,
      ...(llmResponse.context_updates ?? {}),
    },
    actions: mergedActions,
    agent_v2,
    main_delivery_done: llmResponse.contains_delivery || workingSession.main_delivery_done,
    main_delivery:
      (llmResponse.main_delivery as POJUSessionState["main_delivery"]) || workingSession.main_delivery,
    tokens_used: workingSession.tokens_used + (llmResponse.tokens_used || 0),
    last_interaction_at: nowIso,
    expires_at: rollingExpiry,
    locked_provider:
      llmResponse.locked_provider ?? workingSession.locked_provider,
  });
}

/**
 * If the message violates rules, returns the session with rejection messages appended.
 * Call before optimistic user append; pass the same session `handleUserMessage` would see.
 */
export function tryHandleRuleRejection(
  session: POJUSessionState,
  userMessage: string,
  locale: string,
): POJUSessionState | null {
  if (userMessage.trim() === "__OPENING__" || userMessage.startsWith("[SYSTEM:")) return null;
  const ruleCheck = checkRuleViolation(userMessage, session);
  if (ruleCheck.violated && ruleCheck.type) {
    return handleRuleRejection(session, userMessage, ruleCheck.type, locale);
  }
  return null;
}

function handleRuleRejection(
  session: POJUSessionState,
  userMessage: string,
  ruleType: "too_long" | "jailbreak" | "spam",
  locale: string,
): POJUSessionState {
  const rejectionMessage = getRuleRejectionMessage(ruleType, locale);
  const nowIso = new Date().toISOString();
  const rollingExpiry = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
  return {
    ...session,
    messages: [
      ...session.messages,
      {
        role: "user",
        content: userMessage,
        timestamp: nowIso,
        is_rejected: true,
        rejection_type: ruleType,
      },
      {
        role: "assistant",
        content: rejectionMessage,
        timestamp: nowIso,
      },
    ],
    abuse_metrics: updateAbuseMetrics(session.abuse_metrics, ruleType),
    last_interaction_at: nowIso,
    expires_at: rollingExpiry,
  };
}

function updateAbuseMetrics(metrics: POJUSessionState["abuse_metrics"], type: "too_long" | "jailbreak" | "spam") {
  const updated = { ...metrics };
  switch (type) {
    case "too_long":
      updated.long_input_count += 1;
      break;
    case "jailbreak":
      updated.jailbreak_attempts += 1;
      break;
    case "spam":
      updated.duplicate_attempts += 1;
      break;
  }
  return updated;
}

async function callLLMViaAPI(input: {
  session: POJUSessionState;
  profile: UserProfile | null;
  base_analysis?: unknown | null;
  archive_data?: import("@/lib/archive/archive-service").POJUActionRecommendationsData | null;
  locale: string;
  signal?: AbortSignal;
  tool_injection_context?: string | null;
  onStream?: HandleInput["onStream"];
}): Promise<{
  response: string;
  model: string;
  tokens_used: number;
  user_intent: NonNullable<POJUMessage["meta"]>["user_intent"];
  current_state: NonNullable<POJUMessage["meta"]>["current_state"];
  action_requested: NonNullable<POJUMessage["meta"]>["action_requested"];
  topic_drift_detected: boolean;
  topic_drift_signal?: "none" | "edge" | "off_topic";
  drift_reason?: string | null;
  should_show_new_session_button?: boolean;
  context_updates: Record<string, unknown>;
  contains_delivery: boolean;
  main_delivery?: unknown;
  new_actions?: unknown[];
  agent_suggested_phase?: string;
  current_summary?: ContextSummary | null;
  question_category?: string | null;
  thinking_process?: string;
  tool_suggestion?: ToolSuggestionPayload | null;
  start_new_cycle?: boolean;
  new_cycle_question?: string | null;
  collection_progress?: "advancing" | "stalled" | "resistant" | null;
  stall_offer?: boolean;
  investigation_agenda?: unknown;
  suggest_refund?: boolean;
  locked_provider?: string;
}> {
  const body = JSON.stringify({
    session: input.session,
    profile: input.profile,
    base_analysis: input.base_analysis ?? null,
    archive_data: input.archive_data ?? null,
    locale: input.locale,
    tool_injection_context: input.tool_injection_context ?? null,
  });

  if (input.onStream) {
    const response = await fetch("/api/poju/chat?stream=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: input.signal,
    });
    if (!response.ok) {
      throw new Error(`/api/poju/chat stream returned HTTP ${response.status}`);
    }
    if (!response.body) {
      throw new Error("missing stream body from /api/poju/chat");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let complete: LLMApiPayload | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          continue;
        }
        const type = event.type;
        if (type === "reasoning" && typeof event.text === "string") {
          input.onStream.onReasoning?.(event.text);
        } else if (type === "content") {
          if (typeof event.text === "string" && event.text.length > 0) {
            input.onStream.onContentStreamStart?.();
            input.onStream.onPartialResponse?.(event.text);
          }
        } else if (type === "complete") {
          complete = event as LLMApiPayload;
        } else if (type === "error") {
          throw new Error(String(event.message ?? "stream_error"));
        } else if (type === "aborted") {
          const err = new Error("AbortError");
          err.name = "AbortError";
          throw err;
        }
      }
    }

    if (!complete) {
      throw new Error("stream ended without complete payload");
    }
    return mapLlmApiPayload(complete, input.session);
  }

  const response = await fetch("/api/poju/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error(`/api/poju/chat returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as LLMApiPayload;
  if (data.error) {
    throw new Error(String(data.error));
  }
  return mapLlmApiPayload(data, input.session);
}

function mapLlmApiPayload(
  data: LLMApiPayload,
  session: POJUSessionState,
): Awaited<ReturnType<typeof callLLMViaAPI>> {
  const text = data.response ?? data.reply;
  if (!text || typeof text !== "string") {
    throw new Error("missing `response` in /api/poju/chat JSON");
  }

  const wire = chatPayloadFromWire(data as Record<string, unknown>, {
    response: text,
    current_state: sessionStateHint(session),
  });

  return {
    response: text,
    model: typeof wire.model === "string" ? wire.model : "poju-chat-api",
    tokens_used: typeof wire.tokens_used === "number" ? wire.tokens_used : 0,
    user_intent: (wire.user_intent as NonNullable<POJUMessage["meta"]>["user_intent"]) ?? "unclear",
    current_state:
      (wire.current_state as NonNullable<POJUMessage["meta"]>["current_state"]) ??
      sessionStateHint(session),
    action_requested:
      (wire.action_requested as NonNullable<POJUMessage["meta"]>["action_requested"]) ??
      "continue_chat",
    topic_drift_detected: Boolean(wire.topic_drift_detected),
    topic_drift_signal:
      wire.topic_drift_signal === "edge" || wire.topic_drift_signal === "off_topic"
        ? wire.topic_drift_signal
        : "none",
    drift_reason: typeof wire.drift_reason === "string" ? wire.drift_reason : null,
    should_show_new_session_button: Boolean(wire.should_show_new_session_button),
    context_updates: (wire.context_updates as Record<string, unknown>) ?? {},
    contains_delivery: Boolean(wire.contains_delivery),
    main_delivery: wire.main_delivery,
    new_actions: wire.new_actions as unknown[] | undefined,
    agent_suggested_phase:
      typeof wire.agent_suggested_phase === "string" ? wire.agent_suggested_phase : undefined,
    current_summary: wire.current_summary as ContextSummary | null | undefined,
    question_category:
      typeof wire.question_category === "string" ? wire.question_category : null,
    thinking_process:
      typeof wire.thinking_process === "string" ? wire.thinking_process : undefined,
    tool_suggestion: parseToolSuggestionPayload(wire.tool_suggestion),
    start_new_cycle: wire.start_new_cycle === true,
    new_cycle_question:
      typeof wire.new_cycle_question === "string" ? wire.new_cycle_question : null,
    collection_progress: parseCollectionProgress(wire.collection_progress),
    stall_offer: wire.stall_offer === true,
    investigation_agenda: wire.investigation_agenda ?? null,
    suggest_refund: wire.suggest_refund === true,
    locked_provider:
      typeof wire.locked_provider === "string" && wire.locked_provider.trim()
        ? wire.locked_provider.trim()
        : undefined,
  };
}

function parseToolSuggestionPayload(raw: unknown): ToolSuggestionPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const tool = typeof o.tool === "string" ? o.tool.trim().toLowerCase() : "";
  if (tool !== "glyph" && tool !== "syncro" && tool !== "match") return null;
  const trigger_context = typeof o.trigger_context === "string" ? o.trigger_context.trim() : "";
  if (!trigger_context) return null;
  return {
    tool: tool as ToolSuggestionPayload["tool"],
    trigger_context,
    value_prop: typeof o.value_prop === "string" ? o.value_prop : undefined,
    prefill:
      o.prefill && typeof o.prefill === "object" && !Array.isArray(o.prefill)
        ? (o.prefill as Record<string, unknown>)
        : undefined,
  };
}

function sessionStateHint(session: POJUSessionState) {
  const phase = session.agent_v2?.current_phase;
  if (session.main_delivery_done || phase === "delivered") return "tracking" as const;
  if (phase === "awaiting_confirmation") return "awaiting_confirmation" as const;
  if (phase === "opening") return "opening" as const;
  return "collecting_context" as const;
}
