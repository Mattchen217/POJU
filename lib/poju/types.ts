// ---------------------------------------------------------------------------
// POJU v4.0 (POJU_v4.0_POJU_Part1.md) — Agent session model (IndexedDB + LLM)
// ---------------------------------------------------------------------------

export type PojuV4SessionStatus = "active" | "paused" | "resolved" | "archived";

export type PojuV4StateHint =
  | "greeting"
  | "collecting_context"
  | "awaiting_profile"
  | "awaiting_confirmation"
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
    /** DeepSeek / OpenRouter reasoning tokens + POJU thought digest for this turn. */
    thinking_process?: string;
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

/** Step 8 困境分析单次缓存条目（按语境指纹存于 session）。 */
export interface SituationAnalysisCacheEntry {
  context_fingerprint: string;
  generated_at: string;
  model: string;
  tokens_used: number;
  content: unknown;
}

export interface POJUSessionState {
  session_id: string;
  device_id: string;
  original_question: string;
  messages: POJUMessage[];
  context_collected: Record<string, unknown>;
  has_profile: boolean;
  /** True when user submitted birth info in this session (default `userProfiles` slot). */
  birth_submitted_in_session?: boolean;
  profile_skipped: boolean;
  actions: POJUAction[];
  main_delivery_done: boolean;
  main_delivery: POJUDelivery | null;
  /** Agent state machine (Agent Implementation Part1 Step 4–6). */
  agent_v2?: import("./agent-state").POJUAgentState;
  /**
   * Step 8 困境分析缓存：key = `computeSituationContextFingerprint` 结果。
   * 语境变化 → 新 key → 可再次调用模型。
   */
  situation_analysis_by_fingerprint?: Record<string, SituationAnalysisCacheEntry>;
  /** 若从 `stored_profiles` 选人，写入 profile_id 以便挂载 Step 7 `base_analysis`。 */
  selected_stored_profile_id?: string | null;
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
