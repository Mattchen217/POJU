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
 * 300s is the **invoke** hard kill, not the LLM budget — reserve ~25–30s for
 * KV checkpoint, QStash schedule, response flush (see TASK_TAIL_MS in task-runner).
 * Abort ourselves slightly early so the worker can finish cleanly / retry.
 */
export const DELIVERY_SINGLE_CALL_TIMEOUT_MS = 270_000;

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

/** Finalize: high-effort pages (default). */
export const DELIVERY_FINALIZE_TIMEOUT_HIGH_MS = 120_000;
/** Finalize: science_action / metaphysics_action use xhigh — same headroom as mark. */
export const DELIVERY_FINALIZE_TIMEOUT_XHIGH_MS = DELIVERY_MARK_TIMEOUT_MS;
/**
 * Cap for xhigh finalize JSON (+ reasoning). Was 6k — xhigh thinking starved the
 * visible JSON (`finish_reason=length` with empty/truncated content). ~20k leaves
 * room for reasoning + page spine under the single-call client abort.
 */
export const DELIVERY_FINALIZE_MAX_TOKENS_XHIGH = 20_000;
export const DELIVERY_FINALIZE_MAX_TOKENS_HIGH = 20_000;

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
  return 20_000;
}

export function deliveryFinalizeIsXhighTask(task: DeliveryTask): boolean {
  return deliveryFinalizeEffort(task.paths) === "xhigh";
}

/**
 * P4 A/B: mark thinking effort. Default high; set DELIVERY_MARK_EFFORT=medium after
 * connective-only mark is stable. Degenerate JSON/quality → roll back to high.
 */
export type DeliveryMarkEffort = "high" | "medium";
export function resolveDeliveryMarkEffort(
  env: Record<string, string | undefined> = process.env,
): DeliveryMarkEffort {
  return env.DELIVERY_MARK_EFFORT?.trim() === "medium" ? "medium" : "high";
}

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
  if (stage === "finalize") return 6;
  if (stage === "mark") return DELIVERY_MARK_CONCURRENCY;
  if (stage === "evidence") return DELIVERY_TASK_CONCURRENCY;
  return Math.min(DELIVERY_TASK_CONCURRENCY, 3);
}

export const DELIVERY_WRITE_MAX_TOKENS = 20_000;

/**
 * Compress / page-schema fill (thinking=high).
 * Deep-evidence (xhigh) uses PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS separately.
 */
export const PAGE_SCHEMA_FILL_MAX_TOKENS = 20_000;

/**
 * Deep-evidence Call 1 (thinking starts at xhigh). Reasoning + multi-unit ⟦w:⟧ JSON
 * share this budget — 10k was routinely exhausted by thinking alone.
 */
export const PAGE_SCHEMA_DEEP_EVIDENCE_MAX_TOKENS = 20_000;

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
