import type { POJUActionRecommendationsData } from "@/lib/archive/archive-service";
import type { AgentPhase, POJUAgentState } from "@/lib/poju/agent-state";
import type { POJUSessionState, PojuV4ActionRequested, ToolSuggestionPayload } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/** Input for phase-specific LLM modules (Step 10+). */
export interface PhaseLLMInput {
  session: POJUSessionState;
  profile: UserProfile | null;
  /** Step 7 cached analysis — sent from browser; server cannot read IndexedDB. */
  base_analysis?: unknown | null;
  locale: string;
  user_message: string;
  agent_state?: POJUAgentState | null;
  /** Completed / skipped actions from IndexedDB archive (client → API for tracking). */
  archive_data?: POJUActionRecommendationsData | null;
  /** Step 5 — pending tool result context appended to system prompt once. */
  tool_injection_context?: string | null;
  /** Live UI hooks while OpenRouter streams reasoning + JSON content. */
  stream_hooks?: import("@/lib/llm/phases/phase-transport").PhaseStreamHooks;
  signal?: AbortSignal;
  /** Inject pullback response structure when user asks for delivery too early. */
  collecting_pullback?: boolean;
  /** Critical agenda labels still uncovered — prompt tail only. */
  uncovered_critical_labels?: string[];
  /** Precomputed collecting escalation tier for this turn. */
  collecting_escalation_level?: import("@/lib/poju/collection-progress").CollectingEscalationLevel;
}

export interface PhaseLLMResult {
  response: string;
  suggested_phase: AgentPhase | null;
  /** When the model wants the birth form UI, set together with an explanatory `response`. */
  action_requested?: PojuV4ActionRequested | null;
  context_updates: Record<string, unknown> | null;
  question_category: string | null;
  current_summary: unknown | null;
  main_delivery_data: unknown | null;
  actions: unknown[];
  tokens_used: number;
  total_cost: number;
  call_count: number;
  model?: string;
  /** OpenRouter reasoning + optional structured thought, for UI "Thinking process". */
  thinking_process?: string;
  topic_drift_signal?: "none" | "edge" | "off_topic";
  drift_reason?: string | null;
  should_show_new_session_button?: boolean;
  tool_suggestion?: ToolSuggestionPayload | null;
  start_new_cycle?: boolean;
  new_cycle_question?: string | null;
  /** Collecting phase progress signal (Step 1). */
  collection_progress?: "advancing" | "stalled" | "resistant" | null;
  /** Stop-loss binary choice offer (Step 3). */
  stall_offer?: boolean;
  /** First collecting turn only — persisted once. */
  investigation_agenda?: import("@/lib/poju/investigation-agenda").AgendaItem[] | null;
  /** Opening conversion — one-line dilemma summary. */
  problem_summary?: string | null;
  /** Collecting escalation — show refund entry (user-initiated only). */
  suggest_refund?: boolean;
  /** Opening conversion envelope parse failed — orphan dialogue suppressed; core may backfill. */
  conversion_envelope_failed?: boolean;
  /** OpenRouter upstream provider that served this turn (for session lock). */
  served_provider?: string | null;
  breakthrough_core?: import("@/lib/poju/agent-state").BreakthroughCore | null;
  breakthrough_core_updates?: Partial<import("@/lib/poju/agent-state").BreakthroughCore> | null;
  core_dilemma?: import("@/lib/poju/agent-state").CoreDilemma | null;
  desired_direction?: import("@/lib/poju/agent-state").DesiredDirection | null;
  understanding?: { sufficient: boolean; missing: string } | null;
  understanding_sufficient?: boolean;
  /** Opening transport resends exhausted — UI shows retry, not fallback copy. */
  understanding_generation_failed?: boolean;
  /** Opening scope gate. */
  scope_signal?: import("@/lib/poju/scope-mismatch").ScopeSignal;
  /** Unlock composer attachments after a non-out-of-scope opening turn. */
  attachments_unlocked?: boolean;
  agenda_updates?: { completed_in_this_turn?: string[] };
  /** Opening/collecting — clear (incl. clear refusal) vs vague/zero-help. */
  reply_quality?: "clear" | "vague";
  /** 单问题小状态机放行准绳。 */
  question_status?: "satisfied" | "retry" | "escalate" | "terminal";
  /** 终局/暂停；terminate_refund 仅配 terminal。 */
  session_action?: "terminate_refund" | "user_paused" | null;
  /** Opening/collecting reply chips (2–3); display-only, stripped from model history. */
  options?: string[];
  user_confirms_delivery?: boolean;
  confirmation_signal?: "confirmed" | "wants_to_add" | "unclear";
  /** Tracking phase — patch delivered action status from user progress reports. */
  action_status_updates?: import("@/lib/poju/action-status-updates").ActionStatusPatch[];
  /** Debug panel — OpenRouter call metrics for this turn. */
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
}

