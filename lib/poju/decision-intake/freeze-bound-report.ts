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
};

/** Process-local coalescing for concurrent duplicate requests. */
const inFlightByKey = new Map<string, Promise<FreezeBoundReportResult>>();

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
  Object.freeze(detached);
  return Object.freeze({
    sessionId: input.sessionId,
    freezeId: freezeIdFromBinding(input.binding),
    decisionContextVersion: input.binding.context_version,
    contentHash: input.binding.context_hash,
    snapshotSchemaVersion:
      input.snapshotSchemaVersion ?? M22_SNAPSHOT_SCHEMA_VERSION,
    reportSchemaVersion: input.reportSchemaVersion ?? M22_REPORT_SCHEMA_VERSION,
    frozenAt: detached.updated_at,
    decisionContext: detached,
    binding: { ...input.binding },
  });
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

  const existingInflight = inFlightByKey.get(key);
  if (existingInflight) return existingInflight;

  // Register BEFORE any await so concurrent duplicates coalesce.
  let resolveInflight!: (value: FreezeBoundReportResult) => void;
  const gate = new Promise<FreezeBoundReportResult>((resolve) => {
    resolveInflight = resolve;
  });
  inFlightByKey.set(key, gate);

  const run = (async (): Promise<FreezeBoundReportResult> => {
    let session = input.session;
    // Optional durable reload so concurrent writers see prior jobs.
    if (input.deps?.loadSession) {
      const fresh = await input.deps.loadSession(sessionId);
      if (fresh) session = fresh;
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
        reused: true,
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
    }

    // Generate (or continue/retry) under the original binding.
    return runGenerationOnJob({
      session,
      job,
      snapshot,
      deps: input.deps,
    });
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
    inFlightByKey.delete(key);
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

/** Test helper — clear in-flight coalescing map. */
export function __resetFreezeBoundReportInFlightForTests(): void {
  inFlightByKey.clear();
}
