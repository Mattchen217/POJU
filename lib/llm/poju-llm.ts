import { applyPojuOutputPolicies } from "@/lib/poju/output-policy-pass";
import {
  callGreetingPhase,
  shouldUseGreetingPhase,
} from "@/lib/llm/phases/greeting-phase";
import type { PhaseLLMResult } from "@/lib/llm/phases/types";
import { executeAgentPhaseLLM } from "@/lib/poju/agent-phase-runner";
import {
  GEMINI_PRIMARY_MODEL,
  getGeminiClient,
} from "@/lib/llm/gemini-shared";
import { logPojuError } from "@/lib/poju/base-analysis-diagnostics";
import { getOpenRouterDefaultModel, isOpenRouterConfigured, resolveSessionLockedProvider } from "@/lib/llm/openrouter-shared";
import { normalizeAgentPhase } from "@/lib/poju/agent-state";
import { getLastUserMessageContent } from "@/lib/poju/context-helpers";
import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

interface CallInput {
  session: POJUSessionState;
  profile: UserProfile | null;
  base_analysis?: unknown | null;
  archive_data?: POJUActionRecommendationsData | null;
  locale: string;
  tool_injection_context?: string | null;
  stream_hooks?: import("@/lib/llm/phases/phase-transport").PhaseStreamHooks;
  signal?: AbortSignal;
}

export interface POJULLMResponse {
  response: string;
  model: string;
  tokens_used: number;
  user_intent:
    | "greeting"
    | "sharing_situation"
    | "asking_specific"
    | "reporting_progress"
    | "wrapping_up"
    | "unclear"
    | "off_topic";
  current_state:
    | "opening"
    | "greeting"
    | "collecting_context"
    | "awaiting_profile"
    | "awaiting_confirmation"
    | "analyzing"
    | "delivered"
    | "tracking";
  action_requested?: "continue_chat" | "show_birth_form" | "deliver_main" | "track_progress";
  topic_drift_detected: boolean;
  topic_drift_signal?: "none" | "edge" | "off_topic";
  drift_reason?: string | null;
  should_show_new_session_button?: boolean;
  context_updates: Record<string, unknown>;
  contains_delivery: boolean;
  main_delivery?: unknown;
  new_actions?: unknown[];
  /** Phase module hint for `agent_v2` state machine (Part2). */
  agent_suggested_phase?: string;
  current_summary?: unknown;
  question_category?: string | null;
  thinking_process?: string;
  tool_suggestion?: import("@/lib/poju/types").ToolSuggestionPayload | null;
  start_new_cycle?: boolean;
  new_cycle_question?: string | null;
  collection_progress?: "advancing" | "stalled" | "resistant" | null;
  stall_offer?: boolean;
  investigation_agenda?: import("@/lib/poju/investigation-agenda").AgendaItem[] | null;
  suggest_refund?: boolean;
  /** OpenRouter provider that served this turn. */
  served_provider?: string | null;
  /** Resolved session lock (existing or newly set from served_provider). */
  locked_provider?: string;
}

export async function callPOJULLM(input: CallInput): Promise<POJULLMResponse> {
  const { session, profile } = input;

  try {
    if (shouldUseGreetingPhase(session, profile)) {
      return finalizeLockFields(await callPOJULLMGreetingPath(input), session);
    }

    if (!isOpenRouterConfigured() && !getGeminiClient()) {
      return emptyFailureResponse(
        session,
        input.locale,
        GEMINI_PRIMARY_MODEL,
      );
    }

    return finalizeLockFields(await callPOJULLMPhasePath(input), session);
  } catch (error: unknown) {
    logPojuError("poju-llm:callPOJULLM", error);
    throw error;
  }
}

function finalizeLockFields(response: POJULLMResponse, session: POJUSessionState): POJULLMResponse {
  const locked_provider = resolveSessionLockedProvider(
    session.locked_provider,
    response.served_provider,
  );
  return {
    ...response,
    locked_provider,
  };
}

