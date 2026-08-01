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
export const DELIVERY_ARGS_PER_CALL = 3;

/**
 * Mark is 6-step + SSOT + situational gloss — one arg per call avoids
 * mark_incomplete (truncated/wrong JSON) and llm_timeout on 3-arg bundles.
 */
export const DELIVERY_MARK_ARGS_PER_CALL = 1;

/** Mark LLM HTTP timeout (ms). Heavier than narrative/evidence. */
export const DELIVERY_MARK_TIMEOUT_MS = 180_000;

/**
 * Max parallel DeliveryTasks inside one fan-out stage / continue.
 * Segments are independent; wall clock ≈ slowest task in the wave.
 * Mark overrides to 1 (see deliveryFanoutConcurrency) — 6×180s mark waves
 * blow Vercel 300s and stale-resume re-fires the same work.
 */
export const DELIVERY_TASK_CONCURRENCY = 6;

/** Mark = 1 task per continue wave; other stages keep default concurrency. */
export function deliveryFanoutConcurrency(stage: string): number {
  return stage === "mark" ? 1 : DELIVERY_TASK_CONCURRENCY;
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
