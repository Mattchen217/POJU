import {
  DELIVERY_SEGMENT_KEYS,
  type DeliverySegmentKey,
} from "@/lib/llm/pro/delivery/delivery-schema";

export type DeliveryTask = {
  name: string;
  paths: readonly DeliverySegmentKey[];
};

/**
 * One segment per task — keeps each LLM call short enough to finish under
 * max_tokens + 300s when evidence/narrative prose is long.
 * Shared by narrative / evidence / mark / finalize fan-out.
 */
export const DELIVERY_TASKS: readonly DeliveryTask[] = DELIVERY_SEGMENT_KEYS.map((k) => ({
  name: `deliver_${k}`,
  paths: [k] as const,
}));

/** Alias — finalize uses the same grouping as write tasks. */
export const FINALIZE_GROUPS = DELIVERY_TASKS;

/** Max argument rows per evidence LLM call (further fan-out inside a segment). */
export const DELIVERY_ARGS_PER_CALL = 5;

/**
 * Mark args per LLM call (P4 A/B: DELIVERY_MARK_ARGS_PER_CALL=3|4|5).
 * Smaller batches keep thinking=high under timeout; leftover args → next chunk.
 */
export const DELIVERY_MARK_ARGS_PER_CALL = Math.min(
  5,
  Math.max(2, Number.parseInt(process.env.DELIVERY_MARK_ARGS_PER_CALL ?? "3", 10) || 3),
);

/**
 * Single LLM call under a dedicated Vercel invoke (`maxDuration=300`).
 * 300s is the **invoke** hard kill, not the LLM budget — reserve ~15s for
 * KV checkpoint, QStash schedule, response flush (see TASK_TAIL_MS in task-runner).
 * Abort ourselves at 285s so the worker can finish cleanly / retry.
 */
export const DELIVERY_SINGLE_CALL_TIMEOUT_MS = 285_000;

/**
 * Soft/mark connective: args per independent invoke (fresh wall each).
 * P2 foundation is typically 4 units → 2+2 guns. Do not pack a whole page into one gun.
 */
export const DELIVERY_SOFT_ARGS_PER_CALL = 2;

/**
 * Mark LLM client abort (ms). Ours, not Vercel/OpenRouter.
 * Phase-4 dispatch: one mark task ≈ one invoke → use full single-call ceiling.
 */
export const DELIVERY_MARK_TIMEOUT_MS = DELIVERY_SINGLE_CALL_TIMEOUT_MS;

/**
 * Evidence LLM client abort (ms) — aligned with mark (thinking=high walls).
 * Narrative stays on a shorter ceiling (lighter JSON).
 */
export const DELIVERY_EVIDENCE_TIMEOUT_MS = DELIVERY_MARK_TIMEOUT_MS;

/**
 * Finalize: high-effort pages (default, e.g. direct_answer).
 * Was 120s leftover — under concurrent finalize + thinking=high that aborts
 * healthy StreamLake walls; align with the 270s single-call SSOT.
 */
export const DELIVERY_FINALIZE_TIMEOUT_HIGH_MS = DELIVERY_SINGLE_CALL_TIMEOUT_MS;
/** Finalize: science_action / metaphysics_action use xhigh — same headroom as mark. */
export const DELIVERY_FINALIZE_TIMEOUT_XHIGH_MS = DELIVERY_SINGLE_CALL_TIMEOUT_MS;
/**
 * Delivery `callLLM` completion ceiling (SSOT · 铁律锁).
 * Hard stop only — models do not aim at a lower soft target. Lower caps (8k/12k)
 * cause `finish_reason=length` mid-JSON while the 285s wall is still open.
 * Do not lower without an iron-rule change.
 */
export const DELIVERY_LLM_MAX_TOKENS = 20_000;

/** @deprecated Use {@link DELIVERY_LLM_MAX_TOKENS}. */
export const DELIVERY_FINALIZE_MAX_TOKENS_XHIGH = DELIVERY_LLM_MAX_TOKENS;
/** @deprecated Use {@link DELIVERY_LLM_MAX_TOKENS}. */
export const DELIVERY_FINALIZE_MAX_TOKENS_HIGH = DELIVERY_LLM_MAX_TOKENS;

export function deliveryFinalizeEffort(
  paths: readonly DeliverySegmentKey[],
): "high" | "xhigh" {
  if (
    paths.length === 1 &&
    (paths[0] === "science_action" || paths[0] === "metaphysics_action")
  ) {
    return "xhigh";
  }
  return "high";
}

export function deliveryFinalizeTimeoutMs(
  paths: readonly DeliverySegmentKey[],
): number {
  return deliveryFinalizeEffort(paths) === "xhigh"
    ? DELIVERY_FINALIZE_TIMEOUT_XHIGH_MS
    : DELIVERY_FINALIZE_TIMEOUT_HIGH_MS;
}

