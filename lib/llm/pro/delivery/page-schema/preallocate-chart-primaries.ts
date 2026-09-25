/**
 * Non-LLM global chart-term preallocation before Wave A parallel assign.
 *
 * SSOT pool = D1 `buildThesisAssignMenu` (thesis present facts only).
 * Inventory / 神煞 / 十二长生 / 历史大运 never enter the pool.
 * `range` is the full this-chart menu. Every card is fed that range.
 * A lead is only an opening hint so cards do not all start on the same word.
 * Term count is not a quota. Sparse charts → raise reuse cap and/or merge slots.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { inferP4MoatEligibleTypes } from "./p4-means-gate";
import { deepEvidenceUnitSpec } from "./deep-evidence-prompt";
import { resolveDeepEvidenceUnitCount, type PlannedAssignSlot } from "./deep-evidence-assign";
import type { P4MoatMeansType } from "@/lib/glossary/wuxing-semantic-ssot";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import type { ThesisDimensionId } from "@/lib/llm/pro/delivery/thesis/types";
import {
  buildThesisAssignMenu,
  groupAssignMenuByDimension,
  type ThesisAssignMenuItem,
} from "@/lib/llm/pro/delivery/thesis/build-assign-menu";
import {
  isSlugGroundedInThesis,
  slugGroundedInCorpus,
  thesisAllFactsCorpus,
} from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildChartFactPack } from "@/lib/llm/pro/delivery/page-schema/chart-fact-pack";
import {
  castDeliveryQimenFactPack,
  mergeQimenIntoChartFactPackText,
  type DeliveryQimenFactPack,
} from "@/lib/llm/pro/delivery/page-schema/qimen-fact-pack";

export const DEFAULT_PRIMARY_REUSE_CAP = 2;

/** Not load-bearing: placeholder pillar labels and non-bazi tags. */
const NON_LOAD_BEARING_SLUG = /元男|元女|太阳太阴|午午半合/;

export function isNonLoadBearingChartSlug(slug: string): boolean {
  return NON_LOAD_BEARING_SLUG.test(slug.trim());
}

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
  /**
   * page → path → the allowed range for that card (same set as `range`).
   * Index 0 is an opening hint, not a quota. Stored jobs may still hold one string.
   */
  by_page: Partial<
    Record<DeliverySegmentKey, Record<string, string | readonly string[]>>
  >;
  /** This-chart terms the writer may use. Not a per-card budget. */
  range: string[];
  /** Optional reduced slot counts when sparse merge fires */
  slot_count_by_page?: Partial<Record<DeliverySegmentKey, number>>;
  /** Effective per-token reuse cap (may be >2 when sparse) */
  reuse_cap: number;
  /** Unique strong primaries in thesis menu pool */
  unique_strong_primaries: number;
  /** Planned deep slots before merge */
  deep_slots_planned: number;
  /** Actual slots after sparse merge */
  deep_slots_allocated: number;
  sparse_mode: boolean;
  sparse_merge_slots: boolean;
  all_primaries: string[];
  /** Pool provenance. chart_fact_pack is the step-1 source; thesis_menu is legacy. */
  pool_source?: "thesis_menu" | "empty" | "chart_fact_pack";
  /** Full local-calc record for this person. Not a slug menu. */
  chart_fact_pack?: string;
  chart_fact_ganzhi?: string[];
  chart_fact_shen_sha?: string[];
  /**
   * P4 奇门锁盘（Step1）。首次成功算盘写入；之后只读。
   * @see `.cursor/docs/P4-东方谋略-规格锁.md`
   */
  qimen?: DeliveryQimenFactPack;
  /** Mirror of qimen.qimen_cast_at for quick gate checks. */
  qimen_cast_at?: string;
  created_at: number;
};

