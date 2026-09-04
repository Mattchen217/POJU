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
 * Mark LLM client abort (ms). Ours, not Vercel/OpenRouter.
 * Per-call ceiling under continue maxDuration=300s / fan-out budget.
 */
export const DELIVERY_MARK_TIMEOUT_MS = 200_000;

/**
 * Evidence LLM client abort (ms) — aligned with mark (thinking=high walls).
 * Narrative stays on a shorter ceiling (lighter JSON).
 */
export const DELIVERY_EVIDENCE_TIMEOUT_MS = DELIVERY_MARK_TIMEOUT_MS;

/** Finalize: high-effort pages (default). */
export const DELIVERY_FINALIZE_TIMEOUT_HIGH_MS = 120_000;
/** Finalize: science_action / metaphysics_action use xhigh — same headroom as mark. */
export const DELIVERY_FINALIZE_TIMEOUT_XHIGH_MS = DELIVERY_MARK_TIMEOUT_MS;
/** Cap xhigh finalize JSON — 7k+ output at ~55 tok/s already burns ~130s before thinking. */
export const DELIVERY_FINALIZE_MAX_TOKENS_XHIGH = 6_000;
export const DELIVERY_FINALIZE_MAX_TOKENS_HIGH = 8_000;

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
  if (paths.length === 2) return 10_000;
  return 12_000;
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

export const DELIVERY_WRITE_MAX_TOKENS = 16_000;

/**
 * Page-schema fill only — structured JSON pages rarely need 16k completion.
 * Keeps mark/evidence/narrative at DELIVERY_WRITE_MAX_TOKENS.
 */
export const PAGE_SCHEMA_FILL_MAX_TOKENS = 10_000;

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
