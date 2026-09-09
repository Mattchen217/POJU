/**
 * Non-LLM global chart-primary preallocation before Wave A parallel assign.
 * Prevents empty-prior races; sparse charts get dynamic reuse caps (no fake anchors).
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { inferP4MoatEligibleTypes } from "./p4-means-gate";
import { deepEvidenceUnitSpec } from "./deep-evidence-prompt";
import {
  buildInventoryPrimaryPool,
  resolveDeepEvidenceUnitCount,
  type PlannedAssignSlot,
} from "./deep-evidence-assign";
import {
  type CategoryTokenSets,
} from "./anchor-category-tally";
import { inventoryTokensFromCategorySets } from "./layer-b-inventory-menu";
import type { P4MoatMeansType } from "@/lib/glossary/wuxing-semantic-ssot";

export const DEFAULT_PRIMARY_REUSE_CAP = 2;

/** Pages that run deep-evidence assign in parallel Wave A (+ Wave B after unlock). */
export const PREALLOC_DEEP_PAGES: readonly DeliverySegmentKey[] = [
  "foundation",
  "science_action",
  "metaphysics_action",
  "risk_guard",
  "signals_close",
] as const;

export type ChartPrimaryPreallocMap = {
  version: 1;
  /** page → path → prefer_primary */
  by_page: Partial<Record<DeliverySegmentKey, Record<string, string>>>;
  /** Optional reduced slot counts when sparse merge fires */
  slot_count_by_page?: Partial<Record<DeliverySegmentKey, number>>;
  /** Effective per-token reuse cap (may be >2 when sparse) */
  reuse_cap: number;
  /** Unique strong primaries in inventory pool */
  unique_strong_primaries: number;
  /** Planned deep slots before merge */
  deep_slots_planned: number;
  /** Actual slots after sparse merge */
  deep_slots_allocated: number;
  sparse_mode: boolean;
  sparse_merge_slots: boolean;
  all_primaries: string[];
  created_at: number;
};

