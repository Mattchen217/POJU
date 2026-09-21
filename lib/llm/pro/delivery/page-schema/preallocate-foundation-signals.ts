/**
 * D1: deterministic closed-menu signal slots from thesis assign menu.
 * A prealloc group locks every term on the card; otherwise one signal per path.
 * Page-local unique leads. Used by all deep assign pages.
 */

import type { ThesisDimensionId } from "@/lib/llm/pro/delivery/thesis/types";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import {
  buildThesisAssignMenu,
  groupAssignMenuByDimension,
  type ThesisAssignMenuItem,
} from "@/lib/llm/pro/delivery/thesis/build-assign-menu";
import { normalizePrimaryReuseKey } from "@/lib/llm/pro/delivery/page-schema/preallocate-chart-primaries";
import { anchorsServeMoatClass } from "@/lib/llm/pro/delivery/page-schema/p4-means-gate";
import type { P4MoatMeansType } from "@/lib/glossary/wuxing-semantic-ssot";

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

function findMenuItemBySlug(
  menu: readonly ThesisAssignMenuItem[],
  slug: string,
): ThesisAssignMenuItem | null {
  const want = normalizePrimaryReuseKey(slug);
  if (!want) return null;
  for (const item of menu) {
    const k = normalizePrimaryReuseKey(item.slug);
    if (k === want) return item;
    if (item.slug.includes(slug.trim()) || slug.trim().includes(item.slug)) {
      return item;
    }
  }
  return null;
}

function isBareWuxingSlug(slug: string): boolean {
  return /^[木火土金水]$/.test(slug.trim());
}

/** Prefer non-bare-wuxing when alternatives exist (方案 A #7 demote). */
function takeFromDim(
  byDim: Map<ThesisDimensionId, ThesisAssignMenuItem[]>,
  dim: ThesisDimensionId,
  usedKeys: Set<string>,
  avoidKeys?: ReadonlySet<string>,
): ThesisAssignMenuItem | null {
  const list = byDim.get(dim) ?? [];
  const tryPass = (allowBare: boolean): ThesisAssignMenuItem | null => {
    for (const item of list) {
      const k = normalizePrimaryReuseKey(item.slug);
      if (!k || usedKeys.has(k)) continue;
      if (avoidKeys?.has(k)) continue;
      if (!allowBare && isBareWuxingSlug(item.slug)) continue;
      usedKeys.add(k);
      return item;
    }
    return null;
  };
  return tryPass(false) ?? tryPass(true);
}

function takeAnyAvoiding(
  menu: readonly ThesisAssignMenuItem[],
  usedKeys: Set<string>,
  avoidKeys: ReadonlySet<string>,
  preferDims?: readonly ThesisDimensionId[],
  allowAvoidHit = false,
): ThesisAssignMenuItem | null {
  const dims = preferDims?.length ? preferDims : null;
  const tryPass = (allowBare: boolean): ThesisAssignMenuItem | null => {
    for (const item of menu) {
      if (dims && !dims.includes(item.dimension_id)) continue;
      const k = normalizePrimaryReuseKey(item.slug);
      if (!k || usedKeys.has(k)) continue;
      if (!allowAvoidHit && avoidKeys.has(k)) continue;
      if (!allowBare && isBareWuxingSlug(item.slug)) continue;
      usedKeys.add(k);
      return item;
    }
    if (dims) {
      for (const item of menu) {
        const k = normalizePrimaryReuseKey(item.slug);
        if (!k || usedKeys.has(k)) continue;
        if (!allowAvoidHit && avoidKeys.has(k)) continue;
        if (!allowBare && isBareWuxingSlug(item.slug)) continue;
        usedKeys.add(k);
        return item;
      }
    }
    return null;
  };
  return tryPass(false) ?? tryPass(true);
}

function takeMoatServing(
  menu: readonly ThesisAssignMenuItem[],
  usedKeys: Set<string>,
  avoidKeys: ReadonlySet<string>,
  moat: P4MoatMeansType,
  allowAvoidHit: boolean,
): ThesisAssignMenuItem | null {
  const tryPass = (allowBare: boolean): ThesisAssignMenuItem | null => {
    for (const item of menu) {
      const k = normalizePrimaryReuseKey(item.slug);
      if (!k || usedKeys.has(k)) continue;
      if (!allowAvoidHit && avoidKeys.has(k)) continue;
      if (!allowBare && isBareWuxingSlug(item.slug) && moat !== "polarity") {
        continue;
      }
      // archetype：十神优先于任何仍漏网的壳词
      if (moat === "archetype" && item.slug.trim() === "格局") continue;
      if (!anchorsServeMoatClass([item.slug], moat)) continue;
      usedKeys.add(k);
      return item;
    }
    return null;
  };
  // polarity may need bare 土/水 as last resort; archetype never wants bare first
  if (moat === "polarity") {
    return tryPass(false) ?? tryPass(true);
  }
  return tryPass(false) ?? tryPass(true);
}

