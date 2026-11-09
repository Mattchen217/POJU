/**
 * M2.2 — Freeze-bound eight-page report delivery.
 *
 * Authority: M2.1 Freeze package (binding triple + immutable version snapshot).
 * Never reads mutable draft DC as analytical input.
 * Persist Freeze binding BEFORE first page/LLM generation.
 */

import {
  DECISION_PAGE_IDS,
  type DecisionPageId,
} from "@/lib/llm/pro/delivery/page-feed-matrix";
import { formatDecisionContextSliceForPage } from "@/lib/poju/decision-context/dc-page-feed";
import {
  assertFrozenDcIntegrity,
  assertSnapshotMatchesBinding,
  bindingFromDecisionContext,
  DcReportBindError,
  DC_REPORT_HASH_MISMATCH,
  DC_REPORT_MISSING,
  DC_REPORT_NOT_FROZEN,
  DC_REPORT_VERSION_MISS,
  type DecisionContextSessionSlice,
} from "@/lib/poju/decision-context/read-bound";
import { computeContentHash } from "@/lib/poju/decision-context/content-hash";
import type {
  DecisionContext,
  DecisionContextBinding,
} from "@/lib/poju/decision-context/types";
import type { POJUSessionState } from "@/lib/poju/types";
/** Claim ops shape (KV-backed impl lives in freeze-report-claim.ts, server-only). */
export type FreezeReportClaimOps = {
  tryAcquire: (
    key: string,
    token: string,
    ttlSec: number,
    meta?: { job_id?: string | null },
  ) => Promise<boolean>;
  /** Token-checked compare-and-delete. True only when this token owned the key. */
  release: (key: string, token: string) => Promise<boolean | void>;
  forceRelease: (key: string) => Promise<void>;
  load?: (key: string) => Promise<{ token: string; expires_at: number } | null>;
  bindJobId?: (key: string, token: string, jobId: string) => Promise<boolean>;
};

export const M22_REPORT_CLAIM_TTL_SEC = 60 * 90;

export function freezeReportClaimKey(input: {
  sessionId: string;
  freezeId: string;
  reportSchemaVersion: string;
}): string {
  return [
    "poju-m22:freeze-report-claim",
    input.sessionId,
    input.freezeId,
    input.reportSchemaVersion,
  ].join(":");
}

function newFreezeReportClaimToken(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

type ProcessLocalClaim = {
  token: string;
  expires_at: number;
};

/** Process-local NX claim with TTL — safe for client bundles; tests/servers inject KV ops. */
export function createProcessLocalClaimOps(
  store: Map<string, ProcessLocalClaim> = new Map(),
): FreezeReportClaimOps {
  return {
    async tryAcquire(key, token, ttlSec) {
      const now = Date.now();
      const existing = store.get(key);
      if (existing && existing.expires_at > now) return false;
      // Expired residue can be overwritten only when still the same token or absent.
      store.set(key, { token, expires_at: now + ttlSec * 1000 });
      return true;
    },
    async release(key, token) {
      const existing = store.get(key);
      if (!existing || existing.token !== token) return false;
      store.delete(key);
      return true;
    },
    async forceRelease(key) {
      store.delete(key);
    },
    async load(key) {
      const existing = store.get(key);
      if (!existing || existing.expires_at <= Date.now()) return null;
      return existing;
    },
    async bindJobId() {
      return true;
    },
  };
}

const defaultProcessLocalClaimOps = createProcessLocalClaimOps();


/** Stable report schema / prompt family for M2.2 binding uniqueness. */
export const M22_REPORT_SCHEMA_VERSION = "m2.2-eight-page-v1" as const;
export const M22_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type FreezeBoundReportJobStatus =
  | "queued"
  | "generating"
  | "completed"
  | "failed"
  | "retrying";

export type ReportBinding = Readonly<{
  sessionId: string;
  freezeId: string;
  decisionContextVersion: number;
  contentHash: string;
  snapshotSchemaVersion: number;
  reportSchemaVersion: string;
  contextId: string;
}>;

export type FrozenReportSnapshot = Readonly<{
  sessionId: string;
  freezeId: string;
  decisionContextVersion: number;
  contentHash: string;
  snapshotSchemaVersion: number;
  reportSchemaVersion: string;
  frozenAt: string;
  decisionContext: Readonly<DecisionContext>;
  binding: DecisionContextBinding;
}>;

export type FreezeBoundReportPage = {
  pageId: DecisionPageId;
  content: string;
  status: "completed" | "failed" | "empty";
  generated_at: string;
  error?: string | null;
};

export type FreezeBoundReportJob = {
  job_id: string;
  idempotency_key: string;
  status: FreezeBoundReportJobStatus;
  binding: ReportBinding;
  pages: FreezeBoundReportPage[];
  created_at: string;
  updated_at: string;
  error?: string | null;
  completed_at?: string | null;
};

export type EightPageReport = {
  job_id: string;
  binding: ReportBinding;
  pages: Array<{ pageId: DecisionPageId; content: string }>;
  status: "completed";
  completed_at: string;
};

export class FreezeBoundReportError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FreezeBoundReportError";
    this.code = code;
  }
}

export type FreezeBoundReportResult =
  | {
      ok: true;
      reused: boolean;
      job: FreezeBoundReportJob;
      report?: EightPageReport;
      snapshot: FrozenReportSnapshot;
      session: POJUSessionState;
    }
  | {
      ok: false;
      code: string;
      error: string;
      job?: FreezeBoundReportJob | null;
      session: POJUSessionState;
    };

