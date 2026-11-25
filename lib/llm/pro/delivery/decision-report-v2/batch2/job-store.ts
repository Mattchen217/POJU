/**
 * In-memory Batch2 job store (+ optional KV persistence).
 */

import { kv } from "@/lib/kv/client";
import { initialPendingPageStates } from "../orchestration";
import type { ReportPageId, ReportPageRuntimeState } from "../orchestration/types";
import type {
  DispatchLogEntry,
  InvocationLogEntry,
  RepairPendingPayload,
  ReportBatch2JobInputs,
  ReportBatch2JobRecord,
} from "./types";
import { reportBatch2JobKey } from "./types";

const memory = new Map<string, ReportBatch2JobRecord>();

function kvKey(report_id: string, generation_id: string): string {
  return `report-batch2:${report_id}:${generation_id}`;
}

function touch(job: ReportBatch2JobRecord): ReportBatch2JobRecord {
  job.updated_at = new Date().toISOString();
  return job;
}

export async function persistBatch2JobToKv(job: ReportBatch2JobRecord): Promise<void> {
  await kv.set(kvKey(job.report_id, job.generation_id), job);
}

export async function loadBatch2JobFromKv(
  report_id: string,
  generation_id: string,
): Promise<ReportBatch2JobRecord | null> {
  const raw = await kv.get<ReportBatch2JobRecord>(kvKey(report_id, generation_id));
  return raw ?? null;
}

export function createJob(input: {
  report_id: string;
  generation_id: string;
  locale: string;
  inputs: ReportBatch2JobInputs;
  persist_kv?: boolean;
}): ReportBatch2JobRecord {
  const now = new Date().toISOString();
  const job: ReportBatch2JobRecord = {
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    locale: input.locale.trim(),
    page_states: initialPendingPageStates(),
    page_outputs: {},
    repair_pending: {},
    inputs: input.inputs,
    dispatch_log: [],
    invocation_log: [],
    status: "pending",
    created_at: now,
    updated_at: now,
  };
  const key = reportBatch2JobKey(job.report_id, job.generation_id);
  memory.set(key, job);
  if (input.persist_kv) {
    void persistBatch2JobToKv(job);
  }
  return job;
}

export function getJob(
  report_id: string,
  generation_id: string,
): ReportBatch2JobRecord | null {
  return memory.get(reportBatch2JobKey(report_id, generation_id)) ?? null;
}

export async function getJobWithKvFallback(
  report_id: string,
  generation_id: string,
): Promise<ReportBatch2JobRecord | null> {
  const local = getJob(report_id, generation_id);
  if (local) return local;
  const remote = await loadBatch2JobFromKv(report_id, generation_id);
  if (remote) {
    memory.set(reportBatch2JobKey(report_id, generation_id), remote);
  }
  return remote;
}

export function saveJob(job: ReportBatch2JobRecord, opts?: { persist_kv?: boolean }): void {
  touch(job);
  memory.set(reportBatch2JobKey(job.report_id, job.generation_id), job);
  if (opts?.persist_kv) {
    void persistBatch2JobToKv(job);
  }
}

export function updatePageState(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  patch: Partial<ReportPageRuntimeState>,
): void {
  const idx = job.page_states.findIndex((s) => s.page_id === page_id);
  if (idx < 0) return;
  job.page_states[idx] = { ...job.page_states[idx], ...patch, page_id };
  touch(job);
}

export function setPageOutput(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  schema: unknown,
  output_fingerprint: string,
): void {
  job.page_outputs[page_id] = schema;
  updatePageState(job, page_id, {
    output_fingerprint,
    input_fingerprint: job.page_states.find((s) => s.page_id === page_id)
      ?.input_fingerprint,
  });
}

export function setRepairPending(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  payload: RepairPendingPayload,
): void {
  job.repair_pending[page_id] = payload;
  touch(job);
}

export function clearRepairPending(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
): void {
  delete job.repair_pending[page_id];
  touch(job);
}

export function appendDispatchLog(
  job: ReportBatch2JobRecord,
  entry: DispatchLogEntry,
): void {
  job.dispatch_log.push(entry);
  touch(job);
}

export function appendInvocationLog(
  job: ReportBatch2JobRecord,
  entry: InvocationLogEntry,
): void {
  job.invocation_log.push(entry);
  touch(job);
}

export function resetBatch2JobStoreForTests(): void {
  memory.clear();
}

// Re-export for job-store consumers that import key helper from types
export { reportBatch2JobKey } from "./types";