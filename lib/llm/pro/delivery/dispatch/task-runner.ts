/**
 * Execute one Phase-4 dispatch DAG task (assign / write.chunk / fill / mark / …).
 */

import { DELIVERY_TASKS, PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS, PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS } from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  DELIVERY_SEGMENT_KEYS,
  type DeliveryArgumentTree,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  loadAllDeliverySegmentReady,
  loadDeliverySegmentProgress,
  loadDeliveryStageCheckpoint,
  saveDeliverySegmentProgress,
  saveDeliverySegmentReady,
  saveDeliveryStageCheckpoint,
} from "@/lib/llm/pro/delivery/delivery-stage-store";
import { logDeliveryStep } from "@/lib/llm/pro/delivery/delivery-step-log";
import { chunkPaths } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import { runDeepEvidenceAssignCall } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import { runDeepEvidenceWriteChunk } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-write";
import { assessDeepEvidenceQuality } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-quality";
import type { DeepEvidencePlan, DeepEvidenceUnit } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import {
  advanceSegmentChain,
  type SegmentChainPhase,
  type SegmentChainProgress,
} from "@/lib/llm/pro/delivery/run-segment-chain";
import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import type { FinalDeliveryJobInput } from "@/lib/poju/xhigh-job-types";
import {
  ASSEMBLE_ID,
  expandDagAfterAssign,
  pageAssignId,
  pageWriteChunkId,
  unlockWaveB,
  WAVE_B_GATE_ID,
} from "./task-dag";
import { loadSegmentDispatchContext } from "./task-context";
import {
  loadDeliveryDispatchDag,
  patchDispatchTask,
  saveDeliveryDispatchDag,
} from "./task-store";
import {
  DELIVERY_DISPATCH_WRITE_CHUNK_SIZE,
  type DeliveryDispatchTask,
  type DeliveryDispatchTaskResult,
} from "./types";

const VERCEL_HARD_MS = 300_000;
const TASK_TAIL_MS = 25_000;

export type DispatchTaskRunResult =
  | { ok: true; result?: DeliveryDispatchTaskResult }
  | { ok: false; reason: string; soft_retryable?: boolean };

function taskForKey(key: DeliverySegmentKey) {
  return DELIVERY_TASKS.find((t) => t.paths[0] === key) ?? {
    name: `deliver_${key}`,
    paths: [key] as const,
  };
}

function resolveQuestionExpectation(input: FinalDeliveryJobInput): string {
  const q = input.agent_v2.original_question?.trim() || "";
  const want = input.agent_v2.context_collected?.desired_outcome?.trim() || "";
  return [q ? `问题: ${q}` : "", want ? `期望: ${want}` : ""].filter(Boolean).join("\n");
}

async function runChainPhase(opts: {
  job_id: string;
  key: DeliverySegmentKey;
  input: FinalDeliveryJobInput;
  progress: SegmentChainProgress | null;
  shouldYield: (phase: SegmentChainPhase) => boolean;
  signal?: AbortSignal;
}): Promise<
  | { ok: true; progress: SegmentChainProgress; done: boolean }
  | { ok: false; reason: string; progress: SegmentChainProgress }
> {
  const ctx = await loadSegmentDispatchContext(opts.job_id, opts.key, opts.input);
  if (!ctx) {
    return {
      ok: false,
      reason: "missing_finalize",
      progress: opts.progress ?? { key: opts.key, phase: "start", tokens_used: 0 },
    };
  }
  const t0 = Date.now();
  const chain = await advanceSegmentChain({
    task: taskForKey(opts.key),
    finalize: ctx.finalize,
    locale: opts.input.locale,
    original_question: opts.input.agent_v2.original_question,
    session_id: pojuCacheSessionId(opts.input.session_id),
    signal: opts.signal,
    progress: opts.progress,
    shouldYield: opts.shouldYield,
    invokeHardDeadlineMs: VERCEL_HARD_MS - TASK_TAIL_MS,
    invocationStartedAt: t0,
    breakthrough_core: opts.input.breakthrough_core,
    action_brief: ctx.action_brief as never,
    week_summary: ctx.week_summary as never,
    primary_backup_hint: ctx.primary_backup_hint,
    question_expectation: resolveQuestionExpectation(opts.input),
    eastern_calc_slice: ctx.promptOpts.eastern_calc_slice,
    p3_body_excerpt: ctx.p3_body_excerpt,
    risk_calc_slice: ctx.promptOpts.risk_calc_slice,
    page_plan_slice: ctx.promptOpts.page_plan_slice,
    reality_constraints: ctx.promptOpts.reality_constraints,
    foundation_surface_feed: ctx.promptOpts.foundation_surface_feed,
    science_means_feed: ctx.promptOpts.science_means_feed,
    metaphysics_moat_feed: ctx.promptOpts.metaphysics_moat_feed,
    risk_fuse_feed: ctx.promptOpts.risk_fuse_feed,
    close_ritual_feed: ctx.promptOpts.close_ritual_feed,
    prior_chart_anchors: ctx.prior_chart_anchors,
    category_token_sets: ctx.category_token_sets,
    structured_inventory: ctx.promptOpts.structured_inventory,
  });
  if (!chain.ok) {
    await saveDeliverySegmentProgress(opts.job_id, chain.progress);
    return { ok: false, reason: chain.reason, progress: chain.progress };
  }
  await saveDeliverySegmentProgress(opts.job_id, chain.progress);
  if (chain.done && "ready" in chain) {
    await saveDeliverySegmentReady(opts.job_id, chain.ready);
  }
  return { ok: true, progress: chain.progress, done: chain.done };
}

async function runAssign(
  job_id: string,
  key: DeliverySegmentKey,
  input: FinalDeliveryJobInput,
  task: DeliveryDispatchTask,
  signal?: AbortSignal,
): Promise<DispatchTaskRunResult> {
  const ctx = await loadSegmentDispatchContext(job_id, key, input);
  if (!ctx) return { ok: false, reason: "missing_finalize" };
  const assigned = await runDeepEvidenceAssignCall({
    key,
    opts: ctx.promptOpts,
    session_id: pojuCacheSessionId(input.session_id),
    signal,
    timeout_ms: PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS,
    dispatch_attempt: Math.max(1, task.attempts),
  });
  if (!assigned.ok) {
    return { ok: false, reason: assigned.reason, soft_retryable: /queue|midstream|timeout|abort/i.test(assigned.reason) };
  }
  const prev = (await loadDeliverySegmentProgress(job_id, key)) ?? {
    key,
    phase: "start" as const,
    tokens_used: 0,
  };
  await saveDeliverySegmentProgress(job_id, {
    ...prev,
    phase: "deep_assigned",
    deep_evidence_assignment: assigned.assignment,
    tokens_used: prev.tokens_used + assigned.tokens_used,
  });
  let dag = await loadDeliveryDispatchDag(job_id);
  if (dag) {
    dag = expandDagAfterAssign(dag, key, assigned.assignment);
    await saveDeliveryDispatchDag(dag);
  }
  return {
    ok: true,
    result: { type: "assignment", assignment: assigned.assignment },
  };
}

