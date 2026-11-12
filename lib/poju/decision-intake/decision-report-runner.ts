/**
 * M3 — Decision Intake 2.0 report stage runner (server).
 *
 *   finalize  → Personal Analysis (idempotent per session+freeze+hash+profile+schema)
 *   segments  → eight pages in dependency waves, one model wave per invoke,
 *               per-page KV checkpoint (completed pages are never rewritten)
 *   assemble  → integrity check of all eight pages against the job binding,
 *               durable report record (idempotent), then fenced formal completion
 *               of the xhigh job
 *
 * Reuses the legacy relay (continue route / Inngest / QStash), continue lease +
 * ACK, job fuse, deploy kill-switch and the session execution fence. Data comes
 * only from the server Freeze / profile registries — never from agent_v2,
 * breakthrough_core or covered_agenda.
 */

import { ephemeralRemainingMs, isEphemeralKvActive } from "@/lib/kv/client";
import {
  bumpDeliveryJobContinueHop,
  hasLiveDeliveryContinueForStage,
  refreshDeliveryContinueLease,
  releaseDeliveryContinueLease,
  forceReleaseDeliveryContinueLease,
  tryAcquireDeliveryContinueLease,
  type DeliveryPipelineStage,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import {
  DELIVERY_JOB_MAX_CONTINUE_HOPS,
  isDeliveryJobContinueHopExceeded,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { DECISION_PAGE_IDS, type DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";
import {
  assertDeliveryExecutionAuthority,
  commitUnderDeliveryExecutionFence,
  DeliveryExecutionRevokedError,
} from "@/lib/poju/final-delivery-execution-authority";
import { getFdExecutionFence, getXhighJob, releaseXhighSessionLock } from "@/lib/poju/xhigh-job-store";
import type { PojuXhighJob } from "@/lib/poju/xhigh-job-types";
import {
  DI2_MAX_UNIT_ATTEMPTS,
  DI2_PAGE_UPSTREAM,
  DI2_PAGE_WAVES,
  isDecisionReportJobInput,
  type DecisionReportJobInput,
  type DecisionReportJobResult,
  type DecisionReportPageRecord,
  type PersonalAnalysisRecord,
} from "./decision-report-types";
import {
  buildAppendixPage,
  buildReportEvidenceIndex,
  renderPageMarkdown,
  runDecisionReportPageModel,
} from "./decision-report-pages";
import {
  DI2_PAGE07_NOT_APPLICABLE_NOTE,
  renderDi2BookMarkdown,
  type Di2PageStructured,
} from "./decision-report-render";
import {
  commitCompletedReport,
  DecisionReportStoreError,
  loadAllPages,
  loadAnalysis,
  loadPage,
  loadRegisteredFreeze,
  loadRegisteredProfile,
  markDecisionReportDispatch,
  saveAnalysis,
  savePage,
  withdrawCompletedReport,
  type CompletedReportDraft,
  type CompletedReportRecord,
  type RegisteredFreeze,
  type StoredAnalysis,
  type StoredPage,
} from "./decision-report-store";
import { assertCompleteEightPageReport } from "./freeze-bound-report";
import {
  buildProfileProjection,
  runPersonalAnalysisModel,
  type ProfileProjection,
} from "./personal-analysis";

const HEARTBEAT_MS = 12_000;

type StageOpts = { lease_token?: string };

type Ctx = {
  job: PojuXhighJob;
  input: DecisionReportJobInput;
  generation: number;
  lease_token: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function di2Log(event: string, detail: Record<string, unknown>): void {
  console.info(`[decision-report] ${event}`, detail);
}

async function releaseRelay(job_id: string, session_id: string, lease_token: string | null): Promise<void> {
  if (lease_token) await releaseDeliveryContinueLease(job_id, lease_token).catch(() => undefined);
  await releaseXhighSessionLock("decision_report", session_id).catch(() => undefined);
}

/**
 * How a stopped run may be resumed:
 *  - interrupted / report_persist_failed: infrastructure; Continue (also automatic) resumes
 *    from checkpoints;
 *  - quality_exhausted: a unit spent its production 1+1; only a user Continue re-arms it;
 *  - fatal: Continue cannot help (sources gone, integrity broken) — Regenerate.
 */
type FailureKind = "interrupted" | "report_persist_failed" | "quality_exhausted" | "fatal";

/** Fenced terminal failure. Stale generations cannot stamp a newer execution. */
async function failDecisionReportJob(
  ctx: Ctx,
  stage: DeliveryPipelineStage,
  error: string,
  opts: { kind: FailureKind },
): Promise<void> {
  const retryable = opts.kind !== "fatal";
  const committed = await commitUnderDeliveryExecutionFence(ctx.job.job_id, ctx.generation, (job) => ({
    ...job,
    status: "failed",
    error: error.slice(0, 500),
    retryable,
    failure_reason: retryable ? opts.kind as Exclude<FailureKind, "fatal"> : "parse_failed",
    current_stage: stage,
    accumulated_content: `failed:${stage}`,
  }));
  if (!committed.ok) {
    di2Log("fail stamp fenced out", { job_id: ctx.job.job_id, reason: committed.reason });
  }
  await releaseRelay(ctx.job.job_id, ctx.input.session_id, ctx.lease_token);
}

/** Touch the job under the fence immediately before a checkpoint write. */
async function fenceTouch(ctx: Ctx, stage: DeliveryPipelineStage, note: string): Promise<boolean> {
  const r = await commitUnderDeliveryExecutionFence(ctx.job.job_id, ctx.generation, (job) => ({
    ...job,
    status: "running",
    current_stage: stage,
    accumulated_content: `${note}:${Date.now()}`,
  }));
  if (!r.ok) di2Log("fence revoked", { job_id: ctx.job.job_id, stage, reason: r.reason });
  return r.ok;
}

/**
 * Hand off to a fresh invoke. Same order as the legacy relay:
 * fuse → fenced status touch → release lease → dispatch → ACK/lease proof.
 */
async function scheduleNext(ctx: Ctx, stage: DeliveryPipelineStage): Promise<void> {
  const job_id = ctx.job.job_id;
  const hops = await bumpDeliveryJobContinueHop(job_id);
  if (isDeliveryJobContinueHopExceeded(hops)) {
    await failDecisionReportJob(
      ctx,
      stage,
      `job_continue_budget_exhausted:hops=${hops}:max=${DELIVERY_JOB_MAX_CONTINUE_HOPS}`,
      { kind: "interrupted" },
    );
    return;
  }
  {
    const { resolveDeliveryWallFuse } = await import("@/lib/llm/pro/delivery/pipeline-v3/wall-tail");
    const wall = await resolveDeliveryWallFuse({ job_id, created_at: ctx.job.created_at, stage });
    if (wall.tripped) {
      await failDecisionReportJob(
        ctx,
        stage,
        `job_time_budget_exhausted:age_ms=${Date.now() - ctx.job.created_at}:max_ms=${wall.limit_ms}`,
        { kind: "interrupted" },
      );
      return;
    }
  }
  if (!(await fenceTouch(ctx, stage, `handoff_continue:${stage}`))) {
    await releaseDeliveryContinueLease(job_id, ctx.lease_token).catch(() => undefined);
    return;
  }
  const inline = isEphemeralKvActive();
  // Before the lease drops: the hand-off window must not look like a dead worker.
  if (!inline) await markDecisionReportDispatch(job_id, stage).catch(() => undefined);
  await releaseDeliveryContinueLease(job_id, ctx.lease_token).catch(() => undefined);

  if (inline) {
    const remain = ephemeralRemainingMs();
    if (remain != null && remain < 20_000) {
      await failDecisionReportJob(ctx, stage, "inline report stopped before completion", {
        kind: "interrupted",
      });
      return;
    }
    await runDecisionReportStage(job_id, stage);
    return;
  }

  const { dispatchDeliveryContinue } = await import("@/lib/poju/delivery-continue-dispatch");
  const { deliveryContinueSecretForJob } = await import("@/lib/poju/final-delivery-stage-runner");
  const posted = await dispatchDeliveryContinue(job_id, stage, deliveryContinueSecretForJob(job_id));
  if (posted === "accepted") {
    di2Log("continue handoff posted", { job_id, stage });
    return;
  }
  if (await hasLiveDeliveryContinueForStage(job_id, stage)) return;
  await failDecisionReportJob(
    ctx,
    stage,
    posted === "loop_blocked" ? "continue_schedule_failed:vercel_508_loop" : "continue_schedule_failed",
    { kind: "interrupted" },
  );
}

function startHeartbeat(job_id: string, lease_token: string): () => void {
  const t = setInterval(() => {
    void refreshDeliveryContinueLease(job_id, lease_token).catch(() => undefined);
  }, HEARTBEAT_MS);
  return () => clearInterval(t);
}

async function loadSources(input: DecisionReportJobInput): Promise<{
  freeze: RegisteredFreeze;
  projectionProfile: Awaited<ReturnType<typeof loadRegisteredProfile>>;
}> {
  const freeze = await loadRegisteredFreeze({
    session_id: input.session_id,
    freeze_id: input.freeze_id,
    context_hash: input.context_hash,
    receipt_id: input.freeze_receipt_id,
  });
  const projectionProfile = await loadRegisteredProfile({
    session_id: input.session_id,
    freeze_id: input.freeze_id,
    frozen_at: freeze.frozen_at,
    profile_hash: input.profile_hash,
    receipt_id: input.profile_receipt_id,
  });
  return { freeze, projectionProfile };
}

function newAnalysisRecord(input: DecisionReportJobInput, prior: PersonalAnalysisRecord | null): PersonalAnalysisRecord {
  const t = nowIso();
  return {
    analysis_id: prior?.analysis_id ?? `pa_${input.freeze_id.replace(/[^a-zA-Z0-9]/g, "")}_${input.profile_hash.slice(0, 12)}`,
    idempotency_key: input.analysis_key,
    session_id: input.session_id,
    freeze_id: input.freeze_id,
    context_id: input.context_id,
    context_version: input.context_version,
    context_hash: input.context_hash,
    profile_id: input.profile_id,
    profile_hash: input.profile_hash,
    analysis_schema_version: input.analysis_schema_version,
    status: "pending",
    attempts: prior?.attempts ?? 0,
    generated_at: null,
    updated_at: t,
    analysis_result: null,
    error: null,
    retryable: true,
  };
}

// ─── finalize: Personal Analysis ───────────────────────────────────────────

async function runAnalysisStage(ctx: Ctx): Promise<void> {
  const { input } = ctx;
  let sources: Awaited<ReturnType<typeof loadSources>>;
  try {
    sources = await loadSources(input);
  } catch (e) {
    await failDecisionReportJob(ctx, "finalize", `source_unavailable:${e instanceof Error ? e.message : String(e)}`, {
      kind: "fatal",
    });
    return;
  }

  const existing = await loadAnalysis(input.analysis_key);
  if (existing?.record.status === "completed" && existing.record.analysis_result && existing.projection) {
    di2Log("analysis reused", { job_id: ctx.job.job_id, analysis_id: existing.record.analysis_id });
    await scheduleNext(ctx, "segments");
    return;
  }
  const prior = existing?.record ?? null;
  if (prior && prior.attempts >= DI2_MAX_UNIT_ATTEMPTS) {
    await failDecisionReportJob(ctx, "finalize", `personal_analysis_failed:${prior.error ?? "attempts_exhausted"}`, {
      kind: "quality_exhausted",
    });
    return;
  }

  const projection: ProfileProjection = buildProfileProjection(sources.projectionProfile);
  const running: StoredAnalysis = {
    record: {
      ...newAnalysisRecord(input, prior),
      status: "running",
      attempts: (prior?.attempts ?? 0) + 1,
      updated_at: nowIso(),
    },
    projection,
  };
  if (!(await fenceTouch(ctx, "finalize", "analysis_running"))) return;
  await saveAnalysis(running);

  const outcome = await runPersonalAnalysisModel({
    dc: sources.freeze.decision_context,
    blueprint: sources.freeze.blueprint,
    projection,
    locale: input.locale,
    session_id: input.session_id,
  });

  if (!(await fenceTouch(ctx, "finalize", outcome.ok ? "analysis_done" : "analysis_failed"))) return;

  if (outcome.ok) {
    const t = nowIso();
    await saveAnalysis({
      record: {
        ...running.record,
        status: "completed",
        generated_at: t,
        updated_at: t,
        analysis_result: outcome.artifact,
        error: null,
        model: outcome.model,
        tokens_used: outcome.tokens_used,
      },
      projection,
    });
    di2Log("analysis completed", { job_id: ctx.job.job_id, analysis_id: running.record.analysis_id });
    await scheduleNext(ctx, "segments");
    return;
  }

  const exhausted = running.record.attempts >= DI2_MAX_UNIT_ATTEMPTS;
  await saveAnalysis({
    record: {
      ...running.record,
      status: exhausted ? "failed" : "pending",
      updated_at: nowIso(),
      error: outcome.reason,
      retryable: true,
      model: outcome.model,
      tokens_used: outcome.tokens_used,
    },
    projection,
  });
  di2Log("analysis attempt failed", {
    job_id: ctx.job.job_id,
    attempt: running.record.attempts,
    reason: outcome.reason,
    transport: outcome.transport,
  });
  if (exhausted) {
    await failDecisionReportJob(ctx, "finalize", `personal_analysis_failed:${outcome.reason}`, {
      kind: "quality_exhausted",
    });
    return;
  }
  await scheduleNext(ctx, "finalize");
}

// ─── segments: eight pages ─────────────────────────────────────────────────

function pageRecordBase(
  ctx: Ctx,
  pageId: DecisionPageId,
  analysis_id: string,
  prior: DecisionReportPageRecord | null,
): DecisionReportPageRecord {
  return {
    page_id: pageId,
    status: "pending",
    applicability: "applies",
    content_markdown: "",
    structured: null,
    job_id: ctx.job.job_id,
    execution_generation: ctx.generation,
    freeze_id: ctx.input.freeze_id,
    context_hash: ctx.input.context_hash,
    report_schema_version: ctx.input.report_schema_version,
    analysis_id,
    attempts: prior?.attempts ?? 0,
    generated_at: null,
    error: null,
  };
}

function isDeterministicPage(input: DecisionReportJobInput, pageId: DecisionPageId): boolean {
  return pageId === "03" || (pageId === "07" && !input.page07_applies);
}

async function runPagesStage(ctx: Ctx): Promise<void> {
  const { input } = ctx;
  let sources: Awaited<ReturnType<typeof loadSources>>;
  try {
    sources = await loadSources(input);
  } catch (e) {
    await failDecisionReportJob(ctx, "segments", `source_unavailable:${e instanceof Error ? e.message : String(e)}`, {
      kind: "fatal",
    });
    return;
  }
  const analysis = await loadAnalysis(input.analysis_key);
  if (
    !analysis ||
    analysis.record.status !== "completed" ||
    !analysis.record.analysis_result ||
    !analysis.projection
  ) {
    // Pages are never generated before the analysis completes.
    await scheduleNext(ctx, "finalize");
    return;
  }
  const artifact = analysis.record.analysis_result;
  const projection = analysis.projection;
  const analysis_id = analysis.record.analysis_id;
  const dc = sources.freeze.decision_context;
  const idx = buildReportEvidenceIndex({ dc, projection, artifact });

  const pages = new Map<DecisionPageId, StoredPage>();
  for (const p of await loadAllPages(ctx.job.job_id)) pages.set(p.record.page_id, p);
  const done = (id: DecisionPageId) => pages.get(id)?.record.status === "completed";

  const completedStructured = (): Di2PageStructured[] =>
    [...pages.values()]
      .filter((p) => p.record.status === "completed" && p.structured && p.record.applicability === "applies")
      .map((p) => p.structured!);

  const writeDeterministic = async (pageId: DecisionPageId): Promise<boolean> => {
    if (!(await fenceTouch(ctx, "segments", `page_${pageId}`))) return false;
    const base = pageRecordBase(ctx, pageId, analysis_id, pages.get(pageId)?.record ?? null);
    const t = nowIso();
    if (pageId === "07") {
      const stored = await savePage({
        record: {
          ...base,
          status: "completed",
          applicability: "not_applicable",
          content_markdown: DI2_PAGE07_NOT_APPLICABLE_NOTE(input.locale),
          generated_at: t,
        },
        structured: null,
      });
      pages.set(pageId, stored);
      return true;
    }
    const appendix = buildAppendixPage({
      projection,
      artifact,
      pages: completedStructured().filter((p) => p.page_id !== "03"),
      locale: input.locale,
    });
    const stored = await savePage({
      record: {
        ...base,
        status: "completed",
        content_markdown: renderPageMarkdown(appendix, idx, input.locale),
        structured: appendix as unknown as Record<string, unknown>,
        generated_at: t,
      },
      structured: appendix,
    });
    pages.set(pageId, stored);
    return true;
  };

  let ranModelWave = false;
  for (const wave of DI2_PAGE_WAVES) {
    const pending = wave.filter((id) => !done(id));
    if (!pending.length) continue;

    const deterministic = pending.filter((id) => isDeterministicPage(input, id));
    const model = pending.filter((id) => !isDeterministicPage(input, id));

    if (model.length && ranModelWave) {
      // One model wave per invoke — fresh budget for the next one.
      await scheduleNext(ctx, "segments");
      return;
    }

    for (const id of deterministic) {
      if (!(await writeDeterministic(id))) return;
    }
    if (!model.length) continue;

    const exhausted = model.filter((id) => (pages.get(id)?.record.attempts ?? 0) >= DI2_MAX_UNIT_ATTEMPTS);
    if (exhausted.length) {
      // Attempts burned by killed invokes leave the page pending, not failed.
      const qualitySpent = exhausted.some((id) => pages.get(id)?.record.status === "failed");
      await failDecisionReportJob(
        ctx,
        "segments",
        `page_failed:${exhausted.map((id) => `${id}:${pages.get(id)?.record.error ?? "?"}`).join("|")}`,
        { kind: qualitySpent ? "quality_exhausted" : "interrupted" },
      );
      return;
    }

    if (!(await fenceTouch(ctx, "segments", `wave_${model.join("_")}`))) return;
    // Mark attempts before the model call so a killed invoke still burns the attempt.
    for (const id of model) {
      const prior = pages.get(id)?.record ?? null;
      const rec = { ...pageRecordBase(ctx, id, analysis_id, prior), attempts: (prior?.attempts ?? 0) + 1 };
      pages.set(id, await savePage({ record: rec, structured: null }));
    }

    const outcomes = await Promise.all(
      model.map(async (id) => {
        const upstream = new Map<DecisionPageId, Di2PageStructured>();
        for (const up of DI2_PAGE_UPSTREAM[id] ?? []) {
          const s = pages.get(up);
          if (s?.record.status === "completed" && s.structured) upstream.set(up, s.structured);
        }
        const out = await runDecisionReportPageModel({
          pageId: id,
          dc,
          projection,
          artifact,
          upstream,
          locale: input.locale,
          session_id: input.session_id,
        });
        return { id, out };
      }),
    );
    ranModelWave = true;

    if (!(await fenceTouch(ctx, "segments", "wave_done"))) return;
    let anyFailed = false;
    for (const { id, out } of outcomes) {
      const prior = pages.get(id)!.record;
      if (out.ok) {
        const stored = await savePage({
          record: {
            ...prior,
            status: "completed",
            content_markdown: renderPageMarkdown(out.page, idx, input.locale),
            structured: out.page as unknown as Record<string, unknown>,
            generated_at: nowIso(),
            error: null,
          },
          structured: out.page,
        });
        pages.set(id, stored);
      } else {
        anyFailed = true;
        const exhaustedNow = prior.attempts >= DI2_MAX_UNIT_ATTEMPTS;
        pages.set(
          id,
          await savePage({
            record: { ...prior, status: exhaustedNow ? "failed" : "pending", error: out.reason },
            structured: null,
          }),
        );
        di2Log("page attempt failed", { job_id: ctx.job.job_id, page: id, attempt: prior.attempts, reason: out.reason });
      }
    }
    if (anyFailed) {
      const exhaustedNow = model.filter((id) => pages.get(id)?.record.status === "failed");
      if (exhaustedNow.length) {
        await failDecisionReportJob(
          ctx,
          "segments",
          `page_failed:${exhaustedNow.map((id) => `${id}:${pages.get(id)?.record.error ?? "?"}`).join("|")}`,
          { kind: "quality_exhausted" },
        );
        return;
      }
      await scheduleNext(ctx, "segments");
      return;
    }
  }

  if (DECISION_PAGE_IDS.every((id) => done(id))) {
    await scheduleNext(ctx, "assemble");
    return;
  }
  await scheduleNext(ctx, "segments");
}

// ─── assemble ──────────────────────────────────────────────────────────────

async function runAssembleStage(ctx: Ctx): Promise<void> {
  const { input } = ctx;
  const analysis = await loadAnalysis(input.analysis_key);
  if (!analysis || analysis.record.status !== "completed") {
    await failDecisionReportJob(ctx, "assemble", "assemble_without_completed_analysis", { kind: "interrupted" });
    return;
  }
  let freeze: RegisteredFreeze;
  try {
    freeze = await loadRegisteredFreeze({
      session_id: input.session_id,
      freeze_id: input.freeze_id,
      context_hash: input.context_hash,
      receipt_id: input.freeze_receipt_id,
    });
  } catch (e) {
    await failDecisionReportJob(ctx, "assemble", `source_unavailable:${e instanceof Error ? e.message : String(e)}`, {
      kind: "fatal",
    });
    return;
  }

  const pages: DecisionReportPageRecord[] = [];
  for (const id of DECISION_PAGE_IDS) {
    const p = await loadPage(ctx.job.job_id, id);
    if (!p) {
      await failDecisionReportJob(ctx, "assemble", `missing_page:${id}`, { kind: "interrupted" });
      return;
    }
    const r = p.record;
    const mismatch =
      r.status !== "completed" ||
      r.job_id !== ctx.job.job_id ||
      r.execution_generation !== ctx.generation ||
      r.freeze_id !== input.freeze_id ||
      r.context_hash !== input.context_hash ||
      r.report_schema_version !== input.report_schema_version ||
      r.analysis_id !== analysis.record.analysis_id ||
      !r.content_markdown.trim();
    if (mismatch) {
      await failDecisionReportJob(ctx, "assemble", `page_integrity:${id}:${r.status}`, { kind: "fatal" });
      return;
    }
    pages.push(r);
  }
  try {
    assertCompleteEightPageReport(pages.map((p) => ({ pageId: p.page_id, content: p.content_markdown })));
  } catch (e) {
    await failDecisionReportJob(ctx, "assemble", `report_integrity:${e instanceof Error ? e.message : String(e)}`, {
      kind: "fatal",
    });
    return;
  }

  const t = nowIso();
  const dc = freeze.decision_context;
  const full_text = renderDi2BookMarkdown({
    pages,
    locale: input.locale,
    question: dc.definition.decision_question ?? freeze.blueprint?.decision_question ?? "",
    binding: { context_id: input.context_id, context_version: input.context_version, context_hash: input.context_hash },
    report_id: `POJU-${input.session_id.slice(0, 8)}`,
    generated_at: t,
  });
  const result: DecisionReportJobResult = {
    kind: "decision_intake_report",
    report_job_id: input.report_job_id,
    analysis_id: analysis.record.analysis_id,
    freeze_id: input.freeze_id,
    context_hash: input.context_hash,
    report_schema_version: input.report_schema_version,
    execution_generation: ctx.generation,
    page_ids: pages.map((p) => p.page_id),
    full_text,
    model: analysis.record.model ?? "",
    tokens_used: analysis.record.tokens_used ?? 0,
    completed_at: t,
  };
  await commitFinalReport(ctx, completedReportDraft(input, ctx.job.job_id, ctx.generation, analysis.record, pages, result, t));
}

export function completedReportDraft(
  input: DecisionReportJobInput,
  job_id: string,
  generation: number,
  analysis: PersonalAnalysisRecord,
  pages: DecisionReportPageRecord[],
  result: DecisionReportJobResult,
  committed_at: string,
): CompletedReportDraft {
  return {
    job_id,
    session_id: input.session_id,
    execution_generation: generation,
    report_job_id: input.report_job_id,
    freeze_id: input.freeze_id,
    context_id: input.context_id,
    context_version: input.context_version,
    context_hash: input.context_hash,
    profile_id: input.profile_id,
    profile_hash: input.profile_hash,
    freeze_receipt_id: input.freeze_receipt_id,
    profile_receipt_id: input.profile_receipt_id,
    report_schema_version: input.report_schema_version,
    analysis_schema_version: input.analysis_schema_version,
    analysis_id: analysis.analysis_id,
    result,
    analysis,
    pages,
    committed_at,
  };
}

/**
 * Final delivery commit, in this order:
 *  1. the generation must still own the fence (a revoked generation writes nothing);
 *  2. the durable report record is committed (first write wins; a retry reuses it, so
 *     the analysis and pages are never regenerated and the content never changes);
 *  3. the job is marked completed under the fence CAS with the committed result.
 * A record without a completed job is resumable (Continue → assemble reuses it). A
 * completed job without a record does not occur. A persistence failure fails the job
 * as resumable — it is never reported completed.
 */
async function commitFinalReport(ctx: Ctx, draft: CompletedReportDraft): Promise<void> {
  const { job_id } = ctx.job;
  const session_id = ctx.input.session_id;
  if (!(await fenceTouch(ctx, "assemble", "final_commit"))) {
    await releaseDeliveryContinueLease(job_id, ctx.lease_token).catch(() => undefined);
    return;
  }

  let record: CompletedReportRecord;
  try {
    record = (await commitCompletedReport(draft)).record;
  } catch (e) {
    const code = e instanceof DecisionReportStoreError ? e.code : "REPORT_PERSIST_FAILED";
    const message = e instanceof Error ? e.message : String(e);
    di2Log("final report persist failed", { job_id, code, message });
    const fatal = code === "REPORT_RECORD_CONFLICT" || code === "REPORT_RECORD_INVALID";
    await failDecisionReportJob(ctx, "assemble", `report_persist_failed:${code}:${message}`, {
      kind: fatal ? "fatal" : "report_persist_failed",
    });
    return;
  }

  const committed = await commitUnderDeliveryExecutionFence(job_id, ctx.generation, (job) => ({
    ...job,
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
    // Another hop of this generation may have completed the job with the same record;
    // only a generation that lost the fence takes its record back.
    const job = await getXhighJob(job_id).catch(() => null);
    const completedHere = job?.status === "completed" && job.execution_generation === ctx.generation;
    let fenceLost = false;
    try {
      const fence = await getFdExecutionFence(session_id);
      fenceLost = !fence || fence.generation !== ctx.generation || fence.authorized_job_id !== job_id;
    } catch {
      fenceLost = false;
    }
    const withdraw = !completedHere && fenceLost;
    if (withdraw) await withdrawCompletedReport(session_id, job_id, ctx.generation).catch(() => undefined);
    di2Log("complete fenced out", { job_id, reason: committed.reason, withdrawn: withdraw });
    await releaseDeliveryContinueLease(job_id, ctx.lease_token).catch(() => undefined);
    return;
  }
  di2Log("report completed", { job_id, freeze_id: draft.freeze_id, generation: ctx.generation });
  await releaseRelay(job_id, session_id, ctx.lease_token);
}

// ─── entry ─────────────────────────────────────────────────────────────────

export async function runDecisionReportStage(
  job_id: string,
  stage: DeliveryPipelineStage,
  opts?: StageOpts,
): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job || job.phase !== "decision_report" || !isDecisionReportJobInput(job.input)) {
    if (opts?.lease_token) await releaseDeliveryContinueLease(job_id, opts.lease_token).catch(() => undefined);
    return;
  }
  if (job.status === "completed" || job.status === "failed") {
    if (opts?.lease_token) await releaseDeliveryContinueLease(job_id, opts.lease_token).catch(() => undefined);
    return;
  }
  const input = job.input;
  const generation = job.execution_generation;
  if (typeof generation !== "number") {
    if (opts?.lease_token) await releaseDeliveryContinueLease(job_id, opts.lease_token).catch(() => undefined);
    return;
  }

  let lease_token = opts?.lease_token ?? null;
  if (!lease_token) {
    const acquired = await tryAcquireDeliveryContinueLease(job_id, stage);
    if (!acquired.ok) {
      di2Log("lease busy — skip overlap", { job_id, stage, holder: acquired.lease.stage });
      return;
    }
    lease_token = acquired.token;
  }

  try {
    await assertDeliveryExecutionAuthority(job_id, generation);
  } catch (e) {
    if (e instanceof DeliveryExecutionRevokedError) {
      di2Log("execution revoked", { job_id, stage, reason: e.failure_reason });
      await releaseDeliveryContinueLease(job_id, lease_token).catch(() => undefined);
      return;
    }
    throw e;
  }

  const ctx: Ctx = { job, input, generation, lease_token };
  const stopHeartbeat = startHeartbeat(job_id, lease_token);
  try {
    if (stage === "finalize") await runAnalysisStage(ctx);
    else if (stage === "segments") await runPagesStage(ctx);
    else await runAssembleStage(ctx);
  } catch (e) {
    console.error("[decision-report] stage crashed", { job_id, stage, e });
    await failDecisionReportJob(ctx, stage, `stage_crashed:${e instanceof Error ? e.message : String(e)}`, {
      kind: "interrupted",
    });
  } finally {
    stopHeartbeat();
  }
}

/** User Continue after an interrupted / exhausted run: fresh 1+1 budget for failed units. */
export async function resetDecisionReportBudgets(job: PojuXhighJob): Promise<void> {
  if (!isDecisionReportJobInput(job.input)) return;
  const input = job.input;
  const analysis = await loadAnalysis(input.analysis_key);
  if (analysis && analysis.record.status !== "completed") {
    await saveAnalysis({
      ...analysis,
      record: { ...analysis.record, status: "pending", attempts: 0, error: null, updated_at: nowIso() },
    });
  }
  for (const id of DECISION_PAGE_IDS) {
    const p = await loadPage(job.job_id, id);
    if (p && p.record.status !== "completed") {
      await savePage({ record: { ...p.record, status: "pending", attempts: 0, error: null }, structured: null });
    }
  }
  await forceReleaseDeliveryContinueLease(job.job_id).catch(() => undefined);
}

/** First stage to run for a (re)started job, derived from persisted checkpoints. */
export async function firstIncompleteDecisionReportStage(job: PojuXhighJob): Promise<DeliveryPipelineStage> {
  if (!isDecisionReportJobInput(job.input)) return "finalize";
  const analysis = await loadAnalysis(job.input.analysis_key);
  if (!analysis || analysis.record.status !== "completed") return "finalize";
  const pages = await loadAllPages(job.job_id);
  const complete = DECISION_PAGE_IDS.every((id) =>
    pages.some((p) => p.record.page_id === id && p.record.status === "completed"),
  );
  return complete ? "assemble" : "segments";
}
