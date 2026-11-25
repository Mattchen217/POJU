/**
 * Batch2 job store — durableKv() authority with per-page keys (no whole-job overwrite races).
 *
 * Layout:
 *   report-batch2:{rid}:{gid}:meta
 *   report-batch2:{rid}:{gid}:page:{page_id}
 *   report-batch2:{rid}:{gid}:dispatch   (list)
 *   report-batch2:{rid}:{gid}:invocation (list)
 */

import { durableKv, KV_TTL } from "@/lib/kv/client";
import { isRemoteKvConfigured } from "@/lib/kv/memory-kv";
import {
  initialPendingPageStates,
  REPORT_PAGE_IDS,
} from "../orchestration";
import type { ReportPageId, ReportPageRuntimeState } from "../orchestration/types";
import type {
  DispatchLogEntry,
  InvocationLogEntry,
  RepairPendingPayload,
  ReportBatch2JobInputs,
  ReportBatch2JobRecord,
  ReportBatch2JobStatus,
} from "./types";
import { reportBatch2JobKey } from "./types";

export type JobStoreFailCode =
  | "kv_unavailable"
  | "kv_read_failed"
  | "kv_write_failed"
  | "job_not_found"
  | "stale_page_write";

export type JobStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: JobStoreFailCode; detail: string };

type JobMeta = {
  report_id: string;
  generation_id: string;
  generation_epoch?: number;
  locale: string;
  inputs: ReportBatch2JobInputs;
  status: ReportBatch2JobStatus;
  created_at: string;
  updated_at: string;
};

export type PageBlob = {
  rev: number;
  state: ReportPageRuntimeState;
  output?: unknown;
  repair?: RepairPendingPayload | null;
  /**
   * Batch3 page-fence validity_rev bound to this blob.
   * Completed outputs with a lower rev must never overwrite a newer fence generation.
   */
  validity_rev?: number;
  /** Fingerprint recorded when blob was written under a committed fence. */
  authority_output_fingerprint?: string | null;
};

type JobDirty = {
  pages: Set<ReportPageId>;
  meta: boolean;
  pendingDispatch: DispatchLogEntry[];
  pendingInvocation: InvocationLogEntry[];
  /** rev observed at load (or last successful write) per page */
  pageRev: Map<ReportPageId, number>;
  /** Batch3 fence validity_rev to persist with the next page write */
  pageValidityRev: Map<ReportPageId, number>;
  pageAuthorityFp: Map<ReportPageId, string>;
};

const dirtyByJob = new WeakMap<object, JobDirty>();
const trackedKvKeys = new Set<string>();

const CAS_SET_LUA = `
local cur = redis.call("GET", KEYS[1])
local expected = ARGV[1]
if expected == "__ABSENT__" then
  if cur ~= false and cur ~= nil then return 0 end
else
  if cur == false or cur == nil then return 0 end
  if cur ~= expected then return 0 end
end
redis.call("SET", KEYS[1], ARGV[2], "EX", tonumber(ARGV[3]))
return 1
`;

function ttl(): number {
  return KV_TTL.REPORT_BATCH2_JOB;
}

function baseKey(report_id: string, generation_id: string): string {
  return `report-batch2:${report_id.trim()}:${generation_id.trim()}`;
}

function metaKey(report_id: string, generation_id: string): string {
  return `${baseKey(report_id, generation_id)}:meta`;
}

function pageKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return `${baseKey(report_id, generation_id)}:page:${page_id}`;
}

function dispatchKey(report_id: string, generation_id: string): string {
  return `${baseKey(report_id, generation_id)}:dispatch`;
}

function invocationKey(report_id: string, generation_id: string): string {
  return `${baseKey(report_id, generation_id)}:invocation`;
}

function trackKey(key: string): void {
  trackedKvKeys.add(key);
}

export function isReportBatch2SharedStoreAvailable(): boolean {
  if (isRemoteKvConfigured()) return true;
  if (process.env.REPORT_BATCH2_ALLOW_MEMORY_STORE === "1") return true;
  return false;
}

