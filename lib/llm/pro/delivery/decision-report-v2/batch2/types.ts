/**
 * Batch 2 — Inngest orchestration job record + event payloads.
 */

import type { BookJudgmentPack } from "@/lib/llm/pro/delivery/book-judgment/schema";
import type { DecisionContext } from "@/lib/poju/decision-context/types";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";
import type {
  ReportPage07ApplicabilityStatus,
  ReportPageId,
  ReportPageRuntimeState,
  ReportUpstreamOutputFingerprints,
} from "../orchestration/types";

export type ReportBatch2JobStatus =
  | "pending"
  | "orchestrating"
  | "running"
  | "completed"
  | "failed";

export type ReportBatch2JobInputs = {
  dc: DecisionContext;
  pack: BookJudgmentPack | null;
  chart_fact_pack?: string | null;
  ziwei_fact_pack?: ZiweiFactPack | null;
  report_id: string;
  bazi_available?: boolean;
  ziwei_available?: boolean;
  authorized_partner_profile?: boolean;
};

export type ReportBatch2PageOutputs = Partial<Record<ReportPageId, unknown>>;

export type InvocationLogEntry = {
  page_id: ReportPageId | null;
  event_name: string;
  worker_id: string;
  invocation_id: string;
  model_call_id: string | null;
  started_at: string;
  ended_at: string | null;
};

export type DispatchLogEntry = {
  at: string;
  event_name: string;
  page_id: ReportPageId | null;
  input_fingerprint?: string | null;
  upstream_output_fingerprints?: ReportUpstreamOutputFingerprints;
  detail?: string;
};

export type RepairPendingPayload = {
  page_id: ReportPageId;
  system: string;
  user: string;
  previous_raw: string;
  issues: unknown[];
  input_fingerprint: string;
  locale: string;
  validator_version: string;
  production_version: string;
  prompt_version: string;
};

export type ReportBatch2JobRecord = {
  report_id: string;
  generation_id: string;
  /** Batch3 fencing token; absent on legacy Batch2-only jobs. */
  generation_epoch?: number;
  locale: string;
  page_states: ReportPageRuntimeState[];
  page_outputs: ReportBatch2PageOutputs;
  repair_pending: Partial<Record<ReportPageId, RepairPendingPayload>>;
  inputs: ReportBatch2JobInputs;
  dispatch_log: DispatchLogEntry[];
  invocation_log: InvocationLogEntry[];
  status: ReportBatch2JobStatus;
  created_at: string;
  updated_at: string;
};

export type ReportBatch2OrchestrateEventData = {
  report_id: string;
  generation_id: string;
  locale: string;
  generation_epoch?: number;
};

export type ReportBatch2GenerateEventData = {
  report_id: string;
  generation_id: string;
  page_id: ReportPageId;
  locale: string;
  input_fingerprint: string;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  generation_epoch?: number;
};

export type ReportBatch2RepairEventData = {
  report_id: string;
  generation_id: string;
  page_id: ReportPageId;
  locale: string;
  input_fingerprint: string;
  generation_epoch?: number;
};

export type ReportBatch2ApplicabilityEventData = {
  report_id: string;
  generation_id: string;
  page_id: "07";
  locale: string;
  upstream_output_fingerprints: ReportUpstreamOutputFingerprints;
  generation_epoch?: number;
};

export type ReportBatch2RecoverEventData = {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  locale: string;
};

export type ReportBatch2WorkerResult =
  | { status: "completed" | "failed" | "skipped" | "queued" }
  | { status: "needs_repair" }
  | { status: "deferred"; code: string; detail: string }
  | { status: "failed"; code: string; detail: string };

export type ReportBatch2ApplicabilityResult =
  | {
      status: "applicable";
      applicability_status: ReportPage07ApplicabilityStatus;
    }
  | {
      status: "not_applicable" | "insufficient_information";
      applicability_status: ReportPage07ApplicabilityStatus;
      outcome: ReportPageRuntimeState["outcome"];
    }
  | { status: "skipped" }
  | { status: "failed"; code: string; detail: string };

export function reportBatch2JobKey(report_id: string, generation_id: string): string {
  return `${report_id.trim()}:${generation_id.trim()}`;
}