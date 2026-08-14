/**
 * Four-wave DAG for schema-driven delivery fill.
 * Wave A: P1 → Wave B: P2∥P3∥P4 → Extractor → Wave C: P5 → Wave D: P6∥P7
 */

import type { DeliverySegmentKey } from "../delivery-schema";

export type DeliveryWaveId = "A" | "B" | "C" | "D";

export const DELIVERY_WAVES: Record<
  DeliveryWaveId,
  { id: DeliveryWaveId; keys: readonly DeliverySegmentKey[]; unlocks: readonly DeliverySegmentKey[] }
> = {
  A: {
    id: "A",
    keys: ["direct_answer"],
    unlocks: ["direct_answer"],
  },
  B: {
    id: "B",
    keys: ["foundation", "science_action", "metaphysics_action"],
    unlocks: ["foundation", "science_action", "metaphysics_action"],
  },
  C: {
    id: "C",
    keys: ["thirty_day"],
    unlocks: ["thirty_day"],
  },
  D: {
    id: "D",
    keys: ["risk_guard", "signals_close"],
    unlocks: ["risk_guard", "signals_close"],
  },
};

export const DELIVERY_WAVE_ORDER: DeliveryWaveId[] = ["A", "B", "C", "D"];

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

/** Soft-wall: prefer hop at wave boundaries (not mid parallel fill). */
export function isWaveBoundary(keyJustFinished: DeliverySegmentKey): boolean {
  return (
    keyJustFinished === "direct_answer" ||
    keyJustFinished === "metaphysics_action" ||
    keyJustFinished === "thirty_day" ||
    keyJustFinished === "signals_close"
  );
}
