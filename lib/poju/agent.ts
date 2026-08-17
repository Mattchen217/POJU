import { safeRandomUUID } from "@/lib/client/safe-crypto";
import { loadSessionProfileBundle, resolveSessionHasProfile, withSessionProfileFlags } from "@/lib/poju/session-profile";
import { logBaseAnalysisPayload } from "@/lib/poju/base-analysis-diagnostics";
import { yieldToBrowserPaint } from "@/lib/utils/yield-to-paint";
import type { POJUAction, POJUSessionState, POJUMessage } from "@/lib/poju/types";
import { pivotChatCopy } from "@/lib/poju/pivot-chat-copy";
import { checkRuleViolation, getRuleRejectionMessage } from "@/lib/poju/rules";
import {
  applyPhaseTransition,
  calculateCompleteness,
  createInitialAgentState,
  getUnderstandingMissingFields,
  isUnderstandingComplete,
  isUnderstandingFieldFilled,
  mergeBreakthroughCoreUpdates,
  normalizeAgentPhase,
  type AgentPhase,
  type ContextSummary,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import { classifyStallOfferReply } from "@/lib/poju/stall-offer-routing";
import {
  advanceStateMachine,
  buildActiveQuestionState,
  extractModelTurnSignals,
  type AdvanceResult,
} from "@/lib/poju/state-machine";
import {
  clampQuestionSignals,
  ensureCollectingCatchPrefix,
  nextEscalationStage,
  TERMINATE_REFUND_WIPE_MS,
  userPickedProvidedOption,
  type QuestionStatus,
  type SessionAction,
} from "@/lib/poju/question-status";
import { countUserTurns } from "@/lib/poju/summary-readiness";
import {
  applyCollectingTurnCounters,
  evaluateStopLoss,
  parseCollectionProgress,
} from "@/lib/poju/collection-progress";
import { ensureSessionCycles } from "@/lib/poju/cycle-manager";
import { finalizeToolInjectionTurn, prepareToolInjectionTurn } from "@/lib/poju/prepare-tool-injection-turn";
import { findPendingToolInjection } from "@/lib/poju/find-pending-tool-injection";
import {
  extractAnchoredFactIdsFromAssistant,
  mergeAnchoredFactIds,
} from "@/lib/poju/anchored-fact-tracking";
import {
  isPojuEmptyGenerationMessage,
  isPojuFailurePlaceholderMessage,
  isPojuInfrastructureFailureMessage,
} from "@/lib/llm/poju-service-busy-message";
import {
  appendForwardMove,
  hasQuestionCue,
} from "@/lib/poju/collecting-focus-reply";
import {
  openingReplyIsComplete,
  resolveOpeningTurnReply,
} from "@/lib/poju/phases/opening/display";
import {
  applyUnderstandingGateSupplement,
  handleRetryOpeningUnderstanding,
  isOpeningControlPhase,
} from "@/lib/poju/phases/opening/control";
import {
  extractUsedMetaphorsFromAssistant,
  mergeUsedMetaphors,
} from "@/lib/poju/reply-metaphor-extract";
import {
  extractQuestionCategory,
  mergeContextUpdates,
  recordToLLMContextUpdates,
} from "@/lib/poju/context-extractor";
import {
  detectExplicitLanguageSwitch,
  parseAppLocale,
} from "@/lib/prompts/language-directive";
import { nextLockedOutputLocale } from "@/lib/poju/session-lang";
import {
  applyAgendaStatusUpdates,
  captureAgendaAnswer,
  extractAgendaStatusUpdates,
  getNextAgendaFocus,
  parseInvestigationAgenda,
  selectCurrentAgendaFocus,
  stripAgendaFieldsFromContextUpdates,
} from "@/lib/poju/investigation-agenda";
import { applyToolLinkingFromLlm } from "@/lib/poju/tool-suggestion";
import type { ToolSuggestionPayload } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";
import { chatPayloadFromWire } from "@/lib/poju/serialize-chat-payload";
import { sanitizeReplyOptions } from "@/lib/poju/reply-options";
import { buildAgentStateSnapshot } from "@/lib/poju/agent-state-snapshot";
import { runConfirmationPipeline } from "@/lib/poju/agent-orchestrator";
import { classifyConfirmationAffirmative } from "@/lib/poju/confirmation-reply";
import { applyActionStatusUpdates, parseActionStatusUpdates } from "@/lib/poju/action-status-updates";

export { applyUnderstandingGateSupplement, handleRetryOpeningUnderstanding, isOpeningControlPhase };
/** Segment-2 / synthesis handlers live in phases/segment2 — prefer phase-router. */
export {
  startSegment2AfterGateConfirm as handleUnderstandingGateActionAsync,
  startSegment2Regenerate as handleRegenerateBreakthroughCoreAsync,
  startSynthesisAfterGateConfirm as handleDeliveryGateActionAsync,
} from "@/lib/poju/phases/segment2/control";


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
  attachment?: import("@/lib/poju/attachments/types").PojuChatAttachment | null;
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
  scope_signal?: "in_scope" | "unclear" | "out_of_scope" | null;
  attachments_unlocked?: boolean;
  locked_provider?: string;
  understanding?: { sufficient: boolean; missing: string } | null;
  understanding_sufficient?: boolean;
  understanding_generation_failed?: boolean;
  agenda_updates?: { completed_in_this_turn?: string[] };
  reply_quality?: "clear" | "vague";
  question_status?: QuestionStatus;
  session_action?: SessionAction | null;
  options?: string[];
  user_confirms_delivery?: boolean;
  breakthrough_core_updates?: Partial<import("@/lib/poju/agent-state").BreakthroughCore> | null;
  action_status_updates?: import("@/lib/poju/action-status-updates").ActionStatusPatch[];
  conversion_envelope_failed?: boolean;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
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

function resolveOriginalQuestion(agent: POJUAgentState, userMessage: string): string {
  const fromAgent = agent.original_question?.trim();
  if (fromAgent) return fromAgent;
  const trimmed = userMessage.trim();
  if (trimmed && trimmed !== "__OPENING__") return trimmed;
  return "";
}

const OPENING_GREETING_PATTERN =
  /^(你好|您好|hi|hello|在吗|嗨|哈喽|你是谁|你能|你可以|测试)/i;

const PROBLEM_FILLER =
  /^(你好|您好|hi|hello|在吗|嗨|哈喽|测试|好的?|你问吧|请问吧?|继续|可以|嗯+|ok|okay|是的|对)/i;

/** First 1–2 substantive opening user messages = core problem statement (excludes clarifications/fillers). */
export function extractOpeningProblem(messages: POJUMessage[]): string {
  const substantive = messages
    .filter((m) => m.role === "user" && !m.is_rejected)
    .map((m) => m.content.trim())
    .filter(
      (c) =>
        c.length >= 6 &&
        c !== "__OPENING__" &&
        !c.startsWith("[SYSTEM:") &&
        !OPENING_GREETING_PATTERN.test(c) &&
        !PROBLEM_FILLER.test(c),
    );
  return substantive.slice(0, 2).join("；");
}

/** Count substantive user turns in opening from message history (deterministic gate input). */
export function countSubstantiveOpeningTurns(messages: POJUMessage[]): number {
  return messages.filter((m) => {
    if (m.role !== "user" || m.is_rejected) return false;
    const trimmed = m.content.trim();
    if (trimmed.length <= 6 || trimmed === "__OPENING__") return false;
    if (trimmed.startsWith("[SYSTEM:")) return false;
    return !OPENING_GREETING_PATTERN.test(trimmed);
  }).length;
}

/** Latest assistant turn before the trailing user message (for active_question_state.asked). */
function lastAssistantContentBeforeLatestUser(session: POJUSessionState): string {
  const msgs = session.messages;
  let i = msgs.length - 1;
  while (i >= 0 && msgs[i].role === "user") i -= 1;
  while (i >= 0) {
    const m = msgs[i];
    if (m.role === "assistant" && !m.is_rejected) {
      const t = m.content.trim();
      if (t) return t;
    }
    i -= 1;
  }
  return "";
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
    understanding?: { sufficient: boolean; missing: string } | null;
    understanding_sufficient?: boolean;
    understanding_generation_failed?: boolean;
    agenda_updates?: { completed_in_this_turn?: string[] };
    reply_quality?: "clear" | "vague" | null;
    question_status?: QuestionStatus | null;
    session_action?: SessionAction | null;
    user_confirms_delivery?: boolean;
    confirmation_signal?: "confirmed" | "wants_to_add" | "unclear";
    topic_drift_signal?: "none" | "edge" | "off_topic";
    breakthrough_core_updates?: Partial<import("@/lib/poju/agent-state").BreakthroughCore> | null;
    breakthrough_core?: import("@/lib/poju/agent-state").BreakthroughCore | null;
    core_dilemma?: import("@/lib/poju/agent-state").CoreDilemma | null;
    desired_direction?: import("@/lib/poju/agent-state").DesiredDirection | null;
    problem_summary?: string | null;
    attachments_unlocked?: boolean;
  },
  userMessage: string,
  isSystemMessage: boolean,
  loadedBaseAnalysis?: unknown | null,
): {
  agent: POJUAgentState;
  advance: AdvanceResult;
  clampedSignals: ReturnType<typeof extractModelTurnSignals>;
} {
  const currentPhase = normalizeAgentPhase(base.current_phase) ?? base.current_phase;
  const isOpeningTurn =
    currentPhase === "opening" || currentPhase === "awaiting_understanding_confirm";

  const flat = llm.context_updates ?? {};
  const agendaStatusUpdates = extractAgendaStatusUpdates(flat);
  const contextFlat = stripAgendaFieldsFromContextUpdates(flat);
  const structured = recordToLLMContextUpdates(contextFlat);
  let investigation_agenda = base.investigation_agenda ?? [];
  let agenda_generated = base.agenda_generated ?? false;

  if (!isOpeningTurn && !agenda_generated) {
    const parsedAgenda = parseInvestigationAgenda(llm.investigation_agenda);
    if (parsedAgenda) {
      investigation_agenda = parsedAgenda;
      agenda_generated = true;
      console.info("[agenda] generated:", parsedAgenda.map((a) => a.label));
    }
  } else if (
    agendaStatusUpdates &&
    normalizeAgentPhase(base.current_phase) !== "collecting_context"
  ) {
    investigation_agenda = applyAgendaStatusUpdates(investigation_agenda, agendaStatusUpdates);
    console.info("[agenda] status:", agendaStatusUpdates);
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
    investigation_agenda: isOpeningTurn ? (base.investigation_agenda ?? []) : investigation_agenda,
    agenda_generated: isOpeningTurn ? (base.agenda_generated ?? false) : agenda_generated,
    breakthrough_core: isOpeningTurn
      ? (base.breakthrough_core ?? null)
      : (base.breakthrough_core ?? llm.breakthrough_core ?? null),
    core_dilemma:
      llm.core_dilemma !== undefined && llm.core_dilemma !== null
        ? llm.core_dilemma
        : base.core_dilemma,
    desired_direction:
      llm.desired_direction !== undefined && llm.desired_direction !== null
        ? llm.desired_direction
        : base.desired_direction,
    attachments_unlocked:
      base.attachments_unlocked === true || llm.attachments_unlocked === true
        ? true
        : (base.attachments_unlocked ?? false),
  };
  if (
    !isOpeningTurn &&
    merged.breakthrough_core &&
    (llm as { breakthrough_core_updates?: Partial<import("@/lib/poju/agent-state").BreakthroughCore> | null })
      .breakthrough_core_updates
  ) {
    const updates = (llm as { breakthrough_core_updates?: Partial<import("@/lib/poju/agent-state").BreakthroughCore> | null }).breakthrough_core_updates;
    if (updates) {
      merged = {
        ...merged,
        breakthrough_core: mergeBreakthroughCoreUpdates(merged.breakthrough_core, updates),
      };
    }
  }
  merged = {
    ...merged,
    collection_completeness: calculateCompleteness(merged),
    has_situation_analysis: calculateCompleteness(merged) >= 0.4,
  };
  if (isUnderstandingFieldFilled(merged.desired_direction?.wants)) {
    merged = {
      ...merged,
      context_collected: {
        ...merged.context_collected,
        desired_outcome: merged.desired_direction!.wants,
      },
    };
  }
  const llmPhase =
    normalizeAgentPhase(llm.agent_suggested_phase) ?? mapLlmHintToAgentPhase(llm.current_state);
  const phaseUserMessage =
    userMessage.trim() === "__OPENING__"
      ? "__OPENING__"
      : isSystemMessage
        ? ""
        : userMessage;

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
  const substantiveOpeningTurns = countSubstantiveOpeningTurns(session.messages);
  merged = { ...merged, turn_count: userTurns };
  if ((normalizeAgentPhase(base.current_phase) ?? base.current_phase) === "opening") {
    merged = { ...merged, opening_substantive_turns: substantiveOpeningTurns };
  }

  const baseAnalysisReady = Boolean(
    loadedBaseAnalysis != null ||
    merged.has_base_analysis ||
    resolveSessionHasProfile(session),
  );
  const openingProblem =
    llm.problem_summary?.trim() || extractOpeningProblem(session.messages);

  const rawSignals = extractModelTurnSignals({
    response: "",
    understanding_sufficient: llm.understanding_sufficient,
    understanding: llm.understanding,
    base_analysis_ready: baseAnalysisReady,
    substantive_opening_turns: substantiveOpeningTurns,
    opening_problem_statement: openingProblem,
    topic_drift_signal: llm.topic_drift_signal,
    reply_quality: llm.reply_quality,
    question_status: llm.question_status,
    session_action: llm.session_action ?? null,
    agenda_updates: llm.agenda_updates,
    user_confirms_delivery: llm.user_confirms_delivery,
    confirmation_signal: llm.confirmation_signal,
  });

  const focusBeforeCollect =
    currentPhase === "collecting_context"
      ? selectCurrentAgendaFocus(merged.investigation_agenda ?? [])
      : null;

  const pickedOption =
    Boolean(phaseUserMessage.trim()) &&
    !isSystemMessage &&
    userPickedProvidedOption(session, phaseUserMessage);

  const clampedSignals = clampQuestionSignals(
    rawSignals,
    merged.active_question_state ?? null,
    pickedOption,
    focusBeforeCollect?.label ?? null,
    { userMessage: phaseUserMessage },
  );

  console.log("[poju-gate]", {
    phase: merged.current_phase,
    understanding_sufficient: llm.understanding_sufficient,
    understanding_struct_complete: isUnderstandingComplete(merged),
    base_analysis_ready: baseAnalysisReady,
    substantive_opening_turns: substantiveOpeningTurns,
    reply_quality: clampedSignals.reply_quality,
    question_status: clampedSignals.question_status,
    session_action: clampedSignals.session_action,
    picked_option: pickedOption,
  });

  const advance = advanceStateMachine(merged, clampedSignals, phaseUserMessage);
  let after = advance.next_agent;
  let resetStallCount = false;

  // 单问题小状态机记忆:同项 round+1 + history + stage 推进;切 focus 整结构重置。
  if (isCollectingTurn && phaseUserMessage.trim() && focusBeforeCollect) {
    const seeded = buildActiveQuestionState(merged, focusBeforeCollect);
    if (seeded) {
      const lastAsked =
        lastAssistantContentBeforeLatestUser(session) || seeded.focus_label;
      const advanced = {
        ...seeded,
        round_on_this_item: seeded.round_on_this_item + 1,
        escalation_stage: nextEscalationStage(
          seeded.escalation_stage,
          clampedSignals.question_status,
        ),
        history_on_this_item: [
          ...seeded.history_on_this_item,
          {
            asked: lastAsked,
            replied: phaseUserMessage,
            status: clampedSignals.question_status,
          },
        ],
      };
      const focusAfter = selectCurrentAgendaFocus(after.investigation_agenda ?? []);
      const qs = clampedSignals.question_status;
      const shouldCapture =
        qs === "satisfied" ||
        (qs == null && clampedSignals.reply_quality === "clear");
      const agendaWithAnswer = shouldCapture
        ? captureAgendaAnswer(
            after.investigation_agenda ?? [],
            focusBeforeCollect,
            phaseUserMessage,
          )
        : after.investigation_agenda;
      after = {
        ...after,
        ...(agendaWithAnswer ? { investigation_agenda: agendaWithAnswer } : {}),
        active_question_state: buildActiveQuestionState(
          {
            ...after,
            ...(agendaWithAnswer ? { investigation_agenda: agendaWithAnswer } : {}),
            active_question_state: advanced,
          },
          focusAfter,
        ),
      };
    }
  } else if (
    currentPhase === "opening" &&
    phaseUserMessage.trim() &&
    phaseUserMessage !== "__OPENING__" &&
    !isSystemMessage
  ) {
    // 1阶段:用当前缺失必填项作 question_key(切字段即重置)。
    const missing = getUnderstandingMissingFields(merged);
    const openingKey = missing[0] ?? "opening";
    const prev = merged.active_question_state;
    const seeded =
      prev?.question_key === openingKey
        ? prev
        : {
            question_key: openingKey,
            focus_label: openingKey,
            collection_goal: null as string | null,
            round_on_this_item: 1,
            escalation_stage: 0,
            history_on_this_item: [] as NonNullable<
              typeof prev
            >["history_on_this_item"],
          };
    const lastAsked =
      lastAssistantContentBeforeLatestUser(session) || seeded.focus_label;
    after = {
      ...after,
      active_question_state: {
        ...seeded,
        round_on_this_item: seeded.round_on_this_item + 1,
        escalation_stage: nextEscalationStage(
          seeded.escalation_stage,
          clampedSignals.question_status,
        ),
        history_on_this_item: [
          ...seeded.history_on_this_item,
          {
            asked: lastAsked,
            replied: phaseUserMessage,
            status: clampedSignals.question_status,
          },
        ],
      },
    };
  } else if (currentPhase === "collecting_context" || after.current_phase === "collecting_context") {
    const focusAfter = selectCurrentAgendaFocus(after.investigation_agenda ?? []);
    after = {
      ...after,
      active_question_state: buildActiveQuestionState(after, focusAfter),
    };
  }

  if (advance.next_state === "awaiting_understanding_confirm") {
    after = { ...after, active_question_state: null };
  }

  if (isCollectingTurn && stopLoss.triggered && stallOffer) {
    after = applyPhaseTransition(after, {
      should_transition: true,
      new_phase: "awaiting_confirmation",
      stop_loss_triggered: true,
      stall_offer_pending: true,
      reason: `Stop-loss stall offer: ${stopLoss.reason ?? "triggered"}`,
    });
  } else if (
    currentPhase === "awaiting_confirmation" &&
    base.stall_offer_pending &&
    phaseUserMessage.trim()
  ) {
    const choice = classifyStallOfferReply(phaseUserMessage);
    if (choice === "continue_collecting") {
      resetStallCount = true;
      after = applyPhaseTransition(after, {
        should_transition: true,
        new_phase: "collecting_context",
        reset_stall_count: true,
        clear_stall_offer_pending: true,
        resume_collecting_low_barrier: true,
        reason: "User chose to continue collecting after stall offer",
      });
    } else {
      after = applyPhaseTransition(after, {
        should_transition: true,
        new_phase: "delivered",
        delivery_mode: "degraded",
        clear_stall_offer_pending: true,
        reason:
          choice === "degraded_delivery"
            ? "User chose degraded delivery after stall offer"
            : "Stall offer fallback to degraded delivery",
      });
    }
  } else if (
    currentPhase === "awaiting_confirmation" &&
    !after.stall_offer_pending &&
    (clampedSignals.confirmation_signal === "wants_to_add" || llmPhase === "collecting_context")
  ) {
    after = applyPhaseTransition(after, {
      should_transition: true,
      new_phase: "collecting_context",
      reason: "User wants to add more context",
    });
  } else if (
    currentPhase === "awaiting_confirmation" &&
    !advance.trigger_delivery &&
    !advance.trigger_synthesis &&
    (clampedSignals.confirmation_signal === "confirmed" ||
      llmPhase === "delivered" ||
      clampedSignals.user_confirms_delivery === true)
  ) {
    after = applyPhaseTransition(after, {
      should_transition: true,
      new_phase: "delivered",
      delivery_mode: after.delivery_mode ?? "full",
      reason: "User confirmed, generating delivery",
    });
  }

  if (advance.trigger_breakthrough_core) {
    console.info("[agent] state machine: trigger_breakthrough_core");
  }
  if (advance.trigger_synthesis) {
    console.info("[agent] state machine: trigger_synthesis");
  }
  if (advance.trigger_delivery) {
    console.info("[agent] state machine: trigger_delivery");
  }

  after = {
    ...after,
    stall_count: resetStallCount ? 0 : counters.stall_count,
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
    agent: {
      ...after,
      turn_count: userTurns,
      tokens_used: after.tokens_used + tokenDelta,
    },
    advance,
    clampedSignals,
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
  const { session: sessionIn, userMessage, locale, userAlreadyAppended, signal, attachment } = input;
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

  const explicitLanguageSwitch = detectExplicitLanguageSwitch(userMessage);
  const uiLocale = parseAppLocale(locale);
  const { outputLocale: sessionOutputLocale, nextLocked } = nextLockedOutputLocale({
    locked: sessionBase.locked_output_locale,
    userInput: userMessage,
    uiLocale,
    messages: messagesWithUser,
    original_question: sessionBase.original_question,
  });
  // Persist only a real lock (explicit / first substantive / reclaim) — never UI fallback.
  const persistLocked =
    explicitLanguageSwitch ?? nextLocked ?? sessionBase.locked_output_locale ?? undefined;

  sessionForLlm = {
    ...sessionForLlm,
    locked_output_locale: persistLocked ?? sessionOutputLocale,
  };

  let workingSession = sessionBase;

  const bundle = await loadSessionProfileBundle(sessionForLlm);
  const { profile, base_analysis, resolved_profile_id } = bundle;
  if (resolved_profile_id) {
    sessionForLlm = withSessionProfileFlags(sessionForLlm, {
      selected_stored_profile_id: resolved_profile_id,
    });
    workingSession = withSessionProfileFlags(workingSession, {
      selected_stored_profile_id: resolved_profile_id,
    });
  }
  logBaseAnalysisPayload("callLLMViaAPI:before-fetch", base_analysis, {
    session_id: sessionForLlm.session_id,
    has_profile: resolveSessionHasProfile(sessionForLlm),
  });

  let archive_data: import("@/lib/archive/archive-service").POJUActionRecommendationsData | null = null;
  if (sessionForLlm.main_delivery_done && sessionForLlm.session_id) {
    const { loadArchiveDataForSession } = await import("@/lib/archive/archive-service");
    archive_data = await loadArchiveDataForSession(sessionForLlm.session_id);
  }

  const llmResponse = await callLLMViaAPI({
    session: sessionForLlm,
    profile,
    base_analysis,
    archive_data,
    // Process language SSOT — never the website UI locale once lock/sample resolves.
    locale: sessionOutputLocale,
    signal,
    tool_injection_context: injectionPrep.tool_injection_context,
    attachment: attachment ?? null,
  });

  workingSession = finalizeToolInjectionTurn(workingSession, injectionPrep.pending);

  const normalizedNewActions = normalizeNewActions(llmResponse.new_actions);
  const assistantMessageId = safeRandomUUID();
  const trackingPhase =
    normalizeAgentPhase(ensureAgentV2(workingSession).current_phase) === "tracking";

  const linking = applyToolLinkingFromLlm(
    { ...workingSession, messages: messagesWithUser },
    {
      tool_suggestion: llmResponse.tool_suggestion ?? null,
      start_new_cycle: trackingPhase ? false : llmResponse.start_new_cycle,
      new_cycle_question: trackingPhase ? null : llmResponse.new_cycle_question ?? null,
      question_category: llmResponse.question_category,
    },
    assistantMessageId,
  );

  workingSession = linking.session;
  const baseActions =
    normalizedNewActions.length > 0
      ? [...workingSession.actions, ...normalizedNewActions]
      : workingSession.actions;
  const mergedActions = applyActionStatusUpdates(
    baseActions,
    llmResponse.action_status_updates,
  );

  const sessionForAgent: POJUSessionState = { ...workingSession, messages: messagesWithUser };
  const phaseUserMessage =
    userMessage.trim() === "__OPENING__"
      ? "__OPENING__"
      : isSystemMessage
        ? ""
        : userMessage;
  const phaseForWire =
    normalizeAgentPhase(ensureAgentV2(sessionForAgent).current_phase) ?? "opening";
  const openingTurn = isOpeningControlPhase(phaseForWire);
  const { agent: agentCore, advance, clampedSignals } = finalizeAgentV2(
    ensureAgentV2(sessionForAgent),
    sessionForAgent,
    {
      context_updates: llmResponse.context_updates ?? {},
      tokens_used: llmResponse.tokens_used,
      current_state: llmResponse.current_state,
      agent_suggested_phase: llmResponse.agent_suggested_phase,
      question_category: llmResponse.question_category,
      contains_delivery: llmResponse.contains_delivery,
      main_delivery: llmResponse.main_delivery,
      collection_progress: llmResponse.collection_progress,
      stall_offer: llmResponse.stall_offer,
      investigation_agenda: openingTurn ? null : llmResponse.investigation_agenda,
      understanding: llmResponse.understanding ?? null,
      understanding_sufficient: llmResponse.understanding_sufficient,
      agenda_updates: openingTurn ? undefined : llmResponse.agenda_updates,
      reply_quality: llmResponse.reply_quality,
      question_status: llmResponse.question_status,
      session_action: llmResponse.session_action ?? null,
      user_confirms_delivery: llmResponse.user_confirms_delivery,
      confirmation_signal: llmResponse.confirmation_signal,
      topic_drift_signal: llmResponse.topic_drift_signal,
      breakthrough_core_updates: openingTurn ? null : (llmResponse.breakthrough_core_updates ?? null),
      breakthrough_core: openingTurn ? null : (llmResponse.breakthrough_core ?? null),
      core_dilemma: llmResponse.core_dilemma ?? null,
      desired_direction: llmResponse.desired_direction ?? null,
      problem_summary: openingTurn ? null : llmResponse.problem_summary ?? null,
      attachments_unlocked: llmResponse.attachments_unlocked === true,
    },
    userMessage,
    isSystemMessage,
    base_analysis,
  );
  let agent_v2: POJUAgentState = { ...agentCore, actions: mergedActions };

  if (advance.trigger_delivery && !workingSession.main_delivery_done) {
    agent_v2 = { ...agent_v2, current_phase: "awaiting_confirmation" };
  }

  // Segment-2 xhigh is async (phases/segment2 + Segment2AnalysisPreparing).
  // Gate confirm must not sync-block here — UI creates job + polls + display onComplete.
  if (advance.trigger_breakthrough_core) {
    console.info(
      "[agent] trigger_breakthrough_core in handleUserMessage — segment2 owned by phases/segment2 async job, skipping sync await",
    );
  }
  if (advance.trigger_synthesis) {
    console.info(
      "[agent] trigger_synthesis in handleUserMessage — synthesis owned by phases/segment2 async job + UI poll, skipping sync await",
    );
  }

  let finalContent = llmResponse.response;
  let escalationMeta: {
    escalation_lock?: boolean;
    wipe_after_ms?: number;
    unqualified_level?: number;
    paused?: boolean;
    refund_pass?: boolean;
  } = {};
  let replyOptions = sanitizeReplyOptions(llmResponse.options);
  let suggestRefund = Boolean(llmResponse.suggest_refund);

  const phaseAfter = normalizeAgentPhase(agent_v2.current_phase) ?? agent_v2.current_phase;
  const envelopeFailedStayedOpening =
    advance.trigger_breakthrough_core && phaseAfter === "opening";
  const understandingGenerationFailed = Boolean(llmResponse.understanding_generation_failed);

  const openingReplyInput = {
    locale: sessionOutputLocale,
    agent: agent_v2,
    llmResponse: finalContent,
    understandingGenerationFailed,
    phaseAfter,
    envelopeFailedStayedOpening,
  };

  const openingOwned = resolveOpeningTurnReply(openingReplyInput);
  if (openingOwned != null) finalContent = openingOwned;

  // Collecting: chip/短答被模型忽略时，至少在正文前点名接住（不整段改写）。
  if (phaseForWire === "collecting_context" && !isSystemMessage && phaseUserMessage.trim()) {
    const pickedForCatch = userPickedProvidedOption(sessionForAgent, phaseUserMessage);
    const beforeCatch = finalContent;
    finalContent = ensureCollectingCatchPrefix(finalContent, phaseUserMessage, {
      pickedOption: pickedForCatch,
      locale: sessionOutputLocale,
    });
    if (finalContent !== beforeCatch) {
      console.warn("[poju-collecting] prepended catch prefix — model reply lacked user-answer echo", {
        picked_option: pickedForCatch,
        question_status: clampedSignals.question_status,
      });
    }
  }

  // 单问题小状态机终局:session_action 驱动物理动作(锁/wipe);话术由模型按 stage 直出,不再盖固定文案。
  if (clampedSignals.session_action === "terminate_refund") {
    escalationMeta = {
      escalation_lock: true,
      wipe_after_ms: TERMINATE_REFUND_WIPE_MS,
      unqualified_level: 4,
      refund_pass: true,
    };
    agent_v2 = {
      ...agent_v2,
      escalation_locked_at: agent_v2.escalation_locked_at ?? new Date().toISOString(),
      escalation_lock_reason: "unqualified_l4",
    };
    replyOptions = undefined;
    suggestRefund = true;
  } else if (clampedSignals.session_action === "user_paused") {
    escalationMeta = {
      escalation_lock: false,
      paused: true,
    };
  }

  const advancedCleanly =
    openingReplyIsComplete(openingReplyInput) ||
    Boolean(escalationMeta.unqualified_level) ||
    Boolean(escalationMeta.paused) ||
    (!envelopeFailedStayedOpening &&
      (phaseAfter === "awaiting_confirmation" ||
        phaseAfter === "delivered" ||
        phaseAfter === "tracking" ||
        (phaseAfter === "collecting_context" && hasQuestionCue(finalContent))));
  if (!advancedCleanly && !isPojuFailurePlaceholderMessage(finalContent)) {
    finalContent = appendForwardMove(finalContent, agent_v2, sessionOutputLocale, "continue");
  }

  const anchoredFromReply = extractAnchoredFactIdsFromAssistant(finalContent);
  if (anchoredFromReply.length > 0) {
    agent_v2 = {
      ...agent_v2,
      anchored_fact_ids: mergeAnchoredFactIds(agent_v2.anchored_fact_ids, anchoredFromReply),
    };
  }

  const metaphorsFromReply = extractUsedMetaphorsFromAssistant(finalContent);
  if (metaphorsFromReply.length > 0) {
    agent_v2 = {
      ...agent_v2,
      used_metaphors: mergeUsedMetaphors(agent_v2.used_metaphors, metaphorsFromReply),
    };
  }

  const assistantMessage: POJUMessage = {
    role: "assistant",
    content: finalContent,
    timestamp: new Date().toISOString(),
    options: replyOptions,
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
      suggest_refund: suggestRefund,
      scope_mismatch: llmResponse.scope_signal === "out_of_scope" || undefined,
      ...(llmResponse.scope_signal === "out_of_scope" ? { kind: "scope_mismatch" as const } : {}),
      ...(escalationMeta.escalation_lock
        ? {
            escalation_lock: true as const,
            wipe_after_ms: escalationMeta.wipe_after_ms,
            unqualified_level: escalationMeta.unqualified_level,
            ...(escalationMeta.refund_pass ? { refund_pass: true as const } : {}),
          }
        : escalationMeta.paused
          ? { session_paused: true as const }
          : escalationMeta.unqualified_level
            ? { unqualified_level: escalationMeta.unqualified_level }
            : {}),
      contains_delivery: llmResponse.contains_delivery,
      tool_suggestion: linking.tool_suggestion ?? undefined,
      tool_suggestion_message_id: linking.tool_suggestion ? assistantMessageId : undefined,
      thinking_process: llmResponse.thinking_process,
      state_snapshot: buildAgentStateSnapshot(
        agent_v2,
        llmResponse.contains_delivery || workingSession.main_delivery_done,
      ),
      llm_debug: llmResponse.llm_debug,
      ...(understandingGenerationFailed ? { understanding_generation_failed: true as const } : {}),
      ...(phaseAfter === "awaiting_understanding_confirm"
        ? { understanding_gate_pending: true as const }
        : {}),
      ...(isPojuEmptyGenerationMessage(finalContent)
        ? { kind: "generation_incomplete" as const }
        : isPojuInfrastructureFailureMessage(finalContent)
          ? { kind: "infra_busy" as const }
          : {}),
    },
  };

  const nowIso = new Date().toISOString();
  const rollingExpiry = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
  const resolvedOriginalQuestion =
    agent_v2.original_question?.trim() || workingSession.original_question;

  const sessionOut = withSessionProfileFlags({
    ...workingSession,
    original_question: resolvedOriginalQuestion,
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
    locked_output_locale: persistLocked ?? sessionBase.locked_output_locale,
  });

  return maybeRunDeliveryPipeline(sessionOut, advance, sessionOutputLocale);
}

