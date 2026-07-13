// ---------------------------------------------------------------------------
// POJU v4.0 (POJU_v4.0_POJU_Part1.md) — Agent session model (IndexedDB + LLM)
// ---------------------------------------------------------------------------

export type PojuV4SessionStatus = "active" | "paused" | "resolved" | "archived";

export type PojuV4StateHint =
  | "opening"
  | "greeting"
  | "collecting_context"
  | "awaiting_profile"
  | "awaiting_understanding_confirm"
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
  /** Stable list key; preserved from optimistic append through persistence. */
  client_id?: string;
  meta?: {
    llm_model?: string;
    tokens_used?: number;
    user_intent?: PojuV4UserIntent;
    current_state?: PojuV4StateHint;
    action_requested?: PojuV4ActionRequested;
    topic_drift_detected?: boolean;
    topic_drift_signal?: "none" | "edge" | "off_topic";
    drift_reason?: string;
    should_show_new_session_button?: boolean;
    suggest_refund?: boolean;
    contains_delivery?: boolean;
    /** Tool_Linking Step 2 — pending tool card on this assistant turn. */
    tool_suggestion?: ToolSuggestionPayload;
    /** Correlates with `POJUCycle.tool_suggestions[].suggested_in_message_id`. */
    tool_suggestion_message_id?: string;
    /** DeepSeek / OpenRouter reasoning tokens + POJU thought digest for this turn. */
    thinking_process?: string;
    /** Debug panel — agent state machine flags after this turn. */
    state_snapshot?: import("@/lib/poju/agent-state-snapshot").PojuStateSnapshot;
    /** Debug panel — OpenRouter call metrics for this turn. */
    llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
    /** Agenda items when first built (shown below bubble, not in body). */
    investigation_agenda?: import("@/lib/poju/investigation-agenda").AgendaItem[];
    /** Segment-1 understanding gate — show confirm / supplement buttons. */
    understanding_gate_pending?: boolean;
  /** Segment-2 core generation failed — show regenerate button. */
  core_generation_failed?: boolean;
  /** Segment-1 opening resends exhausted — show retry button. */
  understanding_generation_failed?: boolean;
    /** Collecting escalation — show refund entry (user-initiated). */
    kind?: "energy_matrix" | "paywall" | "report" | "welcome" | "infra_busy" | "generation_empty" | "generation_incomplete";
    /** Preview chat — welcome bubble sourced from matrix synopsis (not generic copy). */
    matrix_welcome?: boolean;
    matrix_payload?: import("./build-matrix-payload").PojuMatrixPayload;
    report_text?: string;
    report_profile_id?: string;
  };
  is_rejected?: boolean;
  rejection_type?: "too_long" | "jailbreak" | "spam";
}

export interface POJUAction {
  action_id: string;
  given_at: string;
  text: string;
  /** Custom heading from `### Action N: …` in final delivery (falls back to category label in UI). */
  title?: string;
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

/** Tool linking — per-cycle tool recommendation (Step 1, Tool_Linking_Final). */
export type ToolName = "glyph" | "syncro" | "match";

/** LLM + UI payload for an in-chat tool recommendation. */
export interface ToolSuggestionPayload {
  tool: ToolName;
  trigger_context: string;
  value_prop?: string;
  prefill?: Record<string, unknown>;
}

export interface ToolSuggestion {
  tool: ToolName;
  suggested_at: string;
  suggested_in_message_id: string;
  trigger_context: string;
  user_action: "accepted" | "declined" | "pending";
  tool_result_id?: string;
  tool_result_data?: unknown;
  tool_completed_at?: string;
  injected_to_poju?: boolean;
}

export interface POJUCycleDeliveredAction {
  action_id: string;
  category: string;
  text: string;
  status: "pending" | "completed" | "skipped" | "modified";
  timing?: string;
}

/** One breakthrough cycle inside a POJU session. */
export interface POJUCycle {
  cycle_id: string;
  cycle_index: number;
  original_question: string;
  question_category: string;
  current_summary: unknown | null;
  started_at: string;
  delivery_completed_at?: string;
  tool_suggestions: ToolSuggestion[];
  delivered_actions?: POJUCycleDeliveredAction[];
  is_delivered: boolean;
  is_active: boolean;
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
  /** IndexedDB archive row id for the main-delivery action plan (改进 3). */
  action_plan_archive_id?: string | null;
  tokens_used: number;
  abuse_metrics: {
    long_input_count: number;
    jailbreak_attempts: number;
    duplicate_attempts: number;
  };
  created_at: string;
  last_interaction_at: string;
  expires_at: string;

  /** Tool linking v1 — multiple breakthrough cycles per session. */
  cycles?: POJUCycle[];
  active_cycle_id?: string;
  /** Cross-cycle shared context (e.g. profile refs); not Archive history. */
  shared_context?: Record<string, unknown>;

  /** Preview-unlock flow: chat-first, pay in-thread. */
  unlock_status?: "preview" | "unlocked";
  unlock_via?: "payment" | "code";
  /** User question captured at paywall (before unlock). */
  pending_question?: string;
  /** Preview phase: user acknowledged question-input briefing for this session. */
  question_briefing_dismissed?: boolean;
  /** Local chart data for Energy Matrix (no LLM). */
  matrix_payload?: import("./build-matrix-payload").PojuMatrixPayload;
  /** OpenRouter supplier pinned after first successful chat turn (prefix cache). */
  locked_provider?: string;
  /** 会话首条有效用户消息确定的输出语言；锁定后整段会话不变（语言一致性 + 系统提示词 byte 恒定 → 缓存命中）。 */
  locked_output_locale?: "en" | "es" | "zh" | "fr" | "de";
}
