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
 * Mark args per LLM call. Model finishes ~3s; 4–5 args/call is the default
 * (was 1 — made 20+ evidence rows take 20+ minutes wall clock).
 */
export const DELIVERY_MARK_ARGS_PER_CALL = 5;

/** Mark LLM HTTP timeout (ms). Keep headroom even though typical wall is ~3s. */
export const DELIVERY_MARK_TIMEOUT_MS = 120_000;

/**
 * Max parallel DeliveryTasks inside one fan-out stage / continue.
 * Segments are independent; wall clock ≈ slowest task in the wave.
 */
export const DELIVERY_TASK_CONCURRENCY = 7;

/**
 * Per-stage fan-out concurrency (wall clock ≈ slowest task × waves).
 * With ~3s LLM turns, mark/evidence can run high parallelism under Vercel 300s.
 */
export function deliveryFanoutConcurrency(stage: string): number {
  if (stage === "mark" || stage === "evidence") {
    return DELIVERY_TASK_CONCURRENCY;
  }
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
