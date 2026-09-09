/**
 * Phase 4 delivery — stage + per-task KV relay.
 * Within a stage, incomplete DeliveryTasks run in parallel waves
 * (deliveryFanoutConcurrency), each checkpointed to KV. Waves continue until the
 * stage is done or FANOUT_INVOCATION_BUDGET_MS is exhausted, then /continue
 * gets a fresh 300s budget. Fail-fast: no stale-resume; schedule miss → STOP.
 */

import {
  extractActionsFromDelivery,
  resolveDeliveryMode,
} from "@/lib/llm/pro/final-delivery";
import {
  assembleDeliveryFinalize,
  runFinalizeGroup,
} from "@/lib/llm/pro/delivery/finalize-call";
import {
  mergeDeliveryToMarkdown,
  type DeliveryBookMeta,
} from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { sanitizeDeliveryBookMarkdown } from "@/lib/llm/pro/delivery/sanitize-delivery-book";
import {
  DELIVERY_BOOTSTRAP_SEGMENT,
  DELIVERY_SEGMENT_KEYS,
  type DeliveryArgumentTree,
  type DeliveryComputed,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  deliveryFanoutConcurrency,
  deliveryFinalizeIsXhighTask,
  deliveryFinalizeTimeoutMs,
  DELIVERY_TASKS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  DELIVERY_PIPELINE_STAGES,
  findLatestCompletedDeliveryStage,
  findNextIncompleteDeliveryTask,
  hasLiveDeliveryContinueForStage,
  isDeliveryFanoutStage,
  listIncompleteDeliveryTasks,
  loadAllDeliverySegmentReady,
  loadAllDeliveryTaskCheckpoints,
  loadDeliverySegmentProgress,
  loadDeliveryStageCheckpoint,
  bumpDeliveryJobContinueHop,
  loadDeliveryJobContinueHops,
  nextDeliveryStage,
  refreshDeliveryContinueLease,
  releaseDeliveryContinueLease,
  saveDeliverySegmentProgress,
  saveDeliverySegmentReady,
  saveDeliveryStageCheckpoint,
  saveDeliveryTaskCheckpoint,
  tryAcquireDeliveryContinueLease,
  type DeliveryFanoutStage,
  type DeliveryPipelineStage,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import {
  advanceSegmentChain,
  SCHEMA_WAVE_PACK_MIN_REMAINING_MS,
  SEGMENT_BOOTSTRAP_MIN_INVOKE_MS,
  segmentAdmitMinMs,
} from "@/lib/llm/pro/delivery/run-segment-chain";
import {
  deliveryFailFastEnabled,
  DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS,
  DELIVERY_SEGMENT_SOFT_HOP_MAX,
  DELIVERY_JOB_MAX_CONTINUE_HOPS,
  DELIVERY_JOB_MAX_WALL_MS,
  isDeliveryBudgetExhaustedReason,
  isDeliveryJobContinueHopExceeded,
  isDeliveryJobWallExceeded,
  isDeliverySegmentTransportRetryable,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";
import {
  deliveryPageLabel,
  logDeliveryStep,
} from "@/lib/llm/pro/delivery/delivery-step-log";
import {
  buildPrimaryBackupHintFromBreakthroughCore,
  filterTasksToCurrentWave,
  prioritizeBootstrapSegmentTasks,
  loadPriorChartAnchors,
  loadPrimaryBackupHint,
  loadP3BodyExcerptForP4Moat,
  loadUpstreamActionBrief,
  loadUpstreamWeekSummary,
} from "@/lib/llm/pro/delivery/page-schema/upstream";
import {
  buildCategoryTokenSetsFromStructured,
  tryStructuredFromBaseAnalysis,
} from "@/lib/llm/pro/delivery/page-schema/anchor-category-tally";
import { buildDeliveryPagePlan } from "@/lib/llm/pro/delivery/page-plan";
import type { DeliveryPagePlan } from "@/lib/llm/pro/delivery/page-plan/types";
import {
  DELIVERY_WAVES,
  type DeliveryWaveId,
  isActionBriefUpstreamReady,
  waveForSegment,
} from "@/lib/llm/pro/delivery/page-schema/waves";
import { enrichLlmDebugPhaseTransition } from "@/lib/llm/llm-debug";
import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import {
  completeXhighJob,
  failXhighJob,
  getXhighJob,
  setXhighJobContent,
  updateXhighJobStatus,
  releaseXhighSessionLock,
} from "@/lib/poju/xhigh-job-store";
import {
  isFinalDeliveryJobInput,
  type FinalDeliveryJobInput,
  type FinalDeliveryJobResult,
} from "@/lib/poju/xhigh-job-types";
import { dispatchDeliveryContinue, publishDeliveryTask } from "@/lib/poju/delivery-continue-dispatch";
import {
  assembleIsOk,
  buildInitialDeliveryDispatchDag,
  ensureDeliveryDispatchDag,
  loadDeliveryDispatchDag,
  runDeliveryDispatchSchedulerTick,
} from "@/lib/llm/pro/delivery/dispatch";
import { ensureJobChartPrimaryPrealloc } from "@/lib/llm/pro/delivery/page-schema/ensure-job-chart-primary-prealloc";

const HEARTBEAT_MS = 12_000;
/** Vercel `export const maxDuration = 300` on /continue — hard process kill. */
const VERCEL_INVOKE_HARD_MS = 300_000;
/** Leave merge / schedule / TLS room before platform SIGKILL. */
const INVOKE_TAIL_HEADROOM_MS = 35_000;
/**
 * Soft ceiling for packing waves in one invoke. Secondary to
 * "elapsed + next-wave reserve < hard − headroom" below.
 */
const FANOUT_INVOCATION_BUDGET_MS = 260_000;

/**
 * Soft-wall reserve before starting another segments batch.
 * Parallel siblings share wall clock ≈ one phase (~fill / evidence / mark), not sum.
 * 55s: align with SEGMENT_MIN_INVOKE_MS so a second phase can start without an idle hop.
 */
function reserveMsForNextWave(
  stage: DeliveryPipelineStage,
  _locale = "zh",
  _batchSize = 1,
): number {
  if (stage === "segments") {
    return 55_000;
  }
  return 90_000;
}

function schemaWaveFullyReady(
  readyKeys: Set<DeliverySegmentKey>,
  waveId: DeliveryWaveId,
): boolean {
  return DELIVERY_WAVES[waveId].keys.every((k) => readyKeys.has(k));
}

function continueSecret(job_id: string): string {
  const seed =
    process.env.POJU_INTERNAL_STAGE_SECRET?.trim() ||
    process.env.OPS_SESSION_SECRET?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    "poju-delivery-stage";
  return `fdstage:${job_id}:${seed.slice(0, 24)}`;
}

function resolveQuestionExpectation(input: FinalDeliveryJobInput): string {
  const q = input.agent_v2.original_question?.trim() || "";
  const want = input.agent_v2.context_collected?.desired_outcome?.trim() || "";
  return [
    q ? `问题: ${q}` : "",
    want ? `期望: ${want}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveDeliveryPagePlan(input: FinalDeliveryJobInput): DeliveryPagePlan | null {
  if (!input.breakthrough_core) return null;
  return buildDeliveryPagePlan({
    core: input.breakthrough_core,
    agent_v2: input.agent_v2,
  });
}

export function verifyDeliveryContinueSecret(job_id: string, secret: string | null): boolean {
  return Boolean(secret) && secret === continueSecret(job_id);
}

/**
 * Job-level fuse: wall clock from created_at OR continue hop count.
 * Independent of per-phase counters — last backstop against ok:true soft-wall thrash.
 */
async function tripDeliveryJobFuseIfNeeded(
  job_id: string,
  session_id: string,
  stage: DeliveryPipelineStage,
  created_at: number,
  opts?: { bump_continue_hop?: boolean },
): Promise<"ok" | "tripped"> {
  const hops = opts?.bump_continue_hop
    ? await bumpDeliveryJobContinueHop(job_id)
    : await loadDeliveryJobContinueHops(job_id);
  const wall = isDeliveryJobWallExceeded(created_at);
  const hopCap = isDeliveryJobContinueHopExceeded(hops);
  if (!wall && !hopCap) return "ok";

  const reason = wall
    ? `job_time_budget_exhausted:age_ms=${Date.now() - created_at}:max_ms=${DELIVERY_JOB_MAX_WALL_MS}`
    : `job_continue_budget_exhausted:hops=${hops}:max=${DELIVERY_JOB_MAX_CONTINUE_HOPS}`;
  console.error("[final-delivery-STOP] job-level fuse tripped", {
    job_id,
    stage,
    reason,
    created_at,
    continue_hops: hops,
    wall_ms: DELIVERY_JOB_MAX_WALL_MS,
    hop_max: DELIVERY_JOB_MAX_CONTINUE_HOPS,
  });
  await failStage(job_id, session_id, stage, reason, {
    where: `${stage}/job_fuse`,
    elapsed_ms: Date.now() - created_at,
  });
  return "tripped";
}

/**
 * Success-path hop to a fresh Vercel invoke.
 * Must await while this invoke is still alive (do NOT defer to `after()`).
 * Order: touch status → release lease → dispatch (QStash on Vercel / direct fetch locally)
 * → ACK/lease proves accept on network blip.
 */
export async function scheduleDeliveryStageContinue(
  job_id: string,
  stage: DeliveryPipelineStage,
  opts: { session_id: string; lease_token: string; created_at?: number },
): Promise<"scheduled" | "failed"> {
  if (typeof opts.created_at === "number") {
    const fuse = await tripDeliveryJobFuseIfNeeded(
      job_id,
      opts.session_id,
      stage,
      opts.created_at,
      { bump_continue_hop: true },
    );
    if (fuse === "tripped") return "failed";
  } else {
    // Defense: still burn a hop even if caller forgot created_at.
    const hops = await bumpDeliveryJobContinueHop(job_id);
    if (isDeliveryJobContinueHopExceeded(hops)) {
      await failStage(
        job_id,
        opts.session_id,
        stage,
        `job_continue_budget_exhausted:hops=${hops}:max=${DELIVERY_JOB_MAX_CONTINUE_HOPS}`,
      );
      return "failed";
    }
  }

  try {
    await updateXhighJobStatus(job_id, "running", {
      current_stage: stage,
      accumulated_content: `handoff_continue:${stage}:${Date.now()}`,
    });
  } catch (e) {
    console.error("[final-delivery-STOP] handoff status write failed", { job_id, stage, e });
    await failStage(job_id, opts.session_id, stage, "handoff_status_failed");
    return "failed";
  }

  await releaseDeliveryContinueLease(job_id, opts.lease_token).catch(() => undefined);

  const posted = await dispatchDeliveryContinue(job_id, stage, continueSecret(job_id));
  if (posted === "accepted") {
    logDeliveryStep({
      job_id,
      level: "hop",
      step: "continue → next invoke",
      detail: stage,
    });
    console.info("[final-delivery-stage] continue handoff posted", { job_id, stage });
    return "scheduled";
  }

  // Fetch/QStash may blip after continue already acquired lease + wrote ACK.
  if (await hasLiveDeliveryContinueForStage(job_id, stage)) {
    console.info("[final-delivery-stage] continue handoff confirmed via ACK/lease", {
      job_id,
      stage,
      posted,
    });
    return "scheduled";
  }

  const reason =
    posted === "loop_blocked"
      ? "continue_schedule_failed:vercel_508_loop"
      : "continue_schedule_failed";
  await failStage(job_id, opts.session_id, stage, reason);
  return "failed";
}


type FailStageOutcome = "interrupted" | "hard_failed";

/**
 * Stop the job immediately and emit a high-signal server log for diagnosis.
 * Format is stable so Vercel log search can filter on `[final-delivery-STOP]`.
 */
async function failStage(
  job_id: string,
  session_id: string,
  stage: DeliveryPipelineStage,
  reason: string,
  extra?: { task?: string; elapsed_ms?: number; where?: string },
): Promise<FailStageOutcome> {
  // Never reset+handoff — that re-armed infinite /continue loops (P5/P6 thrash).
  // Ready pages ⇒ interrupt (user Continue); no pages ⇒ hard fail.
  const readyAll = await loadAllDeliverySegmentReady(job_id).catch(() => []);
  if (readyAll.length > 0) {
    console.warn("[final-delivery-stage] fail with pages — interrupt (no auto handoff)", {
      job_id,
      stage,
      reason,
      ready_pages: readyAll.length,
      budget_exhausted: isDeliveryBudgetExhaustedReason(reason),
    });
    await interruptStage(job_id, session_id, stage, reason, extra);
    return "interrupted";
  }
  const where = extra?.where ?? (extra?.task ? `${stage}/${extra.task}` : stage);
  const errorMsg = `STOP at ${where}: ${reason}`;
  logDeliveryStep({
    job_id,
    level: "stop",
    step: extra?.task
      ? `${deliveryPageLabel(extra.task.replace(/^deliver_/, ""))} ${extra.task}`
      : `stage ${stage}`,
    detail: reason.slice(0, 180),
    ms: extra?.elapsed_ms,
  });
  console.error("[final-delivery-STOP]", {
    job_id,
    stage,
    task: extra?.task ?? null,
    where,
    reason,
    elapsed_ms: extra?.elapsed_ms ?? null,
    fail_fast: deliveryFailFastEnabled(),
    message: errorMsg,
  });
  await failXhighJob(job_id, errorMsg, {
    retryable: false,
    failure_reason: "transport_error",
    current_stage: stage,
    error_detail: JSON.stringify({
      stage,
      task: extra?.task ?? null,
      where,
      reason,
      elapsed_ms: extra?.elapsed_ms ?? null,
    }),
    accumulated_content: `failed:${where}:${reason}`.slice(0, 500),
  });
  await releaseXhighSessionLock("final_delivery", session_id);
  return "hard_failed";
}

/**
 * Pause delivery after segment transport retries are exhausted.
 * Keeps segment:ready checkpoints so the UI can Continue from the same job.
 */
async function interruptStage(
  job_id: string,
  session_id: string,
  stage: DeliveryPipelineStage,
  reason: string,
  extra?: { task?: string; elapsed_ms?: number; where?: string },
): Promise<void> {
  const where = extra?.where ?? (extra?.task ? `${stage}/${extra.task}` : stage);
  const errorMsg = `INTERRUPTED at ${where}: ${reason}`;
  logDeliveryStep({
    job_id,
    level: "warn",
    step: "paused — tap Continue",
    detail: `${where}: ${reason}`.slice(0, 200),
    ms: extra?.elapsed_ms,
  });
  console.warn("[final-delivery-INTERRUPTED]", {
    job_id,
    stage,
    task: extra?.task ?? null,
    where,
    reason,
    elapsed_ms: extra?.elapsed_ms ?? null,
    message: errorMsg,
  });
  await failXhighJob(job_id, errorMsg, {
    retryable: true,
    failure_reason: "interrupted",
    current_stage: stage,
    error_detail: JSON.stringify({
      stage,
      task: extra?.task ?? null,
      where,
      reason,
      elapsed_ms: extra?.elapsed_ms ?? null,
      resumable: true,
    }),
    accumulated_content: `interrupted:${where}:${reason}`.slice(0, 500),
  });
  await releaseXhighSessionLock("final_delivery", session_id);
}

type FanoutTaskResult =
  | {
      ok: true;
      value: DeliveryArgumentTree | Partial<DeliveryComputed>;
      tokens_used: number;
      model?: string;
      /** Segment chain yielded before done — progress saved; hop continue. */
      soft_wall_yield?: boolean;
    }
  | {
      ok: false;
      reason: string;
      redirect?: DeliveryPipelineStage;
      /** Transport/timeout — retry same segment; do not abort siblings. */
      soft_retryable?: boolean;
      /** transport_fail_count exhausted — pause job for user Continue. */
      segment_exhausted?: boolean;
    };

/** Sibling cancel / AbortSignal — never the root STOP reason. */
function isAbortishReason(reason: string): boolean {
  const r = reason.toLowerCase();
  return (
    reason === "aborted_after_sibling_fail" ||
    reason === "aborted" ||
    reason.endsWith(":aborted") ||
    r.includes("aborted_after_sibling") ||
    r.includes("aborterror") ||
    r.includes("this operation was aborted") ||
    /:call_error:.*abort/i.test(reason)
  );
}

async function executeFanoutTask(
  job_id: string,
  stage: DeliveryFanoutStage,
  task: (typeof DELIVERY_TASKS)[number],
  input: FinalDeliveryJobInput,
  cacheId: string,
  delivery_mode: ReturnType<typeof resolveDeliveryMode>,
  signal?: AbortSignal,
  invocationStartedAt: number = Date.now(),
): Promise<FanoutTaskResult> {
  if (signal?.aborted) {
    return { ok: false, reason: "aborted_after_sibling_fail" };
  }
  if (stage === "finalize") {
    const page_plan = resolveDeliveryPagePlan(input);
    const question_expectation = resolveQuestionExpectation(input);
    const result = await runFinalizeGroup(task, {
      breakthrough_core: input.breakthrough_core,
      covered_agenda: input.covered_agenda,
      agent_v2: input.agent_v2,
      locale: input.locale,
      delivery_mode,
      session_id: cacheId,
      signal,
      page_plan,
      question_expectation,
      timeout_ms: (() => {
        const elapsed = Date.now() - invocationStartedAt;
        const hardBudget =
          VERCEL_INVOKE_HARD_MS - INVOKE_TAIL_HEADROOM_MS - elapsed - 8_000;
        return Math.min(
          deliveryFinalizeTimeoutMs(task.paths),
          Math.max(90_000, hardBudget),
        );
      })(),
    });
    if (!result.ok) {
      if (isAbortishReason(result.reason) || signal?.aborted) {
        return { ok: false, reason: "aborted_after_sibling_fail" };
      }
      return { ok: false, reason: `delivery_finalize_failed:${result.reason}` };
    }
    return {
      ok: true,
      value: result.partial,
      tokens_used: result.tokens_used,
      model: result.model,
    };
  }

  // P3: full segment chain (page_schema fill → evidence → mark → translate)
  const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
  if (!fin) return { ok: false, reason: "missing_finalize", redirect: "finalize" };
  const key = task.paths[0] as DeliverySegmentKey | undefined;
  if (!key) return { ok: false, reason: "segment_missing_key" };

  const prior = await loadDeliverySegmentProgress(job_id, key);
  const hardDeadline = VERCEL_INVOKE_HARD_MS - INVOKE_TAIL_HEADROOM_MS;

  let action_brief = null as Awaited<ReturnType<typeof loadUpstreamActionBrief>>;
  let week_summary = null as Awaited<ReturnType<typeof loadUpstreamWeekSummary>>;
  let primary_backup_hint = "";
  let eastern_calc_slice = "";
  let risk_calc_slice = "";
  let dashboard_score_hints = "";
  let page_plan_slice = "";
  let p3_body_excerpt = "";
  const page_plan = resolveDeliveryPagePlan(input);
  const question_expectation = resolveQuestionExpectation(input);
  if (key === "metaphysics_action") {
    p3_body_excerpt = await loadP3BodyExcerptForP4Moat(job_id);
  }
  if (key === "risk_guard" || key === "signals_close") {
    action_brief = await loadUpstreamActionBrief(job_id);
    console.info("[final-delivery-stage] P5ActionBrief loaded", {
      job_id,
      key,
      has_brief: Boolean(action_brief),
      primary: action_brief?.primary_name,
      p3_steps: action_brief?.p3_primary_steps.length ?? 0,
    });
  }
  if (
    key === "science_action" ||
    key === "risk_guard" ||
    key === "signals_close"
  ) {
    primary_backup_hint = await loadPrimaryBackupHint(job_id);
    // P3 only runs after P1 — hint should come from P1 page. Synthesis fallback for resume edge cases.
    if (!primary_backup_hint.trim() && input.breakthrough_core) {
      primary_backup_hint = buildPrimaryBackupHintFromBreakthroughCore(input.breakthrough_core);
    }
  }
  if (key === "foundation" && input.breakthrough_core) {
    const { buildDashboardScoreHintsForFill } = await import(
      "@/lib/llm/pro/delivery/format-spine-for-finalize"
    );
    dashboard_score_hints = buildDashboardScoreHintsForFill(input.breakthrough_core);
  }
  let foundation_surface_feed = "";
  if (key === "foundation") {
    const { buildFoundationSurfaceFeedBlock } = await import(
      "@/lib/llm/pro/delivery/foundation-surface-feed"
    );
    const xc = input.breakthrough_core?.key_crossroads;
    foundation_surface_feed = buildFoundationSurfaceFeedBlock(input.covered_agenda, {
      original_question: input.agent_v2.original_question,
      desired_outcome: input.agent_v2.context_collected?.desired_outcome,
      situation_conclusion: input.breakthrough_core?.situation_conclusion,
      decision_traits: xc?.decision_traits,
      real_fork: xc?.real_fork,
      path_costs: xc?.path_costs,
      energy_structure: input.breakthrough_core?.energy_structure,
    });
  }
  let science_means_feed = "";
  if (key === "science_action") {
    const { buildScienceMeansFeedBlock } = await import(
      "@/lib/llm/pro/delivery/science-means-feed"
    );
    science_means_feed = buildScienceMeansFeedBlock(
      input.breakthrough_core,
      input.covered_agenda,
      {
        original_question: input.agent_v2.original_question,
        desired_outcome: input.agent_v2.context_collected?.desired_outcome,
        primary_backup_hint,
      },
    );
  }
  let metaphysics_moat_feed = "";
  if (key === "metaphysics_action") {
    const { buildMetaphysicsMoatFeedBlock } = await import(
      "@/lib/llm/pro/delivery/metaphysics-moat-feed"
    );
    metaphysics_moat_feed = buildMetaphysicsMoatFeedBlock(
      input.breakthrough_core,
      input.covered_agenda,
      {
        original_question: input.agent_v2.original_question,
        desired_outcome: input.agent_v2.context_collected?.desired_outcome,
      },
    ).block;
  }
  let risk_fuse_feed = "";
  if (key === "risk_guard") {
    const { buildRiskFuseFeedBlock } = await import(
      "@/lib/llm/pro/delivery/risk-fuse-feed"
    );
    risk_fuse_feed = buildRiskFuseFeedBlock(
      input.breakthrough_core,
      action_brief,
      input.covered_agenda,
      {
        original_question: input.agent_v2.original_question,
        desired_outcome: input.agent_v2.context_collected?.desired_outcome,
        primary_backup_hint,
      },
    );
  }
  let close_ritual_feed = "";
  if (key === "signals_close") {
    const { buildCloseRitualFeedBlock } = await import(
      "@/lib/llm/pro/delivery/close-ritual-feed"
    );
    close_ritual_feed = buildCloseRitualFeedBlock(
      input.breakthrough_core,
      action_brief,
      input.covered_agenda,
      {
        original_question: input.agent_v2.original_question,
        desired_outcome: input.agent_v2.context_collected?.desired_outcome,
        primary_backup_hint,
      },
    );
  }
  if (page_plan && input.breakthrough_core) {
    const { formatPagePlanSliceForPrompt } = await import(
      "@/lib/llm/pro/delivery/page-plan/format-page-plan-for-prompt"
    );
    if (key !== "metaphysics_action" && key !== "risk_guard") {
      page_plan_slice = formatPagePlanSliceForPrompt(
        key,
        page_plan,
        input.breakthrough_core,
        question_expectation,
      );
    }
  }
  if (key === "metaphysics_action" && input.breakthrough_core) {
    const { buildEasternCalcSliceForFill } = await import(
      "@/lib/llm/pro/delivery/format-spine-for-finalize"
    );
    eastern_calc_slice = buildEasternCalcSliceForFill(
      input.breakthrough_core,
      page_plan,
      question_expectation,
    );
  }
  if (key === "risk_guard" && input.breakthrough_core) {
    const { buildRiskCalcSliceForFill } = await import(
      "@/lib/llm/pro/delivery/format-spine-for-finalize"
    );
    risk_calc_slice = buildRiskCalcSliceForFill(
      input.breakthrough_core,
      page_plan,
      question_expectation,
    );
  }

  const { buildRealityConstraintsBlock } = await import(
    "@/lib/llm/pro/delivery/reality-constraints"
  );
  const reality_constraints = buildRealityConstraintsBlock(input.covered_agenda, {
    original_question: input.agent_v2.original_question,
    desired_outcome: input.agent_v2.context_collected?.desired_outcome,
  });

  // Layer A: collect used anchors from ready pages (same path as ActionBrief).
  const prior_chart_anchors = await loadPriorChartAnchors(job_id, key);
  const structuredForFill = tryStructuredFromBaseAnalysis(input.base_analysis);
  const category_token_sets = buildCategoryTokenSetsFromStructured(structuredForFill);
  let structured_inventory = "";
  if (structuredForFill) {
    const { buildStructuredInstanceInventory } = await import(
      "@/lib/base-analysis/build-structured-instance-inventory"
    );
    structured_inventory = buildStructuredInstanceInventory(structuredForFill, {
      questionCategory: input.agent_v2.question_category ?? null,
    });
  }
  if (prior_chart_anchors.length > 0) {
    console.info("[final-delivery-stage] prior chart anchors for fill", {
      job_id,
      key,
      prior_count: prior_chart_anchors.length,
    });
  }

  const chain = await advanceSegmentChain({
    task,
    finalize: fin.value,
    locale: input.locale,
    original_question: input.agent_v2.original_question,
    session_id: cacheId,
    signal,
    progress: prior,
    breakthrough_core: input.breakthrough_core,
    action_brief,
    week_summary,
    primary_backup_hint,
    question_expectation,
    eastern_calc_slice,
    p3_body_excerpt,
    risk_calc_slice,
    dashboard_score_hints,
    page_plan_slice,
    reality_constraints,
    foundation_surface_feed,
    science_means_feed,
    metaphysics_moat_feed,
    risk_fuse_feed,
    close_ritual_feed,
    prior_chart_anchors,
    category_token_sets,
    structured_inventory,
    shouldYield: (phase) => {
      const remaining = hardDeadline - (Date.now() - invocationStartedAt);
      return remaining < segmentAdmitMinMs(key, phase);
    },
    invokeHardDeadlineMs: hardDeadline,
    invocationStartedAt,
  });

  if (!chain.ok) {
    if (isAbortishReason(chain.reason) || signal?.aborted) {
      return { ok: false, reason: "aborted_after_sibling_fail" };
    }
    const failReason = `delivery_segment_failed:${chain.reason}`;
    const prevCount = chain.progress.transport_fail_count ?? prior?.transport_fail_count ?? 0;
    if (isDeliverySegmentTransportRetryable(failReason)) {
      const transport_fail_count = prevCount + 1;
      const nextProgress = { ...chain.progress, transport_fail_count };
      await saveDeliverySegmentProgress(job_id, nextProgress).catch(() => undefined);
      const exhausted = transport_fail_count >= DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS;
      console.warn("[final-delivery-stage] segment transport fail", {
        job_id,
        task: task.name,
        key,
        transport_fail_count,
        exhausted,
        reason: failReason,
      });
      return {
        ok: false,
        reason: failReason,
        soft_retryable: !exhausted,
        segment_exhausted: exhausted,
      };
    }
    await saveDeliverySegmentProgress(job_id, chain.progress).catch(() => undefined);
    // Quality / phase_budget: isolate this page — do NOT waveAbort siblings mid-flight.
    // User Continue resets phase budgets (see resetDeliverySegmentBudgetsForContinue).
    return {
      ok: false,
      reason: failReason,
      soft_retryable: false,
      segment_exhausted: true,
    };
  }

  // Soft-wall after failed fill/deep admit: clock/rewrite hop only — burn soft_hop,
  // never transport fuse (that was turning soft walls into INTERRUPT after 2 hops).
  if (!chain.done && (chain.progress.fill_yield_count ?? 0) > 0) {
    const hop = (chain.progress.soft_hop_count ?? 0) + 1;
    const nextProgress = {
      ...chain.progress,
      soft_hop_count: hop,
    };
    await saveDeliverySegmentProgress(job_id, nextProgress).catch(() => undefined);
    if (hop >= DELIVERY_SEGMENT_SOFT_HOP_MAX) {
      console.warn("[final-delivery-stage] failed-admit soft-hop exhausted", {
        job_id,
        task: task.name,
        key,
        phase: chain.progress.phase,
        soft_hop_count: hop,
        fill_yield_count: chain.progress.fill_yield_count ?? 0,
      });
      return {
        ok: false,
        reason: `delivery_segment_failed:soft_hop_budget_exhausted:${key}:hops=${hop}`,
        soft_retryable: false,
        segment_exhausted: true,
      };
    }
    console.warn("[final-delivery-stage] failed-admit soft-wall — yield hop", {
      job_id,
      task: task.name,
      key,
      phase: chain.progress.phase,
      soft_hop_count: hop,
      fill_yield_count: chain.progress.fill_yield_count ?? 0,
    });
    return {
      ok: true,
      value: {},
      tokens_used: chain.tokens_used,
      soft_wall_yield: true,
    };
  }

  if (!chain.done) {
    const hop = (chain.progress.soft_hop_count ?? 0) + 1;
    const nextProgress = { ...chain.progress, soft_hop_count: hop };
    await saveDeliverySegmentProgress(job_id, nextProgress).catch(() => undefined);
    if (hop >= DELIVERY_SEGMENT_SOFT_HOP_MAX) {
      console.warn("[final-delivery-stage] soft-hop budget exhausted", {
        job_id,
        key,
        phase: nextProgress.phase,
        soft_hop_count: hop,
      });
      return {
        ok: false,
        reason: `delivery_segment_failed:soft_hop_budget_exhausted:${key}:hops=${hop}`,
        soft_retryable: false,
        segment_exhausted: true,
      };
    }
    return {
      ok: true,
      value: {},
      tokens_used: chain.tokens_used,
      soft_wall_yield: true,
    };
  }

  if ((chain.progress.transport_fail_count ?? 0) > 0) {
    await saveDeliverySegmentProgress(job_id, {
      ...chain.progress,
      transport_fail_count: 0,
    }).catch(() => undefined);
  } else {
    await saveDeliverySegmentProgress(job_id, chain.progress);
  }

  await saveDeliverySegmentReady(job_id, chain.ready);
  return {
    ok: true,
    value: chain.progress.marked ?? chain.progress.narrative ?? {},
    tokens_used: chain.tokens_used,
  };
}

/**
 * Segments stage — DAG dispatch (no in-invoke multi-page Promise.all).
 * Scheduler publishes workers; workers drive the next schedule tick.
 * Do NOT /continue-poll while idle_waiting — that burned hop fuse (18) before P1 ready.
 */
async function progressDispatchSegments(
  job_id: string,
  input: FinalDeliveryJobInput,
  invocationStartedAt: number,
  leaseToken: string,
  leaseHandedOff: { value: boolean },
  stopHeartbeat: () => void,
  created_at: number,
  cancelSignal?: AbortSignal,
): Promise<"merged" | "scheduled" | "failed"> {
  /** Park this invoke: workers (or a delayed safety sweep) resume scheduling. */
  const parkForWorkers = async (why: string): Promise<"scheduled"> => {
    // Keep job.updated_at fresh until workers' own heartbeats take over (status STALE=45s).
    await setXhighJobContent(
      job_id,
      `dispatch_parked:${why}:${Date.now()}`,
    ).catch(() => undefined);
    stopHeartbeat();
    await releaseDeliveryContinueLease(job_id, leaseToken).catch(() => undefined);
    leaseHandedOff.value = true;
    // Safety net if all workers die — delayed continue does NOT bump hop fuse.
    const { publishDeliveryContinueDelayed } = await import(
      "@/lib/poju/delivery-continue-dispatch"
    );
    await publishDeliveryContinueDelayed(
      job_id,
      "segments",
      continueSecret(job_id),
      90,
    ).catch(() => undefined);
    console.info("[final-delivery-stage] dispatch parked for workers", {
      job_id,
      why,
      elapsed_ms: Date.now() - invocationStartedAt,
    });
    return "scheduled";
  };

  if (cancelSignal?.aborted) {
    stopHeartbeat();
    await releaseDeliveryContinueLease(job_id, leaseToken).catch(() => undefined);
    return "failed";
  }

  await ensureDeliveryDispatchDag(job_id, () => buildInitialDeliveryDispatchDag(job_id));
  await ensureJobChartPrimaryPrealloc(job_id, input);

  // Continue after interrupt: reset failed → pending (one more 1+1 budget per task).
  {
    const dag = await loadDeliveryDispatchDag(job_id);
    if (dag) {
      let dirty = false;
      const tasks = { ...dag.tasks };
      for (const [id, t] of Object.entries(tasks)) {
        if (t.status === "failed") {
          tasks[id] = {
            ...t,
            status: "pending",
            attempts: 0,
            error: undefined,
            updated_at: Date.now(),
          };
          dirty = true;
        }
        // Stale "running" without lease (worker died) → re-queue.
        if (t.status === "running" && Date.now() - (t.updated_at || 0) > 360_000) {
          tasks[id] = {
            ...t,
            status: "pending",
            error: "stale_running_reset",
            updated_at: Date.now(),
          };
          dirty = true;
        }
      }
      if (dirty) {
        const { saveDeliveryDispatchDag } = await import(
          "@/lib/llm/pro/delivery/dispatch/task-store"
        );
        await saveDeliveryDispatchDag({ ...dag, tasks, updated_at: Date.now() });
      }
    }
  }

  // Wall fuse only (do not bump hop — dispatch polls must not burn the 18 budget).
  {
    const fuse = await tripDeliveryJobFuseIfNeeded(
      job_id,
      input.session_id,
      "segments",
      created_at,
      { bump_continue_hop: false },
    );
    if (fuse === "tripped") {
      stopHeartbeat();
      await releaseDeliveryContinueLease(job_id, leaseToken).catch(() => undefined);
      return "failed";
    }
  }

  const secret = continueSecret(job_id);
  const tick = await runDeliveryDispatchSchedulerTick({
    job_id,
    publishTask: (task_id) => publishDeliveryTask(job_id, task_id, secret),
  });

  const dagNow = await loadDeliveryDispatchDag(job_id);
  if (tick.status === "segments_merged" || (dagNow && assembleIsOk(dagNow))) {
    const segs = await loadDeliveryStageCheckpoint(job_id, "segments");
    if (segs) {
      console.info("[final-delivery-stage] dispatch segments merged", {
        job_id,
        elapsed_ms: Date.now() - invocationStartedAt,
      });
      logDeliveryStep({
        job_id,
        level: "ok",
        step: "dispatch segments → assemble",
        ms: Date.now() - invocationStartedAt,
      });
      return "merged";
    }
  }

  if (tick.status === "failed") {
    await interruptStage(job_id, input.session_id, "segments", tick.reason, {
      where: "segments/dispatch",
      elapsed_ms: Date.now() - invocationStartedAt,
    });
    return "failed";
  }

  if (tick.status === "published" || tick.status === "idle_waiting") {
    console.info("[final-delivery-stage] dispatch scheduler hop", {
      job_id,
      tick: tick.status,
      tasks: tick.status === "published" ? tick.task_ids : [],
      elapsed_ms: Date.now() - invocationStartedAt,
    });
    logDeliveryStep({
      job_id,
      level: "hop",
      step:
        tick.status === "published"
          ? `dispatch published ${tick.task_ids.length}`
          : "dispatch idle_waiting",
      detail: tick.status === "published" ? tick.task_ids.join(",") : "workers in flight",
      ms: Date.now() - invocationStartedAt,
    });
    return parkForWorkers(tick.status);
  }

  // noop — check if somehow all ready without assemble
  const readyAll = await loadAllDeliverySegmentReady(job_id);
  if (readyAll.length >= DELIVERY_SEGMENT_KEYS.length) {
    const tick2 = await runDeliveryDispatchSchedulerTick({
      job_id,
      publishTask: (task_id) => publishDeliveryTask(job_id, task_id, secret),
    });
    if (tick2.status === "published" || tick2.status === "idle_waiting") {
      return parkForWorkers(tick2.status);
    }
    const dag = await loadDeliveryDispatchDag(job_id);
    if (dag && assembleIsOk(dag)) {
      const segs = await loadDeliveryStageCheckpoint(job_id, "segments");
      if (segs) return "merged";
    }
  }

  await interruptStage(
    job_id,
    input.session_id,
    "segments",
    `dispatch_stuck:${tick.status}:${"reason" in tick ? tick.reason : ""}`,
    { where: "segments/dispatch", elapsed_ms: Date.now() - invocationStartedAt },
  );
  return "failed";
}

/**
 * Run incomplete fan-out tasks in parallel waves (DELIVERY_TASK_CONCURRENCY),
 * checkpoint each to KV, until stage done or FANOUT_INVOCATION_BUDGET_MS exhausted.
 */
async function progressFanoutStage(
  job_id: string,
  stage: DeliveryFanoutStage,
  input: FinalDeliveryJobInput,
  cacheId: string,
  delivery_mode: ReturnType<typeof resolveDeliveryMode>,
  invocationStartedAt: number,
  leaseToken: string,
  leaseHandedOff: { value: boolean },
  stopHeartbeat: () => void,
  created_at: number,
  /** User Stop / failXhighJob(user_cancelled) — abort in-flight LLM. */
  cancelSignal?: AbortSignal,
): Promise<"merged" | "scheduled" | "failed"> {
  // Segments: retire in-invoke multi-page Promise.all — DAG workers only.
  // Compare via string so TS does not narrow `stage` away from "segments" below
  // (legacy segments branches remain as dead fallback until fully deleted).
  if ((stage as string) === "segments") {
    return progressDispatchSegments(
      job_id,
      input,
      invocationStartedAt,
      leaseToken,
      leaseHandedOff,
      stopHeartbeat,
      created_at,
      cancelSignal,
    );
  }

  const concurrency = deliveryFanoutConcurrency(stage);

  const handoff = async (nextStage: DeliveryPipelineStage): Promise<"scheduled" | "failed"> => {
    // Stop heartbeat BEFORE release so refresh cannot overwrite the next hop's lease.
    stopHeartbeat();
    const result = await scheduleDeliveryStageContinue(job_id, nextStage, {
      session_id: input.session_id,
      lease_token: leaseToken,
      created_at: created_at,
    });
    if (result === "scheduled") leaseHandedOff.value = true;
    return result;
  };

  /** Schema DAG waves finished in THIS invoke — never pack A then B in one 300s. */
  const schemaWavesFinishedThisInvoke = new Set<DeliveryWaveId>();

  while (Date.now() - invocationStartedAt < FANOUT_INVOCATION_BUDGET_MS) {
    if (cancelSignal?.aborted) {
      console.info("[final-delivery-stage] user cancelled — leave fanout", { job_id, stage });
      stopHeartbeat();
      await releaseDeliveryContinueLease(job_id, leaseToken).catch(() => undefined);
      return "failed";
    }
    const hardDeadline = VERCEL_INVOKE_HARD_MS - INVOKE_TAIL_HEADROOM_MS;
    let incomplete = await listIncompleteDeliveryTasks(job_id, stage);
    if (incomplete.length === 0) break;

    // Schema DAG: only run tasks in the current wave (A→B→C→D). Never let P5 race ahead.
    if (stage === "segments") {
      const readyAll = await loadAllDeliverySegmentReady(job_id);
      const readyKeys = new Set(readyAll.map((s) => s.key));
      const gated = filterTasksToCurrentWave(incomplete, readyKeys);
      if (gated.length === 0 && incomplete.length > 0) {
        console.info("[final-delivery-stage] wave gate — awaiting upstream", {
          job_id,
          ready: [...readyKeys],
          blocked: incomplete.map((t) => t.name),
        });
        return handoff(stage);
      }
      incomplete = prioritizeBootstrapSegmentTasks(gated);

      const nextKey = incomplete[0]?.paths[0];
      const nextWave = nextKey ? waveForSegment(nextKey) : null;

      // Pack another schema wave in the same invoke only when plenty of budget remains;
      // otherwise hop so heavy Wave B (P5/P6) gets a fresh 300s.
      const roomMs = hardDeadline - (Date.now() - invocationStartedAt);
      if (
        nextWave &&
        schemaWavesFinishedThisInvoke.size > 0 &&
        !schemaWavesFinishedThisInvoke.has(nextWave)
      ) {
        if (roomMs < SCHEMA_WAVE_PACK_MIN_REMAINING_MS) {
          console.info("[final-delivery-stage] soft wall — hop between schema waves", {
            job_id,
            finished_this_invoke: [...schemaWavesFinishedThisInvoke],
            next_wave: nextWave,
            remaining_ms: roomMs,
            pack_min_ms: SCHEMA_WAVE_PACK_MIN_REMAINING_MS,
            elapsed_ms: Date.now() - invocationStartedAt,
          });
          return handoff(stage);
        }
        console.info("[final-delivery-stage] pack next schema wave same invoke", {
          job_id,
          finished_this_invoke: [...schemaWavesFinishedThisInvoke],
          next_wave: nextWave,
          remaining_ms: roomMs,
          elapsed_ms: Date.now() - invocationStartedAt,
        });
      }

      // Hop when ActionBrief upstream (P1+P3+P4) is ready and closing wave B is next —
      // do NOT wait on P2 foundation. Skip hop when budget still allows packing Wave B.
      const elapsedEarly = Date.now() - invocationStartedAt;
      if (
        nextWave === "B" &&
        elapsedEarly > 8_000 &&
        isActionBriefUpstreamReady(readyKeys) &&
        hardDeadline - elapsedEarly < SCHEMA_WAVE_PACK_MIN_REMAINING_MS
      ) {
        console.info("[final-delivery-stage] soft wall — action-brief upstream ready, hop to closing", {
          job_id,
          next_wave: nextWave,
          remaining_ms: hardDeadline - elapsedEarly,
          elapsed_ms: elapsedEarly,
        });
        return handoff(stage);
      }
    }

    const plannedBatch = Math.min(concurrency, incomplete.length);
    const headTask = incomplete[0];
    let waveSize = plannedBatch;
    let reserve = reserveMsForNextWave(stage, input.locale, plannedBatch);
    // Bootstrap alone until segment:ready — unlocks require_preface shelf ASAP.
    if (stage === "segments" && headTask?.paths[0] === DELIVERY_BOOTSTRAP_SEGMENT) {
      waveSize = 1;
      console.info("[final-delivery-stage] bootstrap-first wave", {
        job_id,
        key: DELIVERY_BOOTSTRAP_SEGMENT,
        elapsed_ms: Date.now() - invocationStartedAt,
      });
    }
    if (stage === "finalize" && headTask && deliveryFinalizeIsXhighTask(headTask)) {
      // P3∥P4 xhigh: up to 2 in parallel (share wall clock ≈ one timeout).
      const xhighIncomplete = incomplete.filter((t) => deliveryFinalizeIsXhighTask(t));
      waveSize = Math.min(2, xhighIncomplete.length, plannedBatch);
      // Prefer contiguous xhigh head so science_action ∥ metaphysics_action share a wave.
      if (xhighIncomplete.length >= 2 && incomplete[1] && deliveryFinalizeIsXhighTask(incomplete[1])) {
        waveSize = Math.min(2, plannedBatch);
      } else if (xhighIncomplete.length >= 2) {
        incomplete = [...xhighIncomplete.slice(0, 2), ...incomplete.filter((t) => !deliveryFinalizeIsXhighTask(t))];
        waveSize = Math.min(2, plannedBatch);
      } else {
        waveSize = 1;
      }
      reserve = deliveryFinalizeTimeoutMs(headTask.paths) + 15_000;
      console.info("[final-delivery-stage] finalize xhigh wave", {
        job_id,
        waveSize,
        keys: incomplete.slice(0, waveSize).map((t) => t.paths[0]),
        elapsed_ms: Date.now() - invocationStartedAt,
      });
    }
    const elapsed = Date.now() - invocationStartedAt;
    if (
      elapsed + reserve > hardDeadline ||
      elapsed > FANOUT_INVOCATION_BUDGET_MS - 15_000
    ) {
      console.info("[final-delivery-stage] soft wall — schedule continue before wave", {
        job_id,
        stage,
        elapsed_ms: elapsed,
        reserve_ms: reserve,
        batch: plannedBatch,
        hard_deadline_ms: hardDeadline,
      });
      return handoff(stage);
    }

    // Parallel pages share wall clock (≈ one phase). Do NOT divide room by per-page
    // — that forced waveSize=1 and serial generation. Soft-wall (SEGMENT_MIN) hops
    // between fill / evidence / mark so we never pack a full 3-phase chain × N pages.
    if (stage === "segments") {
      waveSize = plannedBatch;
      if (plannedBatch > 1) {
        console.info("[final-delivery-stage] segments parallel wave", {
          job_id,
          waveSize,
          keys: incomplete.slice(0, waveSize).map((t) => t.paths[0]),
          room_ms: hardDeadline - elapsed,
        });
      }
    }

    const wave = incomplete.slice(0, waveSize);
    const waveKeys = wave.map((t) => t.paths[0]).filter(Boolean) as string[];
    const waveLabel =
      stage === "segments"
        ? waveKeys.map((k) => deliveryPageLabel(k)).join("+") || "segments"
        : stage;
    logDeliveryStep({
      job_id,
      level: "ok",
      step: `wave ${waveLabel}`,
      detail: wave.map((t) => t.name).join(", "),
      ms: Date.now() - invocationStartedAt,
      tags: `left=${incomplete.length}`,
    });
    console.info("[final-delivery-stage] wave start", {
      job_id,
      stage,
      concurrency,
      wave: wave.map((t) => t.name),
      remaining: incomplete.length,
      elapsed_ms: Date.now() - invocationStartedAt,
    });
    await updateXhighJobStatus(job_id, "running", {
      current_stage: stage,
      accumulated_content: `wave_running:${stage}:${wave.map((t) => t.name).join(",")}`,
    });

    const waveStarted = Date.now();
    const waveAbort = new AbortController();
    const onUserCancel = () => waveAbort.abort();
    if (cancelSignal) {
      if (cancelSignal.aborted) waveAbort.abort();
      else cancelSignal.addEventListener("abort", onUserCancel, { once: true });
    }
    // Abort in-flight LLM before Vercel SIGKILL so we can checkpoint + handoff.
    const msUntilPrekill = Math.max(
      1_000,
      hardDeadline - (Date.now() - invocationStartedAt) - 5_000,
    );
    const prekillTimer = setTimeout(() => {
      console.warn("[final-delivery-stage] pre-kill abort — yield before Vercel 300s", {
        job_id,
        stage,
        elapsed_ms: Date.now() - invocationStartedAt,
        hard_deadline_ms: hardDeadline,
      });
      waveAbort.abort();
    }, msUntilPrekill);
    const isolateSegmentTransport = stage === "segments";
    let settled: Array<{
      task: (typeof wave)[number];
      result: FanoutTaskResult;
      task_ms: number;
    }>;
    try {
      settled = await Promise.all(
        wave.map(async (task) => {
          const taskStarted = Date.now();
          try {
            const result = await executeFanoutTask(
              job_id,
              stage,
              task,
              input,
              cacheId,
              delivery_mode,
              waveAbort.signal,
              invocationStartedAt,
            );
            // Poison / non-transport hard fail aborts siblings (except segment soft retries).
            if (
              !result.ok &&
              !result.redirect &&
              !isAbortishReason(result.reason) &&
              !(isolateSegmentTransport && (result.soft_retryable || result.segment_exhausted))
            ) {
              waveAbort.abort();
            }
            return { task, result, task_ms: Date.now() - taskStarted };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const aborted =
              waveAbort.signal.aborted ||
              (e instanceof Error && (e.name === "AbortError" || /abort/i.test(msg)));
            const reason = aborted ? "aborted_after_sibling_fail" : `call_error:${msg}`;
            const soft =
              isolateSegmentTransport &&
              !aborted &&
              isDeliverySegmentTransportRetryable(reason);
            if (!aborted && !soft) waveAbort.abort();
            return {
              task,
              result: {
                ok: false as const,
                reason,
                soft_retryable: soft,
              },
              task_ms: Date.now() - taskStarted,
            };
          }
        }),
      );
    } finally {
      clearTimeout(prekillTimer);
      cancelSignal?.removeEventListener("abort", onUserCancel);
    }
    if (cancelSignal?.aborted) {
      console.info("[final-delivery-stage] user cancelled — stop wave", { job_id, stage });
      stopHeartbeat();
      await releaseDeliveryContinueLease(job_id, leaseToken).catch(() => undefined);
      return "failed";
    }
    const wave_ms = Date.now() - waveStarted;
    const hitPrekill = waveAbort.signal.aborted;

    // Segment transport exhausted → interrupt (keep ready pages; user Continue).
    // Never reset+handoff — that re-armed infinite /continue loops on P5 fill fails.
    if (isolateSegmentTransport) {
      const exhausted = settled.find(
        (s) => !s.result.ok && "segment_exhausted" in s.result && s.result.segment_exhausted,
      );
      if (exhausted && !exhausted.result.ok) {
        const failReason = exhausted.result.reason;
        const where = `${stage}/${exhausted.task.name}`;
        console.warn("[final-delivery-stage] segment transport exhausted — interrupt", {
          job_id,
          stage,
          task: exhausted.task.name,
          reason: failReason,
          elapsed_ms: Date.now() - invocationStartedAt,
        });
        await interruptStage(job_id, input.session_id, stage, failReason, {
          task: exhausted.task.name,
          elapsed_ms: Date.now() - invocationStartedAt,
          where,
        });
        return "failed";
      }
    }

    // Prefer the real poison failure over sibling AbortError cancels.
    const hardFail = settled.find(
      (s) =>
        !s.result.ok &&
        !s.result.redirect &&
        !isAbortishReason(s.result.reason) &&
        !(
          isolateSegmentTransport &&
          ("soft_retryable" in s.result
            ? s.result.soft_retryable || s.result.segment_exhausted
            : false)
        ),
    );
    if (hardFail && !hardFail.result.ok) {
      const failReason = hardFail.result.redirect
        ? `missing_upstream:${hardFail.result.redirect}:${hardFail.result.reason}`
        : hardFail.result.reason;
      const where = `${stage}/${hardFail.task.name}`;
      const extra = {
        task: hardFail.task.name,
        elapsed_ms: Date.now() - invocationStartedAt,
        where,
      };
      // 断点续跑: if earlier pages already checkpointed, pause (Continue) —
      // never wipe a book that already has ready segments (e.g. epilogue JSON truncate).
      if (isolateSegmentTransport) {
        const readyAll = await loadAllDeliverySegmentReady(job_id).catch(() => []);
        if (readyAll.length > 0) {
          await interruptStage(job_id, input.session_id, stage, failReason, extra);
          return "failed";
        }
      }
      await failStage(job_id, input.session_id, stage, failReason, extra);
      return "failed";
    }

    let waveHadSoftWall = false;
    let waveHadSoftRetry = false;
    for (const { task, result, task_ms } of settled) {
      if (!result.ok) {
        if (isAbortishReason(result.reason)) continue;
        if (
          isolateSegmentTransport &&
          "soft_retryable" in result &&
          result.soft_retryable
        ) {
          waveHadSoftRetry = true;
          logDeliveryStep({
            job_id,
            level: "hop",
            step: `${deliveryPageLabel(task.paths[0])} retry later`,
            detail: result.reason.slice(0, 160),
            ms: task_ms,
          });
          console.info("[final-delivery-stage] segment soft-retryable", {
            job_id,
            stage,
            task: task.name,
            task_ms,
            reason: result.reason,
          });
          continue;
        }
        await failStage(
          job_id,
          input.session_id,
          stage,
          result.redirect
            ? `missing_upstream:${result.redirect}:${result.reason}`
            : result.reason,
          {
            task: task.name,
            elapsed_ms: Date.now() - invocationStartedAt,
            where: `${stage}/${task.name}`,
          },
        );
        return "failed";
      }
      if (result.soft_wall_yield) {
        waveHadSoftWall = true;
        logDeliveryStep({
          job_id,
          level: "hop",
          step: `${deliveryPageLabel(task.paths[0])} soft-wall`,
          detail: task.name,
          ms: task_ms,
        });
        console.info("[final-delivery-stage] segment soft-wall yield", {
          job_id,
          stage,
          task: task.name,
          task_ms,
          tokens_used: result.tokens_used,
        });
        continue;
      }
      await saveDeliveryTaskCheckpoint(job_id, {
        stage,
        task: task.name,
        value: result.value,
        tokens_used: result.tokens_used,
        model: result.model,
      });
      logDeliveryStep({
        job_id,
        level: "ok",
        step: `${deliveryPageLabel(task.paths[0])} done`,
        detail: task.name,
        ms: task_ms,
      });
      console.info("[final-delivery-stage] task done", {
        job_id,
        stage,
        task: task.name,
        task_ms,
        tokens_used: result.tokens_used,
        elapsed_ms: Date.now() - invocationStartedAt,
      });
    }

    if (waveHadSoftWall || waveHadSoftRetry) {
      if (waveHadSoftRetry) {
        console.info("[final-delivery-stage] segment soft-retry — schedule continue", {
          job_id,
          stage,
          elapsed_ms: Date.now() - invocationStartedAt,
        });
      }
      return handoff(stage);
    }

    // Pre-kill abort with no soft-wall flag (killed mid-phase) — hop while process alive.
    if (hitPrekill) {
      console.warn("[final-delivery-stage] pre-kill wave abort — handoff", {
        job_id,
        stage,
        wave_ms,
        elapsed_ms: Date.now() - invocationStartedAt,
      });
      return handoff(stage);
    }

    console.info("[final-delivery-stage] wave timing", {
      job_id,
      stage,
      wave_ms,
      tasks: settled.map((s) => ({ name: s.task.name, task_ms: s.task_ms, ok: s.result.ok })),
      elapsed_ms: Date.now() - invocationStartedAt,
    });

    // Finalize: checkpoint each wave to KV, then /continue — every batch gets fresh maxDuration=300.
    // Do not pack wave 1 + wave 2 in one invoke (was the root of 90s+120s timeout math).
    if (stage === "finalize") {
      const moreFinalize = await listIncompleteDeliveryTasks(job_id, stage);
      if (moreFinalize.length > 0) {
        console.info("[final-delivery-stage] finalize wave done — handoff for fresh invoke", {
          job_id,
          remaining: moreFinalize.map((t) => t.name),
          wave_ms,
          elapsed_ms: Date.now() - invocationStartedAt,
        });
        return handoff(stage);
      }
    }

    if (stage === "segments") {
      const readyAll = await loadAllDeliverySegmentReady(job_id);
      const readyKeys = new Set(readyAll.map((s) => s.key));
      for (const wid of ["A", "B"] as DeliveryWaveId[]) {
        if (schemaWaveFullyReady(readyKeys, wid)) {
          schemaWavesFinishedThisInvoke.add(wid);
        }
      }
      // Any successfully completed segment this batch counts as progress in its wave
      // (even if the full DAG wave isn't done yet — blocks packing Wave C after partial B).
      for (const { task, result } of settled) {
        if (!result.ok || result.soft_wall_yield) continue;
        const k = task.paths[0];
        if (k) schemaWavesFinishedThisInvoke.add(waveForSegment(k));
      }

      const moreRaw = await listIncompleteDeliveryTasks(job_id, stage);
      const moreGated = filterTasksToCurrentWave(moreRaw, readyKeys);
      const nextKey = moreGated[0]?.paths[0];
      if (nextKey) {
        const nextWave = waveForSegment(nextKey);
        if (
          schemaWavesFinishedThisInvoke.size > 0 &&
          !schemaWavesFinishedThisInvoke.has(nextWave)
        ) {
          const remainingAfter = hardDeadline - (Date.now() - invocationStartedAt);
          if (remainingAfter < SCHEMA_WAVE_PACK_MIN_REMAINING_MS) {
            console.info("[final-delivery-stage] soft wall — schema wave boundary after batch", {
              job_id,
              finished_this_invoke: [...schemaWavesFinishedThisInvoke],
              next_wave: nextWave,
              remaining_ms: remainingAfter,
              elapsed_ms: Date.now() - invocationStartedAt,
            });
            return handoff(stage);
          }
          console.info("[final-delivery-stage] pack next schema wave after batch", {
            job_id,
            finished_this_invoke: [...schemaWavesFinishedThisInvoke],
            next_wave: nextWave,
            remaining_ms: remainingAfter,
            elapsed_ms: Date.now() - invocationStartedAt,
          });
        }
      }
    }

    const more = await listIncompleteDeliveryTasks(job_id, stage);
    await updateXhighJobStatus(job_id, "running", {
      current_stage: stage,
      accumulated_content: more.length
        ? `wave_done:${stage};remaining:${more.length};wave_ms:${wave_ms}`
        : `wave_done:${stage};merging;wave_ms:${wave_ms}`,
    });

    // Continue waves in-process while budget remains (mark/evidence are fast ~3s/call).
  }

  const stillPending = await findNextIncompleteDeliveryTask(job_id, stage);
  if (stillPending) {
    console.info("[final-delivery-stage] budget pause — schedule continue", {
      job_id,
      stage,
      next_task: stillPending.name,
      elapsed_ms: Date.now() - invocationStartedAt,
    });
    return handoff(stage);
  }

  // All tasks done — merge into stage checkpoint.
  if (stage === "finalize") {
    const taskCps = await loadAllDeliveryTaskCheckpoints(job_id, stage);
    if (taskCps.length < DELIVERY_TASKS.length) {
      await failStage(
        job_id,
        input.session_id,
        stage,
        `task_checkpoint_incomplete:${taskCps.length}/${DELIVERY_TASKS.length}`,
        { where: `${stage}/merge`, elapsed_ms: Date.now() - invocationStartedAt },
      );
      return "failed";
    }
    const tokens_used = taskCps.reduce((s, c) => s + (c.tokens_used ?? 0), 0);
    const assembled = assembleDeliveryFinalize(
      taskCps.map((c) => c.value as Partial<DeliveryComputed>),
      { delivery_mode: input.delivery_mode },
    );
    if (!assembled.ok) {
      await failStage(job_id, input.session_id, stage, assembled.reason, {
        where: "finalize/merge",
        elapsed_ms: Date.now() - invocationStartedAt,
      });
      return "failed";
    }
    const model = taskCps.map((c) => c.model).find((m) => m && m.length > 0) ?? assembled.model;
    await saveDeliveryStageCheckpoint(job_id, {
      stage: "finalize",
      value: assembled.value,
      tokens_used,
      model: model || "",
    });
    // Seed dispatch DAG once finalize spine is ready (segments workers consume it).
    await ensureDeliveryDispatchDag(job_id, () => buildInitialDeliveryDispatchDag(job_id));
    await ensureJobChartPrimaryPrealloc(job_id, input);
    console.info("[final-delivery-stage] stage timing", {
      job_id,
      stage,
      stage_ms: Date.now() - invocationStartedAt,
      tokens_used,
      tasks_done: taskCps.length,
      status: "merged",
    });
    return "merged";
  }

  // segments — merge from segment:ready + progress (not stage-local mark/narr CP)
  const readyAll = await loadAllDeliverySegmentReady(job_id);
  if (readyAll.length < DELIVERY_SEGMENT_KEYS.length) {
    await failStage(
      job_id,
      input.session_id,
      stage,
      `segment_ready_incomplete:${readyAll.length}/${DELIVERY_SEGMENT_KEYS.length}`,
      { where: `${stage}/merge`, elapsed_ms: Date.now() - invocationStartedAt },
    );
    return "failed";
  }

  const narrative: DeliveryArgumentTree = {};
  const marked: DeliveryArgumentTree = {};
  let tokens_used = 0;
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const prog = await loadDeliverySegmentProgress(job_id, k);
    if (!prog || prog.phase !== "done") {
      await failStage(
        job_id,
        input.session_id,
        stage,
        `segment_progress_incomplete:${k}`,
        { where: `${stage}/merge`, elapsed_ms: Date.now() - invocationStartedAt },
      );
      return "failed";
    }
    tokens_used += prog.tokens_used;
    if (prog.narrative?.[k]) narrative[k] = prog.narrative[k];
    if (prog.marked?.[k]) marked[k] = prog.marked[k];
  }

  await saveDeliveryStageCheckpoint(job_id, {
    stage: "segments",
    value: marked,
    narrative,
    tokens_used,
  });

  console.info("[final-delivery-stage] stage timing", {
    job_id,
    stage,
    stage_ms: Date.now() - invocationStartedAt,
    tokens_used,
    tasks_done: readyAll.length,
    status: "merged",
  });
  return "merged";
}

/**
 * Run a single pipeline hop. On success, schedules the next hop (or completes).
 */
export async function runFinalDeliveryStage(
  job_id: string,
  stage: DeliveryPipelineStage,
  opts?: { lease_token?: string },
): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job) {
    console.warn("[final-delivery-stage] missing job", { job_id, stage });
    if (opts?.lease_token) {
      await releaseDeliveryContinueLease(job_id, opts.lease_token).catch(() => undefined);
    }
    return;
  }
  if (job.status === "completed" || job.status === "failed") {
    if (opts?.lease_token) {
      await releaseDeliveryContinueLease(job_id, opts.lease_token).catch(() => undefined);
    }
    return;
  }
  // Redeploy kill-switch (defense in depth — continue route also checks).
  {
    const { isDeliveryJobFromCurrentDeploy, currentDeliveryDeployGeneration } = await import(
      "@/lib/poju/delivery-deploy-generation"
    );
    if (!isDeliveryJobFromCurrentDeploy(job)) {
      console.warn("[final-delivery-stage] skip — superseded by redeploy", {
        job_id,
        stage,
        stamped: job.deploy_generation ?? null,
        current: currentDeliveryDeployGeneration(),
      });
      if (opts?.lease_token) {
        await releaseDeliveryContinueLease(job_id, opts.lease_token).catch(() => undefined);
      }
      const { forceReleaseDeliveryContinueLease } = await import(
        "@/lib/llm/pro/delivery/delivery-stage-store"
      );
      await forceReleaseDeliveryContinueLease(job_id).catch(() => undefined);
      await failXhighJob(job_id, "STOP: superseded by redeploy", {
        retryable: false,
        failure_reason: "superseded_by_deploy",
        current_stage: stage,
        accumulated_content: "failed:superseded_by_deploy",
      }).catch(() => undefined);
      if (isFinalDeliveryJobInput(job.input)) {
        await releaseXhighSessionLock("final_delivery", job.input.session_id).catch(
          () => undefined,
        );
      }
      return;
    }
  }
  if (!isFinalDeliveryJobInput(job.input)) {
    if (opts?.lease_token) {
      await releaseDeliveryContinueLease(job_id, opts.lease_token).catch(() => undefined);
    }
    await failXhighJob(job_id, "invalid final_delivery job input", {
      retryable: false,
      failure_reason: "parse_failed",
    });
    return;
  }

  // Job-level fuse (wall / continue hops) — before any LLM work this invoke.
  {
    const fuse = await tripDeliveryJobFuseIfNeeded(
      job_id,
      job.input.session_id,
      stage,
      job.created_at,
    );
    if (fuse === "tripped") {
      if (opts?.lease_token) {
        await releaseDeliveryContinueLease(job_id, opts.lease_token).catch(() => undefined);
      }
      return;
    }
  }

  let leaseToken = opts?.lease_token;
  if (!leaseToken) {
    const acquired = await tryAcquireDeliveryContinueLease(job_id, stage);
    if (!acquired.ok) {
      console.warn("[final-delivery-stage] continue lease busy — skip overlap", {
        job_id,
        stage,
        holder_stage: acquired.lease.stage,
        expires_at: acquired.lease.expires_at,
      });
      return;
    }
    leaseToken = acquired.token;
  }

  const leaseHandedOff = { value: false };

  // Stage already merged — skip to next.
  const existing = await loadDeliveryStageCheckpoint(job_id, stage);
  if (existing) {
    const next = nextDeliveryStage(stage);
    if (next) {
      await updateXhighJobStatus(job_id, "running", {
        current_stage: next,
        accumulated_content: `stage_skip_to:${next}`,
      });
      const hop = await scheduleDeliveryStageContinue(job_id, next, {
        session_id: job.input.session_id,
        lease_token: leaseToken,
        created_at: job.created_at,
      });
      if (hop === "scheduled") leaseHandedOff.value = true;
    } else {
      await releaseDeliveryContinueLease(job_id, leaseToken).catch(() => undefined);
    }
    return;
  }

  const input = job.input;
  const delivery_mode = resolveDeliveryMode({
    delivery_mode: input.delivery_mode,
    agent_v2: input.agent_v2,
  });
  const cacheId = pojuCacheSessionId(input.session_id);

  await updateXhighJobStatus(job_id, "running", {
    current_stage: stage,
    accumulated_content: `stage_running:${stage}`,
  });
  if (deliveryFailFastEnabled()) {
    console.info("[final-delivery-stage] fail-fast retries disabled", { job_id, stage });
  }

  const userCancel = new AbortController();
  let heartbeat: ReturnType<typeof setInterval> | null = setInterval(() => {
    if (leaseHandedOff.value || userCancel.signal.aborted) return;
    void (async () => {
      try {
        const snap = await getXhighJob(job_id);
        if (
          snap?.status === "failed" &&
          (snap.failure_reason === "user_cancelled" ||
            String(snap.accumulated_content ?? "").includes("user_cancelled"))
        ) {
          userCancel.abort();
          return;
        }
      } catch {
        /* ignore heartbeat read errors */
      }
      if (leaseHandedOff.value || userCancel.signal.aborted) return;
      void setXhighJobContent(job_id, `stage_running:${stage}:${Date.now()}`).catch(() => undefined);
      void refreshDeliveryContinueLease(job_id, leaseToken!).catch(() => undefined);
    })();
  }, HEARTBEAT_MS);

  const stopHeartbeat = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  const t0 = Date.now();
  try {
    if (isDeliveryFanoutStage(stage)) {
      const hop = await progressFanoutStage(
        job_id,
        stage,
        input,
        cacheId,
        delivery_mode,
        t0,
        leaseToken,
        leaseHandedOff,
        stopHeartbeat,
        job.created_at,
        userCancel.signal,
      );
      if (hop === "scheduled" || hop === "failed") return;
      // Merged — advance. After finalize: pack P1 bootstrap in leftover budget when
      // possible (unlock shelf one hop earlier); never pack full Wave A with a starved clock.
      const next = nextDeliveryStage(stage);
      console.info("[final-delivery-stage] stage ok → next", {
        job_id,
        stage,
        next,
        stage_ms: Date.now() - t0,
        mode: "task_fanout_parallel",
      });
      logDeliveryStep({
        job_id,
        level: "ok",
        step: `stage ${stage} → ${next ?? "done"}`,
        ms: Date.now() - t0,
      });
      if (next) {
        await updateXhighJobStatus(job_id, "running", {
          current_stage: next,
          accumulated_content: `stage_done:${stage};next:${next}`,
        });
        const hardDeadline = VERCEL_INVOKE_HARD_MS - INVOKE_TAIL_HEADROOM_MS;
        const remainingMs = hardDeadline - (Date.now() - t0);
        const canPackBootstrap =
          stage === "finalize" &&
          next === "segments" &&
          remainingMs >= SEGMENT_BOOTSTRAP_MIN_INVOKE_MS + 25_000;
        if (canPackBootstrap && isDeliveryFanoutStage(next)) {
          console.info("[final-delivery-stage] pack P1 bootstrap same invoke after finalize", {
            job_id,
            remaining_ms: remainingMs,
            bootstrap_min_ms: SEGMENT_BOOTSTRAP_MIN_INVOKE_MS,
          });
          const hop2 = await progressFanoutStage(
            job_id,
            next,
            input,
            cacheId,
            delivery_mode,
            t0,
            leaseToken,
            leaseHandedOff,
            stopHeartbeat,
            job.created_at,
            userCancel.signal,
          );
          if (hop2 === "merged") {
            const next2 = nextDeliveryStage(next);
            if (next2) {
              await updateXhighJobStatus(job_id, "running", {
                current_stage: next2,
                accumulated_content: `stage_done:${next};next:${next2}`,
              });
              stopHeartbeat();
              const h = await scheduleDeliveryStageContinue(job_id, next2, {
                session_id: input.session_id,
                lease_token: leaseToken,
                created_at: job.created_at,
              });
              if (h === "scheduled") leaseHandedOff.value = true;
            }
            return;
          }
          if (hop2 === "scheduled" || hop2 === "failed") return;
          // Soft-wall mid-segments (P1 done or in progress) — hop already scheduled inside.
        }
        stopHeartbeat();
        const h = await scheduleDeliveryStageContinue(job_id, next, {
          session_id: input.session_id,
          lease_token: leaseToken,
          created_at: job.created_at,
        });
        if (h === "scheduled") leaseHandedOff.value = true;
      }
      return;
    }

    // assemble — merge segment trees (locale mark + body translate already done in chain).
    if (stage === "assemble") {
      if (userCancel.signal.aborted) {
        stopHeartbeat();
        await releaseDeliveryContinueLease(job_id, leaseToken).catch(() => undefined);
        return;
      }
      const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
      const segs = await loadDeliveryStageCheckpoint(job_id, "segments");
      if (!fin || !segs) {
        await failStage(
          job_id,
          input.session_id,
          stage,
          `missing_upstream:${segs ? "finalize" : "segments"}`,
          { where: "assemble", elapsed_ms: Date.now() - t0 },
        );
        return;
      }

      const narrativeForMerge = segs.narrative;
      const evidenceForMerge = segs.value;
      const translate_ms = 0;
      const tokens_used = (fin.tokens_used ?? 0) + segs.tokens_used;
      const model = fin.model || "";

      const { attachMetaphysicsPackToBreakthroughCore } = await import(
        "@/lib/poju/attach-metaphysics-pack"
      );
      const breakthrough_core = input.breakthrough_core
        ? attachMetaphysicsPackToBreakthroughCore(
            input.breakthrough_core,
            input.base_analysis ?? null,
          )
        : null;

      const page_structs: NonNullable<DeliveryBookMeta["page_structs"]> = {};
      const page_schemas: NonNullable<DeliveryBookMeta["page_schemas"]> = {};
      const allReady = await loadAllDeliverySegmentReady(job_id);
      const readyByKey = new Map(allReady.map((r) => [r.key, r]));
      for (const k of DELIVERY_SEGMENT_KEYS) {
        const prog = await loadDeliverySegmentProgress(job_id, k);
        const ready = readyByKey.get(k);
        if (prog?.scan || prog?.gantt) {
          page_structs[k] = {
            scan: prog.scan ?? null,
            gantt: prog.gantt ?? null,
          };
        }
        const schema = ready?.page_schema ?? prog?.page_schema;
        if (schema) page_schemas[k] = schema;
      }

      const bookMeta = {
        original_question: input.agent_v2.original_question,
        locale: input.locale,
        report_id: `POJU-${input.session_id.slice(0, 8)}`,
        generated_at: new Date().toISOString(),
        base_analysis: input.base_analysis ?? null,
        breakthrough_core,
        page_structs,
        page_schemas,
      };
      const markdown = mergeDeliveryToMarkdown(
        narrativeForMerge,
        evidenceForMerge,
        input.locale,
        bookMeta,
      );
      const full_text = sanitizeDeliveryBookMarkdown(markdown, input.locale);

      const timings = {
        translate_ms: translate_ms || undefined,
        total_ms: Date.now() - (job.created_at || t0),
      };

      await saveDeliveryStageCheckpoint(job_id, {
        stage: "assemble",
        full_text,
        tokens_used,
        model,
        timings,
      });

      const actions = extractActionsFromDelivery(full_text, null);
      const latency_ms = Date.now() - job.created_at;
      const llm_debug = enrichLlmDebugPhaseTransition(
        {
          phase: "final_delivery",
          requested_effort: "xhigh",
          max_tokens: 20_000,
          reasoning_budget: 0,
          model,
          prompt_tokens: 0,
          cached_tokens: 0,
          cache_ratio: 0,
          completion_tokens: 0,
          reasoning_tokens: 0,
          reasoning_used_ratio: 0,
          latency_ms,
          attempt: 1,
          retried: false,
          fell_back: false,
        },
        {
          phase_from: input.agent_v2.current_phase,
          phase_to: "delivered",
          call_type: "main_delivery",
        },
      );

      const result: FinalDeliveryJobResult = {
        kind: "final_delivery",
        full_text,
        actions: actions as unknown as Array<Record<string, unknown>>,
        model,
        tokens_used,
        llm_debug,
        timings,
      };

      await completeXhighJob(job_id, {
        result,
        model,
        tokens_used,
        llm_debug,
        accumulated_content: `delivery_done:${full_text.length}`,
      });
      await updateXhighJobStatus(job_id, "completed", {
        current_stage: "completed",
      });
      await releaseXhighSessionLock("final_delivery", input.session_id);
      logDeliveryStep({
        job_id,
        level: "ok",
        step: "book complete",
        detail: `${full_text.length} chars`,
        ms: latency_ms,
      });
      console.info("[final-delivery-stage] stage timing", {
        job_id,
        stage: "assemble",
        stage_ms: Date.now() - t0,
        translate_ms,
        tokens_used,
        chars: full_text.length,
        job_latency_ms: latency_ms,
        status: "completed",
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await failStage(job_id, input.session_id, stage, msg, {
      where: `${stage}/exception`,
      elapsed_ms: Date.now() - t0,
    });
  } finally {
    stopHeartbeat();
    // Handoff already released the lease when posting /continue.
    if (!leaseHandedOff.value) {
      await releaseDeliveryContinueLease(job_id, leaseToken).catch(() => undefined);
    }
  }
}

/** Start or resume pipeline from the first incomplete stage. */
export async function runFinalDeliveryJob(job_id: string): Promise<void> {
  const latest = await findLatestCompletedDeliveryStage(job_id);
  const start = nextDeliveryStage(latest) ?? (latest === "assemble" ? null : "finalize");
  if (!start) {
    const assembled = await loadDeliveryStageCheckpoint(job_id, "assemble");
    if (assembled) {
      const job = await getXhighJob(job_id);
      if (job && job.status !== "completed" && isFinalDeliveryJobInput(job.input)) {
        await runFinalDeliveryStage(job_id, "assemble");
      }
    }
    return;
  }
  await runFinalDeliveryStage(job_id, start);
}

export { DELIVERY_PIPELINE_STAGES };
export type { DeliveryPipelineStage };