function normAnchor(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Dynamic reuse cap when inventory cannot cover slots at default cap=2.
 * Never invents out-of-pool anchors.
 */
export function resolveSparsePrimaryReuseCap(input: {
  inventory_size: number;
  slot_count: number;
  default_cap?: number;
}): number {
  const def = input.default_cap ?? DEFAULT_PRIMARY_REUSE_CAP;
  const n = Math.max(0, input.inventory_size);
  const slots = Math.max(0, input.slot_count);
  if (n <= 0 || slots <= 0) return def;
  if (n * def >= slots) return def;
  return Math.max(def, Math.ceil(slots / n));
}

export function validatePrimaryReuseCap(
  primaries: readonly string[],
  opts?: { cap?: number },
): { ok: true } | { ok: false; reason: string; offenders: string[] } {
  const cap = opts?.cap ?? DEFAULT_PRIMARY_REUSE_CAP;
  const counts = new Map<string, { display: string; n: number }>();
  for (const p of primaries) {
    const t = p.trim();
    if (!t) continue;
    const k = normAnchor(t);
    const prev = counts.get(k);
    if (prev) prev.n += 1;
    else counts.set(k, { display: t, n: 1 });
  }
  const offenders: string[] = [];
  for (const { display, n } of counts.values()) {
    if (n > cap) offenders.push(`${display}:${n}>${cap}`);
  }
  if (offenders.length > 0) {
    return {
      ok: false,
      reason: `primary_reuse_cap:${offenders[0]}`,
      offenders,
    };
  }
  return { ok: true };
}

function planSlotShells(
  key: DeliverySegmentKey,
  eastern_calc_slice?: string | null,
  forcedCount?: number,
): PlannedAssignSlot[] {
  const spec = deepEvidenceUnitSpec(key);
  if (key === "metaphysics_action") {
    const eligible = inferP4MoatEligibleTypes(eastern_calc_slice);
    const count =
      forcedCount ?? resolveDeepEvidenceUnitCount(key, eligible.size);
    const moats = [...eligible];
    return Array.from({ length: count }, (_, i) => ({
      path: spec.paths[i] ?? `dimensions[${i}]`,
      moat_class: (moats[i % Math.max(1, moats.length)] ?? null) as
        | P4MoatMeansType
        | null,
    }));
  }
  const count =
    forcedCount ?? resolveDeepEvidenceUnitCount(key, 0);
  return Array.from({ length: count }, (_, i) => ({
    path: spec.paths[i] ?? `unit[${i}]`,
    moat_class: null,
  }));
}

function countUses(usedCounts: Map<string, number>, token: string): number {
  return usedCounts.get(normAnchor(token)) ?? 0;
}

function bumpUse(usedCounts: Map<string, number>, token: string): void {
  const k = normAnchor(token);
  usedCounts.set(k, (usedCounts.get(k) ?? 0) + 1);
}

/**
 * Greedy global primary assignment across deep pages (stable order).
 */
export function preallocateChartPrimaries(input: {
  category_token_sets: CategoryTokenSets | null;
  eastern_calc_slice_by_key?: Partial<
    Record<DeliverySegmentKey, string | null>
  >;
  pages?: readonly DeliverySegmentKey[];
  default_cap?: number;
}): ChartPrimaryPreallocMap {
  const pages = input.pages ?? PREALLOC_DEEP_PAGES;
  const sets = input.category_token_sets;
  const poolAll = inventoryTokensFromCategorySets(sets);
  const uniqueStrong = poolAll.length;
  const defaultCap = input.default_cap ?? DEFAULT_PRIMARY_REUSE_CAP;

  // First pass: planned slot counts
  const shellsByPage = new Map<DeliverySegmentKey, PlannedAssignSlot[]>();
  let deepSlotsPlanned = 0;
  for (const key of pages) {
    const shells = planSlotShells(
      key,
      input.eastern_calc_slice_by_key?.[key] ?? null,
    );
    shellsByPage.set(key, shells);
    deepSlotsPlanned += shells.length;
  }

  let reuseCap = resolveSparsePrimaryReuseCap({
    inventory_size: uniqueStrong,
    slot_count: deepSlotsPlanned,
    default_cap: defaultCap,
  });
  const sparseMode = uniqueStrong > 0 && uniqueStrong * defaultCap < deepSlotsPlanned;

  // Extreme thin pool: merge slots so we don't invent fake diversity
  let sparseMerge = false;
  const slotCountByPage: Partial<Record<DeliverySegmentKey, number>> = {};
  if (uniqueStrong > 0 && uniqueStrong <= 3 && deepSlotsPlanned > uniqueStrong * reuseCap) {
    sparseMerge = true;
    const maxTotal = uniqueStrong * reuseCap;
    let remaining = maxTotal;
    for (const key of pages) {
      const shells = shellsByPage.get(key) ?? [];
      const share = Math.max(
        1,
        Math.min(shells.length, Math.ceil(remaining / Math.max(1, pages.length))),
      );
      const reduced = Math.min(shells.length, share, remaining);
      slotCountByPage[key] = Math.max(1, reduced);
      shellsByPage.set(key, shells.slice(0, slotCountByPage[key]));
      remaining -= slotCountByPage[key]!;
    }
  }

  const by_page: ChartPrimaryPreallocMap["by_page"] = {};
  const usedCounts = new Map<string, number>();
  const all_primaries: string[] = [];

  for (const key of pages) {
    const shells = shellsByPage.get(key) ?? [];
    const pageMap: Record<string, string> = {};
    for (const slot of shells) {
      // Prefer never-used tokens first; only then reuse under dynamic cap.
      const usedOnce = new Set<string>([...usedCounts.keys()]);
      let pool = buildInventoryPrimaryPool(
        sets,
        usedOnce,
        slot.moat_class,
      );
      if (pool.length === 0 && sets) {
        const atCap = new Set<string>();
        for (const [k, n] of usedCounts) {
          if (n >= reuseCap) atCap.add(k);
        }
        pool = buildInventoryPrimaryPool(sets, atCap, slot.moat_class).filter(
          (t) => countUses(usedCounts, t) < reuseCap,
        );
      }
      let pick = pool[0];
      if (!pick && poolAll.length > 0) {
        pick =
          poolAll.find((t) => countUses(usedCounts, t) === 0) ??
          poolAll.find((t) => countUses(usedCounts, t) < reuseCap);
      }
      if (!pick) continue;
      pageMap[slot.path] = pick;
      bumpUse(usedCounts, pick);
      all_primaries.push(pick);
    }
    if (Object.keys(pageMap).length > 0) {
      by_page[key] = pageMap;
    }
  }

  const deep_slots_allocated = all_primaries.length;
  const diversityOk =
    !sparseMode &&
    uniqueStrong >= Math.ceil(0.6 * Math.max(1, deep_slots_allocated));

  return {
    version: 1,
    by_page,
    slot_count_by_page: sparseMerge ? slotCountByPage : undefined,
    reuse_cap: reuseCap,
    unique_strong_primaries: uniqueStrong,
    deep_slots_planned: deepSlotsPlanned,
    deep_slots_allocated,
    sparse_mode: sparseMode || sparseMerge,
    sparse_merge_slots: sparseMerge,
    all_primaries,
    created_at: Date.now(),
  };
}

/** Diversity ratio check — normal mode only (sparse uses cap validation). */
export function assertSignalDiversity(
  primaries: readonly string[],
  opts: { sparse_mode: boolean; reuse_cap: number },
): { ok: true; unique: number; ratio: number } | { ok: false; reason: string } {
  const cleaned = primaries.map((p) => p.trim()).filter(Boolean);
  const unique = new Set(cleaned.map(normAnchor)).size;
  const ratio = cleaned.length > 0 ? unique / cleaned.length : 1;
  const capCheck = validatePrimaryReuseCap(cleaned, { cap: opts.reuse_cap });
  if (!capCheck.ok) {
    return { ok: false, reason: capCheck.reason };
  }
  if (!opts.sparse_mode && cleaned.length > 0 && ratio < 0.6) {
    return {
      ok: false,
      reason: `signal_diversity_ratio:${ratio.toFixed(2)}<0.6`,
    };
  }
  return { ok: true, unique, ratio };
}

export function reservedPrimariesForPage(
  map: ChartPrimaryPreallocMap,
  excludeKey: DeliverySegmentKey,
): string[] {
  const out: string[] = [];
  for (const [key, paths] of Object.entries(map.by_page)) {
    if (key === excludeKey || !paths) continue;
    for (const p of Object.values(paths)) {
      if (p?.trim()) out.push(p.trim());
    }
  }
  return out;
}

export function preallocPreferByPath(
  map: ChartPrimaryPreallocMap,
  key: DeliverySegmentKey,
): Record<string, string> {
  return { ...(map.by_page[key] ?? {}) };
}
