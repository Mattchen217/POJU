/**
 * Phase 4 delivery — stage + per-task KV relay.
 * Within a stage, incomplete DeliveryTasks run in parallel waves
 * (DELIVERY_TASK_CONCURRENCY), each checkpointed to KV. Waves continue until the
 * stage is done or FANOUT_INVOCATION_BUDGET_MS is exhausted, then /continue
 * gets a fresh 300s budget. Self-HTTP continue is retried; on fetch failure we
 * fall back to inline so the pipeline does not stall on stale-resume.
 */

import { after } from "next/server";

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
import { polishDeliveryGrammar } from "@/lib/llm/sanitize/delivery-grammar-polish";
import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SEGMENT_KEYS,
  type DeliveryArgumentTree,
  type DeliveryComputed,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_TASK_CONCURRENCY,
  DELIVERY_TASKS,
  DELIVERY_WRITE_MAX_TOKENS,
} from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  DELIVERY_PIPELINE_STAGES,
  findLatestCompletedDeliveryStage,
  findNextIncompleteDeliveryTask,
  isDeliveryFanoutStage,
  listIncompleteDeliveryTasks,
  loadAllDeliveryTaskCheckpoints,
  loadDeliveryStageCheckpoint,
  nextDeliveryStage,
  saveDeliveryStageCheckpoint,
  saveDeliveryTaskCheckpoint,
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

const HEARTBEAT_MS = 12_000;
/**
 * Pack multiple fast tasks into one Vercel invocation (under maxDuration=300).
 * Leave headroom for merge / schedule / TLS retries.
 */
const FANOUT_INVOCATION_BUDGET_MS = 210_000;
const CONTINUE_FETCH_ATTEMPTS = 3;

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

function continueOrigin(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) return site.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return null;
}

async function postDeliveryContinue(
  job_id: string,
  stage: DeliveryPipelineStage,
): Promise<boolean> {
  const origin = continueOrigin();
  if (!origin) return false;
  const url = `${origin}/api/poju/final-delivery/continue`;
  for (let attempt = 1; attempt <= CONTINUE_FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-poju-delivery-continue": continueSecret(job_id),
          // Undici keep-alive races on Vercel often surface as ECONNRESET on self-fetch.
          Connection: "close",
        },
        body: JSON.stringify({ job_id, stage }),
      });
      if (res.ok || res.status === 202) return true;
      console.warn("[final-delivery] continue HTTP non-ok", {
        job_id,
        stage,
        status: res.status,
        attempt,
      });
    } catch (e) {
      console.warn("[final-delivery] schedule continue fetch failed", {
        job_id,
        stage,
        attempt,
        e,
      });
    }
    await new Promise((r) => setTimeout(r, 250 * attempt));
  }
  return false;
}

/**
 * Fire a fresh HTTP invocation for the next hop (new 300s budget on Vercel).
 * Retries self-fetch; if TLS/network still fails, runs the next hop inline so
 * the pipeline does not stall until status stale-resume (~tens of seconds).
 */
export function scheduleDeliveryStageContinue(
  job_id: string,
  stage: DeliveryPipelineStage,
): void {
  after(() => {
    void (async () => {
      const posted = await postDeliveryContinue(job_id, stage);
      if (posted) return;
      console.warn("[final-delivery] continue fetch exhausted — inline fallback", {
        job_id,
        stage,
      });
      await runFinalDeliveryStage(job_id, stage);
    })().catch((e) => {
      console.error("[final-delivery] schedule continue failed hard", { job_id, stage, e });
    });
  });
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

async function failStage(
  job_id: string,
  session_id: string,
  stage: DeliveryPipelineStage,
  reason: string,
): Promise<void> {
  await failXhighJob(job_id, reason, {
    retryable: true,
    failure_reason: "transport_error",
    current_stage: stage,
  });
  await releaseXhighSessionLock("final_delivery", session_id);
}

type FanoutTaskResult =
  | { ok: true; value: DeliveryArgumentTree | Partial<DeliveryComputed>; tokens_used: number; model?: string }
  | { ok: false; reason: string; redirect?: DeliveryPipelineStage };

async function executeFanoutTask(
  job_id: string,
  stage: DeliveryFanoutStage,
  task: (typeof DELIVERY_TASKS)[number],
  input: FinalDeliveryJobInput,
  cacheId: string,
  delivery_mode: ReturnType<typeof resolveDeliveryMode>,
): Promise<FanoutTaskResult> {
  if (stage === "finalize") {
    const result = await runFinalizeGroup(task, {
      breakthrough_core: input.breakthrough_core,
      covered_agenda: input.covered_agenda,
      agent_v2: input.agent_v2,
      locale: input.locale,
      delivery_mode,
      base_analysis: input.base_analysis,
      session_id: cacheId,
    });
    if (!result.ok) return { ok: false, reason: `delivery_finalize_failed:${result.reason}` };
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
    const result = await runNarrativeTask(task, fin.value, cacheId);
    if (!result.ok) return { ok: false, reason: `delivery_narrative_failed:${result.reason}` };
    return { ok: true, value: result.value, tokens_used: result.tokens_used };
  }
  if (stage === "evidence") {
    const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
    const narr = await loadDeliveryStageCheckpoint(job_id, "narrative");
    if (!fin || !narr) {
      return { ok: false, reason: "missing_upstream", redirect: fin ? "narrative" : "finalize" };
    }
    const result = await runEvidenceTask(task, fin.value, narr.value, cacheId);
    if (!result.ok) return { ok: false, reason: `delivery_evidence_failed:${result.reason}` };
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
  });
  if (!result.ok) return { ok: false, reason: `delivery_mark_failed:${result.reason}` };
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
): Promise<"scheduled" | "merged" | "failed"> {
  while (Date.now() - invocationStartedAt < FANOUT_INVOCATION_BUDGET_MS) {
    const incomplete = await listIncompleteDeliveryTasks(job_id, stage);
    if (incomplete.length === 0) break;

    const wave = incomplete.slice(0, DELIVERY_TASK_CONCURRENCY);
    console.info("[final-delivery-stage] wave start", {
      job_id,
      stage,
      concurrency: DELIVERY_TASK_CONCURRENCY,
      wave: wave.map((t) => t.name),
      remaining: incomplete.length,
      elapsed_ms: Date.now() - invocationStartedAt,
    });
    await updateXhighJobStatus(job_id, "running", {
      current_stage: stage,
      accumulated_content: `wave_running:${stage}:${wave.map((t) => t.name).join(",")}`,
    });

    const settled = await Promise.all(
      wave.map(async (task) => {
        const result = await executeFanoutTask(
          job_id,
          stage,
          task,
          input,
          cacheId,
          delivery_mode,
        );
        return { task, result };
      }),
    );

    for (const { task, result } of settled) {
      if (!result.ok) {
        if (result.redirect) {
          scheduleDeliveryStageContinue(job_id, result.redirect);
          return "scheduled";
        }
        await failStage(job_id, input.session_id, stage, `${task.name}:${result.reason}`);
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
        elapsed_ms: Date.now() - invocationStartedAt,
      });
    }

    const more = await listIncompleteDeliveryTasks(job_id, stage);
    await updateXhighJobStatus(job_id, "running", {
      current_stage: stage,
      accumulated_content: more.length
        ? `wave_done:${stage};remaining:${more.length}`
        : `wave_done:${stage};merging`,
    });
  }

  const stillPending = await findNextIncompleteDeliveryTask(job_id, stage);
  if (stillPending) {
    console.info("[final-delivery-stage] budget pause — schedule continue", {
      job_id,
      stage,
      next_task: stillPending.name,
      elapsed_ms: Date.now() - invocationStartedAt,
    });
    scheduleDeliveryStageContinue(job_id, stage);
    return "scheduled";
  }

  // All tasks checkpointed — merge into stage checkpoint.
  const taskCps = await loadAllDeliveryTaskCheckpoints(job_id, stage);
  if (taskCps.length < DELIVERY_TASKS.length) {
    // Race / partial — schedule again to pick remainder.
    scheduleDeliveryStageContinue(job_id, stage);
    return "scheduled";
  }

  const tokens_used = taskCps.reduce((s, c) => s + (c.tokens_used ?? 0), 0);

  if (stage === "finalize") {
    const assembled = assembleDeliveryFinalize(
      taskCps.map((c) => c.value as Partial<DeliveryComputed>),
    );
    if (!assembled.ok) {
      await failStage(job_id, input.session_id, stage, `delivery_finalize_failed:${assembled.reason}`);
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
      scheduleDeliveryStageContinue(job_id, "finalize");
      return "scheduled";
    }
    const assembled = assembleDeliveryNarrative(
      taskCps.map((c) => asArgumentTree(c.value)),
      fin.value,
      "zh",
    );
    if (!assembled.ok) {
      await failStage(job_id, input.session_id, stage, `delivery_narrative_failed:${assembled.reason}`);
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
      scheduleDeliveryStageContinue(job_id, fin ? "narrative" : "finalize");
      return "scheduled";
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
      scheduleDeliveryStageContinue(job_id, narr ? "evidence" : "narrative");
      return "scheduled";
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

  return "merged";
}

/**
 * Run a single pipeline hop. On success, schedules the next hop (or completes).
 */
export async function runFinalDeliveryStage(
  job_id: string,
  stage: DeliveryPipelineStage,
): Promise<void> {
  const job = await getXhighJob(job_id);
  if (!job) {
    console.warn("[final-delivery-stage] missing job", { job_id, stage });
    return;
  }
  if (job.status === "completed" || job.status === "failed") return;
  if (!isFinalDeliveryJobInput(job.input)) {
    await failXhighJob(job_id, "invalid final_delivery job input", {
      retryable: false,
      failure_reason: "parse_failed",
    });
    return;
  }

  // Stage already merged — skip to next.
  const existing = await loadDeliveryStageCheckpoint(job_id, stage);
  if (existing) {
    const next = nextDeliveryStage(stage);
    if (next) {
      await updateXhighJobStatus(job_id, "running", {
        current_stage: next,
        accumulated_content: `stage_skip_to:${next}`,
      });
      scheduleDeliveryStageContinue(job_id, next);
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

  const heartbeat = setInterval(() => {
    void setXhighJobContent(job_id, `stage_running:${stage}:${Date.now()}`).catch(() => undefined);
  }, HEARTBEAT_MS);

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
      );
      if (hop === "scheduled" || hop === "failed") return;
      // Merged — advance (or pack next stage into same continue if budget remains).
      const next = nextDeliveryStage(stage);
      console.info("[final-delivery-stage] ok", {
        job_id,
        stage,
        next,
        ms: Date.now() - t0,
        mode: "task_fanout_parallel",
      });
      if (next) {
        await updateXhighJobStatus(job_id, "running", {
          current_stage: next,
          accumulated_content: `stage_done:${stage};next:${next}`,
        });
        if (
          isDeliveryFanoutStage(next) &&
          Date.now() - t0 < FANOUT_INVOCATION_BUDGET_MS
        ) {
          // Same invocation — keep packing (avoids another self-fetch hop).
          const hop2 = await progressFanoutStage(
            job_id,
            next,
            input,
            cacheId,
            delivery_mode,
            t0,
          );
          if (hop2 === "merged") {
            const next2 = nextDeliveryStage(next);
            if (next2) {
              await updateXhighJobStatus(job_id, "running", {
                current_stage: next2,
                accumulated_content: `stage_done:${next};next:${next2}`,
              });
              scheduleDeliveryStageContinue(job_id, next2);
            }
            return;
          }
          if (hop2 === "scheduled" || hop2 === "failed") return;
        }
        scheduleDeliveryStageContinue(job_id, next);
      }
      return;
    }

    // assemble — no LLM fan-out (translate may still run once for non-zh).
    if (stage === "assemble") {
      const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
      const mark = await loadDeliveryStageCheckpoint(job_id, "mark");
      if (!fin || !mark) {
        scheduleDeliveryStageContinue(job_id, mark ? "mark" : "finalize");
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
      const polished = polishDeliveryGrammar(markdown, input.locale);
      const full_text = sanitizeDeliveryBookMarkdown(polished.text, input.locale);

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
      console.info("[final-delivery-stage] completed", {
        job_id,
        chars: full_text.length,
        tokens_used,
        latency_ms,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[final-delivery-stage] failed", { job_id, stage, msg });
    await failXhighJob(job_id, msg, {
      retryable: true,
      failure_reason: "transport_error",
      current_stage: stage,
    });
    await releaseXhighSessionLock("final_delivery", input.session_id);
  } finally {
    clearInterval(heartbeat);
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
