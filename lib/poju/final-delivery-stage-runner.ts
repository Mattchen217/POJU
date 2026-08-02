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
  assembleDeliveryEvidence,
  assembleDeliveryNarrative,
  runEvidenceTask,
  runNarrativeTask,
} from "@/lib/llm/pro/delivery/narrative-evidence-call";
import {
  assembleDeliveryMark,
  runMarkDeliveryTask,
} from "@/lib/llm/pro/delivery/mark-evidence-call";
import { mergeDeliveryToMarkdown } from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { sanitizeDeliveryBookMarkdown } from "@/lib/llm/pro/delivery/sanitize-delivery-book";
import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SEGMENT_KEYS,
  type DeliveryArgumentTree,
  type DeliveryComputed,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  deliveryFanoutConcurrency,
  DELIVERY_MARK_TIMEOUT_MS,
  DELIVERY_TASKS,
  DELIVERY_WRITE_MAX_TOKENS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  DELIVERY_PIPELINE_STAGES,
  findLatestCompletedDeliveryStage,
  findNextIncompleteDeliveryTask,
  hasLiveDeliveryContinueForStage,
  isDeliveryFanoutStage,
  listIncompleteDeliveryTasks,
  loadAllDeliveryTaskCheckpoints,
  loadDeliveryStageCheckpoint,
  nextDeliveryStage,
  refreshDeliveryContinueLease,
  releaseDeliveryContinueLease,
  saveDeliveryStageCheckpoint,
  saveDeliveryTaskCheckpoint,
  tryAcquireDeliveryContinueLease,
  type DeliveryFanoutStage,
  type DeliveryPipelineStage,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
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
import {
  deliveryFailFastEnabled,
  deliveryTransportMaxAttempts,
} from "@/lib/llm/pro/delivery/delivery-retry-policy";
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