function lockTermGroup(input: {
  menu: readonly ThesisAssignMenuItem[];
  group: readonly string[] | undefined;
  lead: string | undefined;
}): LockedAssignSignal[] | null {
  const raw = input.group ?? [];
  if (raw.length < 2) return null;
  const ordered: string[] = [];
  const lead = input.lead?.trim();
  if (lead) ordered.push(lead);
  for (const slug of raw) {
    const t = slug.trim();
    if (t) ordered.push(t);
  }
  const locked: LockedAssignSignal[] = [];
  const seen = new Set<string>();
  for (const slug of ordered) {
    const hit = findMenuItemBySlug(input.menu, slug);
    if (!hit) continue;
    const k = normalizePrimaryReuseKey(hit.slug);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    locked.push({
      slug: hit.slug,
      dimension_id: hit.dimension_id,
      fact_hint: hit.fact_hint,
    });
  }
  return locked.length > 0 ? locked : null;
}

/**
 * Lock this-chart signals per path from the thesis closed menu.
 * When `group_by_path` is set, each path keeps the whole group (lead + companions).
 * Without a group, fall back to exactly one locked signal (legacy callers / tests).
 * Cross-path leads stay unique; prefer unused dimensions.
 * Optional last-path preferDims (foundation: cycle/strength).
 * Cross-page: honor job prefer_by_path; avoid prior-page primaries when menu allows.
 * P4: moat_by_path prefers timing/polarity/archetype-serving slugs per path.
 */