export function deliveryFinalizeMaxTokens(
  paths: readonly DeliverySegmentKey[],
): number {
  if (paths.length === 1) {
    return deliveryFinalizeEffort(paths) === "xhigh"
      ? DELIVERY_FINALIZE_MAX_TOKENS_XHIGH
      : DELIVERY_FINALIZE_MAX_TOKENS_HIGH;
  }
  return DELIVERY_LLM_MAX_TOKENS;
}

export function deliveryFinalizeIsXhighTask(task: DeliveryTask): boolean {
  return deliveryFinalizeEffort(task.paths) === "xhigh";
}

/**
 * Mark / evidence_soft: connective-only rewrite (slots fixed).
 * **Always high** — no medium/low downgrade. Wall-clock pressure is fixed by
 * shortening the mark prompt/feed, not by lowering effort.
 */
export type DeliveryMarkEffort = "high";
export function resolveDeliveryMarkEffort(
  _env: Record<string, string | undefined> = process.env,
): DeliveryMarkEffort {
  return "high";
}

/** Mark / evidence_soft — same SSOT as all delivery admits. */
export const DELIVERY_MARK_MAX_TOKENS = DELIVERY_LLM_MAX_TOKENS;

/**
 * Mark stage: up to N segment tasks in one wave → KV checkpoint → next wave.
 * Chunks inside a task stay serial so in-flight LLM calls ≈ this number.
 */
export const DELIVERY_MARK_CONCURRENCY = 5;

/**
 * Max parallel DeliveryTasks for evidence (and default heavy stages).
 * Segments are independent; wall clock ≈ slowest task in the wave.
 */
export const DELIVERY_TASK_CONCURRENCY = 7;

/**
 * Per-stage fan-out concurrency (wave size before KV checkpoint / next wave).
 * Segments: up to 4 unlocked pages in parallel (covers full Wave A after P1 bootstrap).
 * Wall clock ≈ slowest sibling phase; soft-wall hops between fill / evidence / mark.
 */
export function deliveryFanoutConcurrency(stage: string): number {
  if (stage === "segments") return 4;
  // Finalize: one group per invoke (rule 12) — concurrency 1; handoff after each.
  if (stage === "finalize") return 1;
  if (stage === "mark") return DELIVERY_MARK_CONCURRENCY;
  if (stage === "evidence") return DELIVERY_TASK_CONCURRENCY;
  return Math.min(DELIVERY_TASK_CONCURRENCY, 3);
}

export const DELIVERY_WRITE_MAX_TOKENS = DELIVERY_LLM_MAX_TOKENS;

/** Compress / page-schema fill — same SSOT. */
export const PAGE_SCHEMA_FILL_MAX_TOKENS = DELIVERY_LLM_MAX_TOKENS;

/** Deep-evidence write / judgment — same SSOT. */
export const PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS = DELIVERY_LLM_MAX_TOKENS;

/**
 * Deep-evidence chunk write client abort (ms).
 * Dispatch: one write.chunk ≈ one 300s invoke → same single-call ceiling.
 * Actual abort is still `min(this, remaining−12s)` when packed in a shared invoke.
 * Old hard caps (100s / 60s) caused `llm_timeout` / OpenRouter finish=`cancelled`.
 */
export const PAGE_SCHEMA_DEEP_WRITE_TIMEOUT_MS = DELIVERY_SINGLE_CALL_TIMEOUT_MS;

/**
 * Deep-evidence assign (Call0) client abort (ms).
 * Was 60s → OpenRouter finish=`cancelled` at ~59.9s. Not 180 “halfway”: under
 * dispatch, assign owns the whole invoke, so use DELIVERY_SINGLE_CALL_TIMEOUT_MS.
 */
export const PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS = DELIVERY_SINGLE_CALL_TIMEOUT_MS;

export function getDeliveryTaskByName(name: string): DeliveryTask | undefined {
  return DELIVERY_TASKS.find((t) => t.name === name);
}

/**
 * Split a segment→arguments payload into chunks of ≤ DELIVERY_ARGS_PER_CALL args
 * (preserves segment key + sibling fields like bazi_basis; order = argument order).
 */
export function chunkDeliveryArgPayload<P extends { arguments: unknown[] }>(
  input: Record<string, P>,
  maxPerCall: number = DELIVERY_ARGS_PER_CALL,
): Array<Record<string, P>> {
  const chunks: Array<Record<string, P>> = [];
  for (const [key, pack] of Object.entries(input)) {
    const args = pack.arguments ?? [];
    if (args.length === 0) continue;
    for (let i = 0; i < args.length; i += maxPerCall) {
      chunks.push({
        [key]: {
          ...pack,
          arguments: args.slice(i, i + maxPerCall),
        },
      });
    }
  }
  return chunks;
}
