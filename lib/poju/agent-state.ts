/**
 * POJU Agent 硬性状态机（POJU_v4.0_Agent_Implementation_Part1 · Step 4）
 * 阶段由代码 + LLM 建议共同约束；会话持久化字段见 `POJUSessionState.agent_v2`。
 */

import type { POJUAction } from "@/lib/poju/types";

export type AgentPhase =
  | "greeting"
  | "awaiting_profile"
  | "collecting_context"
  | "awaiting_confirmation"
  | "delivered"
  | "tracking";

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
  turn_count: number;
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

export function createInitialAgentState(input: { original_question: string }): POJUAgentState {
  return {
    current_phase: "greeting",
    original_question: input.original_question,
    selected_profile_id: null,
    has_base_analysis: false,
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
  llm_suggested_phase: AgentPhase | null;
  user_message: string;
}

export interface PhaseTransitionResult {
  should_transition: boolean;
  new_phase: AgentPhase;
  reason: string;
}

export function decidePhaseTransition(input: PhaseTransitionInput): PhaseTransitionResult {
  const { current_state, llm_suggested_phase, user_message } = input;
  const current = current_state.current_phase;

  if (
    /(?:want|like|let me|i'll).{0,30}(?:provide|add|fill|enter).{0,20}(?:birth|profile|info)|想.{0,5}(?:填|提供|输入).{0,5}(?:出生|八字|信息)/i.test(
      user_message,
    )
  ) {
    if (!current_state.selected_profile_id) {
      return {
        should_transition: true,
        new_phase: "awaiting_profile",
        reason: "User explicitly requested to provide birth info",
      };
    }
  }

  if (
    /(?:give|tell|show).{0,20}(?:analysis|reading|advice|recommendation)|现在.{0,5}(?:给我|告诉我).{0,5}(?:分析|建议|结论)/i.test(
      user_message,
    )
  ) {
    if (current === "collecting_context" && current_state.collection_completeness >= 0.5) {
      return {
        should_transition: true,
        new_phase: "awaiting_confirmation",
        reason: "User explicitly requested delivery",
      };
    }
  }

  switch (current) {
    case "greeting":
      if (llm_suggested_phase === "awaiting_profile" || llm_suggested_phase === "collecting_context") {
        if (!current_state.selected_profile_id && !current_state.profile_skipped) {
          return {
            should_transition: true,
            new_phase: "awaiting_profile",
            reason: "LLM detected substantive concern, requesting profile",
          };
        }
        return {
          should_transition: true,
          new_phase: "collecting_context",
          reason: "Profile already exists or skipped, starting context collection",
        };
      }
      break;

    case "awaiting_profile":
      if (current_state.selected_profile_id || current_state.profile_skipped) {
        return {
          should_transition: true,
          new_phase: "collecting_context",
          reason: "Profile selected or skipped, starting context collection",
        };
      }
      break;

    case "collecting_context":
      if (current_state.collection_completeness >= 0.7 || llm_suggested_phase === "awaiting_confirmation") {
        return {
          should_transition: true,
          new_phase: "awaiting_confirmation",
          reason: `Collection sufficient (${(current_state.collection_completeness * 100).toFixed(0)}%)`,
        };
      }
      break;

    case "awaiting_confirmation":
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
  if (!transition.should_transition) return state;

  return {
    ...state,
    current_phase: transition.new_phase,
    phase_history: [
      ...state.phase_history,
      {
        from_phase: state.current_phase,
        to_phase: transition.new_phase,
        triggered_at: new Date().toISOString(),
        reason: transition.reason,
      },
    ],
  };
}
