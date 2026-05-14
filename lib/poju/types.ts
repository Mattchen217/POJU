// ---------------------------------------------------------------------------
// POJU v4.0 (POJU_v4.0_POJU_Part1.md) — Agent session model (IndexedDB + LLM)
// ---------------------------------------------------------------------------

export type PojuV4SessionStatus = "active" | "paused" | "resolved" | "archived";

export type PojuV4StateHint =
  | "greeting"
  | "collecting_context"
  | "awaiting_profile"
  | "analyzing"
  | "delivered"
  | "tracking";

export type PojuV4UserIntent =
  | "greeting"
  | "sharing_situation"
  | "asking_specific"
  | "reporting_progress"
  | "wrapping_up"
  | "unclear"
  | "off_topic";

export type PojuV4ActionRequested = "continue_chat" | "show_birth_form" | "deliver_main" | "track_progress";

export interface POJUMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  meta?: {
    llm_model?: string;
    tokens_used?: number;
    user_intent?: PojuV4UserIntent;
    current_state?: PojuV4StateHint;
    action_requested?: PojuV4ActionRequested;
    topic_drift_detected?: boolean;
    contains_delivery?: boolean;
  };
  is_rejected?: boolean;
  rejection_type?: "too_long" | "jailbreak" | "spam";
}

export interface POJUAction {
  action_id: string;
  given_at: string;
  text: string;
  category: "traditional" | "modern_decisive" | "modern_reflective";
  timing: "immediate" | "this_week" | "this_month" | "ongoing";
  rationale: string;
  status: "pending" | "completed" | "modified" | "skipped";
  user_feedback?: string;
  updated_at?: string;
}

export interface POJUDelivery {
  delivered_at: string;
  language: string;
  analysis: {
    user_situation_summary: string;
    pattern_insight: string;
    current_phase_insight: string;
    hidden_dynamics: string[];
  };
  conclusion: {
    core_message: string;
    perspective_shift: string;
  };
  actions: POJUAction[];
  invitation: string;
}

export interface POJUSessionState {
  session_id: string;
  device_id: string;
  original_question: string;
  messages: POJUMessage[];
  context_collected: Record<string, unknown>;
  has_profile: boolean;
  profile_skipped: boolean;
  actions: POJUAction[];
  main_delivery_done: boolean;
  main_delivery: POJUDelivery | null;
  tokens_used: number;
  abuse_metrics: {
    long_input_count: number;
    jailbreak_attempts: number;
    duplicate_attempts: number;
  };
  created_at: string;
  last_interaction_at: string;
  expires_at: string;
}