function storeUnavailable(): JobStoreResult<never> {
  return {
    ok: false,
    code: "kv_unavailable",
    detail:
      "Batch2 shared KV store is not configured (Upstash/KV env or REPORT_BATCH2_ALLOW_MEMORY_STORE=1 for tests)",
  };
}

function ensureDirty(job: ReportBatch2JobRecord): JobDirty {
  let d = dirtyByJob.get(job);
  if (!d) {
    d = {
      pages: new Set(),
      meta: false,
      pendingDispatch: [],
      pendingInvocation: [],
      pageRev: new Map(),
      pageValidityRev: new Map(),
      pageAuthorityFp: new Map(),
    };
    dirtyByJob.set(job, d);
  } else {
    if (!d.pageValidityRev) d.pageValidityRev = new Map();
    if (!d.pageAuthorityFp) d.pageAuthorityFp = new Map();
  }
  return d;
}

function touch(job: ReportBatch2JobRecord): void {
  job.updated_at = new Date().toISOString();
  ensureDirty(job).meta = true;
}

type KvCasStore = {
  get: <T>(key: string) => Promise<T | null>;
  set: (
    key: string,
    value: unknown,
    opts?: { ex?: number },
  ) => Promise<unknown>;
  compareAndSetExact?: (
    key: string,
    expectedJson: string | null,
    next: unknown,
    opts?: { ex?: number },
  ) => Promise<boolean>;
  eval?: (
    script: string,
    keys: string[],
    args: string[],
  ) => Promise<unknown>;
  rpush?: (key: string, ...values: unknown[]) => Promise<number>;
  lpush?: (key: string, ...values: unknown[]) => Promise<number>;
  lrange?: <T>(key: string, start: number, stop: number) => Promise<T[]>;
  expire?: (key: string, seconds: number) => Promise<number>;
  del: (...keys: string[]) => Promise<number>;
};

function kvStore(): KvCasStore {
  return durableKv() as unknown as KvCasStore;
}

async function casSet(
  key: string,
  expectedJson: string | null,
  next: unknown,
): Promise<boolean> {
  const store = kvStore();
  const ex = ttl();
  if (typeof store.compareAndSetExact === "function") {
    return store.compareAndSetExact(key, expectedJson, next, { ex });
  }
  if (typeof store.eval === "function") {
    const expectedArg = expectedJson === null ? "__ABSENT__" : expectedJson;
    const r = await store.eval(CAS_SET_LUA, [key], [
      expectedArg,
      JSON.stringify(next),
      String(ex),
    ]);
    return r === 1 || r === true;
  }
  throw new Error("Batch2 KV CAS unavailable (need compareAndSetExact or eval)");
}

async function listPush(key: string, value: unknown): Promise<void> {
  const store = kvStore();
  trackKey(key);
  if (typeof store.rpush === "function") {
    await store.rpush(key, value);
  } else if (typeof store.lpush === "function") {
    await store.lpush(key, value);
  } else {
    throw new Error("Batch2 KV list push unavailable");
  }
  if (typeof store.expire === "function") {
    await store.expire(key, ttl()).catch(() => undefined);
  }
}

async function listRange<T>(key: string): Promise<T[]> {
  const store = kvStore();
  if (typeof store.lrange === "function") {
    return store.lrange<T>(key, 0, -1);
  }
  return [];
}

function outcomeRank(outcome: string | undefined): number {
  switch (outcome) {
    case "completed":
    case "skipped_not_applicable":
    case "insufficient_information":
    case "failed":
    case "cancelled":
      return 100;
    case "repair_queued":
      return 70;
    case "validating":
      return 60;
    case "running":
      return 50;
    case "queued":
      return 40;
    case "pending":
    default:
      return 10;
  }
}

/**
 * Same-page guard for rev-mismatch (stale concurrent writer) only.
 * Matching-rev writes from the same load lineage may move outcome freely
 * (e.g. queued → pending after applicability).
 *
 * Batch3: never allow a lower validity_rev blob to overwrite a higher one —
 * that closes the invalidation vs late-completed race.
 */
