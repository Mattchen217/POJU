/**
 * Unit E — DI2 Final Delivery Adapter (Batch2/3 → DI2 Report Store).
 *
 * Batch2 Generation completed ≠ DI2 report delivered. This adapter alone:
 *   1. Re-validates DI2 Job + Batch2 identity binding
 *   2. Re-checks Delivery Authorization
 *   3. Authority-gates every required Batch2 page
 *   4. Maps Authority outputs → DecisionReportPageRecord (not raw blobs)
 *   5. Builds Page 03 via code glossary rules
 *   6. sealDecisionReportDelivery → commitCompletedReport → verifyCompletedReportRecord
 *   7. Marks the DI2 job completed only after commit + verify succeed
 *
 * Does not: redesign Batch2 DAG, write Batch3 V3 as DI2 product, call the old
 * eight-page Runner, allocate a new Batch2 Generation, or overwrite conflict records.
 */

import {
  loadJobRawBlobs,
  type PageBlob,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch2/job-store";
import {
  readAuthorityGatedHistoricalPage,
  type AuthorityPageReadResult,
} from "@/lib/llm/pro/delivery/decision-report-v2/batch3/authority-page-read";
import { readGeneration } from "@/lib/llm/pro/delivery/decision-report-v2/batch3/generation-store";
import {
  hashCanonicalPayload,
  REPORT_PAGE_IDS,
  REPORT_UPSTREAM_SATISFYING_OUTCOMES,
} from "@/lib/llm/pro/delivery/decision-report-v2/orchestration";
import type { ReportPageId } from "@/lib/llm/pro/delivery/decision-report-v2/orchestration/types";
import {
  buildGlossaryAppendix,
  collectUsedTermIdsFromEvidence,
} from "@/lib/llm/pro/delivery/decision-report-v2/glossary-appendix";
import { isFace07NotApplicableOmit } from "@/lib/llm/pro/delivery/decision-report-v2/page07/report-inclusion";
import {
  encodePageSchemaFence,
  pageSchemaToArgumentBodies,
} from "@/lib/llm/pro/delivery/page-schema/render";
import type { DeliveryPageData } from "@/lib/llm/pro/delivery/page-schema/types";
import { DECISION_PAGE_IDS, type DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import { parseTermMarkers } from "@/lib/llm/sanitize/term-marking";
import { loadVerifiedFreezeRecord } from "@/lib/poju/decision-authority/server/freeze-authority";
import { loadVerifiedProfileRecord } from "@/lib/poju/decision-authority/server/profile-authority";
import { commitUnderDeliveryExecutionFence } from "@/lib/poju/final-delivery-execution-authority";
import { getXhighJob } from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import {
  evaluateExistingDi2Batch2Binding,
  type Di2Batch2IdentityBinding,
} from "./decision-report-batch2-identity";
import { assertDi2BoundBatch2JobEpoch } from "./decision-report-batch2-status";
import {
  sealDecisionReportDelivery,
  verifyDecisionReportDelivery,
} from "./decision-report-charge";
import { renderPageMarkdown } from "./decision-report-pages";
import {
  DI2_PAGE07_NOT_APPLICABLE_NOTE,
  type Di2PageStructured,
} from "./decision-report-render";
import { completedReportDraft } from "./decision-report-runner";
import {
  commitCompletedReport,
  DecisionReportStoreError,
  loadAnalysis,
  loadCompletedReport,
  saveAnalysis,
  savePage,
  verifyCompletedReportRecord,
  type CompletedReportRecord,
  type StoredAnalysis,
} from "./decision-report-store";
import {
  isDecisionReportJobInput,
  type DecisionReportJobInput,
  type DecisionReportJobResult,
  type DecisionReportPageRecord,
  type PersonalAnalysisRecord,
} from "./decision-report-types";

export type Di2Batch2FinalDeliveryErrorCode =
  | "missing_job"
  | "wrong_phase"
  | "invalid_job_input"
  | "binding_invalid"
  | "identity_mismatch"
  | "generation_missing"
  | "generation_stale"
  | "generation_epoch_mismatch"
  | "batch2_job_missing"
  | "batch2_job_unreadable"
  | "authority_unavailable"
  | "authority_invalid"
  | "page_incomplete"
  | "page_fingerprint_mismatch"
  | "page_map_failed"
  | "analysis_incomplete"
  | "delivery_denied"
  | "delivery_unconfirmed"
  | "delivery_seal_failed"
  | "report_persist_failed"
  | "report_conflict"
  | "report_verify_failed"
  | "job_complete_unconfirmed"
  | "kv_unavailable"
  | "freeze_mismatch"
  | "profile_mismatch";

export type Di2Batch2FinalDeliveryResult =
  | {
      ok: true;
      outcome: "written" | "existing";
      record: CompletedReportRecord;
      job: PojuXhighJob;
    }
  | {
      ok: false;
      code: Di2Batch2FinalDeliveryErrorCode;
      detail: string;
      retryable: boolean;
      /** True when Delivery Authorization denied — callers must not expose page content. */
      delivery_denied?: boolean;
      /** Commit may have written but verify/complete was uncertain — recoverable, not success. */
      unconfirmed?: boolean;
    };

/** @internal tests only — Freeze/Profile identity snapshot (MemoryKv; no live signing). */
let __finalDeliveryAuthoritySnapshotForTests: {
  freeze: {
    session_id: string;
    freeze_id: string;
    context_id: string;
    context_version: number;
    context_hash: string;
    freeze_receipt_id?: string;
    decision_question?: string | null;
  };
  profile: {
    session_id: string;
    freeze_id: string;
    profile_id: string | null;
    profile_hash: string;
    profile_receipt_id?: string;
  };
} | null = null;

/** @internal tests only */
export function __setDi2Batch2FinalDeliveryAuthoritySnapshotForTests(
  snapshot: typeof __finalDeliveryAuthoritySnapshotForTests,
): void {
  __finalDeliveryAuthoritySnapshotForTests = snapshot;
}

/** @internal tests only — force commitCompletedReport path outcomes. */
let __finalDeliveryCommitHookForTests:
  | ((draft: unknown) => Promise<
      | { ok: true; record: CompletedReportRecord; outcome: "written" | "existing" }
      | { ok: false; code: string; message: string }
    >)
  | null = null;

/** @internal tests only */
export function __setDi2Batch2FinalDeliveryCommitHookForTests(
  fn: typeof __finalDeliveryCommitHookForTests,
): void {
  __finalDeliveryCommitHookForTests = fn;
}

const SATISFYING = new Set<string>(REPORT_UPSTREAM_SATISFYING_OUTCOMES);

function fail(
  code: Di2Batch2FinalDeliveryErrorCode,
  detail: string,
  opts: { retryable?: boolean; delivery_denied?: boolean; unconfirmed?: boolean } = {},
): Di2Batch2FinalDeliveryResult {
  return {
    ok: false,
    code,
    detail,
    retryable: opts.retryable ?? false,
    delivery_denied: opts.delivery_denied,
    unconfirmed: opts.unconfirmed,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function assertJobIdentity(job: PojuXhighJob, ji: DecisionReportJobInput): Di2Batch2FinalDeliveryResult | null {
  if (job.phase !== "decision_report") {
    return fail("wrong_phase", `expected decision_report, got ${job.phase}`);
  }
  if (typeof job.execution_generation !== "number" || !Number.isFinite(job.execution_generation)) {
    return fail("invalid_job_input", "execution_generation missing");
  }
  if (!job.job_id?.trim()) {
    return fail("invalid_job_input", "job_id missing");
  }
  if (!ji.session_id || ji.session_id !== job.session_id) {
    return fail("identity_mismatch", "session_id mismatch");
  }
  if (!ji.freeze_id || !ji.context_id || !ji.context_hash || !ji.report_job_id) {
    return fail("invalid_job_input", "Freeze/Context/report_job_id incomplete");
  }
  if (typeof ji.context_version !== "number" || !Number.isFinite(ji.context_version)) {
    return fail("invalid_job_input", "context_version invalid");
  }
  if (!ji.profile_hash) {
    return fail("invalid_job_input", "profile_hash missing");
  }
  return null;
}

/**
 * Map Authority-sealed face / page_schema output → user-facing markdown.
 * Never writes raw Batch2 Job blobs into the DI2 Store.
 */
export function mapAuthorityOutputToMarkdown(
  page_id: DecisionPageId,
  output: unknown,
  locale: string,
): string {
  if (output == null) {
    throw new Error(`page_${page_id}_missing_output`);
  }

  if (page_id === "07" && isFace07NotApplicableOmit(output)) {
    return DI2_PAGE07_NOT_APPLICABLE_NOTE(locale);
  }

  try {
    const bodies = pageSchemaToArgumentBodies(output as DeliveryPageData);
    if (bodies.length > 0) {
      const md = bodies.map((b) => b.body).join("\n\n").trim();
      if (md) {
        try {
          return `${md}\n\n${encodePageSchemaFence(output as DeliveryPageData)}`;
        } catch {
          return md;
        }
      }
    }
  } catch {
    // Fall through to stub / string shapes used in MemoryKv tests.
  }

  if (typeof output === "string" && output.trim()) return output.trim();
  if (output && typeof output === "object") {
    const rec = output as Record<string, unknown>;
    if (typeof rec.body === "string" && rec.body.trim()) return rec.body.trim();
    if (typeof rec.content_markdown === "string" && rec.content_markdown.trim()) {
      return rec.content_markdown.trim();
    }
  }
  throw new Error(`page_${page_id}_unmappable_output`);
}

function pageApplicability(
  page_id: DecisionPageId,
  outcome: string,
  output: unknown,
  ji: DecisionReportJobInput,
): DecisionReportPageRecord["applicability"] {
  if (page_id === "07") {
    if (
      outcome === "skipped_not_applicable" ||
      isFace07NotApplicableOmit(output) ||
      ji.page07_applies === false
    ) {
      return "not_applicable";
    }
  }
  return "applies";
}

function collectTermIdsFromMarkdown(markdowns: readonly string[]): string[] {
  const lists: string[][] = [];
  for (const md of markdowns) {
    const ids: string[] = [];
    for (const m of parseTermMarkers(md)) {
      if (m.id) ids.push(m.id);
    }
    lists.push(ids);
  }
  return collectUsedTermIdsFromEvidence(lists);
}

function buildPage03Record(input: {
  job: PojuXhighJob;
  ji: DecisionReportJobInput;
  analysis_id: string;
  locale: string;
  priorMarkdowns: readonly string[];
  generated_at: string;
}): DecisionReportPageRecord {
  const usedTermIds = collectTermIdsFromMarkdown(input.priorMarkdowns);
  let glossaryPage: Di2PageStructured | null = null;
  let applicability: DecisionReportPageRecord["applicability"] = "not_applicable";
  let content_markdown = "";

  if (usedTermIds.length > 0) {
    const glossary = buildGlossaryAppendix({
      locale: input.locale,
      usedTermIds,
    });
    if (glossary) {
      glossaryPage = {
        page_id: "03",
        title: glossary.page_title,
        blocks: [],
        appendix: {
          kind: "glossary_appendix",
          reading_note: glossary.reading_note,
          term_ids: [...glossary.term_ids],
        },
      };
      applicability = "applies";
      content_markdown = renderPageMarkdown(glossaryPage, new Map(), input.locale);
    }
  }
  // No term markers → omit appendix (existing DI2 contract: not_applicable + empty).

  return {
    page_id: "03",
    status: "completed",
    applicability,
    content_markdown,
    structured: glossaryPage as unknown as Record<string, unknown> | null,
    job_id: input.job.job_id,
    execution_generation: input.job.execution_generation as number,
    freeze_id: input.ji.freeze_id,
    context_hash: input.ji.context_hash,
    report_schema_version: input.ji.report_schema_version,
    analysis_id: input.analysis_id,
    attempts: 1,
    generated_at: input.generated_at,
    error: null,
  };
}

/** Full DI2 Job ↔ Personal Analysis identity (null profile_id is exact, not a wildcard). */
function analysisIdentityMatches(
  rec: PersonalAnalysisRecord,
  ji: DecisionReportJobInput,
): boolean {
  return (
    rec.idempotency_key === ji.analysis_key &&
    rec.session_id === ji.session_id &&
    rec.freeze_id === ji.freeze_id &&
    rec.context_id === ji.context_id &&
    rec.context_version === ji.context_version &&
    rec.context_hash === ji.context_hash &&
    rec.profile_id === ji.profile_id &&
    rec.profile_hash === ji.profile_hash &&
    rec.analysis_schema_version === ji.analysis_schema_version
  );
}

/**
 * Resolve Personal Analysis for Final Delivery.
 *
 * - completed + full identity + analysis_result → reuse
 * - pending / running → do not overwrite; retryable fail (analysis still in flight)
 * - failed → fail closed; do not rewrite as unavailable
 * - unavailable + full identity + null result → reuse
 * - no record → honest unavailable seal (never forge completed)
 * - identity mismatch on durable records → fail closed (never silent rewrite)
 */
async function ensureAnalysisForDelivery(
  job: PojuXhighJob,
  ji: DecisionReportJobInput,
): Promise<{ ok: true; analysis: PersonalAnalysisRecord } | Di2Batch2FinalDeliveryResult> {
  void job;
  const existing = await loadAnalysis(ji.analysis_key).catch(() => null);

  if (!existing) {
    // No mappable PersonalAnalysisArtifact in Batch2 Authority page outputs.
    const t = nowIso();
    const record: PersonalAnalysisRecord = {
      analysis_id: `pa_${ji.freeze_id.replace(/[^a-zA-Z0-9]/g, "")}_${ji.profile_hash.slice(0, 12)}`,
      idempotency_key: ji.analysis_key,
      session_id: ji.session_id,
      freeze_id: ji.freeze_id,
      context_id: ji.context_id,
      context_version: ji.context_version,
      context_hash: ji.context_hash,
      profile_id: ji.profile_id,
      profile_hash: ji.profile_hash,
      analysis_schema_version: ji.analysis_schema_version,
      status: "unavailable",
      attempts: 0,
      generated_at: null,
      updated_at: t,
      analysis_result: null,
      error: "personal_analysis_not_generated_for_batch2_final_delivery",
      retryable: false,
      model: null,
      tokens_used: 0,
    };
    const saved = await saveAnalysis({ record, projection: null });
    if (saved.record.status === "completed" && saved.record.analysis_result) {
      if (analysisIdentityMatches(saved.record, ji)) {
        return { ok: true, analysis: saved.record };
      }
      return fail("analysis_incomplete", "concurrent Personal Analysis identity mismatch");
    }
    if (saved.record.status !== "unavailable" || saved.record.analysis_result != null) {
      return fail("analysis_incomplete", "Personal Analysis unavailable seal failed", {
        retryable: true,
      });
    }
    if (!analysisIdentityMatches(saved.record, ji)) {
      return fail("analysis_incomplete", "Personal Analysis unavailable seal identity mismatch");
    }
    return { ok: true, analysis: saved.record };
  }

  const rec = existing.record;

  if (rec.status === "pending" || rec.status === "running") {
    return fail(
      "analysis_incomplete",
      `Personal Analysis still ${rec.status} — Final Delivery will not overwrite in-flight analysis`,
      { retryable: true },
    );
  }

  if (rec.status === "failed") {
    return fail(
      "analysis_incomplete",
      "Personal Analysis failed — refuse Final Delivery without rewriting as unavailable",
    );
  }

  if (rec.status === "completed") {
    if (!rec.analysis_result) {
      return fail(
        "analysis_incomplete",
        "Personal Analysis marked completed but analysis_result is missing",
      );
    }
    if (!analysisIdentityMatches(rec, ji)) {
      return fail(
        "analysis_incomplete",
        "Personal Analysis identity ≠ DI2 Job (full Freeze/Context/Profile/schema)",
      );
    }
    return { ok: true, analysis: rec };
  }

  if (rec.status === "unavailable") {
    if (rec.analysis_result != null) {
      return fail(
        "analysis_incomplete",
        "unavailable Personal Analysis must not carry an analysis_result",
      );
    }
    if (!analysisIdentityMatches(rec, ji)) {
      return fail(
        "analysis_incomplete",
        "unavailable Personal Analysis identity ≠ DI2 Job — will not overwrite",
      );
    }
    return { ok: true, analysis: rec };
  }

  return fail(
    "analysis_incomplete",
    `Personal Analysis status=${String(rec.status)} is not deliverable`,
  );
}

type GatedPage = {
  page_id: ReportPageId;
  outcome: string;
  output: unknown;
  output_fingerprint: string;
  gated: AuthorityPageReadResult;
};

async function loadAuthorityPages(input: {
  binding: Di2Batch2IdentityBinding;
  blobs: Map<string, PageBlob>;
}): Promise<{ ok: true; pages: GatedPage[] } | Di2Batch2FinalDeliveryResult> {
  const pages: GatedPage[] = [];
  for (const page_id of REPORT_PAGE_IDS) {
    const blob = input.blobs.get(page_id) ?? null;
    let gated: AuthorityPageReadResult;
    try {
      gated = await readAuthorityGatedHistoricalPage({
        report_id: input.binding.report_id,
        generation_id: input.binding.generation_id,
        generation_epoch: input.binding.batch3_generation_epoch,
        page_id,
        blob,
      });
    } catch (e) {
      return fail(
        "authority_unavailable",
        `Authority gate threw for page ${page_id}: ${e instanceof Error ? e.message : String(e)}`,
        { retryable: true },
      );
    }

    if (gated.verdict === "unavailable") {
      return fail("authority_unavailable", `page ${page_id}: ${gated.detail}`, {
        retryable: true,
      });
    }
    if (gated.verdict === "not_terminal" || gated.verdict === "missing") {
      return fail("page_incomplete", `page ${page_id}: ${gated.detail}`);
    }
    if (gated.verdict !== "valid" || !gated.authority_output) {
      return fail("authority_invalid", `page ${page_id}: verdict=${gated.verdict} ${gated.detail}`);
    }

    const outcome = gated.state?.outcome ?? blob?.state?.outcome ?? "";
    if (!SATISFYING.has(outcome)) {
      return fail("page_incomplete", `page ${page_id}: outcome=${outcome} not terminal`);
    }

    const output = gated.authority_output.output;
    const fp = gated.authority_output.output_fingerprint;
    if (!fp || typeof fp !== "string") {
      return fail("page_fingerprint_mismatch", `page ${page_id}: missing Authority fingerprint`);
    }
    if (output != null) {
      const recomputed = hashCanonicalPayload(output);
      if (recomputed !== fp) {
        return fail(
          "page_fingerprint_mismatch",
          `page ${page_id}: content fingerprint ≠ Authority`,
        );
      }
    } else if (outcome === "completed") {
      return fail("page_incomplete", `page ${page_id}: completed without Authority output`);
    }

    // Page 07 may be skipped without output; other pages require sealed output.
    if (page_id !== "07" && output == null) {
      return fail("page_incomplete", `page ${page_id}: missing Authority output`);
    }
    if (
      page_id === "07" &&
      outcome === "completed" &&
      output == null
    ) {
      return fail("page_incomplete", "page 07 completed without Authority output");
    }

    pages.push({
      page_id,
      outcome,
      output,
      output_fingerprint: fp,
      gated,
    });
  }
  return { ok: true, pages };
}

function buildFullText(
  pages: DecisionReportPageRecord[],
  locale: string,
): string {
  const parts: string[] = [];
  for (const id of DECISION_PAGE_IDS) {
    const p = pages.find((x) => x.page_id === id);
    if (!p || p.status !== "completed") continue;
    if (p.applicability === "not_applicable" && !p.content_markdown.trim()) continue;
    if (!p.content_markdown.trim()) continue;
    parts.push(`## Page ${id}\n\n${p.content_markdown.trim()}`);
  }
  void locale;
  return parts.join("\n\n---\n\n");
}

async function markJobCompleted(
  job: PojuXhighJob,
  record: CompletedReportRecord,
): Promise<Di2Batch2FinalDeliveryResult> {
  const generation = job.execution_generation;
  if (typeof generation !== "number") {
    return fail("invalid_job_input", "execution_generation missing at complete");
  }
  const committed = await commitUnderDeliveryExecutionFence(job.job_id, generation, (cur) => ({
    ...cur,
    status: "completed",
    current_stage: "assemble",
    result: record.result,
    completed_at: Date.now(),
    accumulated_content: "completed",
    error: undefined,
    failure_reason: undefined,
    retryable: undefined,
  }));
  if (!committed.ok) {
    const latest = await getXhighJob(job.job_id).catch(() => null);
    if (
      latest?.status === "completed" &&
      latest.execution_generation === generation &&
      isDecisionReportJobInput(latest.input)
    ) {
      return { ok: true, outcome: "existing", record, job: latest };
    }
    return fail(
      "job_complete_unconfirmed",
      `commitUnderDeliveryExecutionFence: ${committed.reason}`,
      { retryable: true, unconfirmed: true },
    );
  }
  const after = (await getXhighJob(job.job_id)) ?? committed.job;
  return { ok: true, outcome: "written", record, job: after ?? committed.job };
}

/**
 * Attempt DI2 Final Delivery for a Batch2-bound decision_report job.
 * Idempotent: existing same-identity same-content records reuse; conflicts refuse.
 */
export async function attemptDi2Batch2FinalDelivery(
  jobInput: PojuXhighJob | string,
  opts?: {
    /** Optional one-shot Freeze/Profile snapshot (Continue MemoryKv tests). */
    authority_snapshot?: typeof __finalDeliveryAuthoritySnapshotForTests;
  },
): Promise<Di2Batch2FinalDeliveryResult> {
  const prevSnap = __finalDeliveryAuthoritySnapshotForTests;
  if (opts?.authority_snapshot && !prevSnap) {
    __finalDeliveryAuthoritySnapshotForTests = opts.authority_snapshot;
  }
  try {
    return await attemptDi2Batch2FinalDeliveryBody(jobInput);
  } finally {
    if (opts?.authority_snapshot && !prevSnap) {
      __finalDeliveryAuthoritySnapshotForTests = prevSnap;
    }
  }
}

async function attemptDi2Batch2FinalDeliveryBody(
  jobInput: PojuXhighJob | string,
): Promise<Di2Batch2FinalDeliveryResult> {
  const job =
    typeof jobInput === "string" ? await getXhighJob(jobInput).catch(() => null) : jobInput;
  if (!job) return fail("missing_job", "DI2 job missing", { retryable: true });
  if (!isDecisionReportJobInput(job.input)) {
    return fail("invalid_job_input", "job.input is not DecisionReportJobInput");
  }
  const ji = job.input;

  const idErr = assertJobIdentity(job, ji);
  if (idErr) return idErr;

  // Delivery Authorization first — never leak page content on denial.
  const delivery = await verifyDecisionReportDelivery(job);
  if (!delivery.ok) {
    return fail("delivery_denied", `Delivery Authorization failed: ${delivery.reason}`, {
      delivery_denied: true,
      retryable: Boolean(delivery.unreadable),
    });
  }

  // Already delivered?
  try {
    const existing = await loadCompletedReport(job.session_id, job.job_id);
    if (existing) {
      verifyCompletedReportRecord(existing);
      if (
        existing.report_job_id !== ji.report_job_id ||
        existing.freeze_id !== ji.freeze_id ||
        existing.context_hash !== ji.context_hash ||
        existing.profile_hash !== ji.profile_hash ||
        existing.execution_generation !== job.execution_generation
      ) {
        return fail("report_conflict", "existing completed report identity ≠ current job");
      }
      if (job.status === "completed") {
        return { ok: true, outcome: "existing", record: existing, job };
      }
      const marked = await markJobCompleted(job, existing);
      if (marked.ok) return { ...marked, outcome: "existing" };
      return marked;
    }
  } catch (e) {
    if (e instanceof DecisionReportStoreError && e.code === "REPORT_RECORD_INVALID") {
      return fail("report_verify_failed", e.message, { retryable: true, unconfirmed: true });
    }
    // absent is fine; unreadable → fail closed
    if (e instanceof DecisionReportStoreError) {
      return fail("kv_unavailable", e.message, { retryable: true });
    }
  }

  const evaluated = evaluateExistingDi2Batch2Binding(job);
  if (!evaluated.ok) {
    return fail("binding_invalid", `${evaluated.code}: ${evaluated.detail}`);
  }
  const binding = evaluated.binding;

  // Live Freeze / Profile still match this Job.
  const authSnap = __finalDeliveryAuthoritySnapshotForTests;
  if (authSnap) {
    if (
      authSnap.freeze.session_id !== ji.session_id ||
      authSnap.freeze.freeze_id !== ji.freeze_id ||
      authSnap.freeze.context_id !== ji.context_id ||
      authSnap.freeze.context_version !== ji.context_version ||
      authSnap.freeze.context_hash !== ji.context_hash
    ) {
      return fail("freeze_mismatch", "Freeze Context no longer matches DI2 Job (snapshot)");
    }
    if (
      authSnap.freeze.freeze_receipt_id &&
      ji.freeze_receipt_id &&
      authSnap.freeze.freeze_receipt_id !== ji.freeze_receipt_id
    ) {
      return fail("freeze_mismatch", "Freeze receipt ≠ job binding (snapshot)");
    }
    if (
      authSnap.profile.session_id !== ji.session_id ||
      authSnap.profile.freeze_id !== ji.freeze_id ||
      authSnap.profile.profile_hash !== ji.profile_hash
    ) {
      return fail("profile_mismatch", "Profile hash ≠ DI2 Job (snapshot)");
    }
    if (
      authSnap.profile.profile_receipt_id &&
      ji.profile_receipt_id &&
      authSnap.profile.profile_receipt_id !== ji.profile_receipt_id
    ) {
      return fail("profile_mismatch", "Profile receipt ≠ job binding (snapshot)");
    }
  } else {
    try {
      const freeze = await loadVerifiedFreezeRecord(ji.session_id, ji.freeze_id);
      if (
        freeze.context_hash !== ji.context_hash ||
        freeze.context_id !== ji.context_id ||
        freeze.context_version !== ji.context_version
      ) {
        return fail("freeze_mismatch", "Freeze Context no longer matches DI2 Job");
      }
      if (ji.freeze_receipt_id && freeze.receipt.receipt_id !== ji.freeze_receipt_id) {
        return fail("freeze_mismatch", "Freeze receipt ≠ job binding");
      }
      const profile = await loadVerifiedProfileRecord({
        session_id: ji.session_id,
        freeze,
        profile_hash: ji.profile_hash,
      });
      if (profile.profile_hash !== ji.profile_hash) {
        return fail("profile_mismatch", "Profile hash ≠ DI2 Job");
      }
      if (ji.profile_receipt_id && profile.receipt.receipt_id !== ji.profile_receipt_id) {
        return fail("profile_mismatch", "Profile receipt ≠ job binding");
      }
    } catch (e) {
      return fail(
        "freeze_mismatch",
        `Freeze/Profile re-verify failed: ${e instanceof Error ? e.message : String(e)}`,
        { retryable: true },
      );
    }
  }

  const gen = await readGeneration(binding.report_id, binding.generation_id);
  if (!gen.ok) {
    return fail("kv_unavailable", gen.detail ?? gen.code, { retryable: true });
  }
  if (!gen.value) {
    return fail("generation_missing", "Batch3 GenerationRecord missing");
  }
  if (gen.value.generation_epoch !== binding.batch3_generation_epoch) {
    return fail(
      "generation_epoch_mismatch",
      `live_epoch=${gen.value.generation_epoch} binding_epoch=${binding.batch3_generation_epoch}`,
    );
  }
  if (
    gen.value.status === "superseded" ||
    gen.value.status === "failed" ||
    gen.value.status === "cancelled"
  ) {
    return fail("generation_stale", `generation status=${gen.value.status}`);
  }
  if (
    gen.value.status !== "completed" &&
    gen.value.status !== "finalizing" &&
    gen.value.status !== "delivery_failed"
  ) {
    // Production still running — not ready for Final Delivery.
    return fail("page_incomplete", `generation status=${gen.value.status} — not ready`);
  }

  const blobs = await loadJobRawBlobs(binding.report_id, binding.generation_id);
  if (!blobs.ok) {
    return fail("batch2_job_unreadable", blobs.detail ?? blobs.code, { retryable: true });
  }
  if (!blobs.value) {
    return fail("batch2_job_missing", "Batch2 Job missing");
  }
  const meta = blobs.value.meta;
  if (
    meta.report_id !== binding.report_id ||
    meta.generation_id !== binding.generation_id
  ) {
    return fail("identity_mismatch", "Batch2 Job identity ≠ binding");
  }
  const epochCheck = assertDi2BoundBatch2JobEpoch(
    meta.generation_epoch,
    binding.batch3_generation_epoch,
  );
  if (!epochCheck.ok) {
    return fail("generation_epoch_mismatch", epochCheck.detail);
  }

  const gated = await loadAuthorityPages({
    binding,
    blobs: blobs.value.pages,
  });
  if (!("pages" in gated)) return gated;

  const analysisReady = await ensureAnalysisForDelivery(job, ji);
  if (!("analysis" in analysisReady)) return analysisReady;
  const analysis = analysisReady.analysis;

  const locale = job.locale || ji.locale || "en";
  const generated_at = nowIso();
  const mapped: DecisionReportPageRecord[] = [];
  const markdowns: string[] = [];

  for (const g of gated.pages) {
    const page_id = g.page_id as DecisionPageId;
    const applicability = pageApplicability(page_id, g.outcome, g.output, ji);
    let content_markdown = "";
    let structured: Record<string, unknown> | null = null;
    try {
      if (applicability === "not_applicable" && page_id === "07") {
        content_markdown = DI2_PAGE07_NOT_APPLICABLE_NOTE(locale);
        structured = g.output && typeof g.output === "object"
          ? (g.output as Record<string, unknown>)
          : null;
      } else {
        content_markdown = mapAuthorityOutputToMarkdown(page_id, g.output, locale);
        structured =
          g.output && typeof g.output === "object"
            ? (g.output as Record<string, unknown>)
            : { authority_output: g.output };
      }
    } catch (e) {
      return fail(
        "page_map_failed",
        `page ${page_id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (applicability === "applies" && !content_markdown.trim()) {
      return fail("page_incomplete", `page ${page_id}: empty mapped markdown`);
    }
    markdowns.push(content_markdown);
    mapped.push({
      page_id,
      status: "completed",
      applicability,
      content_markdown,
      structured,
      job_id: job.job_id,
      execution_generation: job.execution_generation as number,
      freeze_id: ji.freeze_id,
      context_hash: ji.context_hash,
      report_schema_version: ji.report_schema_version,
      analysis_id: analysis.analysis_id,
      attempts: 1,
      generated_at,
      error: null,
    });
  }

  const page03 = buildPage03Record({
    job,
    ji,
    analysis_id: analysis.analysis_id,
    locale,
    priorMarkdowns: markdowns,
    generated_at,
  });
  mapped.push(page03);

  // Stable DECISION_PAGE_IDS order for Store verify.
  const pagesOrdered: DecisionReportPageRecord[] = [];
  for (const id of DECISION_PAGE_IDS) {
    const p = mapped.find((x) => x.page_id === id);
    if (!p) return fail("page_incomplete", `mapped set missing page ${id}`);
    pagesOrdered.push(p);
  }

  const full_text = buildFullText(pagesOrdered, locale);
  if (!full_text.trim()) {
    return fail("page_incomplete", "assembled full_text empty");
  }

  const result: DecisionReportJobResult = {
    kind: "decision_intake_report",
    report_job_id: ji.report_job_id,
    analysis_id: analysis.analysis_id,
    freeze_id: ji.freeze_id,
    context_hash: ji.context_hash,
    report_schema_version: ji.report_schema_version,
    execution_generation: job.execution_generation as number,
    page_ids: [...DECISION_PAGE_IDS],
    full_text,
    model: analysis.model ?? "batch2_authority",
    tokens_used: analysis.tokens_used ?? 0,
    completed_at: generated_at,
  };

  // Re-check Delivery Authorization immediately before seal/commit.
  const deliveryAgain = await verifyDecisionReportDelivery(job);
  if (!deliveryAgain.ok) {
    return fail("delivery_denied", `Delivery Authorization revoked before commit: ${deliveryAgain.reason}`, {
      delivery_denied: true,
      retryable: Boolean(deliveryAgain.unreadable),
    });
  }

  const sealed = await sealDecisionReportDelivery(job);
  if (!sealed.ok) {
    return fail(
      sealed.unreadable ? "delivery_unconfirmed" : "delivery_seal_failed",
      `sealDecisionReportDelivery: ${sealed.reason}`,
      {
        delivery_denied: !sealed.unreadable,
        retryable: true,
        unconfirmed: sealed.unreadable,
      },
    );
  }

  const draft = completedReportDraft(
    ji,
    job.job_id,
    job.execution_generation as number,
    analysis,
    pagesOrdered,
    result,
    generated_at,
  );

  let commitOutcome: { record: CompletedReportRecord; outcome: "written" | "existing" };
  try {
    if (__finalDeliveryCommitHookForTests) {
      const hooked = await __finalDeliveryCommitHookForTests(draft);
      if (!hooked.ok) {
        throw new DecisionReportStoreError(hooked.code, hooked.message);
      }
      commitOutcome = { record: hooked.record, outcome: hooked.outcome };
    } else {
      commitOutcome = await commitCompletedReport(draft);
    }
  } catch (e) {
    if (e instanceof DecisionReportStoreError) {
      if (e.code === "REPORT_RECORD_CONFLICT") {
        return fail("report_conflict", e.message);
      }
      if (e.code === "REPORT_PERSIST_UNCONFIRMED") {
        return fail("delivery_unconfirmed", e.message, {
          retryable: true,
          unconfirmed: true,
        });
      }
      if (e.code === "REPORT_RECORD_INVALID") {
        return fail("report_verify_failed", e.message);
      }
      return fail("report_persist_failed", `${e.code}: ${e.message}`, { retryable: true });
    }
    return fail(
      "report_persist_failed",
      e instanceof Error ? e.message : String(e),
      { retryable: true },
    );
  }

  try {
    verifyCompletedReportRecord(commitOutcome.record);
    const back = await loadCompletedReport(job.session_id, job.job_id);
    if (!back || back.record_hash !== commitOutcome.record.record_hash) {
      return fail(
        "delivery_unconfirmed",
        "completed report not confirmed on re-read",
        { retryable: true, unconfirmed: true },
      );
    }
  } catch (e) {
    return fail(
      "report_verify_failed",
      e instanceof Error ? e.message : String(e),
      { retryable: true, unconfirmed: true },
    );
  }

  // Persist DI2 page checkpoints for Reader rebuild paths (idempotent completed pages).
  for (const p of pagesOrdered) {
    await savePage({
      record: p,
      structured:
        p.structured &&
        typeof p.structured === "object" &&
        "page_id" in p.structured &&
        "blocks" in p.structured
          ? (p.structured as unknown as Di2PageStructured)
          : null,
    }).catch(() => undefined);
  }

  const marked = await markJobCompleted(job, commitOutcome.record);
  if (!marked.ok) return marked;
  return {
    ok: true,
    outcome: commitOutcome.outcome,
    record: commitOutcome.record,
    job: marked.job,
  };
}