export type FreezeBoundReportDeps = {
  /** Injectable page generator (tests mock LLM; production may wrap delivery). */
  generatePage?: (
    snapshot: FrozenReportSnapshot,
    pageId: DecisionPageId,
  ) => Promise<string>;
  now?: () => string;
  persistSession?: (session: POJUSessionState) => Promise<void>;
  /** Optional reload after persist for durability checks. */
  loadSession?: (sessionId: string) => Promise<POJUSessionState | null>;
  /**
   * Cross-process claim ops (default: Upstash/MemoryKv SET NX).
   * Tests inject a shared MemoryKv-backed ops across isolated inFlight maps.
   */
  claimOps?: FreezeReportClaimOps;
  /** Isolate process-local coalescing (cross-process simulation). */
  inFlightMap?: Map<string, Promise<FreezeBoundReportResult>>;
  /** Claim TTL override (seconds). */
  claimTtlSec?: number;
};

/** Process-local coalescing for concurrent duplicate requests. */
const inFlightByKey = new Map<string, Promise<FreezeBoundReportResult>>();

export function freezeIdFromBinding(binding: DecisionContextBinding): string {
  return `${binding.context_id}@v${binding.context_version}`;
}

export function buildReportIdempotencyKey(input: {
  sessionId: string;
  freezeId: string;
  reportSchemaVersion: string;
}): string {
  return [input.sessionId, input.freezeId, input.reportSchemaVersion].join(":");
}

function deepDetachDc(dc: DecisionContext): DecisionContext {
  return JSON.parse(JSON.stringify(dc)) as DecisionContext;
}

/** Recursive freeze so page generators cannot mutate nested DC / binding. */
export function deepFreezeValue<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) {
    // Still walk children in case a prior shallow freeze left nested mutable.
  } else {
    Object.freeze(value);
  }
  for (const key of Reflect.ownKeys(value as object)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const child = (value as any)[key];
    if (child && typeof child === "object") deepFreezeValue(child);
  }
  return value;
}

function jobsOf(session: POJUSessionState): FreezeBoundReportJob[] {
  return [...(session.freeze_bound_report_jobs ?? [])];
}

function upsertJob(
  session: POJUSessionState,
  job: FreezeBoundReportJob,
): POJUSessionState {
  const rest = jobsOf(session).filter((j) => j.job_id !== job.job_id);
  return {
    ...session,
    freeze_bound_report_jobs: [...rest, job],
    last_delivery_context_binding: {
      context_id: job.binding.contextId,
      context_version: job.binding.decisionContextVersion,
      context_hash: job.binding.contentHash,
    },
  };
}

function findJobByKey(
  session: POJUSessionState,
  key: string,
): FreezeBoundReportJob | undefined {
  return jobsOf(session).find((j) => j.idempotency_key === key);
}

/**
 * Load the authoritative frozen DC for a Freeze id (context_id@version).
 * Prefers immutable decision_context_versions[]; never substitutes draft.
 */
export function loadAuthoritativeFreeze(
  slice: DecisionContextSessionSlice & { session_id?: string },
  opts?: {
    freezeId?: string;
    context_id?: string;
    version?: number;
    expected_hash?: string;
  },
): {
  frozen: DecisionContext;
  binding: DecisionContextBinding;
  freezeId: string;
} {
  let context_id = opts?.context_id;
  let version = opts?.version;
  if (opts?.freezeId) {
    const m = /^(.+)@v(\d+)$/.exec(opts.freezeId.trim());
    if (!m) {
      throw new FreezeBoundReportError(
        "INVALID_FREEZE_ID",
        `Invalid freezeId=${opts.freezeId}`,
      );
    }
    context_id = m[1];
    version = Number(m[2]);
  }

  const versions = [...(slice.decision_context_versions ?? [])];
  const current = slice.decision_context ?? null;

  const pool: DecisionContext[] = [];
  for (const v of versions) {
    if (!v) continue;
    if (context_id && v.context_id !== context_id) continue;
    if (version != null && v.version !== version) continue;
    if (v.status === "final" || v.status === "superseded") pool.push(v);
  }
  // Current final is allowed only when it matches the requested identity;
  // never pull draft.
  if (
    current &&
    (current.status === "final" || current.status === "superseded") &&
    (!context_id || current.context_id === context_id) &&
    (version == null || current.version === version)
  ) {
    const key = `${current.context_id}@v${current.version}`;
    if (!pool.some((p) => `${p.context_id}@v${p.version}` === key)) {
      pool.push(current);
    }
  }

  if (pool.length === 0) {
    if (context_id != null || version != null || opts?.freezeId) {
      throw new FreezeBoundReportError(
        DC_REPORT_VERSION_MISS,
        `No immutable frozen DC for freezeId=${opts?.freezeId ?? `${context_id}@v${version}`}`,
      );
    }
    throw new FreezeBoundReportError(
      DC_REPORT_MISSING,
      "Session has no authoritative Freeze for report binding",
    );
  }

  // Prefer versions[] snapshot over current when both present.
  let chosen = pool[0]!;
  for (const c of pool) {
    const inVersions = versions.some(
      (v) =>
        v.context_id === c.context_id &&
        v.version === c.version &&
        (v.status === "final" || v.status === "superseded"),
    );
    const chosenInVersions = versions.some(
      (v) =>
        v.context_id === chosen.context_id &&
        v.version === chosen.version &&
        (v.status === "final" || v.status === "superseded"),
    );
    if (inVersions && !chosenInVersions) chosen = c;
    else if (c.status === "final" && chosen.status !== "final") chosen = c;
  }

  if (chosen.status !== "final" && chosen.status !== "superseded") {
    throw new FreezeBoundReportError(
      DC_REPORT_NOT_FROZEN,
      `Resolved DC status=${chosen.status} is not frozen`,
    );
  }

  try {
    assertFrozenDcIntegrity(chosen);
  } catch (e) {
    if (e instanceof DcReportBindError) {
      throw new FreezeBoundReportError(e.code, e.message);
    }
    throw e;
  }

  const binding = bindingFromDecisionContext(chosen);
  if (opts?.expected_hash && opts.expected_hash !== binding.context_hash) {
    throw new FreezeBoundReportError(
      DC_REPORT_HASH_MISMATCH,
      `expected_hash mismatch: expected=${opts.expected_hash} got=${binding.context_hash}`,
    );
  }

  return {
    frozen: deepDetachDc(chosen),
    binding,
    freezeId: freezeIdFromBinding(binding),
  };
}

