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
}

