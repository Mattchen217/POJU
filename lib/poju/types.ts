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
  /**
   * Assistant-only input helpers (2–3 chips). Display-only — never sent to the model.
   * Cleared after the user picks one or types a free reply.
   */
  options?: string[];
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
    /** Opening scope mismatch — fixed copy + refund offer. */
    scope_mismatch?: boolean;
    /** Unqualified-answer escalation locked composer (L4 / terminate_refund). */
    escalation_lock?: boolean;
    /** Client wipe countdown after terminate_refund (ms). */
    wipe_after_ms?: number;
    /** Escalation level 1–4 (legacy) or terminal marker. */
    unqualified_level?: number;
    /** terminate_refund: refund 1 PASS placeholder (true refund wired later). */
    refund_pass?: boolean;
    /** user_paused: progress kept, composer not locked. */
    session_paused?: boolean;
    /** Optional attachment preview on user message (not full bytes in IndexedDB long-term). */
    attachment_preview?: {
      name: string;
      kind: "image" | "document" | "pdf";
      mime?: string;
      data_url?: string;
    };
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
  /** 汇总段 generation failed — show retry (子步D UI). */
  synthesis_generation_failed?: boolean;
  /** Segment-2 success delivery bubble (relationship + directions). */
  segment2_analysis?: boolean;
  /** Call B bridge question bubble. */
  segment2_bridge_question?: boolean;
  /** Call B failed after A delivered — show regenerate-question button; input unlocked. */
  segment2_agenda_bridge_failed?: boolean;
  /** Segment-1 opening resends exhausted — show retry button. */
  understanding_generation_failed?: boolean;
  /** Reply option chips were consumed (pick or free-text); do not re-render. */
  options_consumed?: boolean;
  /** Snapshot of chips at consume time — pick detection after UI hide. */
  offered_options?: string[];
  /** Stage-1 dyad collect/skip gate pending on this assistant turn. */
  dyad_gate_pending?: boolean;
  /**
   * S9-R1 — user confirmation turn binding for topic applicability N/A writer.
   * Required on the confirmation_turn_id user message; ordinary chat must omit.
   */
  topic_applicability_confirm?: {
    rule_id: string;
    control_id: string;
    not_applicable: boolean;
    session_id: string;
    target_dir_id: string;
  };
  /**
   * Assistant offer for topic N/A confirm chips (production UI entry).
   * Decline/skip labels must not call the N/A writer.
   */
  topic_applicability_offer?: {
    rule_id: string;
    control_id: string;
    target_dir_id: string;
    confirm_label: string;
    decline_label?: string;
  };
  /** Phase 3 S3 — message marked as Opening Anchor (Contract §12.3). */
  is_opening_anchor?: boolean;
  /** Phase 3 S3 — bound Opening Anchor id (≠ message client_id). */
  opening_anchor_id?: string;
  /** Collecting escalation — show refund entry (user-initiated). */
  kind?: "energy_matrix" | "paywall" | "joint_pass_gate" | "report" | "welcome" | "infra_busy" | "generation_empty" | "generation_incomplete" | "scope_mismatch" | "unsupported_language_notice";
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
  /** Canonical artifact: 6-section dual-layer markdown (A–F). */
  full_text: string;
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
  /**
   * Phase 3 S1 — Session CAS mirror of POJUSessionRecord.session_revision.
   * Bumps on every successful encrypted blob write. Init 0 via create/CAS only.
   */
  session_revision?: number;
  /**
   * Phase 3 S1 — bumps only when formal DC content changes.
   * Must mirror POJUSessionRecord.dc_write_revision.
   */
  dc_write_revision?: number;
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
  /**
   * In-flight Phase 4 delivery xhigh job id.
   * Persisted before poll so a closed tab can resume and hydrate when the user returns.
   */
  pending_delivery_job_id?: string | null;
  /**
   * In-flight synthesis (汇总段) xhigh job id.
   * Persisted while synthesis_status==="pending" so remount can resume poll.
   */
  pending_synthesis_job_id?: string | null;
  /**
   * In-flight Segment-2 Call A/B xhigh job id.
   * Persisted before poll so refresh / reopen can remount preparing + resume status poll.
   */
  pending_segment2_job_id?: string | null;
  /** Which Segment-2 leg `pending_segment2_job_id` belongs to. */
  pending_segment2_stage?: "report" | "agenda" | null;
  /** Agent state machine (Agent Implementation Part1 Step 4–6). */
  agent_v2?: import("./agent-state").POJUAgentState;
  /**
   * Step 8 困境分析缓存：key = `computeSituationContextFingerprint` 结果。
   * 语境变化 → 新 key → 可再次调用模型。
   */
  situation_analysis_by_fingerprint?: Record<string, SituationAnalysisCacheEntry>;
  /** 若从 `stored_profiles` 选人，写入 profile_id 以便挂载 Step 7 `base_analysis`。 */
  selected_stored_profile_id?: string | null;
  /**
   * Stage-1 二元收盘门状态。
   * none → 未问；offered → 已出示二选一；skipped → 不收对方盘；collected → 已收并算过短摘要。
   */
  dyad_offer_status?: import("./dyad-compat").DyadOfferStatus;
  /**
   * S1-D-2 / Case C: understanding confirm was advanced then held at opening while dyad chips show.
   * Cleared when dyad skip/collect resumes awaiting_understanding_confirm.
   */
  understanding_confirm_held_for_dyad?: boolean;
  /** 对方 stored_profiles id（collected 时）。 */
  partner_profile_id?: string | null;
  /** partner_bazi=absent|present；跳过时为 absent。 */
  partner_bazi?: import("./dyad-compat").PartnerBaziPresence;
  /** Match 本地矩阵压缩块；禁止灌满合盘报告。 */
  dyad_compat_summary?: import("./dyad-compat").DyadCompatSummary | null;
  /** Stage-1 锁盘后：solo | dyad（下游提示词/喂料路由）。 */
  pivot_chart_path?: import("./pivot-chart-path").PivotChartPath | null;
  /** 路径锁定时间 ISO。 */
  charts_locked_at?: string | null;
  /** Dyad 路径：完整 ResonanceMatrix 闭集包（Stage2+ / 交付）。 */
  dyad_matrix_pack?: import("./dyad-matrix-pack").DyadMatrixPack | null;
  /** Duo joint decision id (server). When set, skip partner collect chips; question is shared. */
  joint_decision_id?: string | null;
  /** True when this session was seeded from a joint decision accept. */
  joint_decision?: boolean;
  /** Idempotent pass_usage ref already charged at joint accept (`joint:{id}:a|b`). */
  joint_pass_ref?: string | null;
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
  /**
   * HTML-first deliverables (template fill). Written on gen; backfilled on open.
   * Prefer this over rebuilding interactive HTML on every download/view.
   */
  deliverable_html?: {
    baseline?: string;
    delivery?: string;
    reminders?: string;
    locale?: string;
    template_version?: string;
  };
  /** OpenRouter supplier pinned after first successful chat turn (prefix cache). */
  locked_provider?: string;
  /** 会话首条有效用户消息确定的输出语言；锁定后整段会话不变（语言一致性 + 系统提示词 byte 恒定 → 缓存命中）。 */
  locked_output_locale?: "en" | "es" | "zh" | "fr";
  /**
   * Formal Decision Context (Eastern OS Stage1-3). Sole authority for facts/dirs/hypotheses.
   * agent_v2 dilemma/direction/breakthrough_core remain temporary buffers only.
   * Phase 2: wired through session-manager C1 persist; Gate/Opening/CallA/B/Collecting still later.
   */
  decision_context?: import("./decision-context").DecisionContext | null;
  /** Append-only version history for the same context_id (H1 versioning). */
  decision_context_versions?: import("./decision-context").DecisionContext[];
  /**
   * Durable DC persist idempotency keys (C1). Survives reload inside the encrypted session blob.
   * Process-local registry is hydrated from this on load/restore.
   */
  decision_context_idempotency_keys?: string[];
  /**
   * S5 — binding pinned when a delivery job was created for a frozen DC.
   * Survives later V2 supplements so old jobs/reports are not retargeted.
   */
  last_delivery_context_binding?: import("./decision-context").DecisionContextBinding | null;
  /**
   * Phase 3 S2 — async Generation TaskContext rows (Contract §6).
   * Hydrate to [] on create/load when absent.
   */
  generation_task_contexts?: import("./generation").GenerationTaskContext[];
  /**
   * Phase 3 S2 — completed-only Generation Registry (Contract §5.1).
   */
  generation_registry?: import("./generation").GenerationRegistryEntry[];
  /**
   * Phase 3 S2 — Generation Operation Bindings by idempotency_key (Contract §5.2).
   */
  generation_operation_bindings?: import("./generation").GenerationOperationBinding[];
  /**
   * Phase 3 S3 — formal ControlPlane authority (Contract §10).
   * agent_v2 may mirror FROM this; never overwrite this from agent_v2.
   */
  control_plane?: import("./decision-context/control-plane").Phase3ControlPlane;
  /**
   * Phase 3 S3 — append-only Fact/Constraint Confirmation Events (Contract §11).
   */
  confirmation_events?: import("./decision-context/confirmation-event").ConfirmationEvent[];
  /**
   * Intake 2.0 — persisted user N/A declaration actions (not E1/E2).
   * Required to authorize ExplicitNaClassification.
   * Written by declareDirNotApplicable (CAS), not by model.
   */
  na_declaration_actions?: import("./decision-context/na-declaration").UserNaDeclarationAction[];
  /**
   * Intake 2.0 — authoritative Topic Applicability evaluation rows.
   * Topic N/A validation resolves evaluation.eval_id against this store.
   */
  topic_applicability_evals?: import("./decision-context/topic-eval-authority").AuthoritativeTopicEvalRecord[];
  /**
   * Live Topic Applicability catalog version for authority matching.
   */
  topic_catalog_version?: string | null;
  /**
   * Intake 2.0 — last production ask plan from selectNextIntakeAskForSession.
   */
  intake_ask_plan?: import("./decision-context/production-intake-ask").IntakeAskPlanSnapshot | null;
  /**
   * M1 — Decision Blueprint seed (investigation directions / budget / scope).
   * Not a live DIR store; live state remains on decision_context.dirs.
   */
  decision_blueprint?: import("./decision-intake/types").DecisionBlueprint | null;
  /**
   * M1 — derived Understanding State (NOT a second fact SoT).
   */
  decision_understanding?: import("./decision-intake/types").UnderstandingState | null;
  /**
   * M1 — authorized Adaptive Question Plan that drives the next sent question.
   */
  adaptive_ask_plan?: import("./decision-intake/types").AdaptiveQuestionPlan | null;
  /**
   * Phase 3 S3 — Opening Anchor store (Contract §12). Never delete cleared anchors.
   */
  opening_anchors?: import("./decision-context/opening-anchor").OpeningAnchor[];
  /**
   * Phase 3 S3 — Opening Gate confirm history append-only (Contract §12).
   */
  opening_confirm_history?: import("./decision-context/opening-anchor").OpeningConfirmHistoryEntry[];
}
