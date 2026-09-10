/**
 * Deep-evidence Call 0 — assign path → moat_class (P4) + chart_anchors only.
 * No long evidence. Delivery-phase only.
 */

import { callLLM } from "@/lib/llm/router";
import { extractJson } from "@/lib/base-analysis-v2/compute/compute-call";
import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { deliveryTransportMaxAttempts } from "@/lib/llm/pro/delivery/delivery-retry-policy";
import { PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS } from "@/lib/llm/pro/delivery/delivery-tasks";
import type { P4MoatMeansType } from "@/lib/glossary/wuxing-semantic-ssot";
import { inferP4MoatEligibleTypes } from "./p4-means-gate";
import {
  deepEvidenceUnitSpec,
  type DeepEvidencePromptOpts,
} from "./deep-evidence-prompt";
import { pageEvidenceUnitBounds } from "./evidence-unit-soft-cap";
import {
  isSlugGroundedInThesis,
  softStripUngroundedThesisSignals,
  thesisAllFactsCorpus,
  validateAssignmentThesisCoverage,
  resolveSlugToThesisToken,
  HOLLOW_STRUCTURAL_SLUGS,
} from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import { extendThesisDimension } from "@/lib/llm/pro/delivery/thesis/extend-thesis-dimension";
import { formatChartThesisForPrompt } from "@/lib/llm/pro/delivery/thesis/format-for-prompt";
import { isThesisDimensionId } from "./assign-necessary-signals";
import {
  DEEP_EVIDENCE_ANCHOR_JACCARD_MAX,
  maxAssignmentAnchorJaccard,
} from "./deep-evidence-quality";
import {
  ANCHOR_DIVERSITY_CATEGORIES,
  formatAnchorCategoryUsageForPrompt,
  tallyAnchorCategoryUsage,
  type AnchorCategoryId,
  type CategoryTokenSets,
} from "./anchor-category-tally";
import { formatLayerBInventoryMenu } from "./layer-b-inventory-menu";
import {
  feedForAssignKey,
  parseAssignPathHintsFromFeed,
  type AssignPathHint,
} from "./assign-binding-seed";
import {
  anchorsFromNecessarySignals,
  buildAssignNecessarySignalsFewShotBlock,
  parseNecessarySignals,
  parseRemovalTest,
  softRepairNecessarySignals,
  splitUnitClaim,
  validateNecessarySignalsContract,
  hanPathTag,
  type NecessarySignal,
  type PriorSignalRole,
  type RemovalTest,
  MAX_NECESSARY_SIGNALS,
} from "./assign-necessary-signals";
import {
  DEFAULT_PRIMARY_REUSE_CAP,
  normalizePrimaryReuseKey,
  validatePrimaryReuseCap,
} from "./preallocate-chart-primaries";

export type { AssignPathHint } from "./assign-binding-seed";
export { parseAssignPathHintsFromFeed } from "./assign-binding-seed";

/** Planned slot before LLM — path/moat locked; prefer_* seeded for quality-by-construction. */
export type PlannedAssignSlot = {
  path: string;
  moat_class?: P4MoatMeansType | null;
  prefer_primary?: string;
  prefer_candidate_ref?: string;
  prefer_cite?: string;
  prefer_claim?: string;
};

export type PlanDeepEvidenceSlotsOpts = {
  eastern_calc_slice?: string | null;
  foundation_surface_feed?: string | null;
  science_means_feed?: string | null;
  metaphysics_moat_feed?: string | null;
  risk_fuse_feed?: string | null;
  close_ritual_feed?: string | null;
  category_token_sets?: CategoryTokenSets | null;
  prior_chart_anchors?: readonly string[];
  /** Prior pages' slug+role fingerprints — blocks 流展-style cross-page copy. */
  prior_signal_roles?: readonly PriorSignalRole[];
  /** Global prealloc primaries reserved by other pages/paths (normalized via seed). */
  reserved_chart_primaries?: readonly string[];
  /** Path → prefer_primary from job-level prealloc map. */
  prealloc_prefer_by_path?: Readonly<Record<string, string>>;
  /** Sparse merge: max units for this page. */
  prealloc_max_units?: number;
  /** Optional explicit hints (e.g. from buildScienceAssignPathHints). */
  assign_path_hints?: readonly AssignPathHint[];
  /** Page key — selects which feed to parse for hints. */
  key?: DeliverySegmentKey;
  /** When set, prefer_primary / inventory picks must ground in thesis facts. */
  chart_thesis?: ChartThesis | null;
};

/** @deprecated alias — use PlanDeepEvidenceSlotsOpts */
export type PlanAssignOpts = PlanDeepEvidenceSlotsOpts;

