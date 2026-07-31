/**
 * Phase 4 delivery — one pipeline stage per function invocation.
 * Checkpoint to KV, then schedule the next stage (fresh 300s budget).
 */

import { after } from "next/server";

import {
  extractActionsFromDelivery,
  resolveDeliveryMode,
} from "@/lib/llm/pro/final-delivery";
import { runDeliveryFinalize } from "@/lib/llm/pro/delivery/finalize-call";
import {
  runDeliveryEvidence,
  runDeliveryNarrative,
} from "@/lib/llm/pro/delivery/narrative-evidence-call";
import { runMarkDeliveryEvidence } from "@/lib/llm/pro/delivery/mark-evidence-call";
import { mergeDeliveryToMarkdown } from "@/lib/llm/pro/delivery/merge-delivery-markdown";
import { sanitizeDeliveryBookMarkdown } from "@/lib/llm/pro/delivery/sanitize-delivery-book";
import { polishDeliveryGrammar } from "@/lib/llm/sanitize/delivery-grammar-polish";
import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import {
  DELIVERY_SEGMENT_KEYS,
  type DeliveryArgumentTree,
} from "@/lib/llm/pro/delivery/delivery-schema";
import {
  DELIVERY_PIPELINE_STAGES,
  findLatestCompletedDeliveryStage,
  loadDeliveryStageCheckpoint,
  nextDeliveryStage,
  saveDeliveryStageCheckpoint,
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
  type FinalDeliveryJobResult,
} from "@/lib/poju/xhigh-job-types";

const HEARTBEAT_MS = 12_000;

function continueSecret(job_id: string): string {
  const seed =
    process.env.POJU_INTERNAL_STAGE_SECRET?.trim() ||
    process.env.OPS_SESSION_SECRET?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    "poju-delivery-stage";
  // Lightweight opaque token — not crypto auth, just anti-casual-abuse.
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

/** Fire a fresh HTTP invocation for the next stage (new 300s budget on Vercel). */
export function scheduleDeliveryStageContinue(
  job_id: string,
  stage: DeliveryPipelineStage,
): void {
  const origin = continueOrigin();
  if (!origin) {
    // Local / no public URL — chain inline in a nested after (same process, still sequential).
    after(() => {
      void runFinalDeliveryStage(job_id, stage).catch((e) => {
        console.error("[final-delivery] inline next stage failed", e);
      });
    });
    return;
  }

  const url = `${origin}/api/poju/final-delivery/continue`;
  after(() => {
    void fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-poju-delivery-continue": continueSecret(job_id),
      },
      body: JSON.stringify({ job_id, stage }),
    }).catch((e) => {
      console.error("[final-delivery] schedule continue fetch failed", { job_id, stage, e });
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
    max_tokens: 10_000,
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

/**
 * Run a single pipeline stage. On success, schedules the next stage (or completes the job).
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

  // Skip if this stage already checkpointed (idempotent resume).
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
    if (stage === "finalize") {
      const finalized = await runDeliveryFinalize({
        breakthrough_core: input.breakthrough_core,
        covered_agenda: input.covered_agenda,
        agent_v2: input.agent_v2,
        locale: input.locale,
        delivery_mode,
        base_analysis: input.base_analysis,
        session_id: cacheId,
      });
      if (!finalized.ok) {
        await failXhighJob(job_id, `delivery_finalize_failed:${finalized.reason}`, {
          retryable: true,
          failure_reason: "transport_error",
          current_stage: stage,
        });
        await releaseXhighSessionLock("final_delivery", input.session_id);
        return;
      }
      await saveDeliveryStageCheckpoint(job_id, {
        stage: "finalize",
        value: finalized.value,
        tokens_used: finalized.tokens_used,
        model: finalized.model,
      });
    } else if (stage === "narrative") {
      const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
      if (!fin) {
        scheduleDeliveryStageContinue(job_id, "finalize");
        return;
      }
      const narrative = await runDeliveryNarrative(fin.value, "zh", { session_id: cacheId });
      if (!narrative.ok) {
        await failXhighJob(job_id, `delivery_narrative_failed:${narrative.reason}`, {
          retryable: true,
          failure_reason: "transport_error",
          current_stage: stage,
        });
        await releaseXhighSessionLock("final_delivery", input.session_id);
        return;
      }
      await saveDeliveryStageCheckpoint(job_id, {
        stage: "narrative",
        value: narrative.value,
        tokens_used: narrative.tokens_used,
      });
    } else if (stage === "evidence") {
      const fin = await loadDeliveryStageCheckpoint(job_id, "finalize");
      const narr = await loadDeliveryStageCheckpoint(job_id, "narrative");
      if (!fin || !narr) {
        scheduleDeliveryStageContinue(job_id, fin ? "narrative" : "finalize");
        return;
      }
      const evidence = await runDeliveryEvidence(fin.value, narr.value, { session_id: cacheId });
      if (!evidence.ok) {
        await failXhighJob(job_id, `delivery_evidence_failed:${evidence.reason}`, {
          retryable: true,
          failure_reason: "transport_error",
          current_stage: stage,
        });
        await releaseXhighSessionLock("final_delivery", input.session_id);
        return;
      }
      await saveDeliveryStageCheckpoint(job_id, {
        stage: "evidence",
        value: evidence.value,
        tokens_used: evidence.tokens_used,
      });
    } else if (stage === "mark") {
      const narr = await loadDeliveryStageCheckpoint(job_id, "narrative");
      const ev = await loadDeliveryStageCheckpoint(job_id, "evidence");
      if (!narr || !ev) {
        scheduleDeliveryStageContinue(job_id, narr ? "evidence" : "narrative");
        return;
      }
      const marked = await runMarkDeliveryEvidence(ev.value, input.locale, {
        session_id: cacheId,
      });
      if (!marked.ok) {
        await failXhighJob(job_id, `delivery_mark_failed:${marked.reason}`, {
          retryable: true,
          failure_reason: "transport_error",
          current_stage: stage,
        });
        await releaseXhighSessionLock("final_delivery", input.session_id);
        return;
      }
      await saveDeliveryStageCheckpoint(job_id, {
        stage: "mark",
        value: marked.value,
        tokens_used: marked.tokens_used,
        narrative: narr.value,
      });
    } else if (stage === "assemble") {
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
      // Patch current_stage after complete (completeXhighJob already set completed).
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
      return;
    }

    const next = nextDeliveryStage(stage);
    console.info("[final-delivery-stage] ok", {
      job_id,
      stage,
      next,
      ms: Date.now() - t0,
    });
    if (next) {
      await updateXhighJobStatus(job_id, "running", {
        current_stage: next,
        accumulated_content: `stage_done:${stage};next:${next}`,
      });
      scheduleDeliveryStageContinue(job_id, next);
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
    // assemble already done — ensure job marked complete if checkpoint exists
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