export function verifyFrozenSnapshot(
  frozen: DecisionContext,
  binding: DecisionContextBinding,
): void {
  try {
    assertSnapshotMatchesBinding(frozen, binding);
  } catch (e) {
    if (e instanceof DcReportBindError) {
      throw new FreezeBoundReportError(e.code, e.message);
    }
    throw e;
  }
  const recomputed = computeContentHash(frozen);
  if (recomputed !== binding.context_hash) {
    throw new FreezeBoundReportError(
      DC_REPORT_HASH_MISMATCH,
      `report-side content_hash mismatch: freeze=${binding.context_hash} recomputed=${recomputed}`,
    );
  }
}

export function createFrozenReportSnapshot(input: {
  sessionId: string;
  frozen: DecisionContext;
  binding: DecisionContextBinding;
  reportSchemaVersion?: string;
  snapshotSchemaVersion?: number;
}): FrozenReportSnapshot {
  verifyFrozenSnapshot(input.frozen, input.binding);
  const detached = deepDetachDc(input.frozen);
  const bindingCopy: DecisionContextBinding = { ...input.binding };
  const snapshot: FrozenReportSnapshot = {
    sessionId: input.sessionId,
    freezeId: freezeIdFromBinding(input.binding),
    decisionContextVersion: input.binding.context_version,
    contentHash: input.binding.context_hash,
    snapshotSchemaVersion:
      input.snapshotSchemaVersion ?? M22_SNAPSHOT_SCHEMA_VERSION,
    reportSchemaVersion: input.reportSchemaVersion ?? M22_REPORT_SCHEMA_VERSION,
    frozenAt: detached.updated_at,
    decisionContext: detached,
    binding: bindingCopy,
  };
  return deepFreezeValue(snapshot);
}

export function reportBindingFromSnapshot(
  snapshot: FrozenReportSnapshot,
): ReportBinding {
  return {
    sessionId: snapshot.sessionId,
    freezeId: snapshot.freezeId,
    decisionContextVersion: snapshot.decisionContextVersion,
    contentHash: snapshot.contentHash,
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
    reportSchemaVersion: snapshot.reportSchemaVersion,
    contextId: snapshot.binding.context_id,
  };
}

function bindingsEqual(a: ReportBinding, b: ReportBinding): boolean {
  return (
    a.sessionId === b.sessionId &&
    a.freezeId === b.freezeId &&
    a.decisionContextVersion === b.decisionContextVersion &&
    a.contentHash === b.contentHash &&
    a.snapshotSchemaVersion === b.snapshotSchemaVersion &&
    a.reportSchemaVersion === b.reportSchemaVersion &&
    a.contextId === b.contextId
  );
}

export async function defaultGeneratePage(
  snapshot: FrozenReportSnapshot,
  pageId: DecisionPageId,
): Promise<string> {
  const feed = formatDecisionContextSliceForPage(
    snapshot.decisionContext as DecisionContext,
    pageId,
  );
  const body = [
    `# Face ${pageId}`,
    `freezeId=${snapshot.freezeId}`,
    `decisionContextVersion=${snapshot.decisionContextVersion}`,
    `contentHash=${snapshot.contentHash}`,
    `reportSchemaVersion=${snapshot.reportSchemaVersion}`,
    "",
    "```json",
    JSON.stringify(feed, null, 2),
    "```",
  ].join("\n");
  if (!body.trim()) {
    throw new FreezeBoundReportError(
      "EMPTY_PAGE",
      `defaultGeneratePage produced empty content for ${pageId}`,
    );
  }
  return body;
}

export function assertCompleteEightPageReport(
  pages: Array<{ pageId: string; content: string }>,
): void {
  if (pages.length !== 8) {
    throw new FreezeBoundReportError(
      "INVALID_REPORT_PAGE_COUNT",
      `Expected 8 pages, got ${pages.length}`,
    );
  }
  const ids = pages.map((p) => p.pageId);
  if (new Set(ids).size !== 8) {
    throw new FreezeBoundReportError(
      "DUPLICATE_REPORT_PAGE",
      `Duplicate page ids: ${ids.join(",")}`,
    );
  }
  for (const expected of DECISION_PAGE_IDS) {
    if (!ids.includes(expected)) {
      throw new FreezeBoundReportError(
        "MISSING_REPORT_PAGE",
        `Missing page ${expected}`,
      );
    }
  }
  for (const page of pages) {
    if (!page.content || page.content.trim().length === 0) {
      throw new FreezeBoundReportError(
        "EMPTY_REPORT_PAGE",
        `Empty report page ${page.pageId}`,
      );
    }
  }
}

/**
 * Generate all eight pages from ONE immutable snapshot.
 * Page generators must not fetch mutable session/draft DC.
 */
export async function generateEightPageReport(
  snapshot: FrozenReportSnapshot,
  deps?: Pick<FreezeBoundReportDeps, "generatePage" | "now">,
): Promise<Array<{ pageId: DecisionPageId; content: string }>> {
  const generatePage = deps?.generatePage ?? defaultGeneratePage;
  const pages: Array<{ pageId: DecisionPageId; content: string }> = [];
  for (const pageId of DECISION_PAGE_IDS) {
    const content = await generatePage(snapshot, pageId);
    pages.push({ pageId, content });
  }
  assertCompleteEightPageReport(pages);
  return pages;
}