function normAnchor(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

export type DeepEvidenceAssignmentUnit = {
  path: string;
  chart_anchors: string[];
  /** P4 only — locked before write so archetype cannot be squeezed out. */
  moat_class?: P4MoatMeansType | null;
  /** Short quote from 真算料 / risk calc (≤80 chars) — Write must open from this. */
  calc_cite: string;
  /** Menu line id or short label (e.g. 时机候选1 / 科学维2) for Fill means growth. */
  means_candidate_ref: string;
  /** One-line structural claim this unit must prove. */
  unit_claim: string;
  /** Load-bearing signals (quantity is judged, not a fixed target). */
  necessary_signals?: NecessarySignal[];
  removal_test?: RemovalTest;
  signal_count_rationale?: string;
  /** Split-claim / spot-check flags when >4 cannot converge. */
  needs_human_spotcheck?: boolean;
  unsplittable?: boolean;
};

export type DeepEvidenceAssignment = {
  page: DeliverySegmentKey;
  units: DeepEvidenceAssignmentUnit[];
};

/** Assign-time: anchors must already carry the moat class (before write). */
const MOAT_ASSIGN_ANCHOR_HINT: Record<P4MoatMeansType, string> = {
  timing: "≥1 词须匹配 /大运|流年|岁环|岁运|交运|起运|运程/（可另加辅锚；气候交织仅白话别名，勿作未注册真词槽）",
  polarity: "≥1 词须匹配 /用神|忌神|喜神|身弱|身强|补泄|五行/（可另加辅锚）",
  archetype: "≥1 词须为十神/格局角色（比肩劫财食伤财官杀印等）",
};

/**
 * True when locked chart_anchors already serve the unit's moat_class.
 * Timing must cite a phase token at assign — write cannot invent 大运 from 食神 alone.
 */
export function anchorsServeMoatClass(
  anchors: readonly string[],
  moat: P4MoatMeansType,
): boolean {
  const blob = anchors.join(" ");
  if (moat === "timing") {
    return /大运|流年|岁运|气候交织|交运|起运|运程|岁环|纪元/.test(blob);
  }
  if (moat === "polarity") {
    return /用神|忌神|喜神|身弱|身强|补泄|五行/.test(blob);
  }
  return /(比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印|十神|官杀|格局)/.test(
    blob,
  );
}

/** Returns first failing path reason, or null if all moat slots ok. */
export function validateAssignmentMoatAnchors(
  assignment: DeepEvidenceAssignment,
): string | null {
  for (const u of assignment.units) {
    const moat = u.moat_class;
    if (!moat) continue;
    if (!anchorsServeMoatClass(u.chart_anchors, moat)) {
      return `moat_anchor_mismatch:${u.path}:${moat}`;
    }
  }
  return null;
}

/**
 * Within-page units must not share nearly-identical chart_anchors sets.
 * Backstop only — prefer seeding + applyPreferBindingLocks so this rarely fires.
 */
export function validateAssignmentAnchorDiversity(
  assignment: DeepEvidenceAssignment,
): string | null {
  if (assignment.units.length < 3) return null;
  const maxJ = maxAssignmentAnchorJaccard(assignment.units);
  if (maxJ >= DEEP_EVIDENCE_ANCHOR_JACCARD_MAX) {
    return `anchor_reuse_jaccard:${maxJ.toFixed(2)}`;
  }
  return null;
}

/** Inventory pool ordered for underused categories (moat-aware when set). */
export function buildInventoryPrimaryPool(
  sets: CategoryTokenSets | null | undefined,
  alreadyUsed: ReadonlySet<string>,
  moat?: P4MoatMeansType | null,
): string[] {
  if (!sets) return [];
  const priorList = [...alreadyUsed];
  const tally = tallyAnchorCategoryUsage(priorList, sets);

  let cats: AnchorCategoryId[] = [...ANCHOR_DIVERSITY_CATEGORIES].sort(
    (a, b) => tally.byCategory[a].count - tally.byCategory[b].count,
  );
  if (moat === "timing") {
    cats = ["dayun", ...cats.filter((c) => c !== "dayun"), "core_structure"];
  } else if (moat === "archetype") {
    cats = ["ten_god", ...cats.filter((c) => c !== "ten_god"), "core_structure"];
  } else if (moat === "polarity") {
    cats = ["core_structure", ...cats];
  } else {
    cats = [...cats, "core_structure"];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of alreadyUsed) {
    const k = normalizePrimaryReuseKey(u);
    if (k) seen.add(k);
  }
  const push = (t: string) => {
    const n = normalizePrimaryReuseKey(t);
    if (!n || seen.has(n)) return;
    if (moat === "timing" && !/大运|流年|岁运|气候交织|交运|起运|运程|岁环|纪元/.test(t)) {
      return;
    }
    if (
      moat === "polarity" &&
      !/用神|忌神|喜神|身弱|身强|补泄|五行/.test(t)
    ) {
      // Still allow core tokens later via non-moat fallback below
      return;
    }
    if (
      moat === "archetype" &&
      !/(比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印|十神|官杀|格局)/.test(t)
    ) {
      return;
    }
    seen.add(n);
    out.push(t.trim());
  };

  for (const cat of cats) {
    for (const t of sets[cat]) push(t);
  }

  // Polarity fallback: any core_structure if regex-filtered pool empty
  if (moat === "polarity" && out.length === 0) {
    for (const t of sets.core_structure) {
      const n = normalizePrimaryReuseKey(t);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(t.trim());
    }
  }
  return out;
}

/**
 * Attach unique prefer_primary + cite/claim/ref per path from feed hints + inventory.
 * Construction-first: diversify and thicken bindings before the model writes.
 * With chart_thesis: never seed 神煞/长生等总纲未验证词作 prefer_primary.
 */
export function seedPlannedBindings(
  planned: readonly PlannedAssignSlot[],
  opts: PlanAssignOpts,
): PlannedAssignSlot[] {
  const thesis = opts.chart_thesis ?? null;
  const thesisCorpus = thesis?.dimensions?.length
    ? thesisAllFactsCorpus(thesis)
    : "";

  const acceptPrimary = (raw: string | undefined): string | undefined => {
    const p = raw?.trim();
    if (!p) return undefined;
    if (!thesis || thesis.dimensions.length === 0 || !thesisCorpus) return p;
    if (!isSlugGroundedInThesis(thesis, p)) return undefined;
    const resolved = resolveSlugToThesisToken(thesisCorpus, p);
    if (!resolved || HOLLOW_STRUCTURAL_SLUGS.has(resolved)) return undefined;
    return resolved;
  };

  const feedText =
    (opts.key ? feedForAssignKey(opts.key, opts) : null) ??
    opts.science_means_feed ??
    opts.foundation_surface_feed ??
    opts.metaphysics_moat_feed ??
    opts.risk_fuse_feed ??
    opts.close_ritual_feed ??
    null;
  const fromFeed = parseAssignPathHintsFromFeed(feedText);
  const hintByPath = new Map<string, AssignPathHint>();
  for (const h of [...fromFeed, ...(opts.assign_path_hints ?? [])]) {
    if (
      h.path &&
      (h.prefer_primary?.trim() ||
        h.prefer_candidate_ref?.trim() ||
        h.prefer_cite?.trim() ||
        h.prefer_claim?.trim())
    ) {
      hintByPath.set(h.path, h);
    }
  }

  const used = new Set(
    [
      ...(opts.prior_chart_anchors ?? []),
      ...(opts.reserved_chart_primaries ?? []),
    ]
      .map((t) => normalizePrimaryReuseKey(t))
      .filter(Boolean),
  );

  return planned.map((slot) => {
    const hint = hintByPath.get(slot.path);
    const preallocPrimary = acceptPrimary(
      opts.prealloc_prefer_by_path?.[slot.path],
    );
    let primary =
      preallocPrimary || acceptPrimary(hint?.prefer_primary) || undefined;
    if (primary && used.has(normalizePrimaryReuseKey(primary)) && !preallocPrimary) {
      primary = undefined;
    }
    // Prealloc wins even if reserved (it owns this path's quota).
    if (preallocPrimary) {
      primary = preallocPrimary;
    } else if (primary && used.has(normalizePrimaryReuseKey(primary))) {
      primary = undefined;
    }
    if (!primary) {
      const pool = buildInventoryPrimaryPool(
        opts.category_token_sets,
        used,
        slot.moat_class,
      )
        .map((t) => acceptPrimary(t))
        .filter((t): t is string => Boolean(t));
      primary = pool.find((t) => !used.has(normalizePrimaryReuseKey(t)));
    }
    if (primary) used.add(normalizePrimaryReuseKey(primary));
    return {
      ...slot,
      prefer_primary: primary ?? undefined,
      prefer_candidate_ref:
        hint?.prefer_candidate_ref?.trim() || slot.prefer_candidate_ref,
      prefer_cite: hint?.prefer_cite?.trim() || slot.prefer_cite,
      prefer_claim: hint?.prefer_claim?.trim() || slot.prefer_claim,
    };
  });
}

/** @deprecated use seedPlannedBindings */
export function seedPlannedPreferPrimaries(
  planned: readonly PlannedAssignSlot[],
  opts: PlanAssignOpts,
): PlannedAssignSlot[] {
  return seedPlannedBindings(planned, opts);
}

const CITE_MIN = 12;
const CLAIM_MIN = 16;
const REF_MIN = 2;

/**
 * Lock chart_anchors[0] + fill thin calc_cite / unit_claim / means_candidate_ref.
 * Moat conflict skips primary move only — still fills ref/cite/claim.
 * Prefer is only applied when it already appears in necessary_signals
 * (never re-inject 金舆等影子 prefer 覆盖 signals 投影).
 */
export function applyPreferBindingLocks(
  assignment: DeepEvidenceAssignment,
  planned: readonly PlannedAssignSlot[],
): DeepEvidenceAssignment {
  const byPath = new Map(planned.map((p) => [p.path, p]));
  const units = assignment.units.map((u) => {
    const slot = byPath.get(u.path);
    let next: DeepEvidenceAssignmentUnit = { ...u };

    const ref = slot?.prefer_candidate_ref?.trim();
    if (ref && next.means_candidate_ref.trim().length < REF_MIN) {
      next = { ...next, means_candidate_ref: ref.slice(0, 48) };
    }

    const cite = slot?.prefer_cite?.trim();
    if (cite && next.calc_cite.trim().length < CITE_MIN) {
      next = { ...next, calc_cite: cite.slice(0, 80) };
    }

    const claim = slot?.prefer_claim?.trim();
    if (claim && next.unit_claim.trim().length < CLAIM_MIN) {
      next = { ...next, unit_claim: claim.slice(0, 120) };
    }

    const prefer = slot?.prefer_primary?.trim();
    if (!prefer) {
      // Always keep anchors = signal slug projection when signals exist.
      if (next.necessary_signals?.length) {
        return {
          ...next,
          chart_anchors: anchorsFromNecessarySignals(next.necessary_signals),
        };
      }
      return next;
    }

    const signalSlugs = (next.necessary_signals ?? []).map((s) => s.slug.trim());
    const preferInSignals = signalSlugs.some(
      (a) =>
        normAnchor(a) === normAnchor(prefer) ||
        a.includes(prefer) ||
        prefer.includes(a),
    );
    if (!preferInSignals) {
      if (next.necessary_signals?.length) {
        return {
          ...next,
          chart_anchors: anchorsFromNecessarySignals(next.necessary_signals),
        };
      }
      return next;
    }

    const anchors = [...next.chart_anchors];
    const idx = anchors.findIndex(
      (a) =>
        normAnchor(a) === normAnchor(prefer) ||
        a.includes(prefer) ||
        prefer.includes(a),
    );
    let locked: string[];
    if (idx === 0) {
      locked = anchors;
    } else if (idx > 0) {
      const [hit] = anchors.splice(idx, 1);
      locked = [hit!, ...anchors].slice(0, 4);
    } else {
      locked = [
        prefer,
        ...anchors.filter((a) => normAnchor(a) !== normAnchor(prefer)),
      ].slice(0, 4);
    }

    if (u.moat_class && !anchorsServeMoatClass(locked, u.moat_class)) {
      return next;
    }
    return { ...next, chart_anchors: locked };
  });
  return { ...assignment, units };
}

/** @deprecated use applyPreferBindingLocks */
export function applyPreferPrimaryLocks(
  assignment: DeepEvidenceAssignment,
  planned: readonly PlannedAssignSlot[],
): DeepEvidenceAssignment {
  return applyPreferBindingLocks(assignment, planned);
}

/**
 * Cap each unit to primary + at most one aux that is not another unit's primary.
 * Prevents Jaccard≥0.85 from identical aux stacks under distinct primaries.
 */
/**
 * Drop aux that collide with other units' primaries; when a substitute pool is
 * provided, replace dropped aux with an unused pool token (never silent empty).
 */
export function slimSharedAuxAnchors<T extends { chart_anchors: string[] }>(
  units: readonly T[],
  substitutePool?: readonly string[],
): T[] {
  const primaryNorms = new Set(
    units
      .map((u) => normAnchor(u.chart_anchors[0] ?? ""))
      .filter(Boolean),
  );
  const used = new Set(primaryNorms);
  return units.map((u) => {
    const primary = u.chart_anchors[0]?.trim();
    if (!primary) return { ...u, chart_anchors: [...u.chart_anchors] };
    const keptAux = u.chart_anchors
      .slice(1)
      .map((a) => a.trim())
      .filter((a) => {
        const n = normAnchor(a);
        return Boolean(n) && !primaryNorms.has(n) && n !== normAnchor(primary);
      })
      .slice(0, 1);
    if (keptAux.length > 0) {
      used.add(normAnchor(keptAux[0]!));
      return { ...u, chart_anchors: [primary, ...keptAux] };
    }
    // Need a substitute aux if we had extras that were all stripped
    const hadExtras = u.chart_anchors.length > 1;
    if (!hadExtras || !substitutePool?.length) {
      return { ...u, chart_anchors: [primary] };
    }
    let sub: string | undefined;
    for (const p of substitutePool) {
      const t = p.trim();
      const n = normAnchor(t);
      if (!n || used.has(n) || n === normAnchor(primary)) continue;
      sub = t;
      used.add(n);
      break;
    }
    return { ...u, chart_anchors: sub ? [primary, sub] : [primary] };
  });
}

/**
 * Force diversify chart_anchors[0] under reuse cap (construction repair, no LLM).
 * When `allowed_primaries` is set (job prealloc), only swap within that table —
 * never invent out-of-pool anchors for fake diversity.
 *
 * `prior_reuse_tokens` seeds the cap counter (cross-page any-primary:N>cap)
 * using the same {@link normalizePrimaryReuseKey} as quality / prealloc.
 */
export function forceDiversifyChartAnchors<T extends { chart_anchors: string[] }>(
  units: readonly T[],
  pool: readonly string[],
  opts?: {
    /** Prealloc / reserved primaries — exclusive candidate set when non-empty */
    allowed_primaries?: readonly string[];
    /** Max times the same primary may appear across units (default unique / 1 for page-local) */
    reuse_cap?: number;
    /**
     * Tokens already counted toward the job-wide reuse cap (typically prior pages'
     * anchors). Seeded before this page's units are assigned.
     */
    prior_reuse_tokens?: readonly string[];
  },
): T[] {
  const allowed = (opts?.allowed_primaries ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  const reuseCap = Math.max(1, opts?.reuse_cap ?? 1);
  const usedCounts = new Map<string, number>();

  const reuseKey = (t: string): string => normalizePrimaryReuseKey(t);

  for (const raw of opts?.prior_reuse_tokens ?? []) {
    const k = reuseKey(raw);
    if (!k) continue;
    usedCounts.set(k, (usedCounts.get(k) ?? 0) + 1);
  }

  const inAllowed = (n: string): boolean => {
    if (allowed.length === 0) return true;
    return allowed.some((a) => reuseKey(a) === n || normAnchor(a) === n);
  };

  // When prealloc reserved is set, never leave that table for fake diversity.
  const seenPool = new Set<string>();
  const effectivePool: string[] = [];
  const source = allowed.length > 0 ? allowed : pool;
  for (const p of source) {
    const t = p.trim();
    const n = reuseKey(t);
    if (!n || seenPool.has(n)) continue;
    seenPool.add(n);
    effectivePool.push(t);
  }

  const canTake = (n: string): boolean => (usedCounts.get(n) ?? 0) < reuseCap;
  const markTake = (n: string) => usedCounts.set(n, (usedCounts.get(n) ?? 0) + 1);

  const takeFrom = (candidates: readonly string[], preferred?: string): string | undefined => {
    if (preferred?.trim()) {
      const n = reuseKey(preferred);
      if (n && canTake(n) && (allowed.length === 0 || inAllowed(n))) {
        markTake(n);
        return preferred.trim();
      }
    }
    for (const p of candidates) {
      const t = p.trim();
      const n = reuseKey(t);
      if (!n || !canTake(n)) continue;
      markTake(n);
      return t;
    }
    return undefined;
  };

  const take = (preferred?: string): string | undefined => {
    const hit = takeFrom(effectivePool, preferred);
    if (hit) return hit;
    // Prior pages already saturated allowed table — fall back to full pool under cap
    // so merge quality can still clear deep_evidence_primary_reuse_cap.
    if (allowed.length > 0 && pool.length > 0) {
      return takeFrom(pool, preferred);
    }
    return undefined;
  };

  const flatExisting = units.flatMap((u) => u.chart_anchors);
  const extendedPool = [
    ...effectivePool,
    ...flatExisting.filter((a) => inAllowed(reuseKey(a)) || allowed.length === 0),
  ];

  return units.map((u) => {
    const primary =
      take(u.chart_anchors[0]) ?? take(undefined) ?? u.chart_anchors[0]?.trim();
    if (!primary) return { ...u, chart_anchors: [...u.chart_anchors] };
    let aux: string | undefined;
    for (const a of u.chart_anchors.slice(1)) {
      const n = reuseKey(a);
      if (n && n !== reuseKey(primary) && (allowed.length === 0 || inAllowed(n))) {
        aux = a.trim();
        break;
      }
    }
    if (!aux) {
      for (const p of extendedPool) {
        const n = reuseKey(p);
        if (n && n !== reuseKey(primary) && (allowed.length === 0 || inAllowed(n))) {
          aux = p.trim();
          break;
        }
      }
    }
    return {
      ...u,
      chart_anchors: aux ? [primary, aux] : [primary],
    };
  });
}

/**
 * Source-side primary reuse: prior pages + this page's chart_anchors[0] must
 * stay under the job cap (default 2). Prefer local diversify over merge reject.
 */
export function enforceAssignmentPrimaryReuseCap(
  assignment: DeepEvidenceAssignment,
  opts?: {
    prior_primaries?: readonly string[];
    pool?: readonly string[];
    allowed_primaries?: readonly string[];
    reuse_cap?: number;
  },
): {
  assignment: DeepEvidenceAssignment;
  repaired: boolean;
  /** Set when still over cap after local diversify */
  fail_reason?: string;
} {
  const cap = Math.max(1, opts?.reuse_cap ?? DEFAULT_PRIMARY_REUSE_CAP);
  const prior = (opts?.prior_primaries ?? []).map((x) => x.trim()).filter(Boolean);
  const pagePrimaries = assignment.units
    .map((u) => u.chart_anchors[0]?.trim() ?? "")
    .filter(Boolean);
  const before = validatePrimaryReuseCap([...prior, ...pagePrimaries], { cap });
  if (before.ok) {
    return { assignment, repaired: false };
  }

  const pool = [
    ...(opts?.pool ?? []),
    ...assignment.units.flatMap((u) => u.chart_anchors),
  ];
  const diversified = forceDiversifyChartAnchors(assignment.units, pool, {
    allowed_primaries: opts?.allowed_primaries,
    reuse_cap: cap,
    prior_reuse_tokens: prior,
  });
  const slimmed = slimSharedAuxAnchors(diversified, pool);
  const units = slimmed.map((u) => {
    const primary = u.chart_anchors[0]?.trim();
    if (!primary) return u;
    const signals = u.necessary_signals;
    if (!signals?.length) return u;
    const nextSignals = signals.map((s, i) =>
      i === 0 ? { ...s, slug: primary } : s,
    );
    return {
      ...u,
      necessary_signals: nextSignals,
      chart_anchors: [
        primary,
        ...u.chart_anchors
          .slice(1)
          .filter((a) => normalizePrimaryReuseKey(a) !== normalizePrimaryReuseKey(primary)),
      ].slice(0, 4),
    };
  });
  const next: DeepEvidenceAssignment = { ...assignment, units };
  const afterPrimaries = next.units
    .map((u) => u.chart_anchors[0]?.trim() ?? "")
    .filter(Boolean);
  const after = validatePrimaryReuseCap([...prior, ...afterPrimaries], { cap });
  if (!after.ok) {
    return {
      assignment: next,
      repaired: true,
      fail_reason: after.reason,
    };
  }
  return { assignment: next, repaired: true };
}

/** Deterministic round-robin so every eligible moat class gets ≥1 unit. */
export function distributeP4MoatTargets(
  eligible: ReadonlySet<P4MoatMeansType>,
  unitCount: number,
): Array<P4MoatMeansType | null> {
  const n = Math.max(1, unitCount);
  const list = [...eligible];
  if (list.length === 0) return Array.from({ length: n }, () => null);
  const out: Array<P4MoatMeansType | null> = Array.from({ length: n }, () => null);
  // First pass: one slot per eligible class
  for (let i = 0; i < list.length && i < n; i++) {
    out[i] = list[i]!;
  }
  // Remainder: continue round-robin
  for (let i = list.length; i < n; i++) {
    out[i] = list[i % list.length]!;
  }
  return out;
}

/** P4 default unit count: enough to cover eligible classes without monolithic 6. */
export function resolveDeepEvidenceUnitCount(
  key: DeliverySegmentKey,
  eligibleSize: number,
): number {
  const spec = deepEvidenceUnitSpec(key);
  if (key === "metaphysics_action") {
    const target = Math.max(spec.min, Math.min(spec.max, Math.max(3, eligibleSize * 2)));
    return target;
  }
  return Math.min(spec.max, Math.max(spec.min, spec.paths.length));
}

export function chunkPaths<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) {
    out.push([...items.slice(i, i + n)]);
  }
  return out;
}

