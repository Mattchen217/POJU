/**
 * Delivery Lab · Stage1–3 full pipeline (chat + segment2 + synthesis → seed delivery).
 * Ops-only mirror; does not share browser IndexedDB sessions.
 */

import type { LabCallTrace } from "@/lib/llm/pro/delivery/lab/call-trace";
import type { POJUSessionState } from "@/lib/poju/types";

export type LabPipelineMode = "delivery_only" | "full_pipeline";

export type LabPipelineCursor =
  | "opening"
  | "awaiting_understanding"
  | "segment2"
  | "collecting"
  | "awaiting_confirmation"
  | "synthesis"
  | "ready_for_delivery";

export type LabPipelineTurnKind =
  | "chat"
  | "segment2_a"
  | "segment2_b"
  | "synthesis"
  | "gate";

export type LabPipelineAttempt = {
  attempt_number: number;
  timestamp: string;
  duration_ms: number;
  call_trace?: LabCallTrace;
  input_payload?: unknown;
  raw_model_output?: unknown;
  error?: string;
};

export type LabPipelineTurn = {
  turn_id: string;
  phase: string;
  kind: LabPipelineTurnKind;
  attempts: LabPipelineAttempt[];
  /** Gate / chip action summary (confirm, dyad_skip, …). */
  gate?: { action: string; detail?: string };
  /** User text that produced this turn (for rerun). */
  user_input?: string;
};

/** Fields mirrored on DeliveryLabSession for full_pipeline mode. */
export type LabPipelineFields = {
  mode?: LabPipelineMode;
  /** Ops-isolated POJU session (messages + agent_v2 + path locks). */
  chat_session?: POJUSessionState;
  pipeline_turns?: LabPipelineTurn[];
  pipeline_cursor?: LabPipelineCursor;
  /** True after synthesis seeds LabSource — unlocks delivery Run/Approve. */
  pipeline_delivery_unlocked?: boolean;
  /** Pending xhigh job ids for ops poll UI. */
  pipeline_pending_job?: {
    job_id: string;
    stage: "segment2_a" | "segment2_b" | "synthesis";
  } | null;
};

export function emptyPipelineTurns(): LabPipelineTurn[] {
  return [];
}