function makeJobId(key: string, now: string): string {
  return `m22_report_${key.replace(/[^a-zA-Z0-9@_.:-]/g, "_")}_${now.replace(/[:.]/g, "")}`;
}

/**
 * Persist binding BEFORE first page generation. Idempotent create/join.
 */
export async function createOrGetReportJob(input: {
  session: POJUSessionState;
  snapshot: FrozenReportSnapshot;
  deps?: FreezeBoundReportDeps;
}): Promise<{
  session: POJUSessionState;
  job: FreezeBoundReportJob;
  reused: boolean;
}> {
  const now = input.deps?.now?.() ?? new Date().toISOString();
  const binding = reportBindingFromSnapshot(input.snapshot);
  const key = buildReportIdempotencyKey({
    sessionId: binding.sessionId,
    freezeId: binding.freezeId,
    reportSchemaVersion: binding.reportSchemaVersion,
  });

  const existing = findJobByKey(input.session, key);
  if (existing) {
    if (!bindingsEqual(existing.binding, binding)) {
      throw new FreezeBoundReportError(
        "BINDING_MISMATCH",
        `Existing job binding mismatch for key=${key}`,
      );
    }
    if (
      existing.status === "completed" ||
      existing.status === "queued" ||
      existing.status === "generating" ||
      existing.status === "retrying"
    ) {
      return { session: input.session, job: existing, reused: true };
    }
    // failed → retry under same binding
    const retrying: FreezeBoundReportJob = {
      ...existing,
      status: "retrying",
      updated_at: now,
      error: null,
    };
    let session = upsertJob(input.session, retrying);
    if (input.deps?.persistSession) await input.deps.persistSession(session);
    return { session, job: retrying, reused: true };
  }

  const job: FreezeBoundReportJob = {
    job_id: makeJobId(key, now),
    idempotency_key: key,
    status: "queued",
    binding,
    pages: [],
    created_at: now,
    updated_at: now,
    error: null,
    completed_at: null,
  };
  let session = upsertJob(input.session, job);
  // Binding persisted before any page/LLM work.
  if (input.deps?.persistSession) await input.deps.persistSession(session);
  return { session, job, reused: false };
}

function completedPagesReusable(
  job: FreezeBoundReportJob,
  snapshot: FrozenReportSnapshot,
): Map<DecisionPageId, FreezeBoundReportPage> {
  const map = new Map<DecisionPageId, FreezeBoundReportPage>();
  const expected = reportBindingFromSnapshot(snapshot);
  if (!bindingsEqual(job.binding, expected)) return map;
  for (const p of job.pages) {
    if (
      p.status === "completed" &&
      p.content &&
      p.content.trim().length > 0 &&
      (DECISION_PAGE_IDS as readonly string[]).includes(p.pageId)
    ) {
      map.set(p.pageId, p);
    }
  }
  return map;
}

