/**
 * POJU Agent state machine (v5 Step B: opening → collecting → confirmation → delivery → tracking).
 */

import {
  areRequiredFieldsComplete,
  evaluateCollectingConfirmationGate,
  userExplicitlyRequestsConfirmation,
} from "@/lib/poju/collecting-confirmation-gate";
import {
  isPrematureCollectingPhase,
  type CollectionProgress,
  type DeliveryMode,
} from "@/lib/poju/collection-progress";
import { classifyStallOfferReply } from "@/lib/poju/stall-offer-routing";
import type { POJUAction } from "@/lib/poju/types";

export type AgentPhase =
  | "opening"
  | "collecting_context"
  | "awaiting_confirmation"
  | "delivered"
  | "tracking";

/** Persisted v4 phase values normalized on read. */
export type LegacyAgentPhase = "greeting" | "awaiting_profile";

export function normalizeAgentPhase(phase: string | null | undefined): AgentPhase | null {
  if (!phase) return null;
  switch (phase) {
    case "greeting":
      return "opening";
    case "awaiting_profile":
      return "collecting_context";
    case "opening":
    case "collecting_context":
    case "awaiting_confirmation":
    case "delivered":
    case "tracking":
      return phase;
    default:
      return null;
  }
}

export interface ContextCollection {
  duration: string | null;
  trigger_event: string | null;
  emotional_state: string | null;
  what_tried: string[];
  desired_outcome: string | null;
  category_specific: Record<string, unknown>;
}

export type QuestionCategory =
  | "career"
  | "relationship"
  | "wealth"
  | "health"
  | "family"
  | "decision"
  | "interpersonal"
  | "other"
  | null;

export interface ContextSummary {
  generated_at: string;
  category: string;
  sections: Array<{
    section_id: string;
    title: string;
    items: Array<{
      item_id: string;
      label: string;
      value: string;
      field_key: string;
    }>;
  }>;
}

export interface POJUAgentState {
  current_phase: AgentPhase;
  original_question: string;
  selected_profile_id: string | null;
  has_base_analysis: boolean;
  profile_skipped: boolean;
  question_category: QuestionCategory;
  context_collected: ContextCollection;
  collection_completeness: number;
  current_summary: ContextSummary | null;
  has_situation_analysis: boolean;
  actions: POJUAction[];
  main_delivery_at: string | null;
  main_delivery_data: unknown | null;
  /** Total agent turns (legacy counter). */
  turn_count: number;
  /** Effective Q&A rounds while in collecting_context (code-maintained). */
  collecting_turn_count: number;
  /** Consecutive stalled/resistant collecting rounds (resets on advancing). */
  stall_count: number;
  /** full = normal confirm path; degraded = stop-loss path (Step 3 delivery). */
  delivery_mode: import("@/lib/poju/collection-progress").DeliveryMode | null;
  /** Set when stop-loss hard rule fires; Step 3 reads this to run degraded delivery. */
  stop_loss_triggered: boolean;
  /** User sees stall-offer binary choice (no summary form). */
  stall_offer_pending: boolean;
  /** Next collecting turn uses low-barrier re-engagement prompt. */
  resume_collecting_low_barrier: boolean;
  tokens_used: number;
  phase_history: Array<{
    from_phase: AgentPhase;
    to_phase: AgentPhase;
    triggered_at: string;
    reason: string;
  }>;
}

export const REQUIRED_FIELDS_BY_CATEGORY: Record<string, string[]> = {
  career: [
    "current_role",
    "years_experience",
    "industry",
    "specific_issue",
    "duration_of_issue",
    "workplace_relationships",
    "financial_situation",
    "family_support",
    "desired_outcome",
  ],
  relationship: [
    "relationship_type",
    "relationship_duration",
    "specific_issue",
    "frequency",
    "key_incidents",
    "tried_to_resolve",
    "other_party_perspective",
    "commitment_level",
    "desired_outcome",
  ],
  wealth: [
    "current_situation",
    "specific_concern",
    "income_source",
    "debts",
    "investments",
    "risk_tolerance",
    "time_horizon",
    "family_obligations",
    "desired_outcome",
  ],
  health: [
    "health_concern",
    "duration",
    "severity",
    "lifestyle_factors",
    "tried_treatments",
    "stress_level",
    "family_history",
    "desired_outcome",
  ],
  family: [
    "family_member",
    "specific_issue",
    "duration",
    "tried_approaches",
    "other_members_involved",
    "cultural_context",
    "desired_outcome",
  ],
  decision: [
    "decision_topic",
    "options",
    "deadline",
    "stakes",
    "who_else_affected",
    "gut_feeling",
    "fears",
    "desired_outcome",
  ],
  interpersonal: ["situation", "people_involved", "duration", "specific_incidents", "tried", "desired_outcome"],
  other: ["situation_description", "duration", "context", "tried", "desired_outcome"],
};

