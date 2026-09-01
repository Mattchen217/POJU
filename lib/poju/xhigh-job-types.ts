import type { LLMCallDebug } from "@/lib/llm/llm-debug";
import type { BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import type { AgendaItem } from "@/lib/poju/investigation-agenda";

/** POJU async jobs — segment2 Call A / Call B + synthesis + final_delivery. */
export type PojuXhighJobPhase =
  | "segment2_breakthrough_core"
  | "segment2_agenda_bridge"
  | "synthesis"
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

/** Call B input — segment1靶心 + Call A JSON (no full chart dump). */
export type Segment2AgendaJobInput = {
  session_id: string;
  locale: string;
  original_question: string;
  /** Collecting category hint for dual-party / binary agenda coverage. */
  question_category?: string | null;
  /** Call A output — multi-dim + skeleton for agenda + bridge question. */
  breakthrough_core: BreakthroughCore;
  /** Formatted 第1段理解门 (问题/情况/期望); optional for older jobs. */
  segment1_understanding?: string;
};

/** Phase 4 delivery book — multi-task pipeline input (stored so after() can finish after client leaves). */
export type FinalDeliveryJobInput = {
  kind: "final_delivery";
  session_id: string;
  locale: string;
  agent_v2: POJUAgentState;
  breakthrough_core: BreakthroughCore | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  base_analysis: unknown;
  delivery_mode: "full" | "degraded";
  regenerate?: boolean;
};

/** 汇总段(第4段)输入:多维真算 + 收集现实 → 收敛。 */
export type SynthesisJobInput = {
  kind: "synthesis";
  /** 第2段多维真算结果。 */
  multi_dimension_reckoning: import("@/lib/poju/agent-state").DimensionReckoning[];
  /** 收敛要直面的目标。 */
  desired_outcome: string;
  original_question: string;
  question_category: string;
  /** 第3段收集到的现实料。 */
  covered_agenda: Array<{ label: string; answer?: string }>;
  /** 命盘 inventory(收敛仍要真算依据)。 */
  structured_inventory: string;
  /** 供收敛自检的报告蓝图页(可选)。 */
  report_pages?: Array<{ id: string; title: string; purpose: string }>;
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

export type FinalDeliveryJobResult = {
  kind: "final_delivery";
  full_text: string;
  actions: Array<Record<string, unknown>>;
  model: string;
  tokens_used: number;
  llm_debug?: LLMCallDebug;
  timings?: Record<string, number | undefined>;
};

/** 汇总段结果:收敛主辅 + 行动骨架。 */
export type SynthesisJobResult = {
  kind: "synthesis";
  primary_path: import("@/lib/poju/agent-state").ModernActionFrame;
  backup_path: import("@/lib/poju/agent-state").ModernActionFrame;
  action_plan: {
    primary?: string;
    backup?: string;
  };
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
  | "agenda_anchor_failed"
  /** Segment transport exhausted — user may Continue from checkpoint. */
  | "interrupted"
  /** Redeploy invalidated this job — regenerate to start a new chain. */
  | "superseded_by_deploy";

export interface PojuXhighJob {
  job_id: string;
  phase: PojuXhighJobPhase;
  session_id: string;
  locale: string;
  status: PojuXhighJobStatus;
  /** Streamed LLM JSON body (progress + final parse source). */
  accumulated_content: string;
  /** Phase-4 pipeline progress — which stage is running / last finished. */
  current_stage?: string;
  /**
   * Deploy generation stamped at create (`VERCEL_DEPLOYMENT_ID` / …).
   * Continue/status refuse LLM when this ≠ current deploy (redeploy kill-switch).
   */
  deploy_generation?: string;
  input: Segment2JobInput | Segment2AgendaJobInput | SynthesisJobInput | FinalDeliveryJobInput;
  result?: Segment2JobResult | SynthesisJobResult | FinalDeliveryJobResult;
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
        : phase === "synthesis"
          ? "syn"
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

export function isFinalDeliveryJobInput(
  input: PojuXhighJob["input"],
): input is FinalDeliveryJobInput {
  return (
    Boolean(input) &&
    typeof input === "object" &&
    "kind" in input &&
    (input as { kind?: string }).kind === "final_delivery"
  );
}

export function isSynthesisInput(input: unknown): input is SynthesisJobInput {
  return (
    !!input &&
    typeof input === "object" &&
    (input as { kind?: string }).kind === "synthesis"
  );
}

export function isFinalDeliveryJobResult(
  result: PojuXhighJob["result"],
): result is FinalDeliveryJobResult {
  return (
    Boolean(result) &&
    typeof result === "object" &&
    "kind" in result &&
    (result as { kind?: string }).kind === "final_delivery" &&
    typeof (result as FinalDeliveryJobResult).full_text === "string"
  );
}

export function isSynthesisJobResult(
  result: PojuXhighJob["result"],
): result is SynthesisJobResult {
  return (
    Boolean(result) &&
    typeof result === "object" &&
    "kind" in result &&
    (result as { kind?: string }).kind === "synthesis" &&
    typeof (result as SynthesisJobResult).primary_path === "object" &&
    typeof (result as SynthesisJobResult).backup_path === "object"
  );
}

export function isSegment2ReportInput(
  input: PojuXhighJob["input"],
): input is Segment2JobInput {
  return (
    "base_analysis" in input &&
    !isFinalDeliveryJobInput(input) &&
    !isSynthesisInput(input)
  );
}

export function isSegment2AgendaInput(
  input: PojuXhighJob["input"],
): input is Segment2AgendaJobInput {
  return (
    "breakthrough_core" in input &&
    !("base_analysis" in input) &&
    !isFinalDeliveryJobInput(input) &&
    !isSynthesisInput(input)
  );
}

export function isSegment2JobResult(
  result: PojuXhighJob["result"],
): result is Segment2JobResult {
  if (
    !result ||
    typeof result !== "object" ||
    isFinalDeliveryJobResult(result) ||
    isSynthesisJobResult(result)
  ) {
    return false;
  }
  const r = result as Segment2JobResult;
  // Call A always has breakthrough_core; Call B may emphasize agenda + first_question
  // with core mirrored — accept either shape so status never drops a completed job.
  if (r.breakthrough_core != null && typeof r.breakthrough_core === "object") return true;
  if (typeof r.first_question === "string" && r.first_question.trim()) return true;
  if (Array.isArray(r.investigation_agenda) && r.investigation_agenda.length > 0) return true;
  return false;
}
