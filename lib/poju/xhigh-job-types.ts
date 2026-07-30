import type { LLMCallDebug } from "@/lib/llm/llm-debug";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";

/** POJU async jobs — segment2 Call A / Call B + final_delivery. */
export type PojuXhighJobPhase =
  | "segment2_breakthrough_core"
  | "segment2_agenda_bridge"
  | "final_delivery";

export type PojuXhighJobStatus = "pending" | "running" | "completed" | "failed";

/** Call A input — chart + understanding. */
export type Segment2JobInput = {
  session_id: string;
  original_question: string;
  locale: string;
  profile_id: string | null;
  agent_v2: POJUAgentState | null;
  base_analysis: unknown;
};

/** Call B input — A JSON is the sole factual source (no full chart dump). */
export type Segment2AgendaJobInput = {
  session_id: string;
  locale: string;
  original_question: string;
  /** Call A output — exclusive factual source for agenda + bridge question. */
  breakthrough_core: BreakthroughCore;
};

export type Segment2JobResult = {
  breakthrough_core: BreakthroughCore;
  /** Call A leaves this empty; Call B fills it. */
  investigation_agenda: AgendaItem[];
  /** Call B bridge question (also mirrored onto breakthrough_core.first_question). */
  first_question?: string;
  /** Reply chips for first_question (Call B only). */
  options?: string[];
};

export type PojuXhighJobFailureReason =
  | "truncated"
  | "parse_failed"
  | "provider_busy"
  | "transport_error"
  | "llm_timeout"
  | "completed_without_result"
  | "completed_without_core"
  | "poll_timeout"
  | "stale_running"
  | "job_abandoned"
  | "agenda_anchor_failed";

export interface PojuXhighJob {
  job_id: string;
  phase: PojuXhighJobPhase;
  session_id: string;
  locale: string;
  status: PojuXhighJobStatus;
  /** Streamed LLM JSON body (progress + final parse source). */
  accumulated_content: string;
  input: Segment2JobInput | Segment2AgendaJobInput;
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
  const prefix =
    phase === "segment2_breakthrough_core"
      ? "s2a"
      : phase === "segment2_agenda_bridge"
        ? "s2b"
        : "fd";
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

export function isSegment2ReportInput(
  input: PojuXhighJob["input"],
): input is Segment2JobInput {
  return "base_analysis" in input;
}

export function isSegment2AgendaInput(
  input: PojuXhighJob["input"],
): input is Segment2AgendaJobInput {
  return "breakthrough_core" in input && !("base_analysis" in input);
}