function mayReplacePageStateOnConflict(
  current: PageBlob | undefined,
  next: ReportPageRuntimeState,
  nextValidityRev: number | undefined,
): boolean {
  if (!current) return true;
  if (current.state.page_id !== next.page_id) return false;
  const curFence = current.validity_rev ?? 0;
  const nextFence = nextValidityRev ?? 0;
  if (nextFence < curFence) return false;
  if (nextFence > curFence) return true;
  return outcomeRank(next.outcome) > outcomeRank(current.state.outcome);
}

export function clearBatch2JobMemoryOverlay(
  _report_id: string,
  _generation_id: string,
): void {
  // Split-key store has no process overlay authority; kept for call-site compatibility.
  void _report_id;
  void _generation_id;
}

function assembleJob(
  meta: JobMeta,
  pages: Map<ReportPageId, PageBlob>,
  dispatch_log: DispatchLogEntry[],
  invocation_log: InvocationLogEntry[],
): ReportBatch2JobRecord {
  const page_states: ReportPageRuntimeState[] = [];
  const page_outputs: ReportBatch2JobRecord["page_outputs"] = {};
  const repair_pending: ReportBatch2JobRecord["repair_pending"] = {};
  const dirty = {
    pages: new Set<ReportPageId>(),
    meta: false,
    pendingDispatch: [] as DispatchLogEntry[],
    pendingInvocation: [] as InvocationLogEntry[],
    pageRev: new Map<ReportPageId, number>(),
    pageValidityRev: new Map<ReportPageId, number>(),
    pageAuthorityFp: new Map<ReportPageId, string>(),
  };

  for (const page_id of REPORT_PAGE_IDS) {
    const blob = pages.get(page_id);
    if (blob) {
      page_states.push(blob.state);
      dirty.pageRev.set(page_id, blob.rev);
      if (typeof blob.validity_rev === "number") {
        dirty.pageValidityRev.set(page_id, blob.validity_rev);
      }
      if (blob.authority_output_fingerprint) {
        dirty.pageAuthorityFp.set(page_id, blob.authority_output_fingerprint);
      }
      if (blob.output !== undefined) {
        page_outputs[page_id] = blob.output;
      }
      if (blob.repair) {
        repair_pending[page_id] = blob.repair;
      }
    } else {
      page_states.push({
        page_id,
        outcome: "pending",
      });
      dirty.pageRev.set(page_id, 0);
    }
  }

  const job: ReportBatch2JobRecord = {
    report_id: meta.report_id,
    generation_id: meta.generation_id,
    generation_epoch: meta.generation_epoch,
    locale: meta.locale,
    page_states,
    page_outputs,
    repair_pending,
    inputs: meta.inputs,
    dispatch_log: [...dispatch_log],
    invocation_log: [...invocation_log],
    status: meta.status,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
  };
  dirtyByJob.set(job, dirty);
  return job;
}

/**
 * Load raw page blobs without Batch3 authority gating.
 * Production DAG / delivery must use loadJob (gated). Recovery may use this
 * to detect physical blob absence independently of demotions.
 */
export async function loadJobRawBlobs(
  report_id: string,
  generation_id: string,
): Promise<
  JobStoreResult<{
    meta: JobMeta;
    pages: Map<ReportPageId, PageBlob>;
    dispatch_log: DispatchLogEntry[];
    invocation_log: InvocationLogEntry[];
  } | null>
