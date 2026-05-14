import { getUserProfile } from "@/lib/profile/storage";
import type { POJUAction, POJUSessionState, POJUMessage } from "@/lib/poju/types";
import { checkRuleViolation, getRuleRejectionMessage } from "@/lib/poju/rules";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface HandleInput {
  session: POJUSessionState;
  userMessage: string;
  locale: string;
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
};

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
  const { session, userMessage, locale } = input;
  const isSystemMessage = userMessage.startsWith("[SYSTEM:");

  if (!isSystemMessage) {
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

  const messagesWithUser = [...session.messages, newUserMessage];
  const profile = session.has_profile ? await getUserProfile() : null;

  const llmResponse = await callLLMViaAPI({
    session: { ...session, messages: messagesWithUser },
    profile,
    locale,
  });

  const normalizedNewActions = normalizeNewActions(llmResponse.new_actions);
  const mergedActions =
    normalizedNewActions.length > 0 ? [...session.actions, ...normalizedNewActions] : session.actions;

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

  return {
    ...session,
    messages: [...messagesWithUser, assistantMessage],
    context_collected: {
      ...session.context_collected,
      ...(llmResponse.context_updates ?? {}),
    },
    actions: mergedActions,
    main_delivery_done: llmResponse.contains_delivery || session.main_delivery_done,
    main_delivery: (llmResponse.main_delivery as POJUSessionState["main_delivery"]) || session.main_delivery,
    tokens_used: session.tokens_used + (llmResponse.tokens_used || 0),
    last_interaction_at: nowIso,
    expires_at: rollingExpiry,
  };
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
  };
}

function sessionStateHint(session: POJUSessionState) {
  if (session.main_delivery_done) return "tracking" as const;
  if (session.has_profile) return "analyzing" as const;
  return "collecting_context" as const;
}
