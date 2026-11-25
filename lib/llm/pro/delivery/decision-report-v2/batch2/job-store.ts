/**
 * Batch2 job store — durableKv() is the only production authority.
 */

import { durableKv, KV_TTL } from "@/lib/kv/client";
import { isRemoteKvConfigured } from "@/lib/kv/memory-kv";
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

export type JobStoreFailCode =
  | "kv_unavailable"
  | "kv_read_failed"
  | "kv_write_failed"
  | "job_not_found";

export type JobStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: JobStoreFailCode; detail: string };

/** Process-local cache — tests only; cleared before registered Inngest invokes. */
const testMemoryOverlay = new Map<string, ReportBatch2JobRecord>();
const trackedKvKeys = new Set<string>();

function kvStorageKey(report_id: string, generation_id: string): string {
  return `report-batch2:${report_id.trim()}:${generation_id.trim()}`;
}

export function isReportBatch2SharedStoreAvailable(): boolean {
  if (isRemoteKvConfigured()) return true;
  if (process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE === "1") return true;
  return false;
}

function memoryOverlayAllowed(): boolean {
  return process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE === "1";
}

export function clearBatch2JobMemoryOverlay(
  report_id: string,
  generation_id: string,
): void {
  testMemoryOverlay.delete(reportBatch2JobKey(report_id, generation_id));
}

function touch(job: ReportBatch2JobRecord): ReportBatch2JobRecord {
  job.updated_at = new Date().toISOString();
  return job;
}

function storeUnavailable(): JobStoreResult<never> {
  return {
    ok: false,
    code: "kv_unavailable",
    detail:
      "Batch2 shared KV store is not configured (Upstash/KV env or REPORT_BATCH2_ALLOW_MEMORY_STORE=1 for tests)",
  };
}

async function kvGetJob(
  report_id: string,
  generation_id: string,
): Promise<JobStoreResult<ReportBatch2JobRecord | null>> {
  if (!isReportBatch2SharedStoreAvailable()) return storeUnavailable();
  try {
    const raw = await durableKv().get<ReportBatch2JobRecord>(
      kvStorageKey(report_id, generation_id),
    );
    return { ok: true, value: raw ?? null };
  } catch (err) {
    return {
      ok: false,
      code: "kv_read_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function kvSetJob(
  job: ReportBatch2JobRecord,
): Promise<JobStoreResult<void>> {
  if (!isReportBatch2SharedStoreAvailable()) return storeUnavailable();
  try {
    const key = kvStorageKey(job.report_id, job.generation_id);
    trackedKvKeys.add(key);
    await durableKv().set(key, job, { ex: KV_TTL.REPORT_BATCH2_JOB });
    if (memoryOverlayAllowed()) {
      testMemoryOverlay.set(
        reportBatch2JobKey(job.report_id, job.generation_id),
        structuredClone(job),
      );
    }
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function loadJob(
  report_id: string,
  generation_id: string,
): Promise<JobStoreResult<ReportBatch2JobRecord | null>> {
  return kvGetJob(report_id, generation_id);
}

export async function saveJob(
  job: ReportBatch2JobRecord,
): Promise<JobStoreResult<void>> {
  touch(job);
  return kvSetJob(job);
}

export async function createJobAndPersist(input: {
  report_id: string;
  generation_id: string;
  locale: string;
  inputs: ReportBatch2JobInputs;
}): Promise<JobStoreResult<ReportBatch2JobRecord>> {
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
  const saved = await saveJob(job);
  if (!saved.ok) return saved;
  return { ok: true, value: job };
}

export async function updatePageStateAndPersist(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  patch: Partial<ReportPageRuntimeState>,
): Promise<JobStoreResult<void>> {
  const idx = job.page_states.findIndex((s) => s.page_id === page_id);
  if (idx < 0) return { ok: true, value: undefined };
  job.page_states[idx] = { ...job.page_states[idx], ...patch, page_id };
  return saveJob(job);
}

export async function setPageOutputAndPersist(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  schema: unknown,
  output_fingerprint: string,
): Promise<JobStoreResult<void>> {
  job.page_outputs[page_id] = schema;
  const idx = job.page_states.findIndex((s) => s.page_id === page_id);
  if (idx >= 0) {
    job.page_states[idx] = {
      ...job.page_states[idx],
      page_id,
      output_fingerprint,
      input_fingerprint: job.page_states[idx]?.input_fingerprint,
    };
  }
  return saveJob(job);
}

export async function setRepairPendingAndPersist(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  payload: RepairPendingPayload,
): Promise<JobStoreResult<void>> {
  job.repair_pending[page_id] = payload;
  return saveJob(job);
}

export async function clearRepairPendingAndPersist(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
): Promise<JobStoreResult<void>> {
  delete job.repair_pending[page_id];
  return saveJob(job);
}

export async function appendDispatchLogAndPersist(
  job: ReportBatch2JobRecord,
  entry: DispatchLogEntry,
): Promise<JobStoreResult<void>> {
  job.dispatch_log.push(entry);
  return saveJob(job);
}

export async function appendInvocationLogAndPersist(
  job: ReportBatch2JobRecord,
  entry: InvocationLogEntry,
): Promise<JobStoreResult<void>> {
  job.invocation_log.push(entry);
  return saveJob(job);
}

/** @deprecated Use createJobAndPersist — kept for tests that seed jobs inline. */
export async function createJob(input: {
  report_id: string;
  generation_id: string;
  locale: string;
  inputs: ReportBatch2JobInputs;
  persist_kv?: boolean;
}): Promise<JobStoreResult<ReportBatch2JobRecord>> {
  void input.persist_kv;
  return createJobAndPersist(input);
}

/** Test helper: load job or throw. */
export async function getJob(
  report_id: string,
  generation_id: string,
): Promise<ReportBatch2JobRecord | null> {
  const loaded = await loadJob(report_id, generation_id);
  if (!loaded.ok) return null;
  return loaded.value;
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

export async function resetBatch2JobStoreForTests(): Promise<void> {
  testMemoryOverlay.clear();
  const keys = [...trackedKvKeys];
  trackedKvKeys.clear();
  await Promise.all(keys.map((k) => durableKv().del(k).catch(() => undefined)));
}

export { reportBatch2JobKey } from "./types";