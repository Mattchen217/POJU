/**
 * Batch 3 — fencing, idempotency, invalidation, recovery types.
 */

import type {
  ReportPageId,
  ReportUpstreamOutputFingerprints,
} from "../orchestration/types";

export type GenerationStatus =
  | "pending"
  | "active"
  | "completed"
  | "failed"
  | "superseded"
  | "cancelled";

export type GenerationRecord = {
  report_id: string;
  generation_id: string;
  /** Monotonic fencing token — never compare generations by UUID alone. */
  generation_epoch: number;
  status: GenerationStatus;
  locale: string;
  created_at: string;
  updated_at: string;
  superseded_at?: string | null;
  superseded_by?: string | null;
};

export type ActiveGenerationPointer = {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  switched_at: string;
};

export type TaskType = "generate" | "repair" | "applicability";

export type TaskStatus =
  | "queued"
  | "running"
  | "repair_pending"
  | "completed"
  | "failed"
  | "stale"
  | "superseded";

export type TaskRecord = {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  task_type: TaskType;
  task_key: string;
  status: TaskStatus;
  attempt_id: string | null;
  lease_expires_at: string | null;
  worker_id: string | null;
  /** Page fence validity_rev bound at claim — commit must match. */
  validity_rev: number;
  input_fingerprint: string;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  page_contract_version: string;
  prompt_version: string;
  validator_version: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  failure_detail?: string | null;
};

/** Authority gate for page validity vs late commits / invalidation. */
export type PageFence = {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  /** Monotonic; invalidation increments; commit requires exact match. */
  validity_rev: number;
  status: "open" | "committed" | "stale";
  attempt_id: string | null;
  task_key: string | null;
  input_fingerprint: string | null;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints | null;
  output_fingerprint: string | null;
  updated_at: string;
};

export type PageProvenance = {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  input_fingerprint: string;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  page_contract_version: string;
  prompt_version: string;
  validator_version: string;
  output_fingerprint: string;
  attempt_id: string;
  task_key: string;
  validity_rev: number;
  completed_at: string;
  stale: boolean;
  stale_reason?: string | null;
};

export type DispatchIntentStatus = "pending" | "sent" | "acked" | "failed";

export type DispatchIntent = {
  intent_id: string;
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  event_name: string;
  page_id: ReportPageId | null;
  task_key: string | null;
  attempt_id: string | null;
  input_fingerprint: string | null;
  payload: Record<string, unknown>;
  status: DispatchIntentStatus;
  created_at: string;
  sent_at?: string | null;
  acked_at?: string | null;
  last_error?: string | null;
};

export type Batch3FailCode =
  | "success"
  | "conflict"
  | "stale_generation"
  | "stale_attempt"
  | "already_completed"
  | "already_claimed"
  | "input_mismatch"
  | "deps_unmet"
  | "kv_unavailable"
  | "kv_read_failed"
  | "kv_write_failed"
  | "pointer_write_failed"
  | "not_found"
  | "generation_terminal"
  | "stale_page"
  | "limit_reached"
  | "job_missing";

export type Batch3Result<T> =
  | { ok: true; value: T }
  | { ok: false; code: Exclude<Batch3FailCode, "success">; detail: string };

export const DEFAULT_TASK_LEASE_MS = 280_000;
export const DEFAULT_RECOVERY_LIMIT = 20;