/** Return to opening for user-typed supplement — owned by phases/opening/control. */
// applyUnderstandingGateSupplement — re-exported from opening/control above

async function maybeRunDeliveryPipeline(
  session: POJUSessionState,
  advance: AdvanceResult,
  locale: string,
): Promise<POJUSessionState> {
  if (!advance.trigger_delivery || session.main_delivery_done) return session;
  if (session.agent_v2?.delivery_mode === "degraded") return session;
  try {
    return await runConfirmationPipeline(session, locale);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[agent] delivery pipeline failed, staying in confirmation:", e);
    if (!session.agent_v2) return session;
    const retryHint =
      msg === "PASS_REQUIRED" || msg === "PASS_LOGIN_REQUIRED"
        ? pivotChatCopy(locale).pass_required_for_deliverable
        : pivotChatCopy(locale).summary_or_deliverable_failed;
    const messages = [...session.messages];
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      messages[messages.length - 1] = { ...last, content: retryHint };
    }
    return {
      ...session,
      messages,
      pending_delivery_job_id: null,
      agent_v2: { ...session.agent_v2, current_phase: "awaiting_confirmation" },
    };
  }
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
  attachment?: import("@/lib/poju/attachments/types").PojuChatAttachment | null;
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
  scope_signal?: "in_scope" | "unclear" | "out_of_scope" | null;
  attachments_unlocked?: boolean;
  locked_provider?: string;
  understanding?: { sufficient: boolean; missing: string } | null;
  understanding_sufficient?: boolean;
  understanding_generation_failed?: boolean;
  agenda_updates?: { completed_in_this_turn?: string[] };
  reply_quality?: "clear" | "vague";
  question_status?: QuestionStatus;
  session_action?: SessionAction | null;
  options?: string[];
  user_confirms_delivery?: boolean;
  confirmation_signal?: "confirmed" | "wants_to_add" | "unclear";
  breakthrough_core_updates?: Partial<import("@/lib/poju/agent-state").BreakthroughCore> | null;
  breakthrough_core?: import("@/lib/poju/agent-state").BreakthroughCore | null;
  core_dilemma?: import("@/lib/poju/agent-state").CoreDilemma | null;
  desired_direction?: import("@/lib/poju/agent-state").DesiredDirection | null;
  problem_summary?: string | null;
  action_status_updates?: import("@/lib/poju/action-status-updates").ActionStatusPatch[];
  conversion_envelope_failed?: boolean;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
}> {
  // base_analysis + full session stringify is often multi‑MB sync work — yield so
  // the optimistic user bubble can paint before we freeze the main thread.
  await yieldToBrowserPaint();
  const body = JSON.stringify({
    session: input.session,
    profile: input.profile,
    base_analysis: input.base_analysis ?? null,
    archive_data: input.archive_data ?? null,
    locale: input.locale,
    tool_injection_context: input.tool_injection_context ?? null,
    attachment: input.attachment ?? null,
  });

  const response = await fetch("/api/poju/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: input.signal,
  });

  const data = (await response.json().catch(() => ({}))) as LLMApiPayload & { error?: string };
  if (
    data.error === "openrouter_provider_queue" ||
    (!response.ok && response.status === 503)
  ) {
    const err = new Error("openrouter_provider_queue");
    err.name = "OpenRouterProviderQueueError";
    throw err;
  }
  if (!response.ok) {
    throw new Error(`/api/poju/chat returned HTTP ${response.status}`);
  }
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
    scope_signal:
      wire.scope_signal === "in_scope" ||
      wire.scope_signal === "unclear" ||
      wire.scope_signal === "out_of_scope"
        ? wire.scope_signal
        : null,
    attachments_unlocked: wire.attachments_unlocked === true ? true : undefined,
    locked_provider:
      typeof wire.locked_provider === "string" && wire.locked_provider.trim()
        ? wire.locked_provider.trim()
        : undefined,
    understanding:
      wire.understanding &&
      typeof wire.understanding === "object" &&
      !Array.isArray(wire.understanding)
        ? {
            sufficient: Boolean((wire.understanding as { sufficient?: unknown }).sufficient),
            missing: String((wire.understanding as { missing?: unknown }).missing ?? ""),
          }
        : null,
    understanding_sufficient:
      typeof wire.understanding_sufficient === "boolean" ? wire.understanding_sufficient : undefined,
    understanding_generation_failed:
      wire.understanding_generation_failed === true ? true : undefined,
    agenda_updates:
      wire.agenda_updates &&
      typeof wire.agenda_updates === "object" &&
      !Array.isArray(wire.agenda_updates)
        ? (wire.agenda_updates as { completed_in_this_turn?: string[] })
        : undefined,
    reply_quality:
      wire.reply_quality === "clear" || wire.reply_quality === "vague"
        ? wire.reply_quality
        : undefined,
    question_status:
      wire.question_status === "satisfied" ||
      wire.question_status === "retry" ||
      wire.question_status === "escalate" ||
      wire.question_status === "terminal"
        ? wire.question_status
        : undefined,
    session_action:
      wire.session_action === "terminate_refund" || wire.session_action === "user_paused"
        ? wire.session_action
        : wire.session_action === null
          ? null
          : undefined,
    options: sanitizeReplyOptions(wire.options),
    user_confirms_delivery:
      typeof wire.user_confirms_delivery === "boolean" ? wire.user_confirms_delivery : undefined,
    confirmation_signal:
      wire.confirmation_signal === "confirmed" ||
      wire.confirmation_signal === "wants_to_add" ||
      wire.confirmation_signal === "unclear"
        ? wire.confirmation_signal
        : undefined,
    breakthrough_core_updates:
      wire.breakthrough_core_updates &&
      typeof wire.breakthrough_core_updates === "object" &&
      !Array.isArray(wire.breakthrough_core_updates)
        ? (wire.breakthrough_core_updates as Partial<import("@/lib/poju/agent-state").BreakthroughCore>)
        : null,
    breakthrough_core:
      wire.breakthrough_core &&
      typeof wire.breakthrough_core === "object" &&
      !Array.isArray(wire.breakthrough_core)
        ? (wire.breakthrough_core as import("@/lib/poju/agent-state").BreakthroughCore)
        : null,
    core_dilemma:
      wire.core_dilemma &&
      typeof wire.core_dilemma === "object" &&
      !Array.isArray(wire.core_dilemma)
        ? (wire.core_dilemma as import("@/lib/poju/agent-state").CoreDilemma)
        : null,
    desired_direction:
      wire.desired_direction &&
      typeof wire.desired_direction === "object" &&
      !Array.isArray(wire.desired_direction)
        ? (wire.desired_direction as import("@/lib/poju/agent-state").DesiredDirection)
        : null,
    problem_summary:
      typeof wire.problem_summary === "string" ? wire.problem_summary : null,
    action_status_updates: Array.isArray(wire.action_status_updates)
      ? parseActionStatusUpdates({ action_status_updates: wire.action_status_updates })
      : undefined,
    conversion_envelope_failed:
      typeof wire.conversion_envelope_failed === "boolean" ? wire.conversion_envelope_failed : undefined,
    llm_debug:
      wire.llm_debug && typeof wire.llm_debug === "object" && !Array.isArray(wire.llm_debug)
        ? (wire.llm_debug as import("@/lib/llm/llm-debug").LLMCallDebug)
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
  if (phase === "awaiting_understanding_confirm") return "awaiting_understanding_confirm" as const;
  if (phase === "opening") return "opening" as const;
  return "collecting_context" as const;
}
