import type { LLMCallDebug } from "@/lib/llm/llm-debug";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";

/** POJU xhigh async jobs — segment2 + final_delivery share this store. */
export type PojuXhighJobPhase = "segment2_breakthrough_core" | "final_delivery";

export type PojuXhighJobStatus = "pending" | "running" | "completed" | "failed";

export type Segment2JobInput = {
  session_id: string;
  original_question: string;
  locale: string;
  profile_id: string | null;
  agent_v2: POJUAgentState | null;
  base_analysis: unknown;
};

export type Segment2JobResult = {
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
};

export type PojuXhighJobFailureReason =
  | "truncated"
  | "parse_failed"
  | "provider_busy"
  | "transport_error"
  | "completed_without_result"
  | "completed_without_core"
  | "poll_timeout"
  | "stale_running"
  | "job_abandoned";

export interface PojuXhighJob {
  job_id: string;
  phase: PojuXhighJobPhase;
  session_id: string;
  locale: string;
  status: PojuXhighJobStatus;
  /** Streamed LLM JSON body (progress + final parse source). */
  accumulated_content: string;
  input: Segment2JobInput;
  result?: Segment2JobResult;
  llm_debug?: LLMCallDebug;
  model?: string;
  tokens_used?: number;
  error?: string;
  error_detail?: string;
  retryable?: boolean;
  failure_reason?: PojuXhighJobFailureReason;
  created_at: number;
  updated_at: number;
  completed_at?: number;
}

export function generateXhighJobId(phase: PojuXhighJobPhase, session_id: string): string {
  const slug = session_id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
  const prefix = phase === "segment2_breakthrough_core" ? "s2" : "fd";
  return `${prefix}_${slug}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function xhighJobKey(job_id: string): string {
  return `poju-xhigh:job:${job_id}`;
}

export function xhighSessionLockKey(phase: PojuXhighJobPhase, session_id: string): string {
  return `poju-xhigh:lock:${phase}:${session_id}`;
}

export function xhighSessionLatestKey(phase: PojuXhighJobPhase, session_id: string): string {
  return `poju-xhigh:latest:${phase}:${session_id}`;
}