export function buildDeepEvidenceAssignPrompt(
  key: DeliverySegmentKey,
  opts: DeepEvidencePromptOpts,
  planned: readonly PlannedAssignSlot[],
): { system: string; user: string } {
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const tally = tallyAnchorCategoryUsage(
    opts.prior_chart_anchors ?? [],
    opts.category_token_sets,
  );
  const layerA = formatAnchorCategoryUsageForPrompt(tally);
  const layerB = formatLayerBInventoryMenu(opts.category_token_sets);

  const planLines = planned
    .map((p, i) => {
      const bits: string[] = [`path=${p.path}`];
      if (p.moat_class) bits.push(`moat_class=${p.moat_class}`);
      if (p.prefer_primary) bits.push(`prefer_primary=${p.prefer_primary}`);
      if (p.prefer_candidate_ref) {
        bits.push(`prefer_candidate_ref=${p.prefer_candidate_ref}`);
      }
      if (p.prefer_cite) bits.push(`prefer_cite=${p.prefer_cite}`);
      if (p.prefer_claim) bits.push(`prefer_claim=${p.prefer_claim}`);
      return `${i + 1}. ${bits.join(" ")}`;
    })
    .join("\n");

  const system = `# 你是谁
你是交付页【深度依据·派工】专员。为每个 path 锁路由绑定（锚 + 真算摘录 + 主张 + 菜单回溯），不写长 evidence。

# 边界（硬）
- 【不写】长 evidence / 白话正文 / means 正文。
- 【每条 unit 必填】necessary_signals(1–${MAX_NECESSARY_SIGNALS}) + removal_test + signal_count_rationale + calc_cite + means_candidate_ref + unit_claim。
- chart_anchors = necessary_signals[].slug 的有序投影（代码会强制对齐）；数量由本段结论决定，**禁止**为凑数写死「目标3个」。
- necessary_signals 字段：slug（必填）+ role + why_needed；**有命盘总纲时 dimension_id + inference_zh 必填**（六维闭集；inference 针对本 claim，禁粘贴 conclusion_zh）。
- **总纲接地（硬）**：slug 必须能在所引 dimension 的 classical_basis（present）/ usable_claims_hint / strength_verdict 原文中找到；禁止用总纲未验证的神煞/十二长生/历史大运步承重。维标错（如巳寅相刑标成 cycle_rhythm）代码会 thesis_gap。
- **禁止空壳 slug**：不要写「大运/流年/用神/喜神/忌神/日主」单独承重；必须落到总纲具体词核（如丁酉、丙午、水、正官、身弱）。
- **禁止合盘式推理**：不得用盘主十神/神煞推断**第三者**（伙伴/家人/旧部）的动机、期望或决定；只解释盘主自己的结构与行为惯性（含「伙伴期望…」亦禁）。
- 同 slug 跨本页 necessary_signals 合计不得超过 2 次（代码会剥超额）；宁换未超限的总纲真词。
- 同 dimension_id 跨页禁止近似 inference_zh（代码 Jaccard 闸）；同 slug 仍禁近似 role。
- calc_cite：优先跟派工表 prefer_cite（可润色，禁止换成空泛句）；否则从真算料/熔断料/候选菜单摘 ≤80 字。
- means_candidate_ref：若有 prefer_candidate_ref **必须用之**；否则用菜单短标签。
- unit_claim：优先跟 prefer_claim（可润色勿空泛）；一句「本单元要证的结构主张」。
- 若派工表有 prefer_primary：**necessary_signals[0].slug / chart_anchors[0] 必须等于该词**（其余信号可另选，跨 path 主承重词勿撞车）。无 prefer_primary 时，主承重必须从总纲已验证事实中选。
- **跨页主承重复用（任意真词）**：与已就绪页合计，同一 reuse key 的 chart_anchors[0] 不得超过 reuse_cap（默认 2）。别名同键（如 大运/纪元、流年/岁环/气候交织）只计一次；宁换库存真词，勿堆同一主承重。
- 若给定 moat_class：锚点必须服务该类——**至少 1 个主承重词对上类**：
  - timing → ${MOAT_ASSIGN_ANCHOR_HINT.timing}
  - polarity → ${MOAT_ASSIGN_ANCHOR_HINT.polarity}
  - archetype → ${MOAT_ASSIGN_ANCHOR_HINT.archetype}
- 【扫料范围】moat/绑定可从**整份**真算料点词，禁止「dimensions[i] 只能用第 i 条段落」——但 **necessary_signals 承重仍必须总纲接地**。
- 真词来自闭集菜单且须总纲可证；禁止编造；跨 path 主承重词错开（代码已给 prefer_* 时直接跟表）。
- 【推理纪律】禁止逐维长篇推演。点完立刻输出 JSON。
- 输出严格 JSON，无 markdown 围栏。

${buildAssignNecessarySignalsFewShotBlock()}

# 输出形状
{
  "page": "${key}",
  "units": [
    {
      "path": "${planned[0]?.path ?? "unit[0]"}",
      "unit_claim": "${planned[0]?.prefer_claim ?? "本单元要证的一句结构主张"}",
      "necessary_signals": [
        { "slug": "${planned[0]?.prefer_primary ?? "真词"}", "dimension_id": "resource_pattern", "inference_zh": "针对本 claim 从该维推出的新推论（禁粘贴 conclusion_zh）", "role": "本信号在本段解释的具体子命题", "why_needed": "去掉此信号后，论证会断在哪一步" }
      ],
      "removal_test": { "passed": true, "notes": "各信号互补、无冗余" },
      "signal_count_rationale": "为何是这个数量（不是凑数）",
      "chart_anchors": ["${planned[0]?.prefer_primary ?? "真词"}"],
      "calc_cite": "${planned[0]?.prefer_cite ?? "真算短摘录"}",
      "means_candidate_ref": "${planned[0]?.prefer_candidate_ref ?? "菜单短标签"}"
    }
  ]
}
- units 条数允许 ${pageEvidenceUnitBounds(key).min}–${planned.length}（不必凑满）；path 必须属于派工表。`;

  const userParts: string[] = [
    `## 本页\n固定标签【${tag}】 · key=${key}`,
    `## 本页 core_conclusion\n${opts.core_conclusion.trim() || "(空)"}`,
    `## 派工表（锁死 path / moat / prefer_* 四元组；你填锚+绑定）\n${planLines}`,
  ];
  if (opts.eastern_calc_slice?.trim()) {
    userParts.push(`## 本地真算料\n${opts.eastern_calc_slice.trim()}`);
  }
  if (opts.risk_calc_slice?.trim()) {
    userParts.push(`## 熔断算料\n${opts.risk_calc_slice.trim()}`);
  }
  if (opts.question_expectation?.trim()) {
    userParts.push(`## 问题与期望\n${opts.question_expectation.trim()}`);
  }
  if (key === "foundation" && opts.foundation_surface_feed?.trim()) {
    userParts.push(opts.foundation_surface_feed.trim());
  }
  if (key === "science_action" && opts.science_means_feed?.trim()) {
    userParts.push(opts.science_means_feed.trim());
  }
  if (key === "metaphysics_action" && opts.metaphysics_moat_feed?.trim()) {
    userParts.push(opts.metaphysics_moat_feed.trim());
  }
  if (key === "risk_guard" && opts.risk_fuse_feed?.trim()) {
    userParts.push(opts.risk_fuse_feed.trim());
  }
  if (key === "signals_close" && opts.close_ritual_feed?.trim()) {
    userParts.push(opts.close_ritual_feed.trim());
  }
  if (
    (key === "risk_guard" || key === "signals_close") &&
    opts.action_brief_block?.trim()
  ) {
    userParts.push(opts.action_brief_block.trim());
  }
  if (opts.structured_inventory?.trim()) {
    if (opts.chart_thesis_block?.trim()) {
      userParts.push(
        `【闭集·对照用】\n${opts.structured_inventory.trim()}\n\n（有命盘总纲时：神煞/十二长生/历史大运步若未出现在下方总纲 present 事实中，禁止写入 necessary_signals / chart_anchors。闭集≠可承重白名单。）`,
      );
    } else {
      userParts.push(`【闭集】\n${opts.structured_inventory.trim()}`);
    }
  }
  if (opts.chart_thesis_block?.trim()) {
    userParts.push(opts.chart_thesis_block.trim());
  }
  userParts.push(layerA, layerB);
  if (opts.prior_signal_roles && opts.prior_signal_roles.length > 0) {
    const lines = opts.prior_signal_roles
      .slice(0, 40)
      .map((r) => {
        const dim = r.dimension_id ? ` | dim=${r.dimension_id}` : "";
        const inf = r.inference_zh
          ? ` | inference=${r.inference_zh.slice(0, 60)}`
          : "";
        return `- ${r.page ?? "?"}/${r.path ?? "?"}: slug=${r.slug}${dim}${inf} | role=${r.role.slice(0, 80)}`;
      })
      .join("\n");
    userParts.push(
      `## 他页已用信号角色（同 slug 禁近似 role；同 dimension_id 禁近似 inference_zh）\n${lines}`,
    );
  }
  userParts.push(
    `## 输出\n只输出 JSON：page="${key}", units 长度 ${pageEvidenceUnitBounds(key).min}–${planned.length}（可少于上限），每条 path+necessary_signals+removal_test+signal_count_rationale+chart_anchors+calc_cite+means_candidate_ref+unit_claim。`,
  );

  return { system, user: userParts.join("\n\n") };
}

