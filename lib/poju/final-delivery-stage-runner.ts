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
  DELIVERY_SEGMENT_KEYS,
  type DeliveryArgumentTree,
  type DeliveryComputed,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  deliveryFanoutConcurrency,
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
import { advanceSegmentChain } from "@/lib/llm/pro/delivery/run-segment-chain";
import {
  filterTasksToCurrentWave,
  loadPrimaryBackupHint,
  loadUpstreamActionBrief,
  loadUpstreamWeekSummary,
} from "@/lib/llm/pro/delivery/page-schema/upstream";
import { isWaveBoundary } from "@/lib/llm/pro/delivery/page-schema/waves";
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
import { deliveryFailFastEnabled, DELIVERY_SEGMENT_TRANSPORT_MAX_ATTEMPTS, isDeliverySegmentTransportRetryable } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { dispatchDeliveryContinue } from "@/lib/poju/delivery-continue-dispatch";

const HEARTBEAT_MS = 12_000;
/** Vercel `export const maxDuration = 300` on /continue — hard process kill. */
const VERCEL_INVOKE_HARD_MS = 300_000;
/** Leave merge / schedule / TLS room before platform SIGKILL. */
const INVOKE_TAIL_HEADROOM_MS = 25_000;
/**
 * Soft ceiling for packing waves in one invoke. Secondary to
 * "elapsed + next-wave reserve < hard − headroom" below.
 */
const FANOUT_INVOCATION_BUDGET_MS = 270_000;

/**
 * Soft-wall reserve before starting another wave.
 * Segments: mid-chain hops use phase reserves inside advanceSegmentChain;
 * here only gate starting / continuing a wave (~one mark-dominated phase).
 */
function reserveMsForNextWave(stage: DeliveryPipelineStage, _locale = "zh"): number {
  if (stage === "segments") return 200_000;
  return 90_000;
}

function continueSecret(job_id: string): string {
  const seed =
    process.env.POJU_INTERNAL_STAGE_SECRET?.trim() ||
    process.env.OPS_SESSION_SECRET?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    "poju-delivery-stage";
  return `fdstage:${job_id}:${seed.slice(0, 24)}`;
}