export function preallocateClosedMenuSignals(input: {
  thesis: ChartThesis | null | undefined;
  paths: readonly string[];
  /** When set, last path tries these dims first (foundation closing card). */
  last_path_prefer_dims?: readonly ThesisDimensionId[];
  /** Job-level path → prefer slug (lead of the chart-term group). */
  prefer_by_path?: Record<string, string>;
  /** Path → full term group. When set, lock the group instead of one slug. */
  group_by_path?: Readonly<Record<string, readonly string[]>>;
  /** Primaries already used on prior pages — avoid when alternatives exist. */
  avoid_primaries?: readonly string[];
  /** P4 path → moat_class — prefer anchors that already serve the moat. */
  moat_by_path?: Readonly<Record<string, P4MoatMeansType | null | undefined>>;
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
  const avoidKeys = new Set(
    (input.avoid_primaries ?? [])
      .map((p) => normalizePrimaryReuseKey(p))
      .filter(Boolean),
  );
  const by_path: Record<string, LockedAssignSignal[]> = {};

  const dimRoundRobin = [...byDim.keys()].filter(
    (d) => (byDim.get(d)?.length ?? 0) > 0,
  );
  let rr = 0;
  const lastPrefer = input.last_path_prefer_dims;
  const preferByPath = input.prefer_by_path ?? {};
  const moatByPath = input.moat_by_path ?? {};

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!;
    const grouped = lockTermGroup({
      menu,
      group: input.group_by_path?.[path],
      lead: preferByPath[path],
    });
    if (grouped) {
      const leadKey = normalizePrimaryReuseKey(grouped[0]!.slug);
      if (leadKey) usedKeys.add(leadKey);
      usedDims.add(grouped[0]!.dimension_id);
      by_path[path] = grouped;
      continue;
    }

    const isLast = i === paths.length - 1;
    const moat = moatByPath[path] ?? null;
    let pick: ThesisAssignMenuItem | null = null;

    let deferredPrefer: ThesisAssignMenuItem | null = null;
    const pathPrefer = preferByPath[path]?.trim();
    if (pathPrefer) {
      const hit = findMenuItemBySlug(menu, pathPrefer);
      const k = hit ? normalizePrimaryReuseKey(hit.slug) : "";
      const preferServes =
        !moat || (hit ? anchorsServeMoatClass([hit.slug], moat) : false);
      if (hit && k && !usedKeys.has(k) && !avoidKeys.has(k) && preferServes) {
        usedKeys.add(k);
        pick = hit;
      } else if (hit && k && !usedKeys.has(k)) {
        deferredPrefer = hit;
      }
    }

    // P4: lock a moat-serving primary before generic dim round-robin.
    if (!pick && moat) {
      pick = takeMoatServing(menu, usedKeys, avoidKeys, moat, false);
    }

    // When moat is set, exhaust moat-serving (incl. prior reuse) BEFORE any
    // generic pick — otherwise polarity/timing get bare 土/水 and fail gate.
    if (!pick && moat) {
      pick = takeMoatServing(menu, usedKeys, avoidKeys, moat, true);
    }

    if (!pick && !moat && isLast && lastPrefer?.length) {
      pick = takeAnyAvoiding(menu, usedKeys, avoidKeys, lastPrefer, false);
    }

    if (!pick && !moat) {
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
        pick = takeFromDim(byDim, dim, usedKeys, avoidKeys);
        if (pick) {
          rr += 1;
          break;
        }
      }
    }

    if (!pick && !moat) {
      pick = takeAnyAvoiding(menu, usedKeys, avoidKeys, undefined, false);
    }

    if (!pick && deferredPrefer) {
      const k = normalizePrimaryReuseKey(deferredPrefer.slug);
      const deferOk =
        k &&
        !usedKeys.has(k) &&
        (!moat || anchorsServeMoatClass([deferredPrefer.slug], moat));
      if (deferOk) {
        usedKeys.add(k!);
        pick = deferredPrefer;
      }
    }

    // Non-moat sparse last resort — still honor avoid when menu has alternatives.
    if (!pick && !moat && isLast && lastPrefer?.length) {
      pick = takeAnyAvoiding(menu, usedKeys, avoidKeys, lastPrefer, false);
    }
    if (!pick && !moat && isLast && lastPrefer?.length) {
      pick = takeAnyAvoiding(menu, usedKeys, avoidKeys, lastPrefer, true);
    }
    if (!pick && !moat) {
      for (const dim of dimRoundRobin) {
        pick = takeFromDim(byDim, dim, usedKeys, avoidKeys);
        if (pick) break;
      }
    }
    if (!pick && !moat) {
      pick = takeAnyAvoiding(menu, usedKeys, avoidKeys, undefined, false);
    }
    if (!pick && !moat) {
      for (const dim of dimRoundRobin) {
        pick = takeFromDim(byDim, dim, usedKeys);
        if (pick) break;
      }
    }
    if (!pick && !moat) {
      pick = takeAnyAvoiding(menu, usedKeys, avoidKeys, undefined, true);
    }

    if (!pick) {
      return {
        ok: false,
        reason: moat
          ? `assign:menu_empty:moat_underfill:${path}:${moat}`
          : `assign:menu_empty:underfill:${path}`,
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

export type PlannedAssignSlotLike = {
  path: string;
  moat_class?: P4MoatMeansType | null;
  prefer_primary?: string;
  locked_signals?: LockedAssignSignal[];
};

/**
 * Deterministic: for each planned slot whose primary does not serve moat_class,
 * swap to an unused menu slug that does (P4 closed-menu qualify-first).
 */
export function softRepairPlannedMoatLocks(
  planned: readonly PlannedAssignSlotLike[],
  thesis: ChartThesis | null | undefined,
): { planned: PlannedAssignSlotLike[]; repaired: boolean } {
  if (!thesis?.dimensions?.length) {
    return { planned: [...planned], repaired: false };
  }
  const menu = buildThesisAssignMenu(thesis);
  if (menu.length === 0) return { planned: [...planned], repaired: false };

  const used = new Set<string>();
  for (const slot of planned) {
    const slug =
      slot.locked_signals?.[0]?.slug?.trim() ||
      slot.prefer_primary?.trim() ||
      "";
    const k = normalizePrimaryReuseKey(slug);
    if (k) used.add(k);
  }

  let repaired = false;
  const next = planned.map((slot) => {
    const moat = slot.moat_class ?? null;
    if (!moat) return slot;
    const cur =
      slot.locked_signals?.[0]?.slug?.trim() ||
      slot.prefer_primary?.trim() ||
      "";
    if (cur && anchorsServeMoatClass([cur], moat)) return slot;

    for (const item of menu) {
      const k = normalizePrimaryReuseKey(item.slug);
      if (!k || used.has(k)) continue;
      if (!anchorsServeMoatClass([item.slug], moat)) continue;
      const prev = normalizePrimaryReuseKey(cur);
      if (prev) used.delete(prev);
      used.add(k);
      repaired = true;
      const rest = (slot.locked_signals ?? []).filter(
        (s) => normalizePrimaryReuseKey(s.slug) !== k,
      );
      return {
        ...slot,
        prefer_primary: item.slug,
        locked_signals: [
          {
            slug: item.slug,
            dimension_id: item.dimension_id,
            fact_hint: item.fact_hint,
          },
          ...rest,
        ],
      };
    }
    return slot;
  });

  return { planned: next, repaired };
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
