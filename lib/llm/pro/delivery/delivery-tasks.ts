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
 * Mark args per LLM call (2–3). Smaller batches keep thinking=high under timeout;
 * leftover args become the next chunk (serial within the task).
 */
export const DELIVERY_MARK_ARGS_PER_CALL = 3;

/**
 * Mark LLM client abort (ms). Ours, not Vercel/OpenRouter.
 * Per-call ceiling under continue maxDuration=300s / fan-out budget.
 */
export const DELIVERY_MARK_TIMEOUT_MS = 200_000;

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
 * mark: 5 concurrent segments; evidence: 7; finalize/narrative: capped at 3.
 */
export function deliveryFanoutConcurrency(stage: string): number {
  if (stage === "mark") return DELIVERY_MARK_CONCURRENCY;
  if (stage === "evidence") return DELIVERY_TASK_CONCURRENCY;
  return Math.min(DELIVERY_TASK_CONCURRENCY, 3);
}

export const DELIVERY_WRITE_MAX_TOKENS = 16_000;

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
