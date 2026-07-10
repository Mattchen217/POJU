/**
 * POJU Agent state machine (v5 Step B: opening → collecting → confirmation → delivery → tracking).
 */

import { type CollectionProgress, type DeliveryMode } from "@/lib/poju/collection-progress";
import {
  canTransitionToConfirmation,
  computeCollectingPullback,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";
import { classifyStallOfferReply } from "@/lib/poju/stall-offer-routing";
import type { POJUAction } from "@/lib/poju/types";

export type { AgendaItem } from "@/lib/poju/investigation-agenda";
export type AgendaItemStatus = import("@/lib/poju/investigation-agenda").AgendaItemStatus;

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

/** Segment 1 output — concrete dilemma structure (no length cap; all sub-fields required to pass gate). */
export interface CoreDilemma {
  concrete_event: string | null;
  stakes: string | null;
  sticking_point: string | null;
}

/** Segment 1 output — what the user wants to move toward (actively elicited in opening). */
export interface DesiredDirection {
  wants: string | null;
  priority: string | null;
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

/** 破局推理脊柱：深测算一次产出、随收集演进、最后喂入交付。session 内持久。 */
export interface BreakthroughDirection {
  direction: string;
  structural_basis: string;
  timing?: string;
  what_would_confirm: string;
  status?: "hypothesis" | "reinforced" | "selected" | "weakened";
}

export interface BreakthroughCore {
  relationship_conclusion: string;
  breakthrough_directions: BreakthroughDirection[];
  generated_at: string;
  evolved_at?: string;
}

/** Parse collecting-phase `breakthrough_core_updates` (supports revised_directions alias). */
export function parseBreakthroughCoreUpdatesFromLlm(raw: unknown): Partial<BreakthroughCore> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<BreakthroughCore> = {};
  if (typeof o.relationship_conclusion === "string" && o.relationship_conclusion.trim()) {
    out.relationship_conclusion = o.relationship_conclusion.trim();
  }
  const dirsRaw = o.breakthrough_directions ?? o.revised_directions;
  if (Array.isArray(dirsRaw) && dirsRaw.length > 0) {
    const dirs: BreakthroughDirection[] = [];
    for (const entry of dirsRaw) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const direction = typeof row.direction === "string" ? row.direction.trim() : "";
      if (!direction) continue;
      dirs.push({
        direction,
        structural_basis:
          typeof row.structural_basis === "string" ? row.structural_basis.trim() : "",
        timing: typeof row.timing === "string" ? row.timing.trim() : undefined,
        what_would_confirm:
          typeof row.what_would_confirm === "string" ? row.what_would_confirm.trim() : "",
        status:
          row.status === "hypothesis" ||
          row.status === "reinforced" ||
          row.status === "selected" ||
          row.status === "weakened"
            ? row.status
            : undefined,
      });
    }
    if (dirs.length > 0) out.breakthrough_directions = dirs;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Merge collecting-round spine updates; sets evolved_at. */
export function mergeBreakthroughCoreUpdates(
  base: BreakthroughCore,
  updates: Partial<BreakthroughCore>,
): BreakthroughCore {
  const now = new Date().toISOString();
  let breakthrough_directions = [...base.breakthrough_directions];
  if (Array.isArray(updates.breakthrough_directions)) {
    for (const patch of updates.breakthrough_directions) {
      const idx = breakthrough_directions.findIndex((d) => d.direction === patch.direction);
      if (idx >= 0) {
        breakthrough_directions[idx] = {
          ...breakthrough_directions[idx],
          ...patch,
          direction: patch.direction || breakthrough_directions[idx].direction,
        };
      }
    }
  }
  return {
    relationship_conclusion: updates.relationship_conclusion?.trim() || base.relationship_conclusion,
    breakthrough_directions,
    generated_at: base.generated_at,
    evolved_at: now,
  };
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
  /** Substantive user turns while in opening (control-plane threshold for entering collecting). */
  opening_substantive_turns?: number;
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
  /** Custom investigation angles — generated once on first collecting turn. */
  investigation_agenda: AgendaItem[];
  /** When true, investigation_agenda must never be regenerated. */
  agenda_generated: boolean;
  /** 破局推理脊柱（深测算产出，收集演进，交付消费）。null = 尚未深测算。 */
  breakthrough_core: BreakthroughCore | null;
  /** Segment 1 — core dilemma (event + stakes + sticking point). Control-plane gate input. */
  core_dilemma: CoreDilemma | null;
  /** Segment 1 — desired direction (wants + priority). Control-plane gate input. */
  desired_direction: DesiredDirection | null;
  /** Segment 3 — per-agenda collected detail (reserved; not filled in segment 1). */
  agenda_collection_detail?: Record<string, string> | null;
  /** Segment 4 — delivery report artifact (reserved; populated by delivery pipeline). */
  delivery_report?: unknown | null;
  /** Term/relation ids already anchored in visible assistant replies this session. */
  anchored_fact_ids?: string[];
  /** Distinctive metaphor / imagery phrases already used this session. */
  used_metaphors?: string[];
}

/** Minimum effective user turns before confirmation (agenda-driven gate). */
export const MIN_COLLECTING_USER_TURNS = 3;
/** Strong skip-ahead — minimum user turns. */
export const PUSH_MIN_TURNS = 2;
/** Strong skip-ahead — minimum agenda coverage ratio. */
export const PUSH_GATE = 0.6;
/** Overall agenda coverage required for normal confirmation. */
export const AGENDA_COVERED_GATE = 1;
/** @deprecated Display only — no longer used as delivery gate. */
export const COLLECTION_COMPLETE_GATE = 0.85;
/** @deprecated Use PUSH_MIN_TURNS. */
export const MIN_USER_PUSH_TURNS = PUSH_MIN_TURNS;
/** @deprecated Use PUSH_GATE. */
export const USER_PUSH_COMPLETE_GATE = PUSH_GATE;
/** Distinct category fields needed for full category slice of completeness score. */
export const MIN_CATEGORY_FIELDS_FOR_FULL = 6;

export { detectDeliveryRequest, userHardPushed } from "@/lib/poju/investigation-agenda";

/** @deprecated Use userHardPushed. */
export function userExplicitlySkippedAhead(userMessage: string): boolean {
  return /(?:就现在给我结果|直接给结论|不用再问了|skip ahead|just give me (?:the )?(?:result|analysis)|don'?t need more questions)/i.test(
    userMessage,
  );
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

/** Non-empty string check for understanding-gate sub-fields (no minimum length beyond trim). */
export function isUnderstandingFieldFilled(s?: string | null): boolean {
  return Boolean(s && s.trim().length > 0);
}

export function parseCoreDilemmaPatch(raw: unknown): Partial<CoreDilemma> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<CoreDilemma> = {};
  for (const key of ["concrete_event", "stakes", "sticking_point"] as const) {
    if (typeof o[key] === "string" && o[key].trim()) out[key] = o[key].trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function parseDesiredDirectionPatch(raw: unknown): Partial<DesiredDirection> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<DesiredDirection> = {};
  for (const key of ["wants", "priority"] as const) {
    if (typeof o[key] === "string" && o[key].trim()) out[key] = o[key].trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function mergeCoreDilemma(
  base: CoreDilemma | null,
  patch: Partial<CoreDilemma> | null | undefined,
): CoreDilemma | null {
  if (!patch) return base;
  const prev: CoreDilemma = base ?? {
    concrete_event: null,
    stakes: null,
    sticking_point: null,
  };
  return {
    concrete_event: isUnderstandingFieldFilled(patch.concrete_event)
      ? patch.concrete_event!.trim()
      : prev.concrete_event,
    stakes: isUnderstandingFieldFilled(patch.stakes) ? patch.stakes!.trim() : prev.stakes,
    sticking_point: isUnderstandingFieldFilled(patch.sticking_point)
      ? patch.sticking_point!.trim()
      : prev.sticking_point,
  };
}

export function mergeDesiredDirection(
  base: DesiredDirection | null,
  patch: Partial<DesiredDirection> | null | undefined,
): DesiredDirection | null {
  if (!patch) return base;
  const prev: DesiredDirection = base ?? { wants: null, priority: null };
  return {
    wants: isUnderstandingFieldFilled(patch.wants) ? patch.wants!.trim() : prev.wants,
    priority: isUnderstandingFieldFilled(patch.priority) ? patch.priority!.trim() : prev.priority,
  };
}

/** Control-plane gate: segment 1 complete when all dilemma + direction sub-fields are non-empty. */
export function isUnderstandingComplete(
  state: Pick<POJUAgentState, "core_dilemma" | "desired_direction">,
): boolean {
  const d = state.core_dilemma;
  const dir = state.desired_direction;
  return Boolean(
    d &&
      isUnderstandingFieldFilled(d.concrete_event) &&
      isUnderstandingFieldFilled(d.stakes) &&
      isUnderstandingFieldFilled(d.sticking_point) &&
      dir &&
      isUnderstandingFieldFilled(dir.wants) &&
      isUnderstandingFieldFilled(dir.priority),
  );
}

export function getUnderstandingMissingFields(state: POJUAgentState): string[] {
  const missing: string[] = [];
  const d = state.core_dilemma;
  const dir = state.desired_direction;
  if (!d || !isUnderstandingFieldFilled(d.concrete_event)) missing.push("core_dilemma.concrete_event");
  if (!d || !isUnderstandingFieldFilled(d.stakes)) missing.push("core_dilemma.stakes");
  if (!d || !isUnderstandingFieldFilled(d.sticking_point)) missing.push("core_dilemma.sticking_point");
  if (!dir || !isUnderstandingFieldFilled(dir.wants)) missing.push("desired_direction.wants");
  if (!dir || !isUnderstandingFieldFilled(dir.priority)) missing.push("desired_direction.priority");
  return missing;
}

/** Test / fixture helper — fully populated segment-1 understanding. */
export function withCompleteUnderstanding(agent: POJUAgentState): POJUAgentState {
  return {
    ...agent,
    core_dilemma: {
      concrete_event: "离婚8年，近期几乎没接触异性",
      stakes: "怕错过窗口，也怕再受伤",
      sticking_point: "不知道从哪里开始、自信不足",
    },
    desired_direction: {
      wants: "希望能在合适节奏下建立稳定亲密关系",
      priority: "先恢复社交能力与自我确认",
    },
  };
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
    opening_substantive_turns: 0,
    stall_count: 0,
    delivery_mode: null,
    stop_loss_triggered: false,
    stall_offer_pending: false,
    resume_collecting_low_barrier: false,
    tokens_used: 0,
    phase_history: [],
    investigation_agenda: [],
    agenda_generated: false,
    breakthrough_core: null,
    core_dilemma: null,
    desired_direction: null,
    agenda_collection_detail: null,
    delivery_report: null,
    anchored_fact_ids: [],
    used_metaphors: [],
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
  const categoryScore =
    Math.min(1, categoryFilled / Math.max(MIN_CATEGORY_FIELDS_FOR_FULL, required.length)) * 0.6;

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
  /** Opening Deep Judge — only true allows opening → collecting. */
  understanding_sufficient?: boolean;
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
  /** User asked for delivery but agenda gate not met — inject pullback prompt next turn. */
  pullback?: boolean;
}

export function decidePhaseTransition(input: PhaseTransitionInput): PhaseTransitionResult {
  const { current_state, user_message } = input;
  const userTurns = input.user_turn_count ?? current_state.turn_count ?? 0;
  const llm_suggested_phase = normalizeAgentPhase(input.llm_suggested_phase ?? undefined);
  const current = normalizeAgentPhase(current_state.current_phase) ?? current_state.current_phase;

  switch (current) {
    case "opening":
      if (
        user_message !== "__OPENING__" &&
        user_message.trim() &&
        isUnderstandingComplete(current_state)
      ) {
        return {
          should_transition: true,
          new_phase: "collecting_context",
          reason: "Understanding structure complete, entering collection",
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

      const confirm = canTransitionToConfirmation({
        agent: current_state,
        userTurns,
        userMessage: user_message,
      });
      if (confirm.allowed) {
        const reason =
          llm_suggested_phase === "awaiting_confirmation"
            ? confirm.reason
            : confirm.reason;
        return {
          should_transition: true,
          new_phase: "awaiting_confirmation",
          delivery_mode: "full",
          reason,
        };
      }

      const pullback = computeCollectingPullback({
        userMessage: user_message,
        agent: current_state,
        userTurns,
      });
      return {
        should_transition: false,
        new_phase: "collecting_context",
        reason: confirm.reason,
        pullback,
      };
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
