/**
 * D1: deterministic closed-menu signal slots from thesis assign menu.
 * Exactly one locked signal per path; page-local unique primaries.
 * Used by foundation + all deep assign pages (science / metaphysics / risk / close).
 */

import type { ThesisDimensionId } from "@/lib/llm/pro/delivery/thesis/types";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import {
  buildThesisAssignMenu,
  groupAssignMenuByDimension,
  type ThesisAssignMenuItem,
} from "@/lib/llm/pro/delivery/thesis/build-assign-menu";
import { normalizePrimaryReuseKey } from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";

export type LockedAssignSignal = {
  slug: string;
  dimension_id: ThesisDimensionId;
  fact_hint?: string;
};

export type ClosedMenuSignalPrealloc =
  | {
      ok: true;
      by_path: Record<string, LockedAssignSignal[]>;
      menu_size: number;
    }
  | { ok: false; reason: string };

/** @deprecated alias — prefer ClosedMenuSignalPrealloc */
export type FoundationSignalPrealloc = ClosedMenuSignalPrealloc;

/** Foundation last-card prefer: cycle / day-master strength. */
export const FOUNDATION_LAST_CARD_PREFER_DIMS: readonly ThesisDimensionId[] = [
  "cycle_rhythm",
  "day_master_strength",
];

function takeFromDim(
  byDim: Map<ThesisDimensionId, ThesisAssignMenuItem[]>,
  dim: ThesisDimensionId,
  usedKeys: Set<string>,
): ThesisAssignMenuItem | null {
  const list = byDim.get(dim) ?? [];
  for (const item of list) {
    const k = normalizePrimaryReuseKey(item.slug);
    if (!k || usedKeys.has(k)) continue;
    usedKeys.add(k);
    return item;
  }
  return null;
}

function takeAny(
  menu: readonly ThesisAssignMenuItem[],
  usedKeys: Set<string>,
  preferDims?: readonly ThesisDimensionId[],
): ThesisAssignMenuItem | null {
  if (preferDims?.length) {
    for (const dim of preferDims) {
      for (const item of menu) {
        if (item.dimension_id !== dim) continue;
        const k = normalizePrimaryReuseKey(item.slug);
        if (!k || usedKeys.has(k)) continue;
        usedKeys.add(k);
        return item;
      }
    }
  }
  for (const item of menu) {
    const k = normalizePrimaryReuseKey(item.slug);
    if (!k || usedKeys.has(k)) continue;
    usedKeys.add(k);
    return item;
  }
  return null;
}

/**
 * Allocate exactly one locked signal per path from thesis closed menu.
 * Cross-path primary keys unique; prefer unused dimensions.
 * Optional last-path preferDims (foundation: cycle/strength).
 */
export function preallocateClosedMenuSignals(input: {
  thesis: ChartThesis | null | undefined;
  paths: readonly string[];
  /** When set, last path tries these dims first (foundation closing card). */
  last_path_prefer_dims?: readonly ThesisDimensionId[];
}): ClosedMenuSignalPrealloc {
  const paths = input.paths.map((p) => p.trim()).filter(Boolean);
  if (paths.length === 0) {
    return { ok: false, reason: "assign:menu_empty:no_paths" };
  }
  const menu = buildThesisAssignMenu(input.thesis);
  if (menu.length === 0) {
    return { ok: false, reason: "assign:menu_empty" };
  }

  const byDim = groupAssignMenuByDimension(menu);
  const usedKeys = new Set<string>();
  const usedDims = new Set<ThesisDimensionId>();
  const by_path: Record<string, LockedAssignSignal[]> = {};

  const dimRoundRobin = [...byDim.keys()].filter(
    (d) => (byDim.get(d)?.length ?? 0) > 0,
  );
  let rr = 0;
  const lastPrefer = input.last_path_prefer_dims;

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!;
    const isLast = i === paths.length - 1;
    let pick: ThesisAssignMenuItem | null = null;

    if (isLast && lastPrefer?.length) {
      pick = takeAny(menu, usedKeys, lastPrefer);
    }

    if (!pick) {
      const unusedDims = dimRoundRobin.filter((d) => !usedDims.has(d));
      const order =
        unusedDims.length > 0
          ? [
              ...unusedDims.slice(rr % Math.max(1, unusedDims.length)),
              ...unusedDims.slice(0, rr % Math.max(1, unusedDims.length)),
            ]
          : dimRoundRobin;
      for (let t = 0; t < order.length; t++) {
        const dim = order[t]!;
        pick = takeFromDim(byDim, dim, usedKeys);
        if (pick) {
          rr += 1;
          break;
        }
      }
    }

    if (!pick) {
      pick = takeAny(menu, usedKeys);
    }

    if (!pick) {
      return {
        ok: false,
        reason: `assign:menu_empty:underfill:${path}`,
      };
    }

    usedDims.add(pick.dimension_id);
    by_path[path] = [
      {
        slug: pick.slug,
        dimension_id: pick.dimension_id,
        fact_hint: pick.fact_hint,
      },
    ];
  }

  return { ok: true, by_path, menu_size: menu.length };
}

/**
 * Foundation paths: closed-menu + last card prefers cycle/strength.
 */
export function preallocateFoundationSignals(input: {
  thesis: ChartThesis | null | undefined;
  paths: readonly string[];
}): ClosedMenuSignalPrealloc {
  return preallocateClosedMenuSignals({
    thesis: input.thesis,
    paths: input.paths,
    last_path_prefer_dims: FOUNDATION_LAST_CARD_PREFER_DIMS,
  });
}