function trimAssignField(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, max);
}

/** Detect claim that needs split when necessary_signals > hard cap. */
function detectOversizedNecessarySignals(
  raw: unknown,
): { path: string; claim: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const list = Array.isArray((raw as { units?: unknown }).units)
    ? ((raw as { units: unknown[] }).units)
    : null;
  if (!list) return null;
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const u = item as Record<string, unknown>;
    const signals = parseNecessarySignals(u.necessary_signals);
    if (signals.length <= MAX_NECESSARY_SIGNALS) continue;
    const path = typeof u.path === "string" ? u.path.trim() : "?";
    const claim = trimAssignField(u.unit_claim ?? u.claim, 120) || "复合主张过粗";
    return { path, claim };
  }
  return null;
}

export function parseDeepEvidenceAssignment(
  key: DeliverySegmentKey,
  raw: unknown,
  planned: readonly PlannedAssignSlot[],
  optsPriorRoles?: readonly PriorSignalRole[],
  /** Filled with a machine reason when returning null (avoids opaque shape_fail). */
  failOut?: { reason: string },
): DeepEvidenceAssignment | null {
  const fail = (reason: string): null => {
    if (failOut) failOut.reason = reason;
    return null;
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("not_object");
  }
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.units) ? o.units : null;
  const unitBounds = pageEvidenceUnitBounds(key);
  const minUnits = Math.min(unitBounds.min, planned.length);
  if (!list || list.length < minUnits) {
    return fail(
      `units_short:${list?.length ?? 0}/${minUnits}(max${planned.length})`,
    );
  }

  type ParsedBind = {
    chart_anchors: string[];
    calc_cite: string;
    means_candidate_ref: string;
    unit_claim: string;
    necessary_signals: NecessarySignal[];
    removal_test: RemovalTest | null;
    signal_count_rationale: string;
  };
  const byPath = new Map<string, ParsedBind>();
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const u = item as Record<string, unknown>;
    const path = typeof u.path === "string" ? u.path.trim() : "";
    const necessary_signals = parseNecessarySignals(u.necessary_signals);
    const removal_test = parseRemovalTest(u.removal_test);
    const signal_count_rationale = trimAssignField(
      u.signal_count_rationale ?? u.signalCountRationale,
      160,
    );
    let anchors = Array.isArray(u.chart_anchors)
      ? u.chart_anchors.map((x) => String(x).trim()).filter(Boolean).slice(0, 4)
      : [];
    if (necessary_signals.length >= 1) {
      anchors = anchorsFromNecessarySignals(necessary_signals);
    }
    const calc_cite = trimAssignField(u.calc_cite ?? u.cite, 80);
    const means_candidate_ref = trimAssignField(
      u.means_candidate_ref ?? u.candidate_ref ?? u.menu_ref,
      48,
    );
    const unit_claim = trimAssignField(u.unit_claim ?? u.claim, 120);
    if (path && anchors.length >= 1) {
      byPath.set(path, {
        chart_anchors: anchors,
        calc_cite,
        means_candidate_ref,
        unit_claim,
        necessary_signals,
        removal_test,
        signal_count_rationale,
      });
    }
  }

  const units: DeepEvidenceAssignmentUnit[] = [];
  const priorRoles = [...(optsPriorRoles ?? [])];
  // Wave 2: only require standing claims — skip unbound planned paths (no hard-fill).
  const boundPlanned = planned.filter((p) => byPath.has(p.path));
  if (boundPlanned.length < minUnits) {
    return fail(
      `units_short:${boundPlanned.length}/${minUnits}(max${planned.length})`,
    );
  }
  for (const p of boundPlanned) {
    const bind = byPath.get(p.path);
    if (!bind) return fail(`bind_missing:${p.path}`);
    const calc_cite =
      bind.calc_cite.length >= 4
        ? bind.calc_cite
        : (p.prefer_cite?.trim().slice(0, 80) ?? "");
    const means_candidate_ref =
      bind.means_candidate_ref.length >= 2
        ? bind.means_candidate_ref
        : (p.prefer_candidate_ref?.trim().slice(0, 48) ?? "");
    const unit_claim =
      bind.unit_claim.length >= 6
        ? bind.unit_claim
        : (p.prefer_claim?.trim().slice(0, 120) ?? "");
    if (
      calc_cite.length < 4 ||
      means_candidate_ref.length < 2 ||
      unit_claim.length < 6
    ) {
      return fail(`bind_fields_short:${p.path}`);
    }

    // Soft-compat: if model omitted necessary_signals, synthesize from anchors.
    let signals = bind.necessary_signals;
    let removal = bind.removal_test;
    let rationale = bind.signal_count_rationale;
    if (signals.length < 1) {
      signals = bind.chart_anchors.slice(0, MAX_NECESSARY_SIGNALS).map((slug, i) => ({
        slug,
        // Path-scoped roles so soft-compat clones (same anchors across units)
        // don't trip role_cross_dup / intra mid-band on identical templates.
        role: `${hanPathTag(p.path)}${slug}${i === 0 ? "主承" : "辅承"}`,
        why_needed: `去掉此信号后，无法完整支撑「${unit_claim.slice(0, 40)}」在${hanPathTag(p.path)}这一步解释`,
      }));
      removal = {
        passed: true,
        notes: "compat: synthesized from chart_anchors",
      };
      rationale = `${signals.length}个——由锚点兼容生成`;
    }

    const repaired = softRepairNecessarySignals({
      unit_claim,
      necessary_signals: signals,
      removal_test: removal,
      prior_signal_roles: priorRoles,
      path: p.path,
    });
    signals = repaired.necessary_signals;
    removal = repaired.removal_test;
    let contractFail = validateNecessarySignalsContract({
      unit_claim,
      necessary_signals: signals,
      removal_test: removal,
      signal_count_rationale: rationale,
      prior_signal_roles: priorRoles,
    });
    // Second pass: cross rewrite can re-introduce intra collisions (and vice versa).
    if (contractFail) {
      const repaired2 = softRepairNecessarySignals({
        unit_claim,
        necessary_signals: signals,
        removal_test: removal,
        prior_signal_roles: priorRoles,
        path: p.path,
      });
      signals = repaired2.necessary_signals;
      removal = repaired2.removal_test;
      repaired.repairs.push(...repaired2.repairs.map((r) => `r2:${r}`));
      contractFail = validateNecessarySignalsContract({
        unit_claim,
        necessary_signals: signals,
        removal_test: removal,
        signal_count_rationale: rationale,
        prior_signal_roles: priorRoles,
      });
    }
    if (repaired.repairs.length > 0) {
      console.info("[delivery/deep-evidence] assign soft-repaired signals", {
        path: p.path,
        repairs: repaired.repairs.slice(0, 12),
      });
    }
    if (contractFail) {
      return fail(`contract:${contractFail}:${p.path}`);
    }

    const unit: DeepEvidenceAssignmentUnit = {
      path: p.path,
      chart_anchors: anchorsFromNecessarySignals(signals),
      moat_class: p.moat_class ?? null,
      calc_cite,
      means_candidate_ref,
      unit_claim,
      necessary_signals: signals,
      removal_test: removal ?? { passed: true, notes: "" },
      signal_count_rationale: rationale,
    };
    units.push(unit);
    for (const s of signals) {
      priorRoles.push({ slug: s.slug, role: s.role, path: p.path });
    }
  }
  return { page: key, units };
}