function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return true;
}

export function createInitialAgentState(input: {
  original_question: string;
  selected_profile_id?: string | null;
}): POJUAgentState {
  const selected_profile_id = input.selected_profile_id ?? null;
  return {
    current_phase: "opening",
    original_question: input.original_question,
    selected_profile_id,
    has_base_analysis: Boolean(selected_profile_id),
    profile_skipped: false,
    question_category: null,
    context_collected: {
      duration: null,
      trigger_event: null,
      emotional_state: null,
      what_tried: [],
      desired_outcome: null,
      category_specific: {},
    },
    collection_completeness: 0,
    current_summary: null,
    has_situation_analysis: false,
    actions: [],
    main_delivery_at: null,
    main_delivery_data: null,
    turn_count: 0,
    collecting_turn_count: 0,
    stall_count: 0,
    delivery_mode: null,
    stop_loss_triggered: false,
    stall_offer_pending: false,
    resume_collecting_low_barrier: false,
    tokens_used: 0,
    phase_history: [],
  };
}

export function calculateCompleteness(state: POJUAgentState): number {
  if (!state.question_category) return 0;

  const required = REQUIRED_FIELDS_BY_CATEGORY[state.question_category] ?? [];
  if (required.length === 0) return 0;

  const c = state.context_collected;
  const generalFields = ["duration", "trigger_event", "emotional_state", "desired_outcome"] as const;
  let generalFilled = 0;
  for (const field of generalFields) {
    const v = c[field];
    if (isFilled(v)) generalFilled += 1;
  }
  const generalScore = (generalFilled / generalFields.length) * 0.3;

  const triedScore = c.what_tried.length > 0 ? 0.1 : 0;

  let categoryFilled = 0;
  for (const field of required) {
    if (isFilled(c.category_specific[field])) categoryFilled += 1;
  }
  const categoryScore = (categoryFilled / required.length) * 0.6;

  return Math.min(1, generalScore + triedScore + categoryScore);
}

export function findMissingFields(state: POJUAgentState): { general: string[]; category_specific: string[] } {
  const missing = { general: [] as string[], category_specific: [] as string[] };
  const c = state.context_collected;

  const generalFields = ["duration", "trigger_event", "emotional_state", "desired_outcome"] as const;
  for (const field of generalFields) {
    if (!isFilled(c[field])) missing.general.push(field);
  }
  if (c.what_tried.length === 0) missing.general.push("what_tried");

  if (state.question_category) {
    const required = REQUIRED_FIELDS_BY_CATEGORY[state.question_category] ?? [];
    for (const field of required) {
      if (!isFilled(c.category_specific[field])) missing.category_specific.push(field);
    }
  }

  return missing;
}

export interface PhaseTransitionInput {
  current_state: POJUAgentState;
  llm_suggested_phase: AgentPhase | LegacyAgentPhase | null;
  user_message: string;
  /** Effective user Q&A rounds — used for collecting → confirmation hard gate. */
  user_turn_count?: number;
  /** LLM signal from collecting phase (Step 1). */
  collection_progress?: CollectionProgress | null;
  /** Counters after this turn's update (Step 2). */
  stall_count?: number;
  collecting_turn_count?: number;
  /** Precomputed stop-loss evaluation for this turn. */
  stop_loss?: { triggered: boolean; reason: string | null };
  /** LLM stall-offer branch (Step 3). */
  stall_offer?: boolean;
}

export interface PhaseTransitionResult {
  should_transition: boolean;
  new_phase: AgentPhase;
  reason: string;
  delivery_mode?: DeliveryMode | null;
  stop_loss_triggered?: boolean;
  stall_offer_pending?: boolean;
  clear_stall_offer_pending?: boolean;
  reset_stall_count?: boolean;
  resume_collecting_low_barrier?: boolean;
  clear_resume_collecting_low_barrier?: boolean;
}