export function verifyDeliveryContinueSecret(job_id: string, secret: string | null): boolean {
  return Boolean(secret) && secret === continueSecret(job_id);
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
  opts: { session_id: string; lease_token: string },
): Promise<"scheduled" | "failed"> {
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
): Promise<void> {
  const where = extra?.where ?? (extra?.task ? `${stage}/${extra.task}` : stage);
  const errorMsg = `STOP at ${where}: ${reason}`;
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
    const result = await runFinalizeGroup(task, {
      breakthrough_core: input.breakthrough_core,
      covered_agenda: input.covered_agenda,
      agent_v2: input.agent_v2,
      locale: input.locale,
      delivery_mode,
      session_id: cacheId,
      signal,
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
  if (key === "thirty_day" || key === "risk_guard" || key === "signals_close") {
    action_brief = await loadUpstreamActionBrief(job_id);
    console.info("[final-delivery-stage] P5ActionBrief loaded", {
      job_id,
      key,
      has_brief: Boolean(action_brief),
      primary: action_brief?.primary_name,
      p3_steps: action_brief?.p3_primary_steps.length ?? 0,
    });
  }
  if (key === "risk_guard" || key === "signals_close") {
    week_summary = await loadUpstreamWeekSummary(job_id);
  }
  if (
    key === "science_action" ||
    key === "metaphysics_action" ||
    key === "foundation" ||
    key === "thirty_day" ||
    key === "risk_guard" ||
    key === "signals_close"
  ) {
    primary_backup_hint = await loadPrimaryBackupHint(job_id);
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
    shouldYield: (nextPhaseReserveMs) => {
      const elapsed = Date.now() - invocationStartedAt;
      return elapsed + nextPhaseReserveMs > hardDeadline;
    },
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
    return { ok: false, reason: failReason };
  }

  // Success path — clear transport fail counter.
  if ((chain.progress.transport_fail_count ?? 0) > 0) {
    await saveDeliverySegmentProgress(job_id, {
      ...chain.progress,
      transport_fail_count: 0,
    }).catch(() => undefined);
  } else {
    await saveDeliverySegmentProgress(job_id, chain.progress);
  }

  if (!chain.done) {
    return {
      ok: true,
      value: {},
      tokens_used: chain.tokens_used,
      soft_wall_yield: true,
    };
  }

  await saveDeliverySegmentReady(job_id, chain.ready);
  return {
    ok: true,
    value: chain.progress.marked ?? chain.progress.narrative ?? {},
    tokens_used: chain.tokens_used,
  };
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
): Promise<"scheduled" | "merged" | "failed"> {
  const concurrency = deliveryFanoutConcurrency(stage);

  const handoff = async (nextStage: DeliveryPipelineStage): Promise<"scheduled" | "failed"> => {
    // Stop heartbeat BEFORE release so refresh cannot overwrite the next hop's lease.
    stopHeartbeat();
    const result = await scheduleDeliveryStageContinue(job_id, nextStage, {
      session_id: input.session_id,
      lease_token: leaseToken,
    });
    if (result === "scheduled") leaseHandedOff.value = true;
    return result;
  };

  while (Date.now() - invocationStartedAt < FANOUT_INVOCATION_BUDGET_MS) {
    let incomplete = await listIncompleteDeliveryTasks(job_id, stage);
    if (incomplete.length === 0) break;

    // Schema DAG: only run tasks in the current wave (A→B→C→D). Never let P5 race ahead.
    if (stage === "segments") {
      const readyAll = await loadAllDeliverySegmentReady(job_id);
      const readyKeys = new Set(readyAll.map((s) => s.key));
      const gated = filterTasksToCurrentWave(incomplete, readyKeys);
      if (gated.length === 0 && incomplete.length > 0) {
        // Waiting on upstream wave — soft-wall hop rather than spin.
        console.info("[final-delivery-stage] wave gate — awaiting upstream", {
          job_id,
          ready: [...readyKeys],
          blocked: incomplete.map((t) => t.name),
        });
        return handoff(stage);
      }
      incomplete = gated;
    }

    // Soft wall: never start a wave that cannot finish before Vercel SIGKILL.
    // Bug we hit: wave1 ~188s then wave2 started (elapsed < budget−15s) and
    // in-flight OpenRouter calls kept running until the 300s platform kill —
    // abort does not reach the supplier after the process dies.
    const elapsed = Date.now() - invocationStartedAt;
    const reserve = reserveMsForNextWave(stage, input.locale);
    const hardDeadline = VERCEL_INVOKE_HARD_MS - INVOKE_TAIL_HEADROOM_MS;
    if (
      elapsed + reserve > hardDeadline ||
      elapsed > FANOUT_INVOCATION_BUDGET_MS - 15_000
    ) {
      console.info("[final-delivery-stage] soft wall — schedule continue before wave", {
        job_id,
        stage,
        elapsed_ms: elapsed,
        reserve_ms: reserve,
        hard_deadline_ms: hardDeadline,
      });
      return handoff(stage);
    }

    // Prefer soft-wall hop at schema wave boundaries after a single-key wave finishes.
    if (stage === "segments" && incomplete.length > 0) {
      const readyAll = await loadAllDeliverySegmentReady(job_id);
      const lastReady = readyAll[readyAll.length - 1]?.key;
      if (
        lastReady &&
        isWaveBoundary(lastReady) &&
        elapsed > 60_000 &&
        elapsed + reserve > hardDeadline - 90_000
      ) {
        console.info("[final-delivery-stage] soft wall at wave boundary", {
          job_id,
          lastReady,
          elapsed_ms: elapsed,
        });
        return handoff(stage);
      }
    }

    const wave = incomplete.slice(0, concurrency);
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
    const isolateSegmentTransport = stage === "segments";
    const settled = await Promise.all(
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
    const wave_ms = Date.now() - waveStarted;

    // Segment transport exhausted → interrupt (keep ready segments for Continue).
    if (isolateSegmentTransport) {
      const exhausted = settled.find(
        (s) => !s.result.ok && "segment_exhausted" in s.result && s.result.segment_exhausted,
      );
      if (exhausted && !exhausted.result.ok) {
        await interruptStage(
          job_id,
          input.session_id,
          stage,
          exhausted.result.reason,
          {
            task: exhausted.task.name,
            elapsed_ms: Date.now() - invocationStartedAt,
            where: `${stage}/${exhausted.task.name}`,
          },
        );
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

    console.info("[final-delivery-stage] wave timing", {
      job_id,
      stage,
      wave_ms,
      tasks: settled.map((s) => ({ name: s.task.name, task_ms: s.task_ms, ok: s.result.ok })),
      elapsed_ms: Date.now() - invocationStartedAt,
    });

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

  let heartbeat: ReturnType<typeof setInterval> | null = setInterval(() => {
    if (leaseHandedOff.value) return;
    void setXhighJobContent(job_id, `stage_running:${stage}:${Date.now()}`).catch(() => undefined);
    void refreshDeliveryContinueLease(job_id, leaseToken!).catch(() => undefined);
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
      );
      if (hop === "scheduled" || hop === "failed") return;
      // Merged — advance. After finalize always hop (segment chains need a fresh 300s).
      const next = nextDeliveryStage(stage);
      console.info("[final-delivery-stage] stage ok → next", {
        job_id,
        stage,
        next,
        stage_ms: Date.now() - t0,
        mode: "task_fanout_parallel",
      });
      if (next) {
        await updateXhighJobStatus(job_id, "running", {
          current_stage: next,
          accumulated_content: `stage_done:${stage};next:${next}`,
        });
        const canPackSameInvoke = false;
        if (canPackSameInvoke && isDeliveryFanoutStage(next)) {
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
              });
              if (h === "scheduled") leaseHandedOff.value = true;
            }
            return;
          }
          if (hop2 === "scheduled" || hop2 === "failed") return;
        }
        stopHeartbeat();
        const h = await scheduleDeliveryStageContinue(job_id, next, {
          session_id: input.session_id,
          lease_token: leaseToken,
        });
        if (h === "scheduled") leaseHandedOff.value = true;
      }
      return;
    }

    // assemble — merge segment trees (locale mark + body translate already done in chain).
    if (stage === "assemble") {
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
      for (const k of DELIVERY_SEGMENT_KEYS) {
        const prog = await loadDeliverySegmentProgress(job_id, k);
        if (prog?.scan || prog?.gantt) {
          page_structs[k] = {
            scan: prog.scan ?? null,
            gantt: prog.gantt ?? null,
          };
        }
      }

      const bookMeta = {
        original_question: input.agent_v2.original_question,
        locale: input.locale,
        report_id: `POJU-${input.session_id.slice(0, 8)}`,
        generated_at: new Date().toISOString(),
        base_analysis: input.base_analysis ?? null,
        breakthrough_core,
        page_structs,
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
          max_tokens: 16_000,
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