/** Build planned paths (+ P4 moat targets + binding seeds) before assign LLM. */
export function planDeepEvidenceSlots(
  key: DeliverySegmentKey,
  easternOrOpts?: string | null | PlanDeepEvidenceSlotsOpts,
): PlannedAssignSlot[] {
  const opts: PlanDeepEvidenceSlotsOpts =
    typeof easternOrOpts === "object" && easternOrOpts !== null
      ? { ...easternOrOpts, key: easternOrOpts.key ?? key }
      : { eastern_calc_slice: easternOrOpts, key };

  const spec = deepEvidenceUnitSpec(key);
  let base: PlannedAssignSlot[];
  if (key === "metaphysics_action") {
    const eligible = inferP4MoatEligibleTypes(opts.eastern_calc_slice);
    let count = resolveDeepEvidenceUnitCount(key, eligible.size);
    if (
      typeof opts.prealloc_max_units === "number" &&
      opts.prealloc_max_units > 0
    ) {
      count = Math.min(count, opts.prealloc_max_units);
    }
    const targets = distributeP4MoatTargets(eligible, count);
    base = Array.from({ length: count }, (_, i) => ({
      path: spec.paths[i] ?? `dimensions[${i}]`,
      moat_class: targets[i] ?? null,
    }));
  } else {
    let count = resolveDeepEvidenceUnitCount(key, 0);
    if (
      typeof opts.prealloc_max_units === "number" &&
      opts.prealloc_max_units > 0
    ) {
      count = Math.min(count, opts.prealloc_max_units);
    }
    base = Array.from({ length: count }, (_, i) => ({
      path: spec.paths[i] ?? `unit[${i}]`,
      moat_class: null,
    }));
  }
  return seedPlannedBindings(base, opts);
}