export function decidePhaseTransition(input: PhaseTransitionInput): PhaseTransitionResult {
  const { current_state, user_message } = input;
  const userTurnCount = input.user_turn_count ?? 0;
  const collectingTurnCount =
    input.collecting_turn_count ?? current_state.collecting_turn_count ?? 0;
  const llm_suggested_phase = normalizeAgentPhase(input.llm_suggested_phase ?? undefined);
  const current = normalizeAgentPhase(current_state.current_phase) ?? current_state.current_phase;

  const tryCollectingToConfirmation = (reason: string): PhaseTransitionResult | null => {
    if (isPrematureCollectingPhase(current_state, collectingTurnCount)) {
      return null;
    }
    const gate = evaluateCollectingConfirmationGate(current_state, userTurnCount);
    if (!gate.allowed) return null;
    return {
      should_transition: true,
      new_phase: "awaiting_confirmation",
      delivery_mode: "full",
      reason,
    };
  };

  if (
    /(?:give|tell|show).{0,20}(?:analysis|reading|advice|recommendation)|现在.{0,5}(?:给我|告诉我).{0,5}(?:分析|建议|结论)/i.test(
      user_message,
    )
  ) {
    if (current === "collecting_context") {
      if (input.stall_offer) {
        return {
          should_transition: true,
          new_phase: "awaiting_confirmation",
          stop_loss_triggered: true,
          stall_offer_pending: true,
          reason: `Stop-loss stall offer: ${input.stop_loss?.reason ?? "triggered"}`,
        };
      }
      const transition = tryCollectingToConfirmation("User explicitly requested delivery");
      if (transition) return transition;
    }
  }

  switch (current) {
    case "opening":
      if (user_message !== "__OPENING__" && user_message.trim()) {
        return {
          should_transition: true,
          new_phase: "collecting_context",
          reason: "User responded to opening, entering collection",
        };
      }
      break;

    case "collecting_context": {
      if (input.stall_offer) {
        return {
          should_transition: true,
          new_phase: "awaiting_confirmation",
          stop_loss_triggered: true,
          stall_offer_pending: true,
          reason: `Stop-loss stall offer: ${input.stop_loss?.reason ?? "triggered"}`,
        };
      }

      const userWantsConfirm = userExplicitlyRequestsConfirmation(user_message);
      const llmWantsConfirm = llm_suggested_phase === "awaiting_confirmation";

      if (userWantsConfirm) {
        const transition = tryCollectingToConfirmation("User requested confirmation");
        if (transition) return transition;
      }
      if (llmWantsConfirm) {
        const transition = tryCollectingToConfirmation("LLM suggested confirmation");
        if (transition) return transition;
      }
      if (areRequiredFieldsComplete(current_state)) {
        const transition = tryCollectingToConfirmation("Required fields complete");
        if (transition) return transition;
      }
      break;
    }

    case "awaiting_confirmation":
      if (current_state.stall_offer_pending) {
        const choice = classifyStallOfferReply(user_message);
        if (choice === "continue_collecting") {
          return {
            should_transition: true,
            new_phase: "collecting_context",
            reset_stall_count: true,
            clear_stall_offer_pending: true,
            resume_collecting_low_barrier: true,
            reason: "User chose to continue collecting after stall offer",
          };
        }
        return {
          should_transition: true,
          new_phase: "delivered",
          delivery_mode: "degraded",
          clear_stall_offer_pending: true,
          reason:
            choice === "degraded_delivery"
              ? "User chose degraded delivery after stall offer"
              : "Stall offer fallback to degraded delivery",
        };
      }
      if (llm_suggested_phase === "collecting_context") {
        return {
          should_transition: true,
          new_phase: "collecting_context",
          reason: "User wants to add more context",
        };
      }
      if (llm_suggested_phase === "delivered") {
        return {
          should_transition: true,
          new_phase: "delivered",
          delivery_mode: current_state.delivery_mode ?? "full",
          reason: "User confirmed, generating delivery",
        };
      }
      break;

    case "delivered":
      return {
        should_transition: true,
        new_phase: "tracking",
        reason: "Main delivery done, entering tracking mode",
      };

    case "tracking":
      break;

    default:
      break;
  }

  return {
    should_transition: false,
    new_phase: current,
    reason: "No transition condition met",
  };
}

export function applyPhaseTransition(state: POJUAgentState, transition: PhaseTransitionResult): POJUAgentState {
  const statePatch: Partial<POJUAgentState> = {};

  if (transition.delivery_mode != null) statePatch.delivery_mode = transition.delivery_mode;
  if (transition.stop_loss_triggered) statePatch.stop_loss_triggered = true;
  if (transition.stall_offer_pending) statePatch.stall_offer_pending = true;
  if (transition.clear_stall_offer_pending) statePatch.stall_offer_pending = false;
  if (transition.reset_stall_count) statePatch.stall_count = 0;
  if (transition.resume_collecting_low_barrier) statePatch.resume_collecting_low_barrier = true;
  if (transition.clear_resume_collecting_low_barrier) statePatch.resume_collecting_low_barrier = false;

  if (!transition.should_transition) {
    return Object.keys(statePatch).length > 0 ? { ...state, ...statePatch } : state;
  }

  const from = normalizeAgentPhase(state.current_phase) ?? state.current_phase;
  const to = transition.new_phase;

  return {
    ...state,
    ...statePatch,
    current_phase: to,
    phase_history: [
      ...state.phase_history,
      {
        from_phase: from,
        to_phase: to,
        triggered_at: new Date().toISOString(),
        reason: transition.reason,
      },
    ],
  };
}
