import type { AgentPhase, POJUAgentState } from "@/lib/poju/agent-state";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/** Input for phase-specific LLM modules (Step 10+). */
export interface PhaseLLMInput {
  session: POJUSessionState;
  profile: UserProfile | null;
  locale: string;
  user_message: string;
  agent_state?: POJUAgentState | null;
}

export interface PhaseLLMResult {
  response: string;
  suggested_phase: AgentPhase | null;
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
}

export interface SanitizerStateSlice {
  original_question: string;
  selected_profile_id: string | null;
  profile_skipped: boolean;
}

export function sanitizerStateFromSession(session: POJUSessionState): SanitizerStateSlice {
  return {
    original_question: session.original_question,
    selected_profile_id:
      session.selected_stored_profile_id ??
      session.agent_v2?.selected_profile_id ??
      null,
    profile_skipped: session.profile_skipped,
  };
}