function normAnchor(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Normalize vernacular / soft-gloss aliases so reuse-cap counts one logical
 * primary (any term — not 大运-only). Encode soft may show 岁环 without
 * double-counting against 流年 / year.
 */
export function normalizePrimaryReuseKey(token: string): string {
  const n = normAnchor(token);
  if (!n) return n;
  if (
    n === "气候交织" ||
    n === "岁环" ||
    n === "流年" ||
    n === "岁运" ||
    n === "year" ||
    n.includes("气候交织")
  ) {
    return "year";
  }
  if (n === "大运" || n === "纪元" || n === "decade" || n === "运程") {
    return "decade";
  }
  return n;
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
    const k = normalizePrimaryReuseKey(t);
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
  const count = forcedCount ?? resolveDeepEvidenceUnitCount(key, 0);
  return Array.from({ length: count }, (_, i) => ({
    path: spec.paths[i] ?? `unit[${i}]`,
    moat_class: null,
  }));
}

function countUses(usedCounts: Map<string, number>, token: string): number {
  return usedCounts.get(normalizePrimaryReuseKey(token)) ?? 0;
}

function bumpUse(usedCounts: Map<string, number>, token: string): void {
  const k = normalizePrimaryReuseKey(token);
  if (!k) return;
  usedCounts.set(k, (usedCounts.get(k) ?? 0) + 1);
}

function emptyPreallocMap(
  planned: number,
  created_at: number,
  qimenOpts?: {
    castAt?: Date;
    existing?: DeliveryQimenFactPack | null;
  },
): ChartPrimaryPreallocMap {
  return attachQimenLockPan(
    {
      version: 1,
      by_page: {},
      reuse_cap: DEFAULT_PRIMARY_REUSE_CAP,
      unique_strong_primaries: 0,
      deep_slots_planned: planned,
      deep_slots_allocated: 0,
      sparse_mode: true,
      sparse_merge_slots: false,
      all_primaries: [],
      pool_source: "empty",
      range: [],
      created_at,
    },
    qimenOpts,
  );
}

/**
 * Attach / refresh locked qimen pan onto a prealloc map.
 * Idempotent when `existing` / map.qimen is already valid.
 */
export function attachQimenLockPan(
  map: ChartPrimaryPreallocMap,
  opts?: {
    castAt?: Date;
    existing?: DeliveryQimenFactPack | null;
  },
): ChartPrimaryPreallocMap {
  const qimen = castDeliveryQimenFactPack({
    castAt: opts?.castAt,
    existing: opts?.existing ?? map.qimen ?? null,
  });
  return {
    ...map,
    qimen,
    qimen_cast_at: qimen.qimen_cast_at,
    chart_fact_pack: mergeQimenIntoChartFactPackText(
      map.chart_fact_pack,
      qimen,
    ),
  };
}

function takeMenuPick(input: {
  menu: readonly ThesisAssignMenuItem[];
  byDim: Map<ThesisDimensionId, ThesisAssignMenuItem[]>;
  usedCounts: Map<string, number>;
  usedDims: Set<ThesisDimensionId>;
  reuseCap: number;
  dimRoundRobin: ThesisDimensionId[];
  rr: { n: number };
}): ThesisAssignMenuItem | null {
  const underCap = (item: ThesisAssignMenuItem) =>
    countUses(input.usedCounts, item.slug) < input.reuseCap;

  const unusedDims = input.dimRoundRobin.filter((d) => !input.usedDims.has(d));
  const order =
    unusedDims.length > 0
      ? [
          ...unusedDims.slice(input.rr.n % Math.max(1, unusedDims.length)),
          ...unusedDims.slice(0, input.rr.n % Math.max(1, unusedDims.length)),
        ]
      : input.dimRoundRobin;

  for (const dim of order) {
    for (const item of input.byDim.get(dim) ?? []) {
      if (!underCap(item)) continue;
      if (countUses(input.usedCounts, item.slug) > 0) continue;
      input.rr.n += 1;
      return item;
    }
  }
  for (const dim of order) {
    for (const item of input.byDim.get(dim) ?? []) {
      if (!underCap(item)) continue;
      input.rr.n += 1;
      return item;
    }
  }
  for (const item of input.menu) {
    if (!underCap(item)) continue;
    return item;
  }
  return null;
}

/** Accept a stored lead string or a term group. */
export function preallocTermsForPath(
  value: string | readonly string[] | null | undefined,
): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    const t = value.trim();
    return t ? [t] : [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const t = raw.trim();
    const k = normalizePrimaryReuseKey(t);
    if (!t || !k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * Assert every allocated primary is precisely grounded in thesis present facts.
 * Relation kind must match corpus text (巳寅相刑 ≠ 巳寅相害).
 */
export function assertPreallocPrimariesGroundedInThesis(
  map: ChartPrimaryPreallocMap,
  thesis: ChartThesis | null | undefined,
): { ok: true } | { ok: false; reason: string; offenders: string[] } {
  if (!thesis?.dimensions?.length) {
    if (map.all_primaries.length === 0) return { ok: true };
    return {
      ok: false,
      reason: "prealloc:no_thesis_with_primaries",
      offenders: map.all_primaries.slice(0, 8),
    };
  }
  const corpus = thesisAllFactsCorpus(thesis);
  const offenders: string[] = [];
  const terms: string[] = [];
  for (const paths of Object.values(map.by_page)) {
    if (!paths) continue;
    for (const value of Object.values(paths)) {
      terms.push(...preallocTermsForPath(value));
    }
  }
  if (terms.length === 0) terms.push(...map.all_primaries);
  for (const p of terms) {
    const t = p.trim();
    if (!t) continue;
    if (!slugGroundedInCorpus(corpus, t) || !isSlugGroundedInThesis(thesis, t)) {
      offenders.push(t);
    }
  }
  if (offenders.length > 0) {
    return {
      ok: false,
      reason: `prealloc:ungrounded:${offenders[0]}`,
      offenders,
    };
  }
  return { ok: true };
}

/**
 * Greedy global primary assignment across deep pages (stable order).
 * Pool = thesis closed menu only (D1 SSOT). No inventory fallback.
 */
export function preallocateChartPrimaries(input: {
  thesis?: ChartThesis | null;
  /** @deprecated Ignored — kept for call-site compat; pool is thesis menu only. */
  category_token_sets?: unknown;
  eastern_calc_slice_by_key?: Partial<
    Record<DeliverySegmentKey, string | null>
  >;
  pages?: readonly DeliverySegmentKey[];
  default_cap?: number;
  /** When set, prealloc publishes this chart's fact pack and does not copy a slug menu. */
  structured?: ProfileStructured | null;
  as_of?: Date;
  timezone?: string;
  /**
   * Qimen lock-pan time (defaults to now on first cast).
   * Pass through when upgrading an existing map without recasting wall-clock.
   */
  qimen_cast_at?: Date;
  /** Prior locked pan — if valid, never recast. */
  existing_qimen?: DeliveryQimenFactPack | null;
}): ChartPrimaryPreallocMap {
  const pages = input.pages ?? PREALLOC_DEEP_PAGES;
  const created_at = Date.now();
  const defaultCap = input.default_cap ?? DEFAULT_PRIMARY_REUSE_CAP;
  const qimenOpts = {
    castAt: input.qimen_cast_at,
    existing: input.existing_qimen ?? null,
  };

  if (input.structured?.day_master?.trim() || input.structured?.four_pillars?.day) {
    const pack = buildChartFactPack(input.structured, {
      as_of: input.as_of,
      timezone: input.timezone,
    });
    let deepSlotsPlanned = 0;
    for (const key of pages) {
      deepSlotsPlanned += planSlotShells(
        key,
        input.eastern_calc_slice_by_key?.[key] ?? null,
      ).length;
    }
    return attachQimenLockPan(
      {
        version: 1,
        by_page: {},
        range: [],
        reuse_cap: defaultCap,
        unique_strong_primaries: 0,
        deep_slots_planned: deepSlotsPlanned,
        deep_slots_allocated: 0,
        sparse_mode: false,
        sparse_merge_slots: false,
        all_primaries: [],
        pool_source: "chart_fact_pack",
        chart_fact_pack: pack.text,
        chart_fact_ganzhi: pack.ganzhi,
        chart_fact_shen_sha: pack.shen_sha,
        created_at,
      },
      qimenOpts,
    );
  }

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

  const rawMenu = buildThesisAssignMenu(input.thesis);
  const loadBearing = rawMenu.filter((m) => !isNonLoadBearingChartSlug(m.slug));
  const menu = loadBearing.length >= 8 ? loadBearing : rawMenu;
  if (menu.length === 0) {
    return emptyPreallocMap(deepSlotsPlanned, created_at, qimenOpts);
  }

  const uniqueStrong = new Set(
    menu.map((m) => normalizePrimaryReuseKey(m.slug)).filter(Boolean),
  ).size;

  let reuseCap = resolveSparsePrimaryReuseCap({
    inventory_size: uniqueStrong,
    slot_count: deepSlotsPlanned,
    default_cap: defaultCap,
  });
  const sparseMode =
    uniqueStrong > 0 && uniqueStrong * defaultCap < deepSlotsPlanned;

  let sparseMerge = false;
  const slotCountByPage: Partial<Record<DeliverySegmentKey, number>> = {};
  if (
    uniqueStrong > 0 &&
    uniqueStrong <= 3 &&
    deepSlotsPlanned > uniqueStrong * reuseCap
  ) {
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
  } else if (sparseMode && uniqueStrong * reuseCap < deepSlotsPlanned) {
    // Soft merge: shrink slots to what thesis menu can cover at reuseCap.
    sparseMerge = true;
    let remaining = uniqueStrong * reuseCap;
    for (const key of pages) {
      const shells = shellsByPage.get(key) ?? [];
      if (remaining <= 0) {
        slotCountByPage[key] = 0;
        shellsByPage.set(key, []);
        continue;
      }
      const reduced = Math.min(shells.length, remaining);
      slotCountByPage[key] = reduced;
      shellsByPage.set(key, shells.slice(0, reduced));
      remaining -= reduced;
    }
  }

  const byDim = groupAssignMenuByDimension(menu);
  const dimRoundRobin = [...byDim.keys()].filter(
    (d) => (byDim.get(d)?.length ?? 0) > 0,
  );
  const usedCounts = new Map<string, number>();
  const usedDims = new Set<ThesisDimensionId>();
  const rr = { n: 0 };
  const by_page: ChartPrimaryPreallocMap["by_page"] = {};
  const all_primaries: string[] = [];
  const range = menu.map((m) => m.slug);

  for (const key of pages) {
    const shells = shellsByPage.get(key) ?? [];
    const pageMap: Record<string, string[]> = {};
    for (const slot of shells) {
      const pick = takeMenuPick({
        menu,
        byDim,
        usedCounts,
        usedDims,
        reuseCap,
        dimRoundRobin,
        rr,
      });
      if (!pick) break;
      const leadKey = normalizePrimaryReuseKey(pick.slug);
      const rest = range.filter(
        (slug) => normalizePrimaryReuseKey(slug) !== leadKey,
      );
      pageMap[slot.path] = [pick.slug, ...rest];
      bumpUse(usedCounts, pick.slug);
      usedDims.add(pick.dimension_id);
      all_primaries.push(pick.slug);
    }
    if (Object.keys(pageMap).length > 0) {
      by_page[key] = pageMap;
    }
  }

  return attachQimenLockPan(
    {
      version: 1,
      by_page,
      range,
      slot_count_by_page: sparseMerge ? slotCountByPage : undefined,
      reuse_cap: reuseCap,
      unique_strong_primaries: uniqueStrong,
      deep_slots_planned: deepSlotsPlanned,
      deep_slots_allocated: all_primaries.length,
      sparse_mode: sparseMode || sparseMerge,
      sparse_merge_slots: sparseMerge,
      all_primaries,
      pool_source: "thesis_menu",
      created_at,
    },
    qimenOpts,
  );
}

/** Diversity ratio check — normal mode only (sparse uses cap validation). */
export function assertSignalDiversity(
  primaries: readonly string[],
  opts: { sparse_mode: boolean; reuse_cap: number },
): { ok: true; unique: number; ratio: number } | { ok: false; reason: string } {
  const cleaned = primaries.map((p) => p.trim()).filter(Boolean);
  const unique = new Set(
    cleaned.map((p) => normalizePrimaryReuseKey(p)).filter(Boolean),
  ).size;
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

export function minPreallocGroupSize(map: ChartPrimaryPreallocMap): number {
  let min = Number.POSITIVE_INFINITY;
  let n = 0;
  for (const paths of Object.values(map.by_page)) {
    if (!paths) continue;
    for (const value of Object.values(paths)) {
      const terms = preallocTermsForPath(value);
      if (terms.length === 0) continue;
      n += 1;
      if (terms.length < min) min = terms.length;
    }
  }
  return n === 0 ? 0 : min;
}

export function reservedPrimariesForPage(
  map: ChartPrimaryPreallocMap,
  excludeKey: DeliverySegmentKey,
): string[] {
  const out: string[] = [];
  for (const [key, paths] of Object.entries(map.by_page)) {
    if (key === excludeKey || !paths) continue;
    for (const value of Object.values(paths)) {
      const lead = preallocTermsForPath(value)[0];
      if (lead) out.push(lead);
    }
  }
  return out;
}

/** Lead only — closed-menu still receives the full group via preallocTermGroups. */
export function preallocPreferByPath(
  map: ChartPrimaryPreallocMap,
  key: DeliverySegmentKey,
): Record<string, string> {
  const page = map.by_page[key] ?? {};
  const out: Record<string, string> = {};
  for (const [path, value] of Object.entries(page)) {
    const lead = preallocTermsForPath(value)[0];
    if (lead) out[path] = lead;
  }
  return out;
}

/** Full this-chart term group per path (lead first). */
export function preallocTermGroups(
  map: ChartPrimaryPreallocMap,
  key: DeliverySegmentKey,
): Record<string, string[]> {
  const page = map.by_page[key] ?? {};
  const out: Record<string, string[]> = {};
  for (const [path, value] of Object.entries(page)) {
    const terms = preallocTermsForPath(value);
    if (terms.length > 0) out[path] = terms;
  }
  return out;
}