async function runWriteChunk(
  job_id: string,
  key: DeliverySegmentKey,
  chunkIndex: number,
  input: FinalDeliveryJobInput,
  task: DeliveryDispatchTask,
  signal?: AbortSignal,
): Promise<DispatchTaskRunResult> {
  const ctx = await loadSegmentDispatchContext(job_id, key, input);
  if (!ctx) return { ok: false, reason: "missing_finalize" };
  const prog = await loadDeliverySegmentProgress(job_id, key);
  const assignment = prog?.deep_evidence_assignment;
  if (!assignment) return { ok: false, reason: "missing_assignment" };

  const chunks = chunkPaths(assignment.units, DELIVERY_DISPATCH_WRITE_CHUNK_SIZE);
  const chunk = chunks[chunkIndex];
  if (!chunk?.length) return { ok: false, reason: `missing_chunk:${chunkIndex}` };

  let opts = ctx.promptOpts;
  if (prog.deep_rewrite_reason?.trim()) {
    opts = {
      ...opts,
      core_conclusion: `${opts.core_conclusion}\n\n【纠错】上一合并稿未过闸（${prog.deep_rewrite_reason}）。本 chunk 重写：机制更深；禁止跨单元雷同；P4 须落实锁定的 moat_class。`,
    };
  }

  const written = await runDeepEvidenceWriteChunk({
    key,
    opts,
    chunk,
    session_id: pojuCacheSessionId(input.session_id),
    signal,
    timeout_ms: PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS,
    dispatch_attempt: Math.max(1, task.attempts),
  });
  if (!written.ok) {
    return {
      ok: false,
      reason: written.reason,
      soft_retryable: /queue|midstream|timeout|abort/i.test(written.reason),
    };
  }
  if (prog) {
    await saveDeliverySegmentProgress(job_id, {
      ...prog,
      tokens_used: prog.tokens_used + written.tokens_used,
    });
  }
  return {
    ok: true,
    result: { type: "write_units", units: written.units, chunk_index: chunkIndex },
  };
}

async function runWriteMerge(
  job_id: string,
  key: DeliverySegmentKey,
  input: FinalDeliveryJobInput,
): Promise<DispatchTaskRunResult> {
  const ctx = await loadSegmentDispatchContext(job_id, key, input);
  if (!ctx) return { ok: false, reason: "missing_finalize" };
  const dag = await loadDeliveryDispatchDag(job_id);
  if (!dag) return { ok: false, reason: "missing_dag" };
  const prog = await loadDeliverySegmentProgress(job_id, key);
  const assignment = prog?.deep_evidence_assignment;
  if (!assignment) return { ok: false, reason: "missing_assignment" };

  const chunks = chunkPaths(assignment.units, DELIVERY_DISPATCH_WRITE_CHUNK_SIZE);
  const units: DeepEvidenceUnit[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const id = pageWriteChunkId(key, i);
    const t = dag.tasks[id];
    const res = t?.result;
    if (!res || res.type !== "write_units") {
      return { ok: false, reason: `missing_write_result:${id}` };
    }
    units.push(...res.units);
  }

  const plan: DeepEvidencePlan = { page: key, units };
  const quality = assessDeepEvidenceQuality(key, plan, {
    eastern_calc_slice: ctx.promptOpts.eastern_calc_slice,
    core_conclusion: ctx.promptOpts.core_conclusion,
    prior_chart_anchors: ctx.prior_chart_anchors,
    category_token_sets: ctx.category_token_sets,
  });
  if (!quality.ok) {
    // Defer rewrite: stash reason; reset write chunks to pending for one rewrite wave.
    if (prog && !prog.deep_rewrite_reason) {
      await saveDeliverySegmentProgress(job_id, {
        ...prog,
        deep_rewrite_reason: quality.reason,
      });
      const next = { ...dag, tasks: { ...dag.tasks }, updated_at: Date.now() };
      for (let i = 0; i < chunks.length; i++) {
        const id = pageWriteChunkId(key, i);
        const prev = next.tasks[id];
        if (prev) {
          next.tasks[id] = {
            ...prev,
            status: "pending",
            attempts: 0,
            error: undefined,
            result: undefined,
            updated_at: Date.now(),
          };
        }
      }
      const mergeId = `p.${key}.write.merge`;
      const mergePrev = next.tasks[mergeId];
      if (mergePrev) {
        next.tasks[mergeId] = {
          ...mergePrev,
          status: "pending",
          attempts: 0,
          error: undefined,
          result: undefined,
          updated_at: Date.now(),
        };
      }
      await saveDeliveryDispatchDag(next);
      return { ok: false, reason: `deep_quality_defer_rewrite:${quality.reason}`, soft_retryable: true };
    }
    return { ok: false, reason: `deep_evidence:${quality.reason}` };
  }

  await saveDeliverySegmentProgress(job_id, {
    ...(prog ?? { key, phase: "deep_assigned", tokens_used: 0 }),
    phase: "evidence_done",
    deep_evidence_plan: plan,
    deep_rewrite_reason: undefined,
    tokens_used: prog?.tokens_used ?? 0,
  });
  return { ok: true, result: { type: "plan", plan } };
}

