import { loadSessionUserProfile, withSessionProfileFlags } from "@/lib/poju/session-profile";
import type { POJUAction, POJUSessionState, POJUMessage } from "@/lib/poju/types";
import { checkRuleViolation, getRuleRejectionMessage } from "@/lib/poju/rules";
import {
  applyPhaseTransition,
  calculateCompleteness,
  createInitialAgentState,
  decidePhaseTransition,
  type AgentPhase,
  type ContextSummary,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import { extractQuestionCategory, mergeContextUpdates, recordToLLMContextUpdates } from "@/lib/poju/context-extractor";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
/** Session uses default `userProfiles` slot from device. */
const SESSION_PROFILE_SLOT = "active_user_profile";

function resolveSelectedProfileId(session: POJUSessionState, agent: POJUAgentState): string | null {
  const sid = session.selected_stored_profile_id?.trim();
  if (sid) return sid;
  if (session.has_profile) return agent.selected_profile_id ?? SESSION_PROFILE_SLOT;
  return null;
}

interface HandleInput {
  session: POJUSessionState;
  userMessage: string;
  locale: string;
  /** Session already includes this user turn (optimistic UI); skip rule re-check and duplicate append. */
  userAlreadyAppended?: boolean;
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
  context_updates?: Record<string, unknown>;
  contains_delivery?: boolean;
  main_delivery?: unknown;
  new_actions?: unknown[];
  error?: string;
  agent_suggested_phase?: string;
  current_summary?: ContextSummary | null;
  question_category?: string | null;
};

function ensureAgentV2(session: POJUSessionState): POJUAgentState {
  if (session.agent_v2) {
    return {
      ...session.agent_v2,
      profile_skipped: session.profile_skipped,
      has_base_analysis: session.has_profile,
      selected_profile_id: resolveSelectedProfileId(session, session.agent_v2),
    };
  }
  const init = createInitialAgentState({ original_question: session.original_question });
  return {
    ...init,
    profile_skipped: session.profile_skipped,
    has_base_analysis: session.has_profile,
    selected_profile_id: resolveSelectedProfileId(session, init),
  };
}

const AGENT_PHASES: AgentPhase[] = [
  "greeting",
  "awaiting_profile",
  "collecting_context",
  "awaiting_confirmation",
  "delivered",
  "tracking",
];

function mapLlmHintToAgentPhase(hint: string | undefined): AgentPhase | null {
  if (!hint) return null;
  if (AGENT_PHASES.includes(hint as AgentPhase)) return hint as AgentPhase;
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
  },
  userMessage: string,
  isSystemMessage: boolean,
): POJUAgentState {
  const flat = llm.context_updates ?? {};
  const structured = recordToLLMContextUpdates(flat);
  let merged: POJUAgentState = {
    ...base,
    context_collected: mergeContextUpdates(base.context_collected, structured),
    question_category:
      extractQuestionCategory(flat) ??
      (llm.question_category as POJUAgentState["question_category"]) ??
      base.question_category,
    profile_skipped: session.profile_skipped,
    has_base_analysis: session.has_profile,
    selected_profile_id: resolveSelectedProfileId(session, base),
  };
  merged = {
    ...merged,
    collection_completeness: calculateCompleteness(merged),
    has_situation_analysis: calculateCompleteness(merged) >= 0.4,
  };
  const llmPhase =
    (llm.agent_suggested_phase && AGENT_PHASES.includes(llm.agent_suggested_phase as AgentPhase)
      ? (llm.agent_suggested_phase as AgentPhase)
      : null) ?? mapLlmHintToAgentPhase(llm.current_state);
  const transition = decidePhaseTransition({
    current_state: merged,
    llm_suggested_phase: llmPhase,
    user_message: isSystemMessage ? "" : userMessage,
  });
  let after = applyPhaseTransition(merged, transition);
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
    turn_count: after.turn_count + (isSystemMessage ? 0 : 1),
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
      action_id: typeof a?.action_id === "string" && a.action_id ? a.action_id : crypto.randomUUID(),
      given_at: typeof a?.given_at === "string" ? a.given_at : now,
      text: String(a?.text ?? "—"),
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
  const { session, userMessage, locale, userAlreadyAppended } = input;
  const isSystemMessage = userMessage.startsWith("[SYSTEM:");

  if (!isSystemMessage && !userAlreadyAppended) {
    const ruleCheck = checkRuleViolation(userMessage, session);
    if (ruleCheck.violated && ruleCheck.type) {
      return handleRuleRejection(session, userMessage, ruleCheck.type, locale);
    }
  }

  const newUserMessage: POJUMessage = {
    role: isSystemMessage ? "system" : "user",
    content: userMessage,
    timestamp: new Date().toISOString(),
  };

  let messagesWithUser: POJUMessage[];
  if (!isSystemMessage && userAlreadyAppended) {
    const last = session.messages[session.messages.length - 1];
    if (last?.role === "user" && last.content.trim() === userMessage.trim()) {
      messagesWithUser = session.messages;
    } else {
      messagesWithUser = [...session.messages, newUserMessage];
    }
  } else {
    messagesWithUser = [...session.messages, newUserMessage];
  }
  const sessionForLlm = withSessionProfileFlags({ ...session, messages: messagesWithUser });
  const profile = await loadSessionUserProfile(sessionForLlm);

  const llmResponse = await callLLMViaAPI({
    session: sessionForLlm,
    profile,
    locale,
  });

  const normalizedNewActions = normalizeNewActions(llmResponse.new_actions);
  const mergedActions =
    normalizedNewActions.length > 0 ? [...session.actions, ...normalizedNewActions] : session.actions;

  const sessionForAgent: POJUSessionState = { ...session, messages: messagesWithUser };
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
      contains_delivery: llmResponse.contains_delivery,
    },
  };

  const nowIso = new Date().toISOString();
  const rollingExpiry = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();

  return withSessionProfileFlags({
    ...session,
    messages: [...messagesWithUser, assistantMessage],
    context_collected: {
      ...session.context_collected,
      ...(llmResponse.context_updates ?? {}),
    },
    actions: mergedActions,
    agent_v2,
    main_delivery_done: llmResponse.contains_delivery || session.main_delivery_done,
    main_delivery: (llmResponse.main_delivery as POJUSessionState["main_delivery"]) || session.main_delivery,
    tokens_used: session.tokens_used + (llmResponse.tokens_used || 0),
    last_interaction_at: nowIso,
    expires_at: rollingExpiry,
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
  if (userMessage.startsWith("[SYSTEM:")) return null;
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
  profile: unknown;
  locale: string;
}): Promise<{
  response: string;
  model: string;
  tokens_used: number;
  user_intent: NonNullable<POJUMessage["meta"]>["user_intent"];
  current_state: NonNullable<POJUMessage["meta"]>["current_state"];
  action_requested: NonNullable<POJUMessage["meta"]>["action_requested"];
  topic_drift_detected: boolean;
  context_updates: Record<string, unknown>;
  contains_delivery: boolean;
  main_delivery?: unknown;
  new_actions?: unknown[];
  agent_suggested_phase?: string;
  current_summary?: ContextSummary | null;
  question_category?: string | null;
}> {
  const response = await fetch("/api/poju/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session: input.session,
      profile: input.profile,
      locale: input.locale,
    }),
  });

  if (!response.ok) {
    throw new Error(`/api/poju/chat returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as LLMApiPayload;
  if (data.error) {
    throw new Error(String(data.error));
  }

  const text = data.response ?? data.reply;
  if (!text || typeof text !== "string") {
    throw new Error("missing `response` in /api/poju/chat JSON");
  }

  return {
    response: text,
    model: typeof data.model === "string" ? data.model : "poju-chat-api",
    tokens_used: typeof data.tokens_used === "number" ? data.tokens_used : 0,
    user_intent: (data.user_intent as NonNullable<POJUMessage["meta"]>["user_intent"]) ?? "unclear",
    current_state: (data.current_state as NonNullable<POJUMessage["meta"]>["current_state"]) ?? sessionStateHint(
      input.session,
    ),
    action_requested:
      (data.action_requested as NonNullable<POJUMessage["meta"]>["action_requested"]) ?? "continue_chat",
    topic_drift_detected: Boolean(data.topic_drift_detected),
    context_updates: (data.context_updates as Record<string, unknown>) ?? {},
    contains_delivery: Boolean(data.contains_delivery),
    main_delivery: data.main_delivery,
    new_actions: data.new_actions,
    agent_suggested_phase: data.agent_suggested_phase,
    current_summary: data.current_summary,
    question_category: data.question_category,
  };
}

function sessionStateHint(session: POJUSessionState) {
  const phase = session.agent_v2?.current_phase;
  if (session.main_delivery_done || phase === "delivered") return "tracking" as const;
  if (phase === "awaiting_confirmation") return "awaiting_confirmation" as const;
  if (phase === "awaiting_profile") return "awaiting_profile" as const;
  return "collecting_context" as const;
}
