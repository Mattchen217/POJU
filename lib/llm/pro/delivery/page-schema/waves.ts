/**
 * Two-wave DAG for schema-driven delivery fill (6 pages).
 * Wave A: P1–P4 (content body — parallel after finalize) → Wave B: P5∥P6
 * P3/P5/P6 primary-backup hint falls back to synthesis breakthrough_core when P1 not ready yet.
 * Legacy `thirty_day` is not scheduled.
 */

import type { DeliverySegmentKey } from "../delivery-schema";

export type DeliveryWaveId = "A" | "B";

/** Content pages vs closing pages — only hard dependency is P5/P6 need P1+P3+P4 for ActionBrief. */
export const DELIVERY_CONTENT_PAGE_KEYS: readonly DeliverySegmentKey[] = [
  "direct_answer",
  "foundation",
  "science_action",
  "metaphysics_action",
] as const;

export const DELIVERY_CLOSING_PAGE_KEYS: readonly DeliverySegmentKey[] = [
  "risk_guard",
  "signals_close",
] as const;

export const DELIVERY_WAVES: Record<
  DeliveryWaveId,
  { id: DeliveryWaveId; keys: readonly DeliverySegmentKey[]; unlocks: readonly DeliverySegmentKey[] }
> = {
  A: {
    id: "A",
    keys: DELIVERY_CONTENT_PAGE_KEYS,
    unlocks: DELIVERY_CONTENT_PAGE_KEYS,
  },
  B: {
    id: "B",
    keys: DELIVERY_CLOSING_PAGE_KEYS,
    unlocks: DELIVERY_CLOSING_PAGE_KEYS,
  },
};

export const DELIVERY_WAVE_ORDER: DeliveryWaveId[] = ["A", "B"];

export function waveForSegment(key: DeliverySegmentKey): DeliveryWaveId {
  for (const id of DELIVERY_WAVE_ORDER) {
    if (DELIVERY_WAVES[id].keys.includes(key)) return id;
  }
  return "A";
}

/** Pages that should show content (not skeleton) given completed waves. */
export function unlockedKeysThroughWave(
  through: DeliveryWaveId | "done",
): Set<DeliverySegmentKey> {
  const out = new Set<DeliverySegmentKey>();
  if (through === "done") {
    for (const id of DELIVERY_WAVE_ORDER) {
      for (const k of DELIVERY_WAVES[id].unlocks) out.add(k);
    }
    return out;
  }
  for (const id of DELIVERY_WAVE_ORDER) {
    for (const k of DELIVERY_WAVES[id].unlocks) out.add(k);
    if (id === through) break;
  }
  return out;
}

export function nextWave(current: DeliveryWaveId): DeliveryWaveId | "done" {
  const i = DELIVERY_WAVE_ORDER.indexOf(current);
  if (i < 0 || i >= DELIVERY_WAVE_ORDER.length - 1) return "done";
  return DELIVERY_WAVE_ORDER[i + 1]!;
}