async function callPOJULLMPhasePath(input: CallInput): Promise<POJULLMResponse> {
  const { session, profile, locale } = input;
  const fallbackModel = isOpenRouterConfigured() ? getOpenRouterDefaultModel() : GEMINI_PRIMARY_MODEL;

  const { phase, activePhase, ...mapped } = await executeAgentPhaseLLM({
    session,
    profile,
    base_analysis: input.base_analysis,
    archive_data: input.archive_data,
    locale,
    tool_injection_context: input.tool_injection_context ?? null,
    stream_hooks: input.stream_hooks,
    signal: input.signal,
  });

  return {
    response: String(mapped.response ?? phase.response),
    model: phase.model ?? fallbackModel,
    tokens_used: phase.tokens_used,
    user_intent: (mapped.user_intent as POJULLMResponse["user_intent"]) ?? "sharing_situation",
    current_state:
      (mapped.current_state as POJULLMResponse["current_state"]) ??
      (activePhase === "opening" ? "opening" : "collecting_context"),
    action_requested: mapped.action_requested as POJULLMResponse["action_requested"],
    topic_drift_detected: Boolean(mapped.topic_drift_detected),
    topic_drift_signal:
      (mapped.topic_drift_signal as POJULLMResponse["topic_drift_signal"]) ?? "none",
    drift_reason: typeof mapped.drift_reason === "string" ? mapped.drift_reason : null,
    should_show_new_session_button: Boolean(mapped.should_show_new_session_button),
    context_updates: (mapped.context_updates as Record<string, unknown>) ?? {},
    contains_delivery: Boolean(mapped.contains_delivery),
    main_delivery: mapped.main_delivery,
    new_actions: mapped.new_actions as unknown[] | undefined,
    agent_suggested_phase:
      typeof mapped.agent_suggested_phase === "string" ? mapped.agent_suggested_phase : activePhase,
    current_summary: mapped.current_summary,
    question_category: typeof mapped.question_category === "string" ? mapped.question_category : null,
    thinking_process:
      typeof phase.thinking_process === "string" ? phase.thinking_process : undefined,
    tool_suggestion: phase.tool_suggestion ?? null,
    start_new_cycle: Boolean(phase.start_new_cycle),
    new_cycle_question: phase.new_cycle_question ?? null,
    collection_progress: phase.collection_progress ?? null,
    stall_offer: Boolean(phase.stall_offer),
    investigation_agenda: phase.investigation_agenda ?? null,
    suggest_refund: Boolean(phase.suggest_refund),
    served_provider: phase.served_provider ?? null,
  };
}

function mapGreetingPhaseToPojuResponse(phase: PhaseLLMResult, model: string): POJULLMResponse {
  const suggested = normalizeAgentPhase(phase.suggested_phase ?? undefined);
  let current_state: POJULLMResponse["current_state"] = "opening";
  let action_requested: POJULLMResponse["action_requested"] = "continue_chat";
  let user_intent: POJULLMResponse["user_intent"] = "greeting";

  if (phase.action_requested === "show_birth_form") {
    current_state = "collecting_context";
    action_requested = "show_birth_form";
    user_intent = "sharing_situation";
  } else if (suggested === "collecting_context") {
    current_state = "collecting_context";
    user_intent = "sharing_situation";
  } else if (phase.context_updates && Object.keys(phase.context_updates).length > 0) {
    user_intent = "sharing_situation";
  }

  return {
    response: phase.response,
    model,
    tokens_used: phase.tokens_used,
    user_intent,
    current_state,
    action_requested,
    topic_drift_detected: false,
    context_updates: phase.context_updates ?? {},
    contains_delivery: false,
    agent_suggested_phase: suggested ?? undefined,
    question_category: phase.question_category,
    thinking_process: undefined,
    served_provider: phase.served_provider ?? null,
  };
}

async function callPOJULLMGreetingPath(input: CallInput): Promise<POJULLMResponse> {
  const { session, profile, locale } = input;
  const fallbackModel = isOpenRouterConfigured() ? getOpenRouterDefaultModel() : GEMINI_PRIMARY_MODEL;

  if (!isOpenRouterConfigured() && !getGeminiClient()) {
    console.error("[poju-llm] Set OPENROUTER_API_KEY (preferred) or GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY");
    return emptyFailureResponse(session, locale, fallbackModel);
  }

  try {
    const phase = await callGreetingPhase({
      session,
      profile,
      locale,
      user_message: getLastUserMessageContent(session),
    });
    const mapped = mapGreetingPhaseToPojuResponse(phase, phase.model ?? fallbackModel);
    const withThought = {
      ...mapped,
      thought: {
        current_context_score: 2,
        missing_keys: ["birth_profile_missing"],
        next_best_action: mapped.action_requested ?? "continue_chat",
      },
    };
    return applyPojuOutputPolicies(withThought, { session, profile, locale }) as POJULLMResponse;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[poju-llm] Greeting phase failed:", msg);
    return emptyFailureResponse(session, locale, fallbackModel);
  }
}

function emptyFailureResponse(session: POJUSessionState, locale: string, model: string): POJULLMResponse {
  return {
    response: getLLMFailureMessage(locale),
    model,
    tokens_used: 0,
    user_intent: "unclear",
    current_state: session.main_delivery_done ? "tracking" : "collecting_context",
    topic_drift_detected: false,
    contains_delivery: false,
    context_updates: {},
  };
}

/** Infrastructure-only message when the LLM API fails entirely (not conversational coaching). */
function getLLMFailureMessage(locale: string): string {
  const messages: Record<string, string> = {
    en: "[POJU] Reply could not be generated. Please send again. Your session is saved.",
    zh: "[POJU] 本轮回复未能生成，请重试发送。会话已保存。",
    es: "[POJU] No se pudo generar la respuesta. Reintenta. Tu sesión está guardada.",
    fr: "[POJU] Réponse non générée. Réessayez. Session enregistrée.",
    de: "[POJU] Antwort konnte nicht erzeugt werden. Bitte erneut senden.",
  };
  const langCode = locale.split("-")[0];
  return messages[langCode] || messages.en;
}