> {
  if (!isReportBatch2SharedStoreAvailable()) return storeUnavailable();
  try {
    const store = kvStore();
    const meta = await store.get<JobMeta>(metaKey(report_id, generation_id));
    if (!meta) return { ok: true, value: null };

    const pages = new Map<ReportPageId, PageBlob>();
    await Promise.all(
      REPORT_PAGE_IDS.map(async (page_id) => {
        const blob = await store.get<PageBlob>(
          pageKey(report_id, generation_id, page_id),
        );
        if (blob) pages.set(page_id, blob);
      }),
    );

    const dispatch_log = await listRange<DispatchLogEntry>(
      dispatchKey(report_id, generation_id),
    );
    const invocation_log = await listRange<InvocationLogEntry>(
      invocationKey(report_id, generation_id),
    );

    return {
      ok: true,
      value: { meta, pages, dispatch_log, invocation_log },
    };
  } catch (err) {
    return {
      ok: false,
      code: "kv_read_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Production job load — when generation_epoch is set (Batch3), every terminal
 * page blob must pass unified authority gating before entering page_outputs /
 * completed page_states. Authority unavailable fail-closes the whole load.
 */
export async function loadJob(
  report_id: string,
  generation_id: string,
): Promise<JobStoreResult<ReportBatch2JobRecord | null>> {
  const raw = await loadJobRawBlobs(report_id, generation_id);
  if (!raw.ok) return raw;
  if (!raw.value) return { ok: true, value: null };

  const { meta, pages, dispatch_log, invocation_log } = raw.value;
  let gatedPages = pages;

  if (typeof meta.generation_epoch === "number") {
    const { filterPagesThroughAuthority } = await import(
      "../batch3/authority-page-read"
    );
    const filtered = await filterPagesThroughAuthority({
      report_id,
      generation_id,
      generation_epoch: meta.generation_epoch,
      pages,
      page_ids: REPORT_PAGE_IDS,
    });
    if (!filtered.ok) {
      return {
        ok: false,
        code:
          filtered.code === "kv_unavailable"
            ? "kv_unavailable"
            : "kv_read_failed",
        detail: filtered.detail,
      };
    }
    gatedPages = filtered.value.pages;
  }

  return {
    ok: true,
    value: assembleJob(meta, gatedPages, dispatch_log, invocation_log),
  };
}

async function writePageBlob(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
  expectedRev: number,
  blob: Omit<PageBlob, "rev"> & { rev?: number },
): Promise<JobStoreResult<number>> {
  const key = pageKey(report_id, generation_id, page_id);
  trackKey(key);
  try {
    const store = kvStore();
    const current = await store.get<PageBlob>(key);
    if (current) {
      if (current.rev !== expectedRev) {
        // Stale concurrent writer: only accept when fence rev / outcome allow it.
        if (
          !mayReplacePageStateOnConflict(
            current,
            blob.state,
            blob.validity_rev,
          )
        ) {
          return {
            ok: false,
            code: "stale_page_write",
            detail: `page ${page_id} refuse stale write (stored rev=${current.rev} expected=${expectedRev} fence ${current.validity_rev ?? 0}→${blob.validity_rev ?? 0} outcome ${current.state.outcome}→${blob.state.outcome})`,
          };
        }
      } else if (
        (blob.validity_rev ?? 0) < (current.validity_rev ?? 0)
      ) {
        return {
          ok: false,
          code: "stale_page_write",
          detail: `page ${page_id} refuse lower validity_rev ${blob.validity_rev ?? 0} < ${current.validity_rev ?? 0}`,
        };
      }
      const next: PageBlob = {
        rev: current.rev + 1,
        state: blob.state,
        output: blob.output,
        repair: blob.repair ?? null,
        validity_rev: blob.validity_rev,
        authority_output_fingerprint: blob.authority_output_fingerprint ?? null,
      };
      const ok = await casSet(key, JSON.stringify(current), next);
      if (!ok) {
        return {
          ok: false,
          code: "kv_write_failed",
          detail: `page ${page_id} CAS failed`,
        };
      }
      return { ok: true, value: next.rev };
    }

    if (expectedRev !== 0) {
      return {
        ok: false,
        code: "stale_page_write",
        detail: `page ${page_id} missing but expected rev=${expectedRev}`,
      };
    }
    const next: PageBlob = {
      rev: 1,
      state: blob.state,
      output: blob.output,
      repair: blob.repair ?? null,
      validity_rev: blob.validity_rev,
      authority_output_fingerprint: blob.authority_output_fingerprint ?? null,
    };
    const ok = await casSet(key, null, next);
    if (!ok) {
      return {
        ok: false,
        code: "kv_write_failed",
        detail: `page ${page_id} create CAS failed`,
      };
    }
    return { ok: true, value: next.rev };
  } catch (err) {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function writeMeta(
  meta: JobMeta,
  expectedJson: string | null,
): Promise<JobStoreResult<void>> {
  const key = metaKey(meta.report_id, meta.generation_id);
  trackKey(key);
  try {
    const ok = await casSet(key, expectedJson, meta);
    if (!ok) {
      // Reload and merge status only (do not clobber with stale snapshot).
      const store = kvStore();
      const live = await store.get<JobMeta>(key);
      if (!live) {
        return {
          ok: false,
          code: "kv_write_failed",
          detail: "meta CAS failed and key missing",
        };
      }
      const merged: JobMeta = {
        ...live,
        status: meta.status,
        updated_at: meta.updated_at,
      };
      const ok2 = await casSet(key, JSON.stringify(live), merged);
      if (!ok2) {
        return {
          ok: false,
          code: "kv_write_failed",
          detail: "meta CAS retry failed",
        };
      }
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

/**
 * Persist only dirty pages / meta / pending log appends.
 * Never whole-job SET — parallel page workers cannot clobber each other.
 */
export async function saveJob(
  job: ReportBatch2JobRecord,
): Promise<JobStoreResult<void>> {
  if (!isReportBatch2SharedStoreAvailable()) return storeUnavailable();
  const dirty = ensureDirty(job);
  touch(job);

  try {
    for (const page_id of dirty.pages) {
      const state = job.page_states.find((s) => s.page_id === page_id);
      if (!state) continue;
      const expectedRev = dirty.pageRev.get(page_id) ?? 0;
      const written = await writePageBlob(
        job.report_id,
        job.generation_id,
        page_id,
        expectedRev,
        {
          state: { ...state },
          output: job.page_outputs[page_id],
          repair: job.repair_pending[page_id] ?? null,
          validity_rev: dirty.pageValidityRev.get(page_id),
          authority_output_fingerprint:
            dirty.pageAuthorityFp.get(page_id) ??
            state.output_fingerprint ??
            null,
        },
      );
      if (!written.ok) return written;
      dirty.pageRev.set(page_id, written.value);
    }

    for (const entry of dirty.pendingDispatch) {
      await listPush(dispatchKey(job.report_id, job.generation_id), entry);
      job.dispatch_log.push(entry);
    }
    for (const entry of dirty.pendingInvocation) {
      await listPush(invocationKey(job.report_id, job.generation_id), entry);
      job.invocation_log.push(entry);
    }
    dirty.pendingDispatch = [];
    dirty.pendingInvocation = [];

    if (dirty.meta || dirty.pages.size > 0) {
      const store = kvStore();
      const key = metaKey(job.report_id, job.generation_id);
      const live = await store.get<JobMeta>(key);
      const meta: JobMeta = {
        report_id: job.report_id,
        generation_id: job.generation_id,
        generation_epoch: job.generation_epoch ?? live?.generation_epoch,
        locale: job.locale,
        inputs: live?.inputs ?? job.inputs,
        status: job.status,
        created_at: live?.created_at ?? job.created_at,
        updated_at: job.updated_at,
      };
      const savedMeta = await writeMeta(
        meta,
        live ? JSON.stringify(live) : null,
      );
      if (!savedMeta.ok) return savedMeta;
    }

    dirty.pages.clear();
    dirty.meta = false;
    return { ok: true, value: undefined };
  } catch (err) {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Atomically update job status without rewriting page payloads.
 * Safe after workers may already have mutated pages.
 */
export async function updateJobStatus(
  report_id: string,
  generation_id: string,
  status: ReportBatch2JobStatus,
): Promise<JobStoreResult<void>> {
  if (!isReportBatch2SharedStoreAvailable()) return storeUnavailable();
  try {
    const key = metaKey(report_id, generation_id);
    const store = kvStore();
    const live = await store.get<JobMeta>(key);
    if (!live) {
      return { ok: false, code: "job_not_found", detail: "batch2 meta missing" };
    }
    const next: JobMeta = {
      ...live,
      status,
      updated_at: new Date().toISOString(),
    };
    const ok = await casSet(key, JSON.stringify(live), next);
    if (!ok) {
      return {
        ok: false,
        code: "kv_write_failed",
        detail: "status CAS conflict",
      };
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

export async function createJobAndPersist(input: {
  report_id: string;
  generation_id: string;
  locale: string;
  inputs: ReportBatch2JobInputs;
  status?: ReportBatch2JobStatus;
  generation_epoch?: number;
}): Promise<JobStoreResult<ReportBatch2JobRecord>> {
  if (!isReportBatch2SharedStoreAvailable()) return storeUnavailable();
  const now = new Date().toISOString();
  const report_id = input.report_id.trim();
  const generation_id = input.generation_id.trim();
  const meta: JobMeta = {
    report_id,
    generation_id,
    generation_epoch: input.generation_epoch,
    locale: input.locale.trim(),
    inputs: input.inputs,
    status: input.status ?? "pending",
    created_at: now,
    updated_at: now,
  };

  try {
    const mKey = metaKey(report_id, generation_id);
    trackKey(mKey);
    const created = await casSet(mKey, null, meta);
    if (!created) {
      return {
        ok: false,
        code: "kv_write_failed",
        detail: "job meta already exists (refusing overwrite)",
      };
    }

    const states = initialPendingPageStates();
    for (const state of states) {
      const written = await writePageBlob(report_id, generation_id, state.page_id, 0, {
        state,
        repair: null,
      });
      if (!written.ok) return written;
    }

    const loaded = await loadJob(report_id, generation_id);
    if (!loaded.ok) return loaded;
    if (!loaded.value) {
      return { ok: false, code: "job_not_found", detail: "created job missing on reload" };
    }
    return { ok: true, value: loaded.value };
  } catch (err) {
    return {
      ok: false,
      code: "kv_write_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function updatePageStateAndPersist(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  patch: Partial<ReportPageRuntimeState>,
): Promise<JobStoreResult<void>> {
  updatePageState(job, page_id, patch);
  return saveJob(job);
}

export async function setPageOutputAndPersist(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  schema: unknown,
  output_fingerprint: string,
): Promise<JobStoreResult<void>> {
  setPageOutput(job, page_id, schema, output_fingerprint);
  return saveJob(job);
}

export async function setRepairPendingAndPersist(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  payload: RepairPendingPayload,
): Promise<JobStoreResult<void>> {
  setRepairPending(job, page_id, payload);
  return saveJob(job);
}

export async function clearRepairPendingAndPersist(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
): Promise<JobStoreResult<void>> {
  clearRepairPending(job, page_id);
  return saveJob(job);
}

export async function appendDispatchLogAndPersist(
  job: ReportBatch2JobRecord,
  entry: DispatchLogEntry,
): Promise<JobStoreResult<void>> {
  appendDispatchLog(job, entry);
  return saveJob(job);
}

export async function appendInvocationLogAndPersist(
  job: ReportBatch2JobRecord,
  entry: InvocationLogEntry,
): Promise<JobStoreResult<void>> {
  appendInvocationLog(job, entry);
  return saveJob(job);
}

/** @deprecated Use createJobAndPersist — kept for tests that seed jobs inline. */
export async function createJob(input: {
  report_id: string;
  generation_id: string;
  locale: string;
  inputs: ReportBatch2JobInputs;
  persist_kv?: boolean;
  status?: ReportBatch2JobStatus;
  generation_epoch?: number;
}): Promise<JobStoreResult<ReportBatch2JobRecord>> {
  void input.persist_kv;
  return createJobAndPersist(input);
}

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
  const dirty = ensureDirty(job);
  dirty.pages.add(page_id);
  touch(job);
}

export function setPageOutput(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  schema: unknown,
  output_fingerprint: string,
  opts?: { validity_rev?: number },
): void {
  job.page_outputs[page_id] = schema;
  updatePageState(job, page_id, {
    output_fingerprint,
    input_fingerprint: job.page_states.find((s) => s.page_id === page_id)
      ?.input_fingerprint,
  });
  const dirty = ensureDirty(job);
  if (typeof opts?.validity_rev === "number") {
    dirty.pageValidityRev.set(page_id, opts.validity_rev);
    dirty.pageAuthorityFp.set(page_id, output_fingerprint);
  }
}

/** Bind Batch3 fence validity_rev for the next page persist (e.g. invalidation clear). */
export function bindPageValidityRev(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  validity_rev: number,
  authority_output_fingerprint?: string | null,
): void {
  const dirty = ensureDirty(job);
  dirty.pages.add(page_id);
  dirty.pageValidityRev.set(page_id, validity_rev);
  if (authority_output_fingerprint) {
    dirty.pageAuthorityFp.set(page_id, authority_output_fingerprint);
  } else {
    dirty.pageAuthorityFp.delete(page_id);
  }
  touch(job);
}

/**
 * Direct page-blob write used by Batch3 authority persist / recovery replay.
 * Respects validity_rev ordering — lower rev cannot overwrite higher.
 */
export async function writePageBlobWithValidity(input: {
  report_id: string;
  generation_id: string;
  page_id: ReportPageId;
  state: ReportPageRuntimeState;
  output?: unknown;
  repair?: RepairPendingPayload | null;
  validity_rev: number;
  authority_output_fingerprint?: string | null;
}): Promise<JobStoreResult<number>> {
  if (!isReportBatch2SharedStoreAvailable()) return storeUnavailable();
  const key = pageKey(input.report_id, input.generation_id, input.page_id);
  trackKey(key);
  const store = kvStore();
  const current = await store.get<PageBlob>(key);
  const expectedRev = current?.rev ?? 0;
  return writePageBlob(
    input.report_id,
    input.generation_id,
    input.page_id,
    expectedRev,
    {
      state: input.state,
      output: input.output,
      repair: input.repair ?? null,
      validity_rev: input.validity_rev,
      authority_output_fingerprint: input.authority_output_fingerprint ?? null,
    },
  );
}

export function pageBlobKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return pageKey(report_id, generation_id, page_id);
}

export function setRepairPending(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
  payload: RepairPendingPayload,
): void {
  job.repair_pending[page_id] = payload;
  ensureDirty(job).pages.add(page_id);
  touch(job);
}

export function clearRepairPending(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
): void {
  delete job.repair_pending[page_id];
  ensureDirty(job).pages.add(page_id);
  touch(job);
}

export function appendDispatchLog(
  job: ReportBatch2JobRecord,
  entry: DispatchLogEntry,
): void {
  ensureDirty(job).pendingDispatch.push(entry);
  touch(job);
}

export function appendInvocationLog(
  job: ReportBatch2JobRecord,
  entry: InvocationLogEntry,
): void {
  ensureDirty(job).pendingInvocation.push(entry);
  touch(job);
}

/**
 * Test helper: write only one page from a stale in-memory job snapshot
 * (simulates a Worker that never saw the other page's completion).
 */
export async function saveJobPageOnlyForTests(
  job: ReportBatch2JobRecord,
  page_id: ReportPageId,
): Promise<JobStoreResult<void>> {
  const dirty = ensureDirty(job);
  dirty.pages.clear();
  dirty.pages.add(page_id);
  dirty.meta = false;
  dirty.pendingDispatch = [];
  dirty.pendingInvocation = [];
  return saveJob(job);
}

export async function resetBatch2JobStoreForTests(): Promise<void> {
  const keys = [...trackedKvKeys];
  trackedKvKeys.clear();
  const store = kvStore();
  await Promise.all(keys.map((k) => store.del(k).catch(() => undefined)));
}

export { reportBatch2JobKey } from "./types";