export async function runDeepEvidenceAssignCall(input: {
  key: DeliverySegmentKey;
  opts: DeepEvidencePromptOpts;
  /** When set, thesis_gap may extend + persist chart thesis. */
  job_id?: string;
  session_id?: string;
  signal?: AbortSignal;
  timeout_ms?: number;
  /** Dispatch task attempt (1-based) — enables provider escape on attempt ≥2. */
  dispatch_attempt?: number;
}): Promise<
  | { ok: true; assignment: DeepEvidenceAssignment; tokens_used: number }
  | {
      ok: false;
      reason: string;
      tokens_used: number;
      /** Parsed draft that failed gates — Lab must show this, not null. */
      rejected_draft?: DeepEvidenceAssignment;
      last_raw_text?: string;
    }
> {
  const planned = planDeepEvidenceSlots(input.key, {
    key: input.key,
    eastern_calc_slice: input.opts.eastern_calc_slice,
    foundation_surface_feed: input.opts.foundation_surface_feed,
    science_means_feed: input.opts.science_means_feed,
    metaphysics_moat_feed: input.opts.metaphysics_moat_feed,
    risk_fuse_feed: input.opts.risk_fuse_feed,
    close_ritual_feed: input.opts.close_ritual_feed,
    category_token_sets: input.opts.category_token_sets,
    prior_chart_anchors: input.opts.prior_chart_anchors,
    reserved_chart_primaries: input.opts.reserved_chart_primaries,
    prealloc_prefer_by_path: input.opts.prealloc_prefer_by_path,
    prealloc_max_units: input.opts.prealloc_max_units,
    chart_thesis: input.opts.chart_thesis ?? null,
  });
  const { system, user: userBase } = buildDeepEvidenceAssignPrompt(
    input.key,
    input.opts,
    planned,
  );
  let tokens_used = 0;
  let lastReason = "unknown";
  let lastRejectedDraft: DeepEvidenceAssignment | undefined;
  let lastRawText: string | undefined;
  let user = userBase;
  const timeoutUsed = input.timeout_ms ?? PAGE_SCHEMA_DEEP_ASSIGN_TIMEOUT_MS;
  const assignStartedAt = Date.now();
  /** Skip doomed in-process attempt 2 when remaining wall < this (let DAG hop). */
  const ASSIGN_RETRY_MIN_REMAINING_MS = 90_000;
  /** Ceiling shared with reasoning+JSON — never lower thinking_effort on retry (no degrade). */
  const ASSIGN_MAX_TOKENS = 20_000;
  const { deliveryDispatchProviderBody } = await import(
    "@/lib/llm/pro/delivery/dispatch/provider-escape"
  );

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (input.signal?.aborted) {
      return {
        ok: false,
        reason: "aborted",
        tokens_used,
        rejected_draft: lastRejectedDraft,
        last_raw_text: lastRawText,
      };
    }
    if (attempt >= 2) {
      const remaining = timeoutUsed - (Date.now() - assignStartedAt);
      if (remaining < ASSIGN_RETRY_MIN_REMAINING_MS) {
        console.warn("[delivery/deep-evidence] assign skip in-process retry", {
          key: input.key,
          lastReason,
          remaining_ms: remaining,
          min_remaining_ms: ASSIGN_RETRY_MIN_REMAINING_MS,
        });
        break;
      }
    }
    // Attempt 2 always opens DigitalOcean escape after any soft fail (incl. finish=`-` empty).
    const escapeAttempt =
      attempt >= 2 ? Math.max(2, input.dispatch_attempt ?? 2) : input.dispatch_attempt ?? 1;
    const provider = deliveryDispatchProviderBody(escapeAttempt);
    const remainingMs = Math.max(
      5_000,
      timeoutUsed - (Date.now() - assignStartedAt),
    );
    const callTimeoutMs = Math.min(timeoutUsed, remainingMs);
    try {
      const result = await callLLM({
        call_type: "main_delivery",
        phase_name: "deep_evidence_assign",
        system,
        messages: [{ role: "user", content: user }],
        max_tokens: ASSIGN_MAX_TOKENS,
        thinking_effort: "high",
        timeout_ms: callTimeoutMs,
        response_format: "json",
        session_id: input.session_id,
        temperature: 0.25,
        max_attempts: deliveryTransportMaxAttempts(),
        signal: input.signal,
        provider,
      });
      tokens_used += result.meta.tokens_used;
      const finish = result.meta.finish_reason ?? null;
      const text = result.content?.trim() ?? "";
      if (text) lastRawText = text;
      if (finish === "cancelled") {
        lastReason = "finish_cancelled";
        console.warn("[delivery/deep-evidence] assign finish_reason=cancelled — discard", {
          key: input.key,
          attempt,
          completion_tokens: result.meta.completion_tokens ?? null,
          generation_id: result.meta.generation_id ?? null,
          timeout_ms: timeoutUsed,
        });
        continue;
      }
      if (!text) {
        lastReason =
          finish === "length" || finish == null
            ? `empty_after_${finish ?? "null_finish"}`
            : "empty_response";
        console.warn("[delivery/deep-evidence] assign empty/truncated — will retry if budget", {
          key: input.key,
          attempt,
          finish_reason: finish,
          completion_tokens: result.meta.completion_tokens ?? null,
          next_escape: attempt < 2,
        });
        user = `${userBase}\n\n【纠错】上一稿无可见 JSON（finish=${finish ?? "null"}）。点完锚点后立刻输出完整 units JSON。`;
        continue;
      }
      if (finish === "length") {
        console.warn("[delivery/deep-evidence] assign finish_reason=length", {
          key: input.key,
          attempt,
          content_len: text.length,
          completion_tokens: result.meta.completion_tokens ?? null,
        });
      }
      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch {
        lastReason = finish === "length" ? "parse_fail_length" : "parse_fail";
        user = `${userBase}\n\n【纠错】上一稿 JSON 不完整。点完锚点后立刻输出完整 units 数组。`;
        continue;
      }
      const failOut = { reason: "shape_fail" };
      const assignmentRaw = parseDeepEvidenceAssignment(
        input.key,
        parsed,
        planned,
        input.opts.prior_signal_roles,
        failOut,
      );
      if (!assignmentRaw) {
        lastReason =
          failOut.reason === "shape_fail"
            ? "shape_fail"
            : failOut.reason.startsWith("contract:")
              ? failOut.reason
              : `shape_fail:${failOut.reason}`;
        console.warn("[delivery/deep-evidence] assign shape/contract fail", {
          key: input.key,
          attempt,
          reason: lastReason,
        });
        const oversized = detectOversizedNecessarySignals(parsed);
        if (oversized && attempt < 2) {
          const [a, b] = splitUnitClaim(oversized.claim);
          user = `${userBase}\n\n【纠错·claim拆分】path=${oversized.path} 的 necessary_signals>${MAX_NECESSARY_SIGNALS}。请把主张拆成两段更细的 unit_claim（例：①${a} ②${b}），各自 ≤${MAX_NECESSARY_SIGNALS} 个必要信号；禁止无限堆叠。`;
        } else {
          user = `${userBase}\n\n【纠错】${lastReason}。units 须覆盖全部派工 path；每条须含 necessary_signals(1–${MAX_NECESSARY_SIGNALS})+removal_test(passed:true)+why_needed具体缺口(须含去掉/无法解释等)+chart_anchors+calc_cite+means_candidate_ref+unit_claim。同 slug 禁止复写他页近似 role；同 dimension_id 禁止近似 inference_zh（须换针对本 claim 的切入，禁止同义改写糊弄）。`;
        }
        continue;
      }
      // Binding locks + slim shared aux — diversify by construction before gates.
      const locked = applyPreferBindingLocks(assignmentRaw, planned);
      const reserved = input.opts.reserved_chart_primaries ?? [];
      const pool = [
        ...reserved,
        ...locked.units.flatMap((u) => u.chart_anchors),
      ];
      let assignment: DeepEvidenceAssignment = {
        ...locked,
        units: slimSharedAuxAnchors(locked.units, pool),
      };
      // Source-side job primary reuse cap (any term ≤ reuse_cap): repair here —
      // do not wait for merge reject.
      const reuseEnforced = enforceAssignmentPrimaryReuseCap(assignment, {
        prior_primaries: input.opts.prior_chart_anchors,
        pool,
        allowed_primaries: reserved.length > 0 ? reserved : undefined,
        reuse_cap: input.opts.primary_reuse_cap ?? DEFAULT_PRIMARY_REUSE_CAP,
      });
      assignment = reuseEnforced.assignment;
      if (reuseEnforced.repaired) {
        console.info("[delivery/deep-evidence] assign primary-reuse repaired", {
          key: input.key,
          attempt,
          primaries: assignment.units.map((u) => u.chart_anchors[0]),
          fail_reason: reuseEnforced.fail_reason ?? null,
        });
      }
      if (reuseEnforced.fail_reason) {
        lastReason = reuseEnforced.fail_reason;
        lastRejectedDraft = assignment;
        console.warn("[delivery/deep-evidence] assign primary-reuse still over cap", {
          key: input.key,
          attempt,
          reason: lastReason,
        });
        user = `${userBase}\n\n【纠错·主承重复用】${lastReason}。跨页+本页 chart_anchors[0] 同一主词不得超过 reuse_cap；请换未超限的真词作主承重（跟 prefer_primary / 库存），立刻输出完整 JSON。`;
        continue;
      }
      const moatFail = validateAssignmentMoatAnchors(assignment);
      if (moatFail) {
        lastReason = moatFail;
        lastRejectedDraft = assignment;
        console.warn("[delivery/deep-evidence] assign moat-anchor mismatch", {
          key: input.key,
          attempt,
          reason: moatFail,
        });
        user = `${userBase}\n\n【纠错·moat】${moatFail}。timing 槽须含大运/流年/岁运/气候交织等；polarity 须含用神/忌神/身弱等；archetype 须含十神角色。从整份真算料重点，立刻输出完整 JSON。`;
        continue;
      }
      const diversifyFail = validateAssignmentAnchorDiversity(assignment);
      if (diversifyFail) {
        lastReason = diversifyFail;
        lastRejectedDraft = assignment;
        console.warn("[delivery/deep-evidence] assign anchor reuse", {
          key: input.key,
          attempt,
          reason: diversifyFail,
        });
        const preferHint = planned
          .filter((p) => p.prefer_primary)
          .map((p) => `${p.path}→${p.prefer_primary}`)
          .join("；");
        user = `${userBase}\n\n【纠错·锚点雷同】${diversifyFail}。请严格跟派工表 prefer_primary（${preferHint || "各 path 换主承重词"}）。立刻输出完整 JSON。`;
        continue;
      }
      let thesisFail = validateAssignmentThesisCoverage(
        assignment,
        input.opts.chart_thesis,
      );
      if (thesisFail && input.opts.chart_thesis && input.opts.thesis_structured) {
        const dimRaw = thesisFail.replace(/^thesis_gap:/, "").split(":")[0] ?? "";
        const prefer = isThesisDimensionId(dimRaw) ? dimRaw : undefined;
        const extended = extendThesisDimension({
          thesis: input.opts.chart_thesis,
          structured: input.opts.thesis_structured,
          gap_claim_zh: assignment.units[0]?.unit_claim ?? "",
          prefer_dimension_id: prefer,
        });
        if (extended.ok) {
          if (input.job_id) {
            const { saveChartThesis } = await import(
              "@/lib/llm/pro/delivery/dispatch/task-store"
            );
            await saveChartThesis(input.job_id, extended.thesis);
          }
          input.opts.chart_thesis = extended.thesis;
          input.opts.chart_thesis_block = formatChartThesisForPrompt(
            extended.thesis,
          );
          thesisFail = validateAssignmentThesisCoverage(
            assignment,
            extended.thesis,
          );
          console.info("[delivery/deep-evidence] thesis extended on gap", {
            key: input.key,
            refined: extended.refined,
            cleared: !thesisFail,
          });
        }
      }
      if (input.opts.chart_thesis) {
        lastRejectedDraft = assignment;
        // Always soft-strip/canonicalize: hollow→concrete, reuse cap, shadow drop.
        const stripped = softStripUngroundedThesisSignals(
          assignment,
          input.opts.chart_thesis,
        );
        if (stripped.stripped_slugs.length > 0) {
          console.info("[delivery/deep-evidence] assign soft-strip thesis gaps", {
            key: input.key,
            attempt,
            stripped: stripped.stripped_slugs,
            emptied: stripped.emptied_paths,
          });
        }
        if (stripped.emptied_paths.length > 0) {
          const { min } = pageEvidenceUnitBounds(input.key);
          const keptUnits = stripped.assignment.units.filter(
            (u) => (u.necessary_signals?.length ?? 0) > 0,
          );
          if (keptUnits.length >= min) {
            const trimmed = { ...stripped.assignment, units: keptUnits };
            const afterDrop = validateAssignmentThesisCoverage(
              trimmed,
              input.opts.chart_thesis,
            );
            const moatAfter = validateAssignmentMoatAnchors(trimmed);
            const divAfter = validateAssignmentAnchorDiversity(trimmed);
            if (!afterDrop && !moatAfter && !divAfter) {
              console.info(
                "[delivery/deep-evidence] assign ok after soft-strip+drop empty",
                {
                  key: input.key,
                  stripped: stripped.stripped_slugs,
                  dropped_paths: stripped.emptied_paths,
                  kept: keptUnits.length,
                  attempt,
                },
              );
              return { ok: true, assignment: trimmed, tokens_used };
            }
          }
          lastReason = `thesis_gap:soft_strip_empty:${stripped.emptied_paths.join("|")}`;
          lastRejectedDraft = assignment;
          break;
        }
        const afterStrip = validateAssignmentThesisCoverage(
          stripped.assignment,
          input.opts.chart_thesis,
        );
        const moatAfter = validateAssignmentMoatAnchors(stripped.assignment);
        const divAfter = validateAssignmentAnchorDiversity(stripped.assignment);
        if (!afterStrip && !moatAfter && !divAfter) {
          console.info("[delivery/deep-evidence] assign ok after soft-strip", {
            key: input.key,
            stripped: stripped.stripped_slugs,
            attempt,
          });
          return { ok: true, assignment: stripped.assignment, tokens_used };
        }
        lastReason =
          afterStrip ?? moatAfter ?? divAfter ?? thesisFail ?? "thesis_gap";
        lastRejectedDraft = stripped.assignment;
        console.warn("[delivery/deep-evidence] assign thesis_gap", {
          key: input.key,
          attempt,
          reason: lastReason,
        });
        break;
      }
      console.info("[delivery/deep-evidence] assign ok", {
        key: input.key,
        units: assignment.units.length,
        moats: assignment.units.map((u) => u.moat_class).filter(Boolean),
        prefer_primaries: planned.map((p) => p.prefer_primary).filter(Boolean),
        attempt,
        finish_reason: finish,
        provider_escape: escapeAttempt >= 2,
      });
      return { ok: true, assignment, tokens_used };
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "llm_error";
      const elapsed = Date.now() - assignStartedAt;
      const nearTimeout = elapsed >= timeoutUsed - 15_000;
      if (
        nearTimeout &&
        (lastReason === "AbortError" ||
          /aborterror|this operation was aborted/i.test(lastReason))
      ) {
        // Parent pre-kill (~275s) often wins the race vs client llm_timeout label.
        lastReason = "llm_timeout";
      }
      const aborted =
        input.signal?.aborted ||
        lastReason === "AbortError" ||
        /aborterror|this operation was aborted/i.test(lastReason);
      console.warn("[delivery/deep-evidence] assign error", {
        key: input.key,
        attempt,
        reason: lastReason,
        elapsed_ms: elapsed,
        timeout_ms: timeoutUsed,
        provider_escape: escapeAttempt >= 2,
        will_retry: attempt < 2 && !aborted && lastReason !== "llm_timeout",
      });
      // Only user/job cancel stops the 1+1 loop. Transport abort midstream → retry + escape.
      if (aborted && input.signal?.aborted) break;
      if (lastReason === "llm_timeout") {
        // Timeout already burned most of the 300s invoke — retry via DAG/QStash, not in-process.
        break;
      }
    }
  }
  return {
    ok: false,
    reason: `assign:${lastReason}`,
    tokens_used,
    rejected_draft: lastRejectedDraft,
    last_raw_text: lastRawText,
  };
}