async function runFill(
  job_id: string,
  key: DeliverySegmentKey,
  input: FinalDeliveryJobInput,
  signal?: AbortSignal,
): Promise<DispatchTaskRunResult> {
  const prog = await loadDeliverySegmentProgress(job_id, key);
  const startProg =
    prog ??
    ({
      key,
      phase: key === "direct_answer" ? "start" : "evidence_done",
      tokens_used: 0,
    } satisfies SegmentChainProgress);

  // Fill only — stop before mark.
  const r = await runChainPhase({
    job_id,
    key,
    input,
    progress: startProg,
    shouldYield: (phase) => phase === "narrative_done" || phase === "mark_done",
    signal,
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  if (r.progress.phase !== "narrative_done" && r.progress.phase !== "mark_done") {
    // P1 transition may land on mark_done without mark LLM.
    if (!r.progress.page_schema && key !== "direct_answer") {
      return { ok: false, reason: `fill_incomplete_phase:${r.progress.phase}` };
    }
  }
  if (!r.progress.page_schema && key === "direct_answer" && r.progress.phase === "start") {
    return { ok: false, reason: "p1_fill_incomplete" };
  }
  return {
    ok: true,
    result: r.progress.page_schema
      ? { type: "page_schema", page_schema: r.progress.page_schema }
      : { type: "empty" },
  };
}

async function runMark(
  job_id: string,
  key: DeliverySegmentKey,
  input: FinalDeliveryJobInput,
  signal?: AbortSignal,
): Promise<DispatchTaskRunResult> {
  const prog = await loadDeliverySegmentProgress(job_id, key);
  if (!prog || prog.phase !== "narrative_done") {
    return { ok: false, reason: `mark_bad_phase:${prog?.phase ?? "null"}` };
  }
  const r = await runChainPhase({
    job_id,
    key,
    input,
    progress: prog,
    shouldYield: (phase) => phase === "mark_done",
    signal,
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, result: { type: "empty" } };
}

async function runReady(
  job_id: string,
  key: DeliverySegmentKey,
  input: FinalDeliveryJobInput,
  signal?: AbortSignal,
): Promise<DispatchTaskRunResult> {
  const prog = await loadDeliverySegmentProgress(job_id, key);
  if (!prog) return { ok: false, reason: "missing_progress" };
  // Allow narrative_done (P1 after fill) or mark_done.
  if (prog.phase !== "mark_done" && prog.phase !== "narrative_done") {
    return { ok: false, reason: `ready_bad_phase:${prog.phase}` };
  }
  const r = await runChainPhase({
    job_id,
    key,
    input,
    progress: prog,
    shouldYield: () => false,
    signal,
  });
  if (!r.ok) return { ok: false, reason: r.reason };
  if (!r.done) return { ok: false, reason: "ready_not_done" };
  return { ok: true, result: { type: "ready", key } };
}

async function runWaveBGate(job_id: string): Promise<DispatchTaskRunResult> {
  const dag = await loadDeliveryDispatchDag(job_id);
  if (!dag) return { ok: false, reason: "missing_dag" };
  const next = unlockWaveB(dag);
  await saveDeliveryDispatchDag(next);
  return {
    ok: true,
    result: { type: "gate", unlocked: ["risk_guard", "signals_close"] },
  };
}

async function runAssemble(job_id: string, input: FinalDeliveryJobInput): Promise<DispatchTaskRunResult> {
  const readyAll = await loadAllDeliverySegmentReady(job_id);
  if (readyAll.length < DELIVERY_SEGMENT_KEYS.length) {
    return {
      ok: false,
      reason: `segment_ready_incomplete:${readyAll.length}/${DELIVERY_SEGMENT_KEYS.length}`,
    };
  }
  const narrative: DeliveryArgumentTree = {};
  const marked: DeliveryArgumentTree = {};
  let tokens_used = 0;
  for (const k of DELIVERY_SEGMENT_KEYS) {
    const prog = await loadDeliverySegmentProgress(job_id, k);
    if (!prog || prog.phase !== "done") {
      return { ok: false, reason: `segment_progress_incomplete:${k}` };
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
  void input;
  return { ok: true, result: { type: "assembled", full_text_len: tokens_used } };
}

/**
 * Run one dispatch task end-to-end (caller holds lease).
 */
export async function executeDeliveryDispatchTask(input: {
  job_id: string;
  task_id: string;
  job_input: FinalDeliveryJobInput;
  signal?: AbortSignal;
}): Promise<DispatchTaskRunResult> {
  const { job_id, task_id, job_input, signal } = input;
  const dag = await loadDeliveryDispatchDag(job_id);
  const task = dag?.tasks[task_id];
  if (!task) return { ok: false, reason: "unknown_task" };
  if (task.status === "ok") return { ok: true, result: task.result };
  if (task.status === "locked" && task.kind === "assign") {
    // Still wave-B locked
    return { ok: false, reason: "task_still_locked" };
  }

  const attempts = (task.attempts ?? 0) + 1;
  await patchDispatchTask(job_id, task_id, {
    status: "running",
    attempts,
    error: undefined,
  });

  const t0 = Date.now();
  let result: DispatchTaskRunResult;
  try {
    switch (task.kind) {
      case "assign":
        result = await runAssign(job_id, task.key!, job_input, { ...task, attempts }, signal);
        break;
      case "write_chunk":
        result = await runWriteChunk(
          job_id,
          task.key!,
          task.chunk_index ?? 0,
          job_input,
          { ...task, attempts },
          signal,
        );
        break;
      case "write_merge":
        result = await runWriteMerge(job_id, task.key!, job_input);
        break;
      case "p1_fill":
      case "fill":
        result = await runFill(job_id, task.key!, job_input, signal);
        break;
      case "mark":
        result = await runMark(job_id, task.key!, job_input, signal);
        break;
      case "ready":
        result = await runReady(job_id, task.key!, job_input, signal);
        break;
      case "wave_b_gate":
        result = await runWaveBGate(job_id);
        break;
      case "assemble":
        result = await runAssemble(job_id, job_input);
        break;
      default:
        result = { ok: false, reason: `unknown_kind:${task.kind}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result = { ok: false, reason: `task_error:${msg}` };
  }

  const ms = Date.now() - t0;
  if (result.ok) {
    await patchDispatchTask(job_id, task_id, {
      status: "ok",
      result: result.result ?? { type: "empty" },
      error: undefined,
    });
    logDeliveryStep({
      job_id,
      level: "ok",
      step: `task ${task_id}`,
      ms,
    });
    console.info(`[FD] task ${task_id} ok`, { job_id, ms });
    return result;
  }

  // Soft rewrite path already reset chunks — leave this merge pending.
  if (result.soft_retryable && result.reason.startsWith("deep_quality_defer_rewrite:")) {
    await patchDispatchTask(job_id, task_id, {
      status: "pending",
      attempts: Math.max(0, attempts - 1),
      error: result.reason,
    });
    logDeliveryStep({
      job_id,
      level: "hop",
      step: `task ${task_id}`,
      detail: result.reason,
      ms,
    });
    return result;
  }

  const failStatus = attempts >= 2 ? "failed" : "pending";
  await patchDispatchTask(job_id, task_id, {
    status: failStatus,
    error: result.reason,
  });
  logDeliveryStep({
    job_id,
    level: failStatus === "failed" ? "fail" : "warn",
    step: `task ${task_id}`,
    detail: result.reason,
    ms,
    tags: `attempts=${attempts}`,
  });
  console.warn(`[FD] task ${task_id} ${failStatus === "failed" ? "fail" : "retry"}`, {
    job_id,
    reason: result.reason,
    attempts,
    ms,
  });
  return result;
}

export { pageAssignId, WAVE_B_GATE_ID, ASSEMBLE_ID };
