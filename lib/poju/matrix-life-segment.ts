export type PillarKey = "year" | "month" | "day" | "hour";

/** Life-segment pillar highlight by current age (local heuristic). */
export function activePillarByAge(age: number): PillarKey {
  if (age <= 16) return "year";
  if (age <= 32) return "month";
  if (age <= 48) return "day";
  return "hour";
}