/** Worst-case wall for one more parallel wave (≈ slowest task). */
function reserveMsForNextWave(stage: DeliveryPipelineStage): number {
  if (stage === "mark") return DELIVERY_MARK_TIMEOUT_MS;
  if (stage === "evidence") return 120_000;
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

async function translateNarrativeTree(
  tree: DeliveryArgumentTree,
  targetLocale: string,
  session_id?: string,
): Promise<{ tree: DeliveryArgumentTree; tokens_used: number; model: string }> {
  if (targetLocale.startsWith("zh")) {
    return { tree, tokens_used: 0, model: "" };
  }

  const payload: Record<string, { arguments: Array<{ body: string }> }> = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const args = tree[k];
    if (!args?.length) continue;
    payload[k] = { arguments: args.map((a) => ({ body: a.body })) };
  }

  const system = `You translate POJU delivery narrative bodies into the target language.
Keep markdown inside each body (###, >, -). Do not add 命理 jargon. Do not invent ⟦t: markers.
Fate lexicon ban (do not write these Chinese words even in translation leftovers): 命运 / 命定 / 宿命 / 天注定.
Bare 判决 is OK as vernacular; ban compounds like 命运判决书.
Output strict JSON with the same keys; each value is { "arguments": [ { "body": "..." } ] } matching input length.`;
  const user = `Target locale: ${targetLocale}\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;

  const result = await callLLM({
    call_type: "main_delivery",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: DELIVERY_WRITE_MAX_TOKENS,
    thinking_effort: "medium",
    timeout_ms: 120_000,
    response_format: "text",
    session_id,
    temperature: 0.3,
    max_attempts: deliveryTransportMaxAttempts(),
  });

  const text = result.content?.trim() ?? "";
  let parsed: unknown = null;
  try {
    parsed = extractJson(text);
  } catch {
    return { tree, tokens_used: result.meta.tokens_used, model: result.actual_model };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { tree, tokens_used: result.meta.tokens_used, model: result.actual_model };
  }

  const o = parsed as Record<string, unknown>;
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const src = tree[k] ?? [];
    if (!src.length) continue;
    const raw = o[k];
    const translatedArgs =
      raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as { arguments?: unknown }).arguments)
        ? (raw as { arguments: unknown[] }).arguments
        : Array.isArray(raw)
          ? raw
          : null;
    out[k] = src.map((a, i) => {
      const t = translatedArgs?.[i];
      const body =
        t && typeof t === "object" && !Array.isArray(t) && typeof (t as { body?: unknown }).body === "string"
          ? String((t as { body: string }).body).trim()
          : typeof t === "string"
            ? t.trim()
            : a.body;
      return { body: body || a.body, evidence: a.evidence };
    });
  }

  return {
    tree: out,
    tokens_used: result.meta.tokens_used,
    model: result.actual_model,
  };
}

function asArgumentTree(value: unknown): DeliveryArgumentTree {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const o = value as Record<string, unknown>;
  const out: DeliveryArgumentTree = {};
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const v = o[k];
    if (Array.isArray(v)) {
      out[k] = v
        .filter((a): a is { body: string; evidence?: string } =>
          Boolean(a) && typeof a === "object" && typeof (a as { body?: unknown }).body === "string",
        )
        .map((a) => ({ body: a.body, evidence: a.evidence }));
    }
  }
  return out;
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

type FanoutTaskResult =
  | { ok: true; value: DeliveryArgumentTree | Partial<DeliveryComputed>; tokens_used: number; model?: string }
  | { ok: false; reason: string; redirect?: DeliveryPipelineStage };

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
      base_analysis: input.base_analysis,
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
  if (stage === "narrative") {
    const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
    if (!fin) return { ok: false, reason: "missing_finalize", redirect: "finalize" };
    const result = await runNarrativeTask(task, fin.value, cacheId, signal);
    if (!result.ok) {
      if (isAbortishReason(result.reason) || signal?.aborted) {
        return { ok: false, reason: "aborted_after_sibling_fail" };
      }
      return { ok: false, reason: `delivery_narrative_failed:${result.reason}` };
    }
    return { ok: true, value: result.value, tokens_used: result.tokens_used };
  }
  if (stage === "evidence") {
    const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
    const narr = await loadDeliveryStageCheckpoint(job_id, "narrative");
    if (!fin || !narr) {
      return { ok: false, reason: "missing_upstream", redirect: fin ? "narrative" : "finalize" };
    }
    const result = await runEvidenceTask(task, fin.value, narr.value, cacheId, signal);
    if (!result.ok) {
      if (isAbortishReason(result.reason) || signal?.aborted) {
        return { ok: false, reason: "aborted_after_sibling_fail" };
      }
      return { ok: false, reason: `delivery_evidence_failed:${result.reason}` };
    }
    return { ok: true, value: result.value, tokens_used: result.tokens_used };
  }
  // mark
  const narr = await loadDeliveryStageCheckpoint(job_id, "narrative");
  const ev = await loadDeliveryStageCheckpoint(job_id, "evidence");
  if (!narr || !ev) {
    return { ok: false, reason: "missing_upstream", redirect: narr ? "evidence" : "narrative" };
  }
  const result = await runMarkDeliveryTask(task, ev.value, input.locale, {
    session_id: cacheId,
    original_question: input.agent_v2.original_question,
    signal,
  });
  if (!result.ok) {
    if (isAbortishReason(result.reason) || signal?.aborted) {
      return { ok: false, reason: "aborted_after_sibling_fail" };
    }
    return { ok: false, reason: `delivery_mark_failed:${result.reason}` };
  }
  return { ok: true, value: result.value, tokens_used: result.tokens_used };
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
    const incomplete = await listIncompleteDeliveryTasks(job_id, stage);
    if (incomplete.length === 0) break;

    // Soft wall: never start a wave that cannot finish before Vercel SIGKILL.
    // Bug we hit: wave1 ~188s then wave2 started (elapsed < budget−15s) and
    // in-flight OpenRouter calls kept running until the 300s platform kill —
    // abort does not reach the supplier after the process dies.
    const elapsed = Date.now() - invocationStartedAt;
    const reserve = reserveMsForNextWave(stage);
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
          );
          // First hard failure aborts siblings so OpenRouter stops burning tokens.
          if (!result.ok && !result.redirect && !isAbortishReason(result.reason)) {
            waveAbort.abort();
          }
          return { task, result, task_ms: Date.now() - taskStarted };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const aborted =
            waveAbort.signal.aborted ||
            (e instanceof Error && (e.name === "AbortError" || /abort/i.test(msg)));
          if (!aborted) waveAbort.abort();
          return {
            task,
            result: {
              ok: false as const,
              reason: aborted ? "aborted_after_sibling_fail" : `call_error:${msg}`,
            },
            task_ms: Date.now() - taskStarted,
          };
        }
      }),
    );
    const wave_ms = Date.now() - waveStarted;

    // Prefer the real failure over sibling AbortError cancels when reporting STOP.
    const hardFail = settled.find(
      (s) => !s.result.ok && !s.result.redirect && !isAbortishReason(s.result.reason),
    );
    if (hardFail && !hardFail.result.ok) {
      await failStage(
        job_id,
        input.session_id,
        stage,
        hardFail.result.redirect
          ? `missing_upstream:${hardFail.result.redirect}:${hardFail.result.reason}`
          : hardFail.result.reason,
        {
          task: hardFail.task.name,
          elapsed_ms: Date.now() - invocationStartedAt,
          where: `${stage}/${hardFail.task.name}`,
        },
      );
      return "failed";
    }

    // Every failure looks like abort — still STOP (no resume), but label clearly.
    const anyFail = settled.find((s) => !s.result.ok && !s.result.redirect);
    if (anyFail && !anyFail.result.ok) {
      await failStage(
        job_id,
        input.session_id,
        stage,
        "wave_aborted_without_root_cause",
        {
          task: anyFail.task.name,
          elapsed_ms: Date.now() - invocationStartedAt,
          where: `${stage}/${anyFail.task.name}`,
        },
      );
      return "failed";
    }

    for (const { task, result, task_ms } of settled) {
      if (!result.ok) {
        // Sibling abort after another task already failed — ignore.
        if (isAbortishReason(result.reason)) {
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

  // All tasks checkpointed — merge into stage checkpoint.
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

  if (stage === "finalize") {
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
  } else if (stage === "narrative") {
    const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
    if (!fin) {
      await failStage(job_id, input.session_id, stage, "missing_upstream:finalize", {
        where: "narrative/merge",
        elapsed_ms: Date.now() - invocationStartedAt,
      });
      return "failed";
    }
    const assembled = assembleDeliveryNarrative(
      taskCps.map((c) => asArgumentTree(c.value)),
      fin.value,
      "zh",
    );
    if (!assembled.ok) {
      await failStage(job_id, input.session_id, stage, assembled.reason, {
        where: "narrative/merge",
        elapsed_ms: Date.now() - invocationStartedAt,
      });
      return "failed";
    }
    await saveDeliveryStageCheckpoint(job_id, {
      stage: "narrative",
      value: assembled.value,
      tokens_used,
    });
  } else if (stage === "evidence") {
    const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
    const narr = await loadDeliveryStageCheckpoint(job_id, "narrative");
    if (!fin || !narr) {
      await failStage(
        job_id,
        input.session_id,
        stage,
        `missing_upstream:${fin ? "narrative" : "finalize"}`,
        { where: "evidence/merge", elapsed_ms: Date.now() - invocationStartedAt },
      );
      return "failed";
    }
    const value = assembleDeliveryEvidence(
      taskCps.map((c) => asArgumentTree(c.value)),
      narr.value,
      fin.value,
    );
    await saveDeliveryStageCheckpoint(job_id, {
      stage: "evidence",
      value,
      tokens_used,
    });
  } else {
    const narr = await loadDeliveryStageCheckpoint(job_id, "narrative");
    const ev = await loadDeliveryStageCheckpoint(job_id, "evidence");
    if (!narr || !ev) {
      await failStage(
        job_id,
        input.session_id,
        stage,
        `missing_upstream:${narr ? "evidence" : "narrative"}`,
        { where: "mark/merge", elapsed_ms: Date.now() - invocationStartedAt },
      );
      return "failed";
    }
    const value = assembleDeliveryMark(
      taskCps.map((c) => asArgumentTree(c.value)),
      ev.value,
      input.locale,
    );
    await saveDeliveryStageCheckpoint(job_id, {
      stage: "mark",
      value,
      tokens_used,
      narrative: narr.value,
    });
  }

  const stage_ms = Date.now() - invocationStartedAt;
  console.info("[final-delivery-stage] stage timing", {
    job_id,
    stage,
    stage_ms,
    tokens_used,
    tasks_done: taskCps.length,
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
      // Merged — advance. Only pack finalize→narrative in-process; evidence/mark always hop.
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
        const canPackSameInvoke =
          next === "narrative" && Date.now() - t0 < FANOUT_INVOCATION_BUDGET_MS;
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

    // assemble — no LLM fan-out (translate may still run once for non-zh).
    if (stage === "assemble") {
      const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
      const mark = await loadDeliveryStageCheckpoint(job_id, "mark");
      if (!fin || !mark) {
        await failStage(
          job_id,
          input.session_id,
          stage,
          `missing_upstream:${mark ? "finalize" : "mark"}`,
          { where: "assemble", elapsed_ms: Date.now() - t0 },
        );
        return;
      }

      let narrativeForMerge = mark.narrative;
      let translate_ms = 0;
      let tokens_used =
        (fin.tokens_used ?? 0) +
        ((await loadDeliveryStageCheckpoint(job_id, "narrative"))?.tokens_used ?? 0) +
        ((await loadDeliveryStageCheckpoint(job_id, "evidence"))?.tokens_used ?? 0) +
        mark.tokens_used;
      let model = fin.model || "";

      if (!input.locale.startsWith("zh")) {
        const tTr = Date.now();
        const tr = await translateNarrativeTree(mark.narrative, input.locale, cacheId);
        narrativeForMerge = tr.tree;
        tokens_used += tr.tokens_used;
        if (tr.model) model = tr.model;
        translate_ms = Date.now() - tTr;
      }

      const bookMeta = {
        original_question: input.agent_v2.original_question,
        locale: input.locale,
        report_id: `POJU-${input.session_id.slice(0, 8)}`,
        generated_at: new Date().toISOString(),
        base_analysis: input.base_analysis ?? null,
      };
      const markdown = mergeDeliveryToMarkdown(
        narrativeForMerge,
        mark.value,
        input.locale,
        bookMeta,
      );
      // Diagnosis: no grammar polish / marker strip — sanitize is pass-through.
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