async function runGenerationOnJob(input: {
  session: POJUSessionState;
  job: FreezeBoundReportJob;
  snapshot: FrozenReportSnapshot;
  deps?: FreezeBoundReportDeps;
}): Promise<FreezeBoundReportResult> {
  const nowFn = input.deps?.now ?? (() => new Date().toISOString());
  let session = input.session;
  let job: FreezeBoundReportJob = {
    ...input.job,
    status: "generating",
    updated_at: nowFn(),
    error: null,
  };
  session = upsertJob(session, job);
  if (input.deps?.persistSession) await input.deps.persistSession(session);

  // Re-verify hash immediately before page generation / retry.
  try {
    verifyFrozenSnapshot(
      input.snapshot.decisionContext as DecisionContext,
      input.snapshot.binding,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e instanceof FreezeBoundReportError ? e.code : DC_REPORT_HASH_MISMATCH;
    job = {
      ...job,
      status: "failed",
      updated_at: nowFn(),
      error: msg,
    };
    session = upsertJob(session, job);
    if (input.deps?.persistSession) await input.deps.persistSession(session);
    return { ok: false, code, error: msg, job, session };
  }

  const generatePage = input.deps?.generatePage ?? defaultGeneratePage;
  const reusable = completedPagesReusable(job, input.snapshot);
  const nextPages: FreezeBoundReportPage[] = [];

  try {
    for (const pageId of DECISION_PAGE_IDS) {
      const prior = reusable.get(pageId);
      if (prior) {
        nextPages.push(prior);
        continue;
      }
      const content = await generatePage(input.snapshot, pageId);
      if (!content || !content.trim()) {
        throw new FreezeBoundReportError(
          "EMPTY_REPORT_PAGE",
          `Empty report page ${pageId}`,
        );
      }
      nextPages.push({
        pageId,
        content,
        status: "completed",
        generated_at: nowFn(),
        error: null,
      });
      // Persist page progress under the same immutable binding.
      job = {
        ...job,
        pages: [...nextPages],
        status: "generating",
        updated_at: nowFn(),
      };
      session = upsertJob(session, job);
      if (input.deps?.persistSession) await input.deps.persistSession(session);
    }

    assertCompleteEightPageReport(nextPages);
    if (!bindingsEqual(job.binding, reportBindingFromSnapshot(input.snapshot))) {
      throw new FreezeBoundReportError(
        "BINDING_MISMATCH",
        "Job binding drifted during generation",
      );
    }

    const completed_at = nowFn();
    job = {
      ...job,
      pages: nextPages,
      status: "completed",
      updated_at: completed_at,
      completed_at,
      error: null,
    };
    session = upsertJob(session, job);
    if (input.deps?.persistSession) await input.deps.persistSession(session);

    const report: EightPageReport = {
      job_id: job.job_id,
      binding: job.binding,
      pages: nextPages.map((p) => ({ pageId: p.pageId, content: p.content })),
      status: "completed",
      completed_at,
    };
    return {
      ok: true,
      reused: false,
      job,
      report,
      snapshot: input.snapshot,
      session,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e instanceof FreezeBoundReportError ? e.code : "REPORT_GENERATION_FAILED";
    job = {
      ...job,
      pages: nextPages,
      status: "failed",
      updated_at: nowFn(),
      error: msg,
      completed_at: null,
    };
    session = upsertJob(session, job);
    if (input.deps?.persistSession) await input.deps.persistSession(session);
    return { ok: false, code, error: msg, job, session };
  }
}

/**
 * Primary M2.2 entry: Freeze → snapshot → bound eight-page report.
 */
export async function requestFreezeBoundEightPageReport(input: {
  session: POJUSessionState;
  freezeId?: string;
  context_id?: string;
  version?: number;
  expected_hash?: string;
  reportSchemaVersion?: string;
  deps?: FreezeBoundReportDeps;
}): Promise<FreezeBoundReportResult> {
  const sessionId = input.session.session_id;
  let snapshot: FrozenReportSnapshot;
  try {
    const loaded = loadAuthoritativeFreeze(input.session, {
      freezeId: input.freezeId,
      context_id: input.context_id,
      version: input.version,
      expected_hash: input.expected_hash,
    });
    snapshot = createFrozenReportSnapshot({
      sessionId,
      frozen: loaded.frozen,
      binding: loaded.binding,
      reportSchemaVersion:
        input.reportSchemaVersion ?? M22_REPORT_SCHEMA_VERSION,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e instanceof FreezeBoundReportError
        ? e.code
        : e instanceof DcReportBindError
          ? e.code
          : "FREEZE_LOAD_FAILED";
    return { ok: false, code, error: msg, session: input.session };
  }

  const key = buildReportIdempotencyKey({
    sessionId: snapshot.sessionId,
    freezeId: snapshot.freezeId,
    reportSchemaVersion: snapshot.reportSchemaVersion,
  });

  const flightMap = input.deps?.inFlightMap ?? inFlightByKey;
  const existingInflight = flightMap.get(key);
  if (existingInflight) return existingInflight;

  // Register BEFORE any await so concurrent duplicates coalesce (process-local).
  let resolveInflight!: (value: FreezeBoundReportResult) => void;
  const gate = new Promise<FreezeBoundReportResult>((resolve) => {
    resolveInflight = resolve;
  });
  flightMap.set(key, gate);

  const claimOps = input.deps?.claimOps ?? defaultProcessLocalClaimOps;
  const claimKey = freezeReportClaimKey({
    sessionId: snapshot.sessionId,
    freezeId: snapshot.freezeId,
    reportSchemaVersion: snapshot.reportSchemaVersion,
  });
  const claimTtl = input.deps?.claimTtlSec ?? M22_REPORT_CLAIM_TTL_SEC;

  const completedResult = (
    job: FreezeBoundReportJob,
    session: POJUSessionState,
    reused: boolean,
  ): FreezeBoundReportResult => {
    const pages = job.pages
      .filter((p) => p.status === "completed")
      .map((p) => ({ pageId: p.pageId, content: p.content }));
    try {
      assertCompleteEightPageReport(pages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        ok: false,
        code: "INCOMPLETE_COMPLETED_JOB",
        error: msg,
        job,
        session,
      };
    }
    return {
      ok: true,
      reused,
      job,
      report: {
        job_id: job.job_id,
        binding: job.binding,
        pages,
        status: "completed",
        completed_at: job.completed_at ?? job.updated_at,
      },
      snapshot,
      session,
    };
  };

  const run = (async (): Promise<FreezeBoundReportResult> => {
    let session = input.session;
    // Optional durable reload so concurrent writers see prior jobs.
    if (input.deps?.loadSession) {
      const fresh = await input.deps.loadSession(sessionId);
      if (fresh) session = fresh;
    }

    const existing = findJobByKey(session, key);
    if (existing?.status === "completed") {
      return completedResult(existing, session, true);
    }

    // Cross-process atomic claim BEFORE job create + generation.
    // Only the winner may create/run; losers must not generate again.
    const token = newFreezeReportClaimToken();
    const acquired = await claimOps.tryAcquire(claimKey, token, claimTtl);
    if (!acquired) {
      if (input.deps?.loadSession) {
        const fresh = await input.deps.loadSession(sessionId);
        if (fresh) session = fresh;
      }
      const heldJob = findJobByKey(session, key);
      if (heldJob?.status === "completed") {
        return completedResult(heldJob, session, true);
      }
      return {
        ok: false,
        code: "GENERATION_IN_PROGRESS",
        error: `Freeze-bound report claim held for ${claimKey}; not generating again`,
        job: heldJob ?? null,
        session,
      };
    }

    try {
      // Reload under claim so job create sees the latest durable state.
      if (input.deps?.loadSession) {
        const fresh = await input.deps.loadSession(sessionId);
        if (fresh) session = fresh;
      }
      const raced = findJobByKey(session, key);
      if (raced?.status === "completed") {
        return completedResult(raced, session, true);
      }

      let created;
      try {
        created = await createOrGetReportJob({
          session,
          snapshot,
          deps: input.deps,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const code =
          e instanceof FreezeBoundReportError ? e.code : "JOB_CREATE_FAILED";
        return { ok: false, code, error: msg, session };
      }

      session = created.session;
      const job = created.job;
      if (job.status === "completed") {
        return completedResult(job, session, true);
      }

      // Generate (or continue/retry) under the original Freeze + binding only.
      return await runGenerationOnJob({
        session,
        job,
        snapshot,
        deps: input.deps,
      });
    } finally {
      await claimOps.release(claimKey, token).catch(() => undefined);
    }
  })();

  try {
    const result = await run;
    resolveInflight(result);
    return result;
  } catch (e) {
    const fail: FreezeBoundReportResult = {
      ok: false,
      code: "REPORT_GENERATION_FAILED",
      error: e instanceof Error ? e.message : String(e),
      session: input.session,
    };
    resolveInflight(fail);
    return fail;
  } finally {
    flightMap.delete(key);
  }
}

/** Explicit retry entry — always reloads original job binding; never switches Freeze. */
export async function retryFreezeBoundEightPageReport(input: {
  session: POJUSessionState;
  jobId: string;
  deps?: FreezeBoundReportDeps;
}): Promise<FreezeBoundReportResult> {
  const job = jobsOf(input.session).find((j) => j.job_id === input.jobId);
  if (!job) {
    return {
      ok: false,
      code: "JOB_NOT_FOUND",
      error: `No report job ${input.jobId}`,
      session: input.session,
    };
  }
  return requestFreezeBoundEightPageReport({
    session: input.session,
    freezeId: job.binding.freezeId,
    expected_hash: job.binding.contentHash,
    reportSchemaVersion: job.binding.reportSchemaVersion,
    deps: input.deps,
  });
}

/** Retrieval: completed only. */
export function getCompletedFreezeBoundReport(
  session: POJUSessionState,
  opts?: { freezeId?: string; jobId?: string },
): EightPageReport | null {
  const jobs = jobsOf(session);
  const job = opts?.jobId
    ? jobs.find((j) => j.job_id === opts.jobId)
    : opts?.freezeId
      ? jobs.find(
          (j) =>
            j.binding.freezeId === opts.freezeId && j.status === "completed",
        )
      : jobs.find((j) => j.status === "completed");
  if (!job || job.status !== "completed") return null;
  const pages = job.pages
    .filter((p) => p.status === "completed")
    .map((p) => ({ pageId: p.pageId, content: p.content }));
  try {
    assertCompleteEightPageReport(pages);
  } catch {
    return null;
  }
  return {
    job_id: job.job_id,
    binding: job.binding,
    pages,
    status: "completed",
    completed_at: job.completed_at ?? job.updated_at,
  };
}

/**
 * M2.2 → formal final-delivery bridge:
 * Load authoritative Freeze → FrozenReportSnapshot → persist Freeze-bound job
 * → return DC fields for FinalDeliveryJobInput (existing eight-page LLM path).
 * Does not invent a second report pipeline.
 *
 * When `acquireGenerationClaim` is true (production Final Delivery path):
 * acquire the shared KV claim BEFORE job create; only the claim owner may
 * proceed to start generation. Caller MUST release via releaseFreezeBoundReportClaim
 * on completion/failure (token-checked CAS delete).
 */
export async function prepareFreezeBoundFinalDelivery(input: {
  session: POJUSessionState;
  freezeId?: string;
  context_id?: string;
  version?: number;
  expected_hash?: string;
  reportSchemaVersion?: string;
  deps?: FreezeBoundReportDeps;
  /** Production Final Delivery: claim before create/start; hold until complete/fail. */
  acquireGenerationClaim?: boolean;
}): Promise<
  | {
      ok: true;
      snapshot: FrozenReportSnapshot;
      job: FreezeBoundReportJob;
      session: POJUSessionState;
      decision_context_snapshot: DecisionContext;
      decision_context_binding: DecisionContextBinding;
      require_decision_context: true;
      claimHeld: boolean;
      claimToken: string | null;
      claimKey: string | null;
      reusedCompleted: boolean;
    }
  | {
      ok: false;
      code: string;
      error: string;
      session: POJUSessionState;
      job?: FreezeBoundReportJob | null;
    }
> {
  let snapshot: FrozenReportSnapshot;
  try {
    const loaded = loadAuthoritativeFreeze(input.session, {
      freezeId: input.freezeId,
      context_id: input.context_id,
      version: input.version,
      expected_hash: input.expected_hash,
    });
    snapshot = createFrozenReportSnapshot({
      sessionId: input.session.session_id,
      frozen: loaded.frozen,
      binding: loaded.binding,
      reportSchemaVersion:
        input.reportSchemaVersion ?? M22_REPORT_SCHEMA_VERSION,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e instanceof FreezeBoundReportError
        ? e.code
        : e instanceof DcReportBindError
          ? e.code
          : "FREEZE_LOAD_FAILED";
    return { ok: false, code, error: msg, session: input.session };
  }

  const key = buildReportIdempotencyKey({
    sessionId: snapshot.sessionId,
    freezeId: snapshot.freezeId,
    reportSchemaVersion: snapshot.reportSchemaVersion,
  });
  const claimKey = freezeReportClaimKey({
    sessionId: snapshot.sessionId,
    freezeId: snapshot.freezeId,
    reportSchemaVersion: snapshot.reportSchemaVersion,
  });
  const claimOps = input.deps?.claimOps ?? defaultProcessLocalClaimOps;
  const claimTtl = input.deps?.claimTtlSec ?? M22_REPORT_CLAIM_TTL_SEC;

  let session = input.session;
  if (input.deps?.loadSession) {
    const fresh = await input.deps.loadSession(session.session_id);
    if (fresh) session = fresh;
  }

  const existing = findJobByKey(session, key);
  if (existing?.status === "completed") {
    return {
      ok: true,
      snapshot,
      job: existing,
      session,
      decision_context_snapshot: snapshot.decisionContext as DecisionContext,
      decision_context_binding: snapshot.binding,
      require_decision_context: true,
      claimHeld: false,
      claimToken: null,
      claimKey: null,
      reusedCompleted: true,
    };
  }

  let claimToken: string | null = null;
  let claimHeld = false;
  if (input.acquireGenerationClaim) {
    claimToken = newFreezeReportClaimToken();
    const acquired = await claimOps.tryAcquire(
      claimKey,
      claimToken,
      claimTtl,
      existing ? { job_id: existing.job_id } : undefined,
    );
    if (!acquired) {
      if (input.deps?.loadSession) {
        const fresh = await input.deps.loadSession(session.session_id);
        if (fresh) session = fresh;
      }
      const heldJob = findJobByKey(session, key);
      if (heldJob?.status === "completed") {
        return {
          ok: true,
          snapshot,
          job: heldJob,
          session,
          decision_context_snapshot: snapshot.decisionContext as DecisionContext,
          decision_context_binding: snapshot.binding,
          require_decision_context: true,
          claimHeld: false,
          claimToken: null,
          claimKey: null,
          reusedCompleted: true,
        };
      }
      return {
        ok: false,
        code: "GENERATION_IN_PROGRESS",
        error: `Freeze-bound report claim held for ${claimKey}; not starting another generator`,
        job: heldJob ?? null,
        session,
      };
    }
    claimHeld = true;
  }

  try {
    if (input.deps?.loadSession && claimHeld) {
      const fresh = await input.deps.loadSession(session.session_id);
      if (fresh) session = fresh;
    }
    const raced = findJobByKey(session, key);
    if (raced?.status === "completed") {
      if (claimHeld && claimToken) {
        await claimOps.release(claimKey, claimToken).catch(() => undefined);
        claimHeld = false;
        claimToken = null;
      }
      return {
        ok: true,
        snapshot,
        job: raced,
        session,
        decision_context_snapshot: snapshot.decisionContext as DecisionContext,
        decision_context_binding: snapshot.binding,
        require_decision_context: true,
        claimHeld: false,
        claimToken: null,
        claimKey: null,
        reusedCompleted: true,
      };
    }

    const created = await createOrGetReportJob({
      session,
      snapshot,
      deps: input.deps,
    });
    return {
      ok: true,
      snapshot,
      job: created.job,
      session: created.session,
      decision_context_snapshot: snapshot.decisionContext as DecisionContext,
      decision_context_binding: snapshot.binding,
      require_decision_context: true,
      claimHeld,
      claimToken: claimHeld ? claimToken : null,
      claimKey: claimHeld ? claimKey : null,
      reusedCompleted: false,
    };
  } catch (e) {
    if (claimHeld && claimToken) {
      await claimOps.release(claimKey, claimToken).catch(() => undefined);
    }
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e instanceof FreezeBoundReportError ? e.code : "JOB_CREATE_FAILED";
    return { ok: false, code, error: msg, session };
  }
}

/** Token-checked compare-and-delete release for a held Final Delivery claim. */
export async function releaseFreezeBoundReportClaim(input: {
  claimKey: string;
  claimToken: string;
  deps?: FreezeBoundReportDeps;
}): Promise<boolean> {
  const claimOps = input.deps?.claimOps ?? defaultProcessLocalClaimOps;
  const result = await claimOps.release(input.claimKey, input.claimToken);
  return result !== false;
}

/**
 * M2.2-R3: release a successfully acquired claim before any pre-handoff early return.
 * If the request will not hand ownership to a running Final Delivery job, call this
 * with token CAS before returning so a subsequent valid request can acquire.
 */

/**
 * M2.2-R3 Regenerate claim release: only the original owner's token may CAS-delete.
 * Never force-delete another execution context's claim.
 * If ownership cannot be proven while a claim is held → fail closed.
 */
export type RegenerateClaimReleaseResult =
  | { ok: true; released: boolean }
  | { ok: false; code: "CLAIM_OWNED_BY_OTHER"; error: string };

export async function tryReleaseClaimForRegenerate(input: {
  claimOps?: FreezeReportClaimOps;
  claimKey: string;
  ownerToken: string | null | undefined;
}): Promise<RegenerateClaimReleaseResult> {
  const claimOps = input.claimOps ?? defaultProcessLocalClaimOps;
  const held = claimOps.load ? await claimOps.load(input.claimKey) : null;
  if (!held) {
    return { ok: true, released: false };
  }
  if (!input.ownerToken) {
    return {
      ok: false,
      code: "CLAIM_OWNED_BY_OTHER",
      error:
        "Regenerate cannot prove claim ownership; fail closed until lease expiry",
    };
  }
  const released = await claimOps.release(input.claimKey, input.ownerToken);
  if (!released) {
    return {
      ok: false,
      code: "CLAIM_OWNED_BY_OTHER",
      error:
        "Regenerate token does not own the active claim; fail closed (will not steal)",
    };
  }
  return { ok: true, released: true };
}

export async function releaseClaimBeforePreHandoffReturn(input: {
  claimKey: string | null | undefined;
  claimToken: string | null | undefined;
  deps?: FreezeBoundReportDeps;
}): Promise<boolean> {
  if (!input.claimKey || !input.claimToken) return false;
  return releaseFreezeBoundReportClaim({
    claimKey: input.claimKey,
    claimToken: input.claimToken,
    deps: input.deps,
  });
}

/**
 * Mark the Freeze-bound report job failed/retryable (never completed).
 * Preserves original Freeze binding.
 */
export async function failFreezeBoundReportJob(input: {
  session: POJUSessionState;
  jobId: string;
  error: string;
  deps?: FreezeBoundReportDeps;
}): Promise<{ session: POJUSessionState; job: FreezeBoundReportJob | null }> {
  const now = input.deps?.now?.() ?? new Date().toISOString();
  const job = jobsOf(input.session).find((j) => j.job_id === input.jobId);
  if (!job) return { session: input.session, job: null };
  if (job.status === "completed") {
    return { session: input.session, job };
  }
  const next: FreezeBoundReportJob = {
    ...job,
    status: "failed",
    updated_at: now,
    error: input.error,
  };
  let session = upsertJob(input.session, next);
  if (input.deps?.persistSession) await input.deps.persistSession(session);
  return { session, job: next };
}

/**
 * After existing final-delivery LLM pipeline completes, bind pages onto the
 * Freeze-bound report job (same Freeze identity). Fail-closed on integrity.
 */
export async function completeFreezeBoundReportFromDeliveryPages(input: {
  session: POJUSessionState;
  snapshot: FrozenReportSnapshot;
  jobId: string;
  pages: Array<{ pageId: DecisionPageId; content: string }>;
  deps?: FreezeBoundReportDeps;
}): Promise<FreezeBoundReportResult> {
  const nowFn = input.deps?.now ?? (() => new Date().toISOString());
  verifyFrozenSnapshot(
    input.snapshot.decisionContext as DecisionContext,
    input.snapshot.binding,
  );
  assertCompleteEightPageReport(input.pages);
  const job = jobsOf(input.session).find((j) => j.job_id === input.jobId);
  if (!job) {
    return {
      ok: false,
      code: "JOB_NOT_FOUND",
      error: `No report job ${input.jobId}`,
      session: input.session,
    };
  }
  const expected = reportBindingFromSnapshot(input.snapshot);
  if (!bindingsEqual(job.binding, expected)) {
    return {
      ok: false,
      code: "BINDING_MISMATCH",
      error: "Cannot complete job under a different Freeze binding",
      job,
      session: input.session,
    };
  }
  const completed_at = nowFn();
  const nextPages: FreezeBoundReportPage[] = input.pages.map((p) => ({
    pageId: p.pageId,
    content: p.content,
    status: "completed",
    generated_at: completed_at,
    error: null,
  }));
  const nextJob: FreezeBoundReportJob = {
    ...job,
    pages: nextPages,
    status: "completed",
    updated_at: completed_at,
    completed_at,
    error: null,
  };
  let session = upsertJob(input.session, nextJob);
  if (input.deps?.persistSession) await input.deps.persistSession(session);
  return {
    ok: true,
    reused: false,
    job: nextJob,
    report: {
      job_id: nextJob.job_id,
      binding: nextJob.binding,
      pages: input.pages,
      status: "completed",
      completed_at,
    },
    snapshot: input.snapshot,
    session,
  };
}

/** Test helper — clear in-flight coalescing map. */
export function __resetFreezeBoundReportInFlightForTests(): void {
  inFlightByKey.clear();
}

/** Test helper — build claim ops over an injectable KV-like store (shared across isolates). */
export function __createClaimOpsForTests(store: {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean },
  ) => Promise<"OK" | null>;
  del: (...keys: string[]) => Promise<number>;
  compareAndDelete?: (key: string, expectedToken: string) => Promise<boolean>;
}): FreezeReportClaimOps {
  return {
    async tryAcquire(key, token, ttlSec, meta) {
      const existing = await store.get<{ token?: string; expires_at?: number }>(key);
      const now = Date.now();
      if (
        existing &&
        typeof existing.expires_at === "number" &&
        existing.expires_at > now &&
        typeof existing.token === "string"
      ) {
        return false;
      }
      if (existing && typeof existing.token === "string") {
        // Expired only: atomic token-checked delete (fail closed if CAS unavailable).
        if (
          typeof existing.expires_at === "number" &&
          existing.expires_at <= now
        ) {
          if (typeof store.compareAndDelete !== "function") {
            throw new Error(
              "CLAIM_CAS_UNAVAILABLE: cannot clear expired claim without compareAndDelete",
            );
          }
          await store.compareAndDelete(key, existing.token);
        }
      }
      const setResult = await store.set(
        key,
        {
          token,
          acquired_at: now,
          expires_at: now + ttlSec * 1000,
          job_id: meta?.job_id ?? null,
        },
        { nx: true, ex: ttlSec },
      );
      return setResult === "OK";
    },
    async release(key, token) {
      if (typeof store.compareAndDelete === "function") {
        return store.compareAndDelete(key, token);
      }
      // M2.2-R3: never silently downgrade atomic ownership release to GET+DEL.
      throw new Error(
        "CLAIM_CAS_UNAVAILABLE: store provides no compareAndDelete; refusing non-atomic claim release",
      );
    },
    async forceRelease(key) {
      await store.del(key);
    },
    async load(key) {
      const existing = await store.get<{ token: string; expires_at: number }>(key);
      if (!existing || existing.expires_at <= Date.now()) return null;
      return existing;
    },
    async bindJobId(key, token, jobId) {
      const existing = await store.get<{
        token?: string;
        expires_at?: number;
        acquired_at?: number;
        job_id?: string | null;
      }>(key);
      if (!existing || existing.token !== token) return false;
      if (typeof existing.expires_at === "number" && existing.expires_at <= Date.now()) {
        return false;
      }
      const ttlSec = Math.max(
        1,
        Math.ceil(((existing.expires_at ?? Date.now()) - Date.now()) / 1000),
      );
      const again = await store.get<{ token?: string }>(key);
      if (!again || again.token !== token) return false;
      await store.set(
        key,
        { ...existing, token, job_id: jobId },
        { ex: ttlSec },
      );
      return true;
    },
  };
}
