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
import { inferP4MoatEligibleTypes, anchorsServeMoatClass } from "./p4-means-gate";
export { anchorsServeMoatClass } from "./p4-means-gate";
import { pageEvidenceUnitBounds } from "./evidence-unit-soft-cap";
import {
  normalizeNear7DayStem,
  stripMonthBandDayPrefix,
  type Near7DayRole,
} from "@/lib/llm/pro/delivery/close-ritual-feed";
import {
  isSlugGroundedInThesis,
  softStripUngroundedThesisSignals,
  softRepairAssignmentThirdPartySignals,
  softRepairThirdPartyAttributionProse,
  collapseQuerentPressureStutter,
  thesisAllFactsCorpus,
  thesisDimsContainingSlug,
  validateAssignmentThesisCoverage,
  resolveSlugToThesisToken,
  HOLLOW_STRUCTURAL_SLUGS,
} from "@/lib/llm/pro/delivery/thesis/validate-assignment-coverage";
import {
  detectKnownThirdPartyAgency,
  extractKnownThirdParties,
  isPartnershipFrictionSurface,
  isPartnershipRejectionSurface,
  isRelationshipFrictionSurface,
  partnershipFrictionInferenceTemplate,
  partnershipRejectionInferenceTemplate,
  relationshipFrictionInferenceTemplate,
  softRepairThirdPartyAgencyProse,
} from "@/lib/llm/pro/delivery/thesis/third-party-agency";
import type { ChartThesis } from "@/lib/llm/pro/delivery/thesis/types";
import { extendThesisDimension } from "@/lib/llm/pro/delivery/thesis/extend-thesis-dimension";
import { formatChartThesisForPrompt } from "@/lib/llm/pro/delivery/thesis/format-for-prompt";
import { isThesisDimensionId } from "./assign-necessary-signals";
import {
  DEEP_EVIDENCE_ANCHOR_JACCARD_MAX,
  maxAssignmentAnchorJaccard,
  softStripUnmatchedDeepEvidenceAnchors,
} from "./deep-evidence-quality";
import {
  bindFoundationRelationPicks,
  buildFoundationRelationInventory,
  readFoundationPickIds,
  type FoundationRelation,
} from "./foundation-relation-inventory";
import {
  assessFactPackAssignClaims,
  factPackAssignClaimRetryHint,
  isAssignStructureClaimWeak,
  softRepairFactPackAssignCites,
  softStripMeansLayerFromClaim,
} from "./assign-fact-pack-claim-gate";
import { assignDutyForKey } from "@/lib/llm/pro/delivery/page-prompts";
import {
  deepEvidenceUnitSpec,
  type DeepEvidencePlan,
  type DeepEvidencePromptOpts,
} from "./deep-evidence-prompt";
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
  scrubAssignClaimBanSeed,
  parsePrimaryBackupNamesFromFeed,
  alignPrimaryBackupTrackProse,
  type AssignPathHint,
} from "./assign-binding-seed";
import { suggestFoundationPrimaryForSurface } from "./foundation-surface-primary";
import { buildThesisAssignMenu } from "@/lib/llm/pro/delivery/thesis/build-assign-menu";
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
import {
  FOUNDATION_LAST_CARD_PREFER_DIMS,
  preallocateClosedMenuSignals,
  softRepairPlannedMoatLocks,
  type LockedAssignSignal,
} from "./preallocate-foundation-signals";
import { assessCrossPagePrimaryAnchorReuse, ensureClaimCarriesCiteRelationPhrases } from "./deep-evidence-quality";

export type { AssignPathHint } from "./assign-binding-seed";
export { parseAssignPathHintsFromFeed } from "./assign-binding-seed";
export {
  parsePrimaryBackupNamesFromFeed,
  alignPrimaryBackupTrackProse,
} from "./assign-binding-seed";

/** Deep pages that must use D1 closed-menu assign (no free-select). */
export const CLOSED_MENU_DEEP_ASSIGN_KEYS = new Set<DeliverySegmentKey>([
  "foundation",
  "science_action",
  "metaphysics_action",
  "risk_guard",
  "signals_close",
]);

/** Closed-menu assign JSON is explanation-only — keep ceiling tight so models STOP. */
export const ASSIGN_CLOSED_MENU_MAX_TOKENS = 8_000;
export const ASSIGN_FREE_SELECT_MAX_TOKENS = 20_000;

/** Planned slot before LLM — path/moat locked; prefer_* seeded for quality-by-construction. */
export type PlannedAssignSlot = {
  path: string;
  moat_class?: P4MoatMeansType | null;
  prefer_primary?: string;
  prefer_candidate_ref?: string;
  prefer_cite?: string;
  prefer_claim?: string;
  /**
   * D1 closed-menu quota: code-locked signals. Model only writes role/why/inference.
   * When set, parse force-overwrites slug/dim/count.
   */
  locked_signals?: LockedAssignSignal[];
  /**
   * This-chart range for the card. Model chooses which terms the claim needs.
   * Membership is checked; count is not capped.
   */
  allowed_signals?: LockedAssignSignal[];
  /** Step 1: claims only. Vocabulary is the chart fact pack, not a slug lock. */
  fact_pack_mode?: boolean;
};

export type { LockedAssignSignal };

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
  /** Path → prefer_primary (lead) from job-level prealloc map. */
  prealloc_prefer_by_path?: Readonly<Record<string, string>>;
  /** Path → full this-chart term group. Closed menu locks the group, not the lead alone. */
  prealloc_term_groups?: Readonly<Record<string, readonly string[]>>;
  /** This person's local-calc record. When set, assign does not lock a slug menu. */
  chart_fact_pack?: string;
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
  timing:
    "≥1 词须匹配 /大运|流年|岁环|岁运|交运|起运|运程/ 或岁运干支（丁酉/丙午）或奇门局势（值符|值使|客克主|主克客|門宫|遁局）；可另加辅锚",
  polarity: "≥1 词须匹配 /用神|忌神|喜神|身弱|身强|补泄|五行/（可另加辅锚）",
  archetype: "≥1 词须为十神/格局角色（比肩劫财食伤财官杀印等）",
};

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

function anchorSetJaccard(a: readonly string[], b: readonly string[]): number {
  const A = new Set(a.map((x) => x.trim()).filter(Boolean));
  const B = new Set(b.map((x) => x.trim()).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function unitProseForAnchorPick(u: DeepEvidenceAssignmentUnit): string {
  const signals = u.necessary_signals ?? [];
  return [
    u.unit_claim,
    u.calc_cite,
    ...signals.flatMap((s) => [s.inference_zh, s.role, s.why_needed]),
  ]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Deterministic soft-repair for within-page `anchor_reuse_jaccard` (rule 11).
 * Prefer promote aux signal → prose-grounded pool pick → forceDiversify + sync
 * signal[0]. Never invent out-of-thesis primaries when thesis is present.
 */
export function softRepairAssignmentAnchorDiversity(
  assignment: DeepEvidenceAssignment,
  opts?: {
    pool?: readonly string[];
    allowed_primaries?: readonly string[];
    thesis?: ChartThesis | null;
    /** Page-local primary uniqueness for Jaccard repair (default 1). */
    page_primary_cap?: number;
  },
): {
  assignment: DeepEvidenceAssignment;
  repaired: boolean;
  still_fail?: string;
} {
  if (!validateAssignmentAnchorDiversity(assignment)) {
    return { assignment, repaired: false };
  }

  let units: DeepEvidenceAssignmentUnit[] = assignment.units.map((u) => ({
    ...u,
    chart_anchors: [...u.chart_anchors],
    necessary_signals: u.necessary_signals?.map((s) => ({ ...s })),
  }));
  let repaired = false;
  const pageCap = Math.max(1, opts?.page_primary_cap ?? 1);
  const thesis = opts?.thesis ?? null;

  const syncUnit = (
    u: DeepEvidenceAssignmentUnit,
    signals: NecessarySignal[],
  ): DeepEvidenceAssignmentUnit => ({
    ...u,
    necessary_signals: signals,
    chart_anchors: anchorsFromNecessarySignals(signals, { cap: signals.length }),
  });

  for (let round = 0; round < units.length + 2; round++) {
    if (!validateAssignmentAnchorDiversity({ ...assignment, units })) break;

    let fixedPair = false;
    for (let i = 0; i < units.length && !fixedPair; i++) {
      for (let j = i + 1; j < units.length && !fixedPair; j++) {
        const jv = anchorSetJaccard(
          units[i]!.chart_anchors,
          units[j]!.chart_anchors,
        );
        if (jv < DEEP_EVIDENCE_ANCHOR_JACCARD_MAX) continue;

        const uj = units[j]!;
        const usedPrimaryKeys = new Set(
          units
            .map((u, idx) =>
              idx === j ? "" : normalizePrimaryReuseKey(u.chart_anchors[0] ?? ""),
            )
            .filter(Boolean),
        );
        const signals = [...(uj.necessary_signals ?? [])];

        // 1) Promote a later signal with a free primary slug.
        const altIdx = signals.findIndex(
          (s, si) =>
            si > 0 &&
            Boolean(s.slug?.trim()) &&
            !usedPrimaryKeys.has(normalizePrimaryReuseKey(s.slug!)),
        );
        if (altIdx > 0) {
          const alt = signals[altIdx]!;
          const reordered = [alt, ...signals.filter((_, k) => k !== altIdx)];
          units[j] = syncUnit(uj, reordered);
          repaired = true;
          fixedPair = true;
          break;
        }

        // 2) Swap primary to a pool/thesis token already named in this unit's prose.
        const prose = unitProseForAnchorPick(uj);
        const candidatePool = [
          ...(opts?.allowed_primaries ?? []),
          ...(opts?.pool ?? []),
          ...units.flatMap((u) => u.chart_anchors),
        ];
        const pick = candidatePool.find((raw) => {
          const t = raw.trim();
          if (!t || !prose.includes(t)) return false;
          const n = normalizePrimaryReuseKey(t);
          if (!n || usedPrimaryKeys.has(n)) return false;
          if (thesis && !isSlugGroundedInThesis(thesis, t)) return false;
          return true;
        });
        if (pick && signals[0]) {
          const token = pick.trim();
          const dims = thesis
            ? thesisDimsContainingSlug(thesis, token)
            : [];
          const curDim = signals[0].dimension_id?.trim() ?? "";
          const nextDim =
            (curDim && dims.includes(curDim) ? curDim : dims[0]) || curDim;
          const nextSignals = signals.map((s, si) =>
            si === 0
              ? {
                  ...s,
                  slug: token,
                  ...(nextDim ? { dimension_id: nextDim } : {}),
                }
              : s,
          );
          units[j] = syncUnit(uj, nextSignals);
          repaired = true;
          fixedPair = true;
          break;
        }
      }
    }

    if (fixedPair) continue;

    // 3) Last resort: force unique primaries under page cap, sync signal[0].
    const pool = [
      ...(opts?.allowed_primaries ?? []),
      ...(opts?.pool ?? []),
      ...units.flatMap((u) => u.chart_anchors),
    ];
    const diversified = forceDiversifyChartAnchors(units, pool, {
      allowed_primaries: opts?.allowed_primaries,
      reuse_cap: pageCap,
    });
    units = diversified.map((u) => {
      const primary = u.chart_anchors[0]?.trim();
      if (!primary || !u.necessary_signals?.length) return u;
      const dims = thesis ? thesisDimsContainingSlug(thesis, primary) : [];
      const curDim = u.necessary_signals[0]?.dimension_id?.trim() ?? "";
      const nextDim =
        (curDim && dims.includes(curDim) ? curDim : dims[0]) || curDim;
      const nextSignals = u.necessary_signals.map((s, si) =>
        si === 0
          ? {
              ...s,
              slug: primary,
              ...(nextDim ? { dimension_id: nextDim } : {}),
            }
          : s,
      );
      return syncUnit(u, nextSignals);
    });
    repaired = true;
    break;
  }

  const next: DeepEvidenceAssignment = { ...assignment, units };
  const still = validateAssignmentAnchorDiversity(next);
  return {
    assignment: next,
    repaired,
    still_fail: still ?? undefined,
  };
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
    if (
      moat === "timing" &&
      !/大运|流年|岁运|气候交织|交运|起运|运程|岁环|纪元|值符|值使|客克主|主克客|主生客|客生主|陰遁|阴遁|陽遁|阳遁|開門|开门|休門|休门|生門|生门|傷門|伤门|杜門|杜门|景門|景门|死門|死门|驚門|惊門|惊门|坎一宮|坎一宫|坤二宮|坤二宫|震三宮|震三宫|巽四宮|巽四宫|中五宮|中五宫|乾六宮|乾六宫|兑七宮|兑七宫|艮八宮|艮八宫|離九宮|离九宫/.test(
        t,
      )
    ) {
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

  const usedCrossPage = new Set(
    [
      ...(opts.prior_chart_anchors ?? []),
      ...(opts.reserved_chart_primaries ?? []),
    ]
      .map((t) => normalizePrimaryReuseKey(t))
      .filter(Boolean),
  );
  /** Page-local uniqueness for rematch; do not let other pages' reserved
   *  starve 食神/印/害 when reuse_cap already allows cross-page reuse. */
  const usedThisPage = new Set(
    (opts.prior_chart_anchors ?? [])
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
    let fromSurfaceRematch = false;

    if (opts.key === "foundation" && thesis?.dimensions?.length) {
      const surface = `${hint?.prefer_cite ?? ""}\n${hint?.prefer_claim ?? ""}`;
      const menu = buildThesisAssignMenu(thesis);
      const suggested = acceptPrimary(
        suggestFoundationPrimaryForSurface(surface, menu, usedThisPage),
      );
      if (suggested) {
        primary = suggested;
        fromSurfaceRematch = true;
      }
    }

    if (primary && usedThisPage.has(normalizePrimaryReuseKey(primary))) {
      primary = undefined;
      fromSurfaceRematch = false;
    }
    if (
      primary &&
      !fromSurfaceRematch &&
      usedCrossPage.has(normalizePrimaryReuseKey(primary))
    ) {
      primary = undefined;
    }
    if (!primary) {
      const pool = buildInventoryPrimaryPool(
        opts.category_token_sets,
        usedCrossPage,
        slot.moat_class,
      )
        .map((t) => acceptPrimary(t))
        .filter((t): t is string => Boolean(t));
      primary = pool.find(
        (t) => !usedThisPage.has(normalizePrimaryReuseKey(t)),
      );
    }
    if (primary) {
      const k = normalizePrimaryReuseKey(primary);
      usedThisPage.add(k);
      usedCrossPage.add(k);
    }
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
 * Category: unit_claim must be a complete sentence — not truncated mid-phrase.
 * Hanging endings (为/中/的/且…) are a common model abort; rule 14 — no case stems.
 */
export function isHangingUnitClaim(claim: string): boolean {
  const t = claim.trim().replace(/[。．.！？!?；;…]+$/g, "").trim();
  if (!t || t.length < CLAIM_MIN) return true;
  // 「对比/相比/无比」are finished compounds — do not treat trailing 比 as abort.
  if (
    !/(?:对比|相比|无比)$/.test(t) &&
    /[为与及和而且或比被把让使在于由从对向中]$/.test(t)
  ) {
    return true;
  }
  // Mid-predicate abort particles (待…再 / 才 / 便 / 就).
  if (/[再才便就]$/.test(t)) return true;
  if (/[的地得]$/.test(t) && t.length < 40) return true;
  if (/[，、]$/.test(t)) return true;
  // Mid-thought abort: 「……，此时」「……需以食神」「食神主」without finishing.
  if (/(?:此时|此刻|这时|当下)$/.test(t)) return true;
  if (
    /(?:需以|应以|当以|用以)(?:食神|伤官|比肩|劫财|正印|偏印|正官|七杀|正财|偏财|[木火土金水])?$/.test(
      t,
    )
  ) {
    return true;
  }
  // 「食神主」「偏印主」abort — not bare「日主」(rule 14: ten-god+主 only).
  if (
    /(?:食神|伤官|比肩|劫财|正印|偏印|正官|七杀|正财|偏财|印星|财星|官星|食伤)主$/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

/** Prefer-claim soft-fill only when seed is a finished structure claim (not means). */
export function isUsableAssignPreferClaim(claim: string): boolean {
  const t = claim.trim();
  if (t.length < CLAIM_MIN) return false;
  if (isHangingUnitClaim(t)) return false;
  if (isAssignStructureClaimWeak(t)) return false;
  return true;
}

/** Placeholder / menu labels that must not stand as calc_cite. */
const HOLLOW_ASSIGN_CITE_RE =
  /^(主手段|辅手段|辅轨|执行面\d*|熔断候选\d*|防护\d*|结构坑|切辅条件|真算短摘录)$/;

export function isThinAssignCite(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (t.length < CITE_MIN) return true;
  return HOLLOW_ASSIGN_CITE_RE.test(t);
}

/**
 * Qualify-first: model hollow「主手段」→ prefer_cite → claim → inference.
 * Never LLM-retry bind_fields_short when a longer seed exists.
 */
export function resolveAssignCalcCite(input: {
  model_cite?: string | null;
  prefer_cite?: string | null;
  unit_claim?: string | null;
  prefer_claim?: string | null;
  inference_zh?: string | null;
  /**
   * When true (foundation why_cards): prefer_cite wins if model cite does not
   * overlap the seeded label/answer pair (方案 A #3 — stop wrong thick cite).
   */
  prefer_cite_must_match?: boolean;
}): string {
  const prefer = (input.prefer_cite ?? "").trim();
  const model = (input.model_cite ?? "").trim();
  if (
    input.prefer_cite_must_match &&
    prefer.length >= 8 &&
    model.length >= 4 &&
    !citeOverlapsPreferSeed(model, prefer)
  ) {
    return prefer.slice(0, 80);
  }

  const pool = [
    input.model_cite,
    input.prefer_cite,
    input.unit_claim,
    input.prefer_claim,
    input.inference_zh,
  ];
  for (const c of pool) {
    const t = (c ?? "").trim();
    if (t && !isThinAssignCite(t) && !HOLLOW_ASSIGN_CITE_RE.test(t)) {
      return t.slice(0, 80);
    }
  }
  for (const c of pool) {
    const t = (c ?? "").trim();
    if (t.length >= 4 && !HOLLOW_ASSIGN_CITE_RE.test(t)) return t.slice(0, 80);
  }
  return "";
}

/** True when model cite shares the seeded label or a substantial answer chunk. */
export function citeOverlapsPreferSeed(modelCite: string, preferCite: string): boolean {
  const m = modelCite.replace(/\s+/g, "");
  const p = preferCite.replace(/\s+/g, "");
  if (!m || !p) return false;
  if (m.includes(p.slice(0, Math.min(24, p.length))) || p.includes(m.slice(0, Math.min(24, m.length)))) {
    return true;
  }
  const label = preferCite.split(/[:：]/)[0]?.trim() ?? "";
  if (label.length >= 2 && modelCite.includes(label)) return true;
  const answer = preferCite.replace(/^[^:：]{1,40}[:：]\s*/, "").replace(/\s+/g, "");
  if (answer.length >= 8) {
    const chunk = answer.slice(0, Math.min(12, answer.length));
    if (m.includes(chunk)) return true;
  }
  return false;
}

/**
 * Lock chart_anchors[0] + fill thin calc_cite / unit_claim / means_candidate_ref.
 * Moat conflict skips primary move only — still fills ref/cite/claim.
 * Prefer is only applied when it already appears in necessary_signals
 * (never re-inject 金舆等影子 prefer 覆盖 signals 投影).
 *
 * P4 (slot.moat_class set): always stamp means_candidate_ref from path hint —
 * model free-pick of 极性/时机/角色候选 is unreliable (Lab 4/4 mismatch).
 */
export function applyPreferBindingLocks(
  assignment: DeepEvidenceAssignment,
  planned: readonly PlannedAssignSlot[],
): DeepEvidenceAssignment {
  const byPath = new Map(planned.map((p) => [p.path, p]));
  const units = assignment.units.map((u) => {
    const slot = byPath.get(u.path);
    let next: DeepEvidenceAssignmentUnit = { ...u };

    const moat = slot?.moat_class ?? null;
    let ref = slot?.prefer_candidate_ref?.trim();
    // Absolute: P4 ref must match slot moat_class prefix (feed path table may disagree).
    if (moat) {
      const prefix = P4_MOAT_REF_PREFIX[moat];
      if (!ref || moatClassFromCandidateRef(ref) !== moat) {
        ref = `${prefix}1`;
      }
      next = { ...next, means_candidate_ref: ref.slice(0, 48) };
    } else if (ref && next.means_candidate_ref.trim().length < REF_MIN) {
      next = { ...next, means_candidate_ref: ref.slice(0, 48) };
    }

    const factPackSlot = Boolean(slot?.fact_pack_mode);
    const resolvedCite = factPackSlot
      ? next.calc_cite.trim()
      : resolveAssignCalcCite({
          model_cite: next.calc_cite,
          prefer_cite: slot?.prefer_cite,
          unit_claim: next.unit_claim,
          prefer_claim: slot?.prefer_claim,
          inference_zh: next.necessary_signals?.[0]?.inference_zh,
          prefer_cite_must_match: next.path.startsWith("why_cards"),
        });
    if (resolvedCite && resolvedCite !== next.calc_cite.trim()) {
      next = { ...next, calc_cite: resolvedCite };
    }

    // P6 day7：禁月表腔残留在锁定 cite/claim
    if (next.path.startsWith("day7_micro_actions")) {
      const roleIdx = Number((next.path.match(/\[(\d+)\]/) ?? [])[1] ?? 0);
      const role: Near7DayRole =
        roleIdx === 0
          ? "observe"
          : roleIdx === 1
            ? "adjust"
            : roleIdx === 2
              ? "consolidate"
              : "aux";
      const citeN = normalizeNear7DayStem(next.calc_cite, role);
      const claimStripped = stripMonthBandDayPrefix(next.unit_claim);
      const claimN =
        claimStripped && claimStripped !== next.unit_claim.trim()
          ? claimStripped.slice(0, 120)
          : next.unit_claim.trim();
      if (citeN !== next.calc_cite.trim() || claimN !== next.unit_claim.trim()) {
        next = {
          ...next,
          calc_cite: citeN.slice(0, 80),
          unit_claim: claimN || next.unit_claim,
        };
      }
    }

    const claim = slot?.prefer_claim?.trim();
    // Soft-fill hanging/short claims only from a usable structure prefer_claim.
    if (claim && isUsableAssignPreferClaim(claim)) {
      const cur = next.unit_claim.trim();
      if (cur.length < CLAIM_MIN || isHangingUnitClaim(cur) || isAssignStructureClaimWeak(cur)) {
        next = { ...next, unit_claim: claim.slice(0, 120) };
      }
    }

    const prefer = slot?.prefer_primary?.trim();
    if (!prefer) {
      // Always keep anchors = signal slug projection when signals exist.
      if (next.necessary_signals?.length) {
        return {
          ...next,
          chart_anchors: anchorsFromNecessarySignals(next.necessary_signals, {
            cap: next.necessary_signals.length,
          }),
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
          chart_anchors: anchorsFromNecessarySignals(next.necessary_signals, {
            cap: next.necessary_signals.length,
          }),
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
      locked = [hit!, ...anchors];
    } else {
      locked = [
        prefer,
        ...anchors.filter((a) => normAnchor(a) !== normAnchor(prefer)),
      ];
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

  return units.map((u) => {
    const primary =
      take(u.chart_anchors[0]) ?? take(undefined) ?? u.chart_anchors[0]?.trim();
    if (!primary) return { ...u, chart_anchors: [...u.chart_anchors] };
    // Only keep an existing aux — never invent one from the pool (invented aux
    // fails deep_evidence_anchor_mismatch when evidence has no ⟦w:aux⟧).
    let aux: string | undefined;
    for (const a of u.chart_anchors.slice(1)) {
      const n = reuseKey(a);
      if (n && n !== reuseKey(primary) && (allowed.length === 0 || inAllowed(n))) {
        aux = a.trim();
        break;
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
      ],
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

/**
 * Write/merge qualify-first: when job-wide primary_reuse_cap fails, diversify
 * chart_anchors[0] under prior counts and restamp ⟦w:⟧ tags (no LLM retry).
 */
export function softRepairDeepEvidencePlanPrimaryReuse(
  plan: DeepEvidencePlan,
  opts?: {
    prior_chart_anchors?: readonly string[];
    pool?: readonly string[];
    reuse_cap?: number;
  },
): {
  plan: DeepEvidencePlan;
  repaired: boolean;
  still_fail?: string;
} {
  const cap = Math.max(1, opts?.reuse_cap ?? DEFAULT_PRIMARY_REUSE_CAP);
  const prior = (opts?.prior_chart_anchors ?? []).map((x) => x.trim()).filter(Boolean);
  const pagePrimaries = plan.units
    .map((u) => u.chart_anchors[0]?.trim() ?? "")
    .filter(Boolean);
  const before = validatePrimaryReuseCap([...prior, ...pagePrimaries], { cap });
  if (before.ok) {
    return { plan, repaired: false };
  }

  const oldByPath = new Map(
    plan.units.map((u) => [u.path, u.chart_anchors[0]?.trim() ?? ""] as const),
  );
  const pool = [
    ...(opts?.pool ?? []),
    ...plan.units.flatMap((u) => u.chart_anchors),
  ];
  const diversified = forceDiversifyChartAnchors(plan.units, pool, {
    reuse_cap: cap,
    prior_reuse_tokens: prior,
  });
  const restamped = diversified.map((u) => {
    const oldP = oldByPath.get(u.path) ?? "";
    const newP = u.chart_anchors[0]?.trim() ?? "";
    if (!oldP || !newP || oldP === newP) return u;
    const evidence = (u.evidence ?? "").split(`⟦w:${oldP}⟧`).join(`⟦w:${newP}⟧`);
    return { ...u, evidence };
  });
  const { units } = softStripUnmatchedDeepEvidenceAnchors(restamped);
  const next: DeepEvidencePlan = { ...plan, units };
  const afterPrimaries = units
    .map((u) => u.chart_anchors[0]?.trim() ?? "")
    .filter(Boolean);
  const after = validatePrimaryReuseCap([...prior, ...afterPrimaries], { cap });
  if (!after.ok) {
    return {
      plan: next,
      repaired: true,
      still_fail: `deep_evidence_primary_reuse_cap:${after.offenders[0] ?? "overflow"}`,
    };
  }
  return { plan: next, repaired: true };
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

/** Menu label prefix per moat — must match metaphysics-moat-feed REF_PREFIX. */
export const P4_MOAT_REF_PREFIX: Record<P4MoatMeansType, string> = {
  timing: "时机候选",
  polarity: "极性候选",
  archetype: "角色候选",
};

export function moatClassFromCandidateRef(
  ref: string | null | undefined,
): P4MoatMeansType | null {
  const t = (ref ?? "").trim();
  if (t.startsWith(P4_MOAT_REF_PREFIX.timing)) return "timing";
  if (t.startsWith(P4_MOAT_REF_PREFIX.polarity)) return "polarity";
  if (t.startsWith(P4_MOAT_REF_PREFIX.archetype)) return "archetype";
  return null;
}

/**
 * Feed hint table is built with feed-local eligible×unitCount; plan slots may
 * use a different slice + prealloc cap → path[i] ref type ≠ slot.moat_class.
 * Realign prefer_candidate_ref (+ type-matched claim) to the planned moat.
 */
export function realignP4PreferBindingsToMoat(
  planned: readonly PlannedAssignSlot[],
  feedText?: string | null,
): PlannedAssignSlot[] {
  if (!planned.some((p) => p.moat_class)) return [...planned];
  const hints = parseAssignPathHintsFromFeed(feedText);
  const claimsByMoat: Record<P4MoatMeansType, string[]> = {
    timing: [],
    polarity: [],
    archetype: [],
  };
  const citesByMoat: Record<P4MoatMeansType, string[]> = {
    timing: [],
    polarity: [],
    archetype: [],
  };
  for (const h of hints) {
    const m = moatClassFromCandidateRef(h.prefer_candidate_ref);
    if (!m) continue;
    if (h.prefer_claim?.trim()) claimsByMoat[m].push(h.prefer_claim.trim());
    if (h.prefer_cite?.trim()) citesByMoat[m].push(h.prefer_cite.trim());
  }
  const ordinal: Record<P4MoatMeansType, number> = {
    timing: 0,
    polarity: 0,
    archetype: 0,
  };
  return planned.map((slot) => {
    const moat = slot.moat_class;
    if (!moat) return slot;
    const idx = ++ordinal[moat];
    const ref = `${P4_MOAT_REF_PREFIX[moat]}${idx}`;
    const claimPool = claimsByMoat[moat];
    const citePool = citesByMoat[moat];
    const prefer_claim =
      (claimPool.length > 0
        ? claimPool[(idx - 1) % claimPool.length]
        : undefined) || slot.prefer_claim;
    const prefer_cite =
      (citePool.length > 0
        ? citePool[(idx - 1) % citePool.length]
        : undefined) || slot.prefer_cite;
    return {
      ...slot,
      prefer_candidate_ref: ref,
      prefer_claim,
      prefer_cite,
    };
  });
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
  const closed = isClosedMenuAssign(planned);
  const tally = tallyAnchorCategoryUsage(
    opts.prior_chart_anchors ?? [],
    opts.category_token_sets,
  );
  const layerA = formatAnchorCategoryUsageForPrompt(tally);
  const layerB = closed
    ? "【闭集库存】本页 closed-menu：slug/dimension 已由派工表锁死；库存仅对照，禁止写入 necessary_signals.slug。"
    : formatLayerBInventoryMenu(opts.category_token_sets);

  const planLines = planned
    .map((p, i) => {
      const bits: string[] = [`path=${p.path}`];
      if (p.moat_class) bits.push(`moat_class=${p.moat_class}`);
      if (p.locked_signals?.length) {
        const ls = p.locked_signals
          .map(
            (s) =>
              `${s.slug}@${s.dimension_id}${s.fact_hint ? `(${s.fact_hint.slice(0, 40)})` : ""}`,
          )
          .join(",");
        bits.push(`locked_signals=${ls}`);
      } else if (p.allowed_signals?.length) {
        bits.push(
          `allowed_range=${p.allowed_signals.map((s) => `${s.slug}@${s.dimension_id}`).join("、")}`,
        );
      } else if (p.prefer_primary) {
        bits.push(`prefer_primary=${p.prefer_primary}`);
      }
      if (p.prefer_candidate_ref) {
        bits.push(`prefer_candidate_ref=${p.prefer_candidate_ref}`);
      }
      if (p.prefer_cite) bits.push(`prefer_cite=${p.prefer_cite}`);
      if (p.prefer_claim) bits.push(`prefer_claim=${p.prefer_claim}`);
      return `${i + 1}. ${bits.join(" ")}`;
    })
    .join("\n");

  const locked0 = planned[0]?.locked_signals?.[0];
  const rangeOpen =
    planned.length > 0 &&
    planned.every(
      (p) =>
        (p.allowed_signals?.length ?? 0) >= 2 && !(p.locked_signals?.length),
    );
  const factPackOpen = planned.length > 0 && planned.every((p) => p.fact_pack_mode);
  const foundationDiscover = factPackOpen && key === "foundation";
  if (foundationDiscover) {
    const inventory = opts.thesis_structured
      ? buildFoundationRelationInventory(opts.thesis_structured)
      : [];
    const list = inventory.map((row) => `${row.id} ${row.claim}`).join("\n");
    const n = planned.length;
    const system = `# 你是谁
你是交付页【归因发现】专员。这一步只从清单里选出彼此不同的关系编号。不写批断，不写表象，不写新的生克。

# 人设
只根据这张盘做归因。不做执行教练。

# 任务
读【问题与期望】和【处境材料】。它们只说明问的是哪一类事。
从【本盘合法关系】里选出 ${n} 个不同编号。选中的关系要和这个问题有关，彼此不是同一条。

# 边界
- 只输出编号。禁止改写结构句。禁止另写生克、宫位或摘录。
- 禁止把【处境材料】、问题、期望里的原句写进输出。
- 编号必须来自清单。条数等于待选条数。不得重复。
- 本提示没有合格样句。清单是这张盘的全部合法关系。

# 输出
只输出一个 JSON 对象，无 markdown 围栏。键只有 page 和 pick_ids。`;
    const userParts: string[] = [
      `## 本页\n固定标签【${tag}】 · key=${key}`,
      `## 待选条数\n${n}`,
    ];
    if (opts.question_expectation?.trim()) {
      userParts.push(`## 问题与期望\n${opts.question_expectation.trim()}`);
    }
    if (opts.foundation_surface_feed?.trim()) {
      userParts.push(opts.foundation_surface_feed.trim());
    }
    userParts.push(
      `## 本盘合法关系\n只许从下面编号里选。结构句已经写好。\n${list || "（空）"}`,
    );
    userParts.push(
      `## 输出\n只输出 JSON：page="${key}"，pick_ids 长度 ${n}，编号互异且来自上面的清单。不要输出 unit_claim 或 calc_cite。`,
    );
    return { system, user: userParts.join("\n\n") };
  }
  if (factPackOpen) {
    const n = planned.length;
    const pageDuty = assignDutyForKey(key, tag);
    const system = `# 你是谁
你是交付页【深度依据·派工】专员。这一步只定每张卡要证的**本盘结构主张**和真算短摘录。不锁词，不写批断，不写本页用户可见正文。

# 人设
只根据这张盘做归因。不做执行教练。

${pageDuty}

# 共用形状（硬）
读【本盘事实档】与（若有）【本地真算料】。为派工表每个 path 写一句 unit_claim + 一句 calc_cite。
- unit_claim：一句短结构主张（含日主/柱干支/用喜忌/十神/合冲刑害/大运流年等）。允许用喜忌通关方向。按上面「本页派工任务」分层，禁止把 fill 手段写进主张；写到结构关系为止（运岁未熟/用忌失衡/十神透干/客克主主方受制等），**禁止**主张尾巴接「不宜冒进」「易思虑」「宜等待」「宜以客位进取开创」「宜进取开创」等执行/攻守嘱咐白话；**禁止**把【处境材料】/问题期望里的议题结论或生活表象贴进主张尾巴。
- calc_cite：**原样连续**摘自事实档或真算料（整行或行内连续片段，可截断）。禁止改写拼接多字段；禁止白话结论与「宜等待/暗示…」处方腔；禁止把 unit_claim 整句当摘录；**禁止**把手段菜单/派工 refr 里的职场白话当摘录。
- **unit_claim 与 calc_cite 必须不同**：主张是解释，摘录是材料里的另一段短原文。
- 不选 slug；necessary_signals=[]；chart_anchors=[]。
- 禁止长文与能力说明书。输出严格 JSON，无 markdown 围栏。

# 输出形状
{
  "page": "${key}",
  "units": [
    {
      "path": "${planned[0]?.path ?? "unit[0]"}",
      "unit_claim": "一句本盘结构主张",
      "necessary_signals": [],
      "removal_test": { "passed": true, "notes": "派工不锁词" },
      "signal_count_rationale": "不锁词",
      "chart_anchors": [],
      "calc_cite": "事实档或真算短摘录",
      "means_candidate_ref": "${planned[0]?.prefer_candidate_ref ?? "菜单短标签"}"
    }
  ]
}
- units 须覆盖派工表全部 ${n} 个 path。本提示没有合格样句。`;
    const userParts: string[] = [
      `## 本页\n固定标签【${tag}】 · key=${key}`,
      `## 派工表（只锁 path；主张与摘录由你写）\n${planLines}`,
    ];
    if (opts.chart_fact_pack?.trim()) {
      userParts.push(`## 本盘事实档\n${opts.chart_fact_pack.trim()}`);
    }
    if (opts.eastern_calc_slice?.trim()) {
      userParts.push(`## 本地真算料\n${opts.eastern_calc_slice.trim()}`);
    }
    if (key === "risk_guard" && opts.risk_calc_slice?.trim()) {
      userParts.push(`## 熔断算料\n${opts.risk_calc_slice.trim()}`);
    }
    if (opts.question_expectation?.trim()) {
      userParts.push(
        `## 问题与期望（议题方向·禁止写入主张或摘录）\n${opts.question_expectation.trim()}`,
      );
    }
    userParts.push(
      `## 输出\n只输出 JSON：page="${key}"，units 覆盖派工表全部 path；每条 unit_claim 为一句结构主张（按上面本页派工任务），calc_cite 须能在事实档/真算料对上；necessary_signals=[]；chart_anchors=[]。`,
    );
    return { system, user: userParts.join("\n\n") };
  }
  const system = rangeOpen
    ? `# 你是谁
你是交付页【深度依据·派工】专员。每张卡已经喂了本盘 Range。你按这张卡要说明的主张，从 Range 里取真正用到的词。

# 边界（硬）
- slug 只能来自该 path 的 allowed_range。禁止 Range 外的神煞、干支、库存词。
- 条数不设上限，也不为凑数写用不到的词。主张需要几个就写几个。
- 每个选用的词必填 dimension_id（用 Range 上标注的维）+ role + why_needed + inference_zh。
- **unit_claim**：一句结构主张；**禁止**把 calc_cite 原句粘上去。
- inference_zh：机制链（词 → 对本卡主张的作用）。禁十二长生/神煞影子。
- **禁止合盘式推理**：主语只能是「你」。
- role：≤20 字；why_needed：须含「去掉此信号则无法解释…」。
- signal_count_rationale：写实际条数，例如「6个——本卡主张用到」。
- chart_anchors 等于选用 slug，顺序一致。代码不再按条数裁切。
- 输出严格 JSON，无 markdown 围栏。

# 输出形状
{
  "page": "${key}",
  "units": [
    {
      "path": "${planned[0]?.path ?? "why_cards[0]"}",
      "unit_claim": "${planned[0]?.prefer_claim ?? "本单元结构主张"}",
      "necessary_signals": [
        { "slug": "Range内真词", "dimension_id": "resource_pattern", "inference_zh": "针对本 claim 的机制", "role": "本信号解释的子命题", "why_needed": "去掉此信号后论证断在哪" }
      ],
      "removal_test": { "passed": true, "notes": "选用的词各自承重" },
      "signal_count_rationale": "按本卡主张实际条数",
      "chart_anchors": ["Range内真词"],
      "calc_cite": "${planned[0]?.prefer_cite ?? "真算短摘录"}",
      "means_candidate_ref": "${planned[0]?.prefer_candidate_ref ?? "菜单短标签"}"
    }
  ]
}
- units 须覆盖派工表全部 path。示例里的一条信号只是形状，不是条数。`
    : closed
    ? `# 你是谁
你是交付页【深度依据·派工】专员（closed-menu）。slug 与 dimension_id **已由代码锁死**；你只写解释文字。

# 边界（硬）
- 【禁止】改 slug、改 dimension_id、增减 necessary_signals 条数、另选库存真词。
- 【必填】每条 locked 信号写 role + why_needed + inference_zh；removal_test；calc_cite；means_candidate_ref；unit_claim。
- **unit_claim**：一句**结构主张**（为何此表象在本盘成立）；**禁止**「此表象说明结构上：」+ calc_cite 原句粘贴。
- inference_zh：2 句内机制链（slug 结构 → 对本卡表象的作用）；禁粘贴 conclusion_zh；禁十二长生/神煞影子；禁「你感到你在该结构下更易感到」叠词套话。
- **禁止合盘式推理**：表象可引用对方原话；inference/role/why **主语只能是你**——写合局/十神如何让你感到绑定、从属、难开口，禁「伙伴/他期望|希望|要求…」。
- role：≤20 字点明本信号子命题；why_needed：须含「去掉此信号则无法解释…」且指向**你的**结构缺口。
- 同 dimension_id 跨页禁近似 inference_zh；同 slug 禁近似 role。
- calc_cite / means_candidate_ref：优先跟派工表 prefer_*（可润色）。
- signal_count_rationale：写「${planned[0]?.locked_signals?.length ?? 1}个——派工表锁定」即可。
- chart_anchors 填 locked slug 投影（代码会再对齐）。
- 【推理纪律】禁止长篇推演。写完立刻输出 JSON。
- 输出严格 JSON，无 markdown 围栏。

# 输出形状
{
  "page": "${key}",
  "units": [
    {
      "path": "${planned[0]?.path ?? "why_cards[0]"}",
      "unit_claim": "${planned[0]?.prefer_claim ?? "本单元结构主张"}",
      "necessary_signals": [
        { "slug": "${locked0?.slug ?? "真词"}", "dimension_id": "${locked0?.dimension_id ?? "resource_pattern"}", "inference_zh": "针对本 claim 的新推论", "role": "本信号解释的子命题", "why_needed": "去掉此信号后论证断在哪" }
      ],
      "removal_test": { "passed": true, "notes": "锁定信号已承重" },
      "signal_count_rationale": "${planned[0]?.locked_signals?.length ?? 1}个——派工表锁定",
      "chart_anchors": ["${locked0?.slug ?? "真词"}"],
      "calc_cite": "${planned[0]?.prefer_cite ?? "真算短摘录"}",
      "means_candidate_ref": "${planned[0]?.prefer_candidate_ref ?? "菜单短标签"}"
    }
  ]
}
- units 须覆盖派工表全部 path；每条 necessary_signals 条数必须等于该 path 的 locked_signals。`
    : `# 你是谁
你是交付页【深度依据·派工】专员。为每个 path 锁路由绑定（锚 + 真算摘录 + 主张 + 菜单回溯），不写长 evidence。

# 边界（硬）
- 【不写】长 evidence / 白话正文 / means 正文。
- 【每条 unit 必填】necessary_signals(1–${MAX_NECESSARY_SIGNALS}) + removal_test + signal_count_rationale + calc_cite + means_candidate_ref + unit_claim。
- chart_anchors = necessary_signals[].slug 的有序投影（代码会强制对齐）；数量由本段结论决定，**禁止**为凑数写死「目标3个」。
- necessary_signals 字段：slug（必填）+ role + why_needed；**有命盘总纲时 dimension_id + inference_zh 必填**（六维闭集；inference 针对本 claim，禁粘贴 conclusion_zh）。
- **总纲接地（硬）**：slug 必须能在所引 dimension 的 classical_basis（present）/ usable_claims_hint / strength_verdict 原文中找到；禁止用总纲未验证的神煞/十二长生/历史大运步承重。维标错（如巳寅相刑标成 cycle_rhythm）代码会 thesis_gap。
- **禁止空壳 slug**：不要写「大运/流年/用神/喜神/忌神/日主/藏干」单独承重；必须落到总纲具体词核（如丁酉、丙午、水、正官、身弱）。禁止十二长生名承重（与神煞同级，未扩维前 parked）。禁止单天干/单地支承重（prose 有十神则用十神）。
- **slug ↔ inference 同指（硬）**：necessary_signals[].slug 必须是该条 inference_zh 里真正承重的那个总纲具体词。禁止 slug 与推理各说各的（如 slug=食神、推理只讲正印；slug=甲/日主、推理只讲伤官/正财）。代码会从 inference∩总纲确定性改写，但你应一次写对。
- signal_count_rationale 声称的「N个」必须等于 necessary_signals 实际条数。
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
    closed
      ? `## 派工表（locked_signals 已锁死 slug+维；你只填解释）\n${planLines}`
      : `## 派工表（锁死 path / moat / prefer_* 四元组；你填锚+绑定）\n${planLines}`,
  ];
  if (opts.chart_fact_pack?.trim()) {
    userParts.push(`## 本盘事实档\n${opts.chart_fact_pack.trim()}`);
  }
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
    if (closed) {
      userParts.push(
        `【闭集·对照用·不得入 slug】\n${opts.structured_inventory.trim()}`,
      );
    } else if (opts.chart_thesis_block?.trim()) {
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
    closed
      ? `## 输出\n只输出 JSON：page="${key}", units 覆盖派工表全部 path；每条 necessary_signals 条数=locked；只改写 role/why_needed/inference_zh。`
      : `## 输出\n只输出 JSON：page="${key}", units 长度 ${pageEvidenceUnitBounds(key).min}–${planned.length}（可少于上限），每条 path+necessary_signals+removal_test+signal_count_rationale+chart_anchors+calc_cite+means_candidate_ref+unit_claim。`,
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

function softPolishClosedMenuAssignment(
  assignment: DeepEvidenceAssignment,
  planned: readonly PlannedAssignSlot[],
  knownParties: readonly string[] = [],
  opts?: {
    pageKey?: DeliverySegmentKey;
    primaryName?: string;
    backupName?: string;
  },
): { assignment: DeepEvidenceAssignment; repaired: boolean } {
  const byPath = new Map(planned.map((p) => [p.path, p]));
  let repaired = false;
  const pageKey = opts?.pageKey;
  const trackPrimary = opts?.primaryName?.trim();
  const trackBackup = opts?.backupName?.trim();

  const thinClaimLead = /^此表象说明结构上[：:]\s*/;
  const norm = (s: string) => s.replace(/\s+/g, "");
  /** Intimacy/partnership template weld: foundation only (Lab science/P4/P5 cite「关系」盲焊债). */
  const allowFrictionWeld = pageKey === "foundation" || pageKey == null;

  const units = assignment.units.map((u) => {
    const slot = byPath.get(u.path);
    let next = { ...u };
    const cite = (u.calc_cite ?? "").trim();
    let claim = (u.unit_claim ?? "").trim();

    const preferClaimRaw = slot?.prefer_claim?.trim();
    const preferClaim = preferClaimRaw
      ? scrubAssignClaimBanSeed(preferClaimRaw)
      : undefined;
    const slug = slot?.locked_signals?.[0]?.slug ?? u.chart_anchors[0] ?? "";
    const scrubbedClaim = scrubAssignClaimBanSeed(claim);
    if (scrubbedClaim !== claim && scrubbedClaim.length >= 6) {
      next = { ...next, unit_claim: scrubbedClaim.slice(0, 120) };
      repaired = true;
      claim = scrubbedClaim.slice(0, 120);
    } else if (
      scrubbedClaim.length < 6 &&
      claim.length >= 6 &&
      preferClaim &&
      preferClaim.length >= 6
    ) {
      next = { ...next, unit_claim: preferClaim.slice(0, 120) };
      repaired = true;
      claim = preferClaim.slice(0, 120);
    }
    // P4/P3: strip stance/means tails (宜以客位进取开创…) after ban-seed scrub.
    if (pageKey === "metaphysics_action" || pageKey === "science_action") {
      const meansStripped = softStripMeansLayerFromClaim(claim);
      if (
        meansStripped !== claim &&
        meansStripped.length >= 6 &&
        !isAssignStructureClaimWeak(meansStripped)
      ) {
        next = { ...next, unit_claim: meansStripped.slice(0, 120) };
        repaired = true;
        claim = meansStripped.slice(0, 120);
      }
    }

    // Cite-locked 合冲 must appear in claim so write expands relation, not bare 生克.
    if (cite.length >= 4 && claim.length >= 6) {
      const withRel = ensureClaimCarriesCiteRelationPhrases(claim, cite);
      if (withRel !== claim) {
        next = { ...next, unit_claim: withRel };
        repaired = true;
        claim = withRel;
      }
    }

    // #14: switch / day7[3] must not label P1 primary as 辅轨 destination.
    if (
      (u.path === "switch_to_backup" || u.path === "day7_micro_actions[3]") &&
      trackBackup
    ) {
      const alignedClaim = alignPrimaryBackupTrackProse(claim, {
        primaryName: trackPrimary,
        backupName: trackBackup,
        path: u.path,
      });
      if (alignedClaim !== claim && alignedClaim.length >= 6) {
        const use =
          preferClaim &&
          preferClaim.includes(trackBackup) &&
          (!trackPrimary || !preferClaim.includes(trackPrimary))
            ? preferClaim
            : alignedClaim;
        next = { ...next, unit_claim: use.slice(0, 120) };
        repaired = true;
        claim = use.slice(0, 120);
      }
      const alignedCite = alignPrimaryBackupTrackProse(cite, {
        primaryName: trackPrimary,
        backupName: trackBackup,
        path: u.path,
      });
      if (alignedCite !== cite && alignedCite.length >= 4) {
        next = { ...next, calc_cite: alignedCite.slice(0, 80) };
        repaired = true;
      }
    }

    const isThin =
      thinClaimLead.test(claim) ||
      (cite.length >= 8 && norm(claim.replace(thinClaimLead, "")) === norm(cite)) ||
      (claim.length > 0 && cite.length > 0 && norm(claim) === norm(cite));

    if (isThin) {
      const rebuilt =
        preferClaim && preferClaim.length >= 6
          ? preferClaim.slice(0, 120)
          : slug
            ? `${slug}从结构上解释本卡表象为何成立`.slice(0, 120)
            : claim.replace(thinClaimLead, "").slice(0, 120);
      if (rebuilt && rebuilt !== claim) {
        next = { ...next, unit_claim: rebuilt };
        repaired = true;
        claim = rebuilt;
      }
    }

    const surfaceBlob = `${cite}\n${claim}\n${slot?.prefer_cite ?? ""}\n${preferClaim ?? ""}`;
    const pathAllowsWeld =
      allowFrictionWeld &&
      (pageKey === "foundation" || u.path.startsWith("why_cards"));
    const weldRelationship =
      pathAllowsWeld &&
      isRelationshipFrictionSurface(surfaceBlob, knownParties);
    const weldPartnership =
      pathAllowsWeld &&
      !weldRelationship &&
      isPartnershipFrictionSurface(surfaceBlob);

    // 全局：unit_claim 与 inference 同尺软修第三方施事（勿只修解释层漏 claim）。
    {
      const claimRepaired = softRepairThirdPartyAgencyProse(claim, knownParties);
      if (claimRepaired !== claim) {
        next = { ...next, unit_claim: claimRepaired.slice(0, 120) };
        repaired = true;
        claim = claimRepaired.slice(0, 120);
      }
      if (weldRelationship && detectKnownThirdPartyAgency(claim, knownParties) && slug) {
        const weldedClaim =
          `${slug}使你在亲密关系议题上更易感到推进阻力，压力落在你侧的开口与节奏`.slice(
            0,
            120,
          );
        next = { ...next, unit_claim: weldedClaim };
        repaired = true;
        claim = weldedClaim;
      } else if (
        weldPartnership &&
        detectKnownThirdPartyAgency(claim, knownParties) &&
        slug
      ) {
        const rejection = isPartnershipRejectionSurface(surfaceBlob);
        const weldedClaim = (
          rejection
            ? `${slug}使你在全职门槛已立时更易落入配合与让步位`
            : `${slug}使你在合作推进上更易处于配合位，开口试水时压力落在你侧`
        ).slice(0, 120);
        next = { ...next, unit_claim: weldedClaim };
        repaired = true;
        claim = weldedClaim;
      }
    }

    const signals = (next.necessary_signals ?? []).map((s) => {
      const rawInference = (s.inference_zh ?? "").trim();
      let inference = collapseQuerentPressureStutter(
        softRepairThirdPartyAgencyProse(rawInference, knownParties),
      );
      let role = collapseQuerentPressureStutter(
        softRepairThirdPartyAgencyProse(s.role ?? "", knownParties),
      );
      let why = collapseQuerentPressureStutter(
        softRepairThirdPartyAgencyProse(s.why_needed ?? "", knownParties),
      );

      // Scheme C: intimacy only → intimacy template; 创业伙伴/兼职 → partnership template.
      if (weldRelationship && slug) {
        const welded = relationshipFrictionInferenceTemplate(slug);
        if (inference !== welded) {
          inference = welded;
          repaired = true;
        }
        if (detectKnownThirdPartyAgency(role, knownParties)) {
          role = `说明${slug}如何加重你在关系议题上的推进阻力`.slice(0, 80);
          repaired = true;
        }
        if (detectKnownThirdPartyAgency(why, knownParties)) {
          why = `去掉此信号则无法说明关系议题上压力为何落在你侧`.slice(0, 80);
          repaired = true;
        }
      } else if (weldPartnership && slug) {
        const rejection = isPartnershipRejectionSurface(surfaceBlob);
        const welded = rejection
          ? partnershipRejectionInferenceTemplate(slug)
          : partnershipFrictionInferenceTemplate(slug);
        if (inference !== welded) {
          inference = welded;
          repaired = true;
        }
        if (
          rejection ||
          detectKnownThirdPartyAgency(role, knownParties) ||
          /希望我|他明确|伙伴期望|对方|更难把兼职试水说出口/.test(role)
        ) {
          role = (
            rejection
              ? `说明${slug}如何加重全职门槛下你侧的配合压力`
              : `说明${slug}如何加重你在合作推进上的开口压力`
          ).slice(0, 80);
          repaired = true;
        }
        if (
          detectKnownThirdPartyAgency(why, knownParties) ||
          /希望我|他明确|伙伴期望|对方/.test(why) ||
          (rejection && /更难把兼职试水说出口/.test(why))
        ) {
          why = (
            rejection
              ? `去掉此信号则无法说明全职门槛下压力为何落在你侧`
              : `合局压力下你更难把兼职试水说出口`
          ).slice(0, 80);
          repaired = true;
        }
      } else {
        const surfacePartner =
          /伙伴|旧部|对方|他明确|希望我全职|兼职/.test(`${cite}\n${claim}`);
        if (
          surfacePartner &&
          slug &&
          !inference.includes(slug) &&
          inference.length < 24
        ) {
          const rejection = isPartnershipRejectionSurface(`${cite}\n${claim}`);
          inference = (
            rejection
              ? `${slug}形成外部合化压力，全职门槛下你更易落入配合与让步位`
              : `${slug}形成外部合化压力，${inference || "你更难在兼职试水上开口"}`
          ).slice(0, 160);
          repaired = true;
        }
      }

      if (
        inference !== (s.inference_zh ?? "").trim() ||
        role !== (s.role ?? "").trim() ||
        why !== (s.why_needed ?? "").trim()
      ) {
        repaired = true;
      }
      return {
        ...s,
        inference_zh: inference || s.inference_zh,
        role: role || s.role,
        why_needed: why || s.why_needed,
      };
    });

    return {
      ...next,
      necessary_signals: signals,
      chart_anchors: anchorsFromNecessarySignals(signals, { cap: signals.length }),
    };
  });

  return { assignment: { ...assignment, units }, repaired };
}

function restampClosedMenuAssignment(
  assignment: DeepEvidenceAssignment,
  planned: readonly PlannedAssignSlot[],
): DeepEvidenceAssignment {
  const byPath = new Map(planned.map((p) => [p.path, p]));
  const units = assignment.units.map((u) => {
    const slot = byPath.get(u.path);
    if (!slot?.locked_signals?.length) return u;
    const forced = forceApplyLockedSignals(
      u.necessary_signals ?? [],
      slot.locked_signals,
    );
    if (!forced.ok) return u;
    return {
      ...u,
      necessary_signals: forced.signals,
      chart_anchors: anchorsFromNecessarySignals(forced.signals, {
        cap: forced.signals.length,
      }),
    };
  });
  return { ...assignment, units };
}

function keepSignalsInsideRange(
  signals: readonly NecessarySignal[],
  allowed: readonly LockedAssignSignal[],
): { ok: true; signals: NecessarySignal[] } | { ok: false; reason: string } {
  const byKey = new Map<string, LockedAssignSignal>();
  for (const item of allowed) {
    const k = normalizePrimaryReuseKey(item.slug);
    if (k && !byKey.has(k)) byKey.set(k, item);
  }
  const kept: NecessarySignal[] = [];
  const seen = new Set<string>();
  for (const signal of signals) {
    const k = normalizePrimaryReuseKey(signal.slug);
    const hit = k ? byKey.get(k) : undefined;
    if (!hit || !k || seen.has(k)) {
      if (k && !hit) return { ok: false, reason: `out_of_range:${signal.slug}` };
      continue;
    }
    seen.add(k);
    kept.push({
      ...signal,
      slug: hit.slug,
      dimension_id: hit.dimension_id,
    });
  }
  if (kept.length < 1) return { ok: false, reason: "range_empty" };
  return { ok: true, signals: kept };
}

function forceApplyLockedSignals(
  signals: NecessarySignal[],
  locked: readonly LockedAssignSignal[],
): { ok: true; signals: NecessarySignal[] } | { ok: false; reason: string } {
  const out: NecessarySignal[] = [];
  for (let i = 0; i < locked.length; i++) {
    const L = locked[i]!;
    const fromModel =
      signals.find((s) => s.slug.trim() === L.slug) ?? signals[i] ?? null;
    const inference = (fromModel?.inference_zh ?? "").trim();
    const role = (fromModel?.role ?? "").trim();
    const why = (fromModel?.why_needed ?? "").trim();
    if (!inference) {
      return { ok: false, reason: `locked_inference_missing:${L.slug}` };
    }
    if (!role) {
      return { ok: false, reason: `locked_role_missing:${L.slug}` };
    }
    if (!why) {
      return { ok: false, reason: `locked_why_missing:${L.slug}` };
    }
    out.push({
      slug: L.slug,
      dimension_id: L.dimension_id,
      inference_zh: inference,
      role,
      why_needed: why,
    });
  }
  return { ok: true, signals: out };
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
      ? u.chart_anchors.map((x) => String(x).trim()).filter(Boolean)
      : [];
    const slotForCap = planned.find((p) => p.path === path);
    const rangeCap = slotForCap?.allowed_signals?.length;
    if (!rangeCap && !slotForCap?.fact_pack_mode) anchors = anchors.slice(0, 4);
    if (necessary_signals.length >= 1 && !slotForCap?.fact_pack_mode) {
      anchors = anchorsFromNecessarySignals(necessary_signals, {
        cap: rangeCap && rangeCap >= 2 ? rangeCap : undefined,
      });
    }
    if (slotForCap?.fact_pack_mode) anchors = [];
    const calc_cite = trimAssignField(u.calc_cite ?? u.cite, 80);
    const means_candidate_ref = trimAssignField(
      u.means_candidate_ref ?? u.candidate_ref ?? u.menu_ref,
      48,
    );
    const unit_claim = trimAssignField(u.unit_claim ?? u.claim, 120);
    if (path && (anchors.length >= 1 || planned.find((p) => p.path === path)?.fact_pack_mode)) {
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
    const calc_cite = resolveAssignCalcCite({
      model_cite: bind.calc_cite,
      prefer_cite: p.prefer_cite,
      unit_claim: bind.unit_claim,
      prefer_claim: p.prefer_claim,
      inference_zh: bind.necessary_signals[0]?.inference_zh,
    });
    let means_candidate_ref =
      p.moat_class && p.prefer_candidate_ref?.trim()
        ? p.prefer_candidate_ref.trim().slice(0, 48)
        : bind.means_candidate_ref.length >= 2
          ? bind.means_candidate_ref
          : (p.prefer_candidate_ref?.trim().slice(0, 48) ?? "");
    if (p.moat_class) {
      const prefix = P4_MOAT_REF_PREFIX[p.moat_class];
      if (moatClassFromCandidateRef(means_candidate_ref) !== p.moat_class) {
        means_candidate_ref = (p.prefer_candidate_ref?.trim() || `${prefix}1`).slice(
          0,
          48,
        );
        if (moatClassFromCandidateRef(means_candidate_ref) !== p.moat_class) {
          means_candidate_ref = `${prefix}1`;
        }
      }
    }
    let unit_claim =
      bind.unit_claim.length >= 6
        ? bind.unit_claim
        : (p.prefer_claim?.trim().slice(0, 120) ?? "");
    if (
      p.moat_class &&
      p.prefer_claim?.trim() &&
      isUsableAssignPreferClaim(p.prefer_claim) &&
      (isHangingUnitClaim(unit_claim) || isAssignStructureClaimWeak(unit_claim))
    ) {
      unit_claim = p.prefer_claim.trim().slice(0, 120);
    }
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

    if (p.fact_pack_mode) {
      signals = [];
      rationale = "事实档写批断；派工不锁词";
      if (!removal) removal = { passed: true, notes: "fact pack; signals not locked" };
    } else if (p.locked_signals?.length) {
      const forced = forceApplyLockedSignals(signals, p.locked_signals);
      if (!forced.ok) {
        return fail(`contract:${forced.reason}:${p.path}`);
      }
      signals = forced.signals;
      rationale =
        rationale.trim() ||
        `${p.locked_signals.length}个——派工表锁定`;
      if (!removal) {
        removal = { passed: true, notes: "closed-menu locked signals" };
      }
    } else if (p.allowed_signals?.length) {
      const kept = keepSignalsInsideRange(signals, p.allowed_signals);
      if (!kept.ok) return fail(`contract:${kept.reason}:${p.path}`);
      signals = kept.signals;
      rationale = rationale.trim() || `${signals.length}个——本卡主张用到`;
      if (!removal) {
        removal = { passed: true, notes: "range membership checked" };
      }
    } else if (signals.length < 1) {
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

    const signalCap = p.allowed_signals?.length;
    const repaired = softRepairNecessarySignals({
      unit_claim,
      necessary_signals: signals,
      removal_test: removal,
      prior_signal_roles: priorRoles,
      path: p.path,
      max_signals: signalCap && signalCap >= 2 ? signalCap : undefined,
    });
    signals = repaired.necessary_signals;
    removal = repaired.removal_test;
    if (p.fact_pack_mode) {
      signals = [];
    }
    // Re-assert locked slug/dim after soft-repair (must not drift).
    if (p.locked_signals?.length) {
      const forced2 = forceApplyLockedSignals(signals, p.locked_signals);
      if (!forced2.ok) {
        return fail(`contract:${forced2.reason}:${p.path}`);
      }
      signals = forced2.signals;
    }
    let contractFail: string | null = null;
    if (!p.fact_pack_mode) {
      contractFail = validateNecessarySignalsContract({
        unit_claim,
        necessary_signals: signals,
        removal_test: removal,
        signal_count_rationale: rationale,
        prior_signal_roles: priorRoles,
        max_signals: signalCap && signalCap >= 2 ? signalCap : undefined,
      });
    }
    // Second pass: cross rewrite can re-introduce intra collisions (and vice versa).
    if (contractFail) {
      const repaired2 = softRepairNecessarySignals({
        unit_claim,
        necessary_signals: signals,
        removal_test: removal,
        prior_signal_roles: priorRoles,
        path: p.path,
        max_signals: signalCap && signalCap >= 2 ? signalCap : undefined,
      });
      signals = repaired2.necessary_signals;
      removal = repaired2.removal_test;
      repaired.repairs.push(...repaired2.repairs.map((r) => `r2:${r}`));
      if (p.locked_signals?.length) {
        const forced3 = forceApplyLockedSignals(signals, p.locked_signals);
        if (!forced3.ok) {
          return fail(`contract:${forced3.reason}:${p.path}`);
        }
        signals = forced3.signals;
      }
      contractFail = validateNecessarySignalsContract({
        unit_claim,
        necessary_signals: signals,
        removal_test: removal,
        signal_count_rationale: rationale,
        prior_signal_roles: priorRoles,
        max_signals: signalCap && signalCap >= 2 ? signalCap : undefined,
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
      chart_anchors: anchorsFromNecessarySignals(signals, {
        cap: signalCap && signalCap >= 2 ? signalCap : MAX_NECESSARY_SIGNALS,
      }),
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
    // Eligible must union eastern slice + moat feed: feed carries 用神/忌神 lines
    // that slice-only infer often misses → polarity dropped from locked table.
    const eligible = inferP4MoatEligibleTypes(
      [opts.eastern_calc_slice, opts.metaphysics_moat_feed]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join("\n"),
    );
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
  let seeded = seedPlannedBindings(base, opts);
  if (key === "metaphysics_action") {
    seeded = realignP4PreferBindingsToMoat(seeded, opts.metaphysics_moat_feed);
  }
  if (opts.chart_fact_pack?.trim()) {
    // Fact pack is the only cite/claim vocabulary. Means-feed prefer_cite/claim
    // (e.g.「技术是核心价值」「利于和解与协议」) must not appear on the派工表 —
    // models copy them into calc_cite and fail cite_not_in_pack.
    return seeded.map((slot, i) => ({
      ...slot,
      fact_pack_mode: true,
      locked_signals: undefined,
      allowed_signals: undefined,
      // Fact pack is cite vocabulary — clear feed prefer_cite so models don't
      // paste menu action prose into calc_cite. P4 keep prefer_claim (structure
      // claim_seed) so hanging unit_claim can soft-fill; keep prefer_candidate_ref.
      prefer_cite: undefined,
      prefer_claim:
        key === "metaphysics_action" ? slot.prefer_claim : undefined,
      prefer_primary: undefined,
      prefer_candidate_ref:
        key === "foundation"
          ? `归因${i + 1}`
          : slot.prefer_candidate_ref,
    }));
  }
  if (
    CLOSED_MENU_DEEP_ASSIGN_KEYS.has(key) &&
    opts.chart_thesis?.dimensions?.length
  ) {
    // Honor surface rematch (seed prefer_primary) over raw job prealloc map.
    const preferMerged: Record<string, string> = {
      ...(opts.prealloc_prefer_by_path ?? {}),
    };
    for (const s of seeded) {
      const p = s.prefer_primary?.trim();
      if (p) preferMerged[s.path] = p;
    }
    seeded = applyClosedMenuLocks(seeded, opts.chart_thesis, key, {
      avoid_primaries: opts.prior_chart_anchors,
      prefer_by_path: preferMerged,
      group_by_path: opts.prealloc_term_groups,
    }).planned;
  }
  return seeded;
}

function resolveAllowedRange(
  planned: readonly PlannedAssignSlot[],
  thesis: ChartThesis,
  groups: Readonly<Record<string, readonly string[]>>,
): PlannedAssignSlot[] | null {
  const menu = buildThesisAssignMenu(thesis);
  if (menu.length === 0) return null;
  const next: PlannedAssignSlot[] = [];
  for (const slot of planned) {
    const group = groups[slot.path];
    if (!group || group.length < 2) return null;
    const allowed: LockedAssignSignal[] = [];
    const seen = new Set<string>();
    for (const slug of group) {
      const key = normalizePrimaryReuseKey(slug);
      const hit = menu.find((m) => normalizePrimaryReuseKey(m.slug) === key);
      if (!hit) continue;
      const k = normalizePrimaryReuseKey(hit.slug);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      allowed.push({
        slug: hit.slug,
        dimension_id: hit.dimension_id,
        fact_hint: hit.fact_hint,
      });
    }
    if (allowed.length < 2) return null;
    next.push({
      ...slot,
      allowed_signals: allowed,
      prefer_primary: slot.prefer_primary?.trim() || allowed[0]!.slug,
      locked_signals: undefined,
    });
  }
  return next.length === planned.length ? next : null;
}

/**
 * D1: overlay this-chart range, or legacy one-lock when no range was fed.
 * Returns fail_reason when menu empty/underfill — caller must not free-select.
 * Cross-page: pass prior primaries + job prefer_by_path so science≠foundation echo.
 */
export function applyClosedMenuLocks(
  planned: readonly PlannedAssignSlot[],
  thesis: ChartThesis | null | undefined,
  key?: DeliverySegmentKey,
  crossPage?: {
    avoid_primaries?: readonly string[];
    prefer_by_path?: Readonly<Record<string, string>>;
    group_by_path?: Readonly<Record<string, readonly string[]>>;
  },
): { planned: PlannedAssignSlot[]; fail_reason?: string } {
  if (!thesis?.dimensions?.length) {
    return { planned: [...planned], fail_reason: "assign:menu_empty:no_thesis" };
  }
  const groups = crossPage?.group_by_path;
  if (groups && Object.values(groups).some((g) => (g?.length ?? 0) >= 2)) {
    const ranged = resolveAllowedRange(planned, thesis, groups);
    if (ranged) return { planned: ranged };
  }
  const alloc = preallocateClosedMenuSignals({
    thesis,
    paths: planned.map((p) => p.path),
    last_path_prefer_dims:
      key === "foundation" ? FOUNDATION_LAST_CARD_PREFER_DIMS : undefined,
    avoid_primaries: crossPage?.avoid_primaries,
    prefer_by_path: crossPage?.prefer_by_path
      ? { ...crossPage.prefer_by_path }
      : undefined,
    moat_by_path:
      key === "metaphysics_action"
        ? Object.fromEntries(
            planned.map((p) => [p.path, p.moat_class ?? null] as const),
          )
        : undefined,
  });
  if (!alloc.ok) {
    return { planned: [...planned], fail_reason: alloc.reason };
  }
  const next = planned.map((slot) => {
    const locked = alloc.by_path[slot.path];
    if (!locked?.length) return { ...slot };
    return {
      ...slot,
      locked_signals: locked,
      prefer_primary: locked[0]!.slug,
    };
  });
  return { planned: next };
}

/**
 * D1: foundation closed-menu locks (last card prefers cycle/strength).
 * @deprecated prefer applyClosedMenuLocks(planned, thesis, "foundation")
 */
export function applyFoundationClosedMenuLocks(
  planned: readonly PlannedAssignSlot[],
  thesis: ChartThesis | null | undefined,
): { planned: PlannedAssignSlot[]; fail_reason?: string } {
  return applyClosedMenuLocks(planned, thesis, "foundation");
}

/** True when every planned unit is closed to this chart (quota lock or range). */
export function isClosedMenuAssign(
  planned: readonly PlannedAssignSlot[],
): boolean {
  return (
    planned.length > 0 &&
    planned.every(
      (p) =>
        (p.locked_signals?.length ?? 0) > 0 ||
        (p.allowed_signals?.length ?? 0) >= 2,
    )
  );
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
    prealloc_term_groups: input.opts.prealloc_term_groups,
    chart_fact_pack: input.opts.chart_fact_pack,
    prealloc_max_units: input.opts.prealloc_max_units,
    chart_thesis: input.opts.chart_thesis ?? null,
  });
  // Slug menu is not the step-1 vocabulary when the chart fact pack is present.
  if (CLOSED_MENU_DEEP_ASSIGN_KEYS.has(input.key) && !input.opts.chart_fact_pack?.trim()) {
    if (!input.opts.chart_thesis?.dimensions?.length) {
      return {
        ok: false,
        reason: "assign:menu_empty:no_thesis",
        tokens_used: 0,
      };
    }
    if (!isClosedMenuAssign(planned)) {
      const { fail_reason } = applyClosedMenuLocks(
        planned,
        input.opts.chart_thesis,
        input.key,
        {
          avoid_primaries: input.opts.prior_chart_anchors,
          prefer_by_path: input.opts.prealloc_prefer_by_path,
          group_by_path: input.opts.prealloc_term_groups,
        },
      );
      return {
        ok: false,
        reason: fail_reason ?? "assign:menu_empty",
        tokens_used: 0,
      };
    }
  }
  const foundationSelect =
    input.key === "foundation" && planned.every((p) => p.fact_pack_mode);
  let relationInventory: FoundationRelation[] = [];
  if (foundationSelect) {
    const structured = input.opts.thesis_structured;
    if (!structured) {
      return { ok: false, reason: "assign:inventory_empty", tokens_used: 0 };
    }
    relationInventory = buildFoundationRelationInventory(structured);
    if (relationInventory.length < planned.length) {
      return { ok: false, reason: "assign:inventory_short", tokens_used: 0 };
    }
  }
  const closedMenu = isClosedMenuAssign(planned);
  const knownThirdParties = extractKnownThirdParties({
    extra_blobs: [
      input.opts.question_expectation,
      input.opts.reality_constraints,
      input.opts.foundation_surface_feed,
      input.opts.science_means_feed,
      input.opts.metaphysics_moat_feed,
      input.opts.risk_fuse_feed,
      input.opts.close_ritual_feed,
    ],
  });
  const thesisCoverageOpts =
    knownThirdParties.length > 0
      ? { known_third_parties: knownThirdParties }
      : undefined;
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
  const ASSIGN_MAX_TOKENS = closedMenu
    ? ASSIGN_CLOSED_MENU_MAX_TOKENS
    : ASSIGN_FREE_SELECT_MAX_TOKENS;
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
        user = foundationSelect
          ? `${userBase}\n\n【纠错】上一稿无可见 JSON（finish=${finish ?? "null"}）。只输出 pick_ids JSON。`
          : `${userBase}\n\n【纠错】上一稿无可见 JSON（finish=${finish ?? "null"}）。点完锚点后立刻输出完整 units JSON。`;
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
        user = foundationSelect
          ? `${userBase}\n\n【纠错】上一稿 JSON 不完整。只输出 page 与 pick_ids。`
          : `${userBase}\n\n【纠错】上一稿 JSON 不完整。点完锚点后立刻输出完整 units 数组。`;
        continue;
      }
      const failOut = { reason: "shape_fail" };
      if (foundationSelect) {
        const ids = readFoundationPickIds(parsed);
        const bound = ids
          ? bindFoundationRelationPicks(
              relationInventory,
              ids,
              planned.map((p) => p.path),
            )
          : {
              ok: false as const,
              reason: "assign:pick_shape",
              picks: [] as Array<{ path: string; id: string; claim: string; cite: string }>,
            };
        const draft: DeepEvidenceAssignment = {
          page: "foundation",
          units: bound.picks.map((pick, i) => ({
            path: pick.path,
            chart_anchors: [],
            calc_cite: pick.cite,
            means_candidate_ref: `归因${i + 1}`,
            unit_claim: pick.claim,
            necessary_signals: [],
            removal_test: { passed: true, notes: "" },
            signal_count_rationale: "事实档写批断；派工不锁词",
          })),
        };
        if (!bound.ok) {
          lastReason = bound.reason.replace(/^assign:/, "");
          lastRejectedDraft = draft;
          if (bound.reason === "assign:pick_shape") {
            user = `${userBase}\n\n【纠错】pick_ids 条数必须等于待选条数，且每个编号都是非空字符串。只重出 JSON。`;
            continue;
          }
          return {
            ok: false,
            reason: bound.reason,
            tokens_used,
            rejected_draft: draft,
            last_raw_text: text,
          };
        }
        return { ok: true, assignment: draft, tokens_used };
      }
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
        if (closedMenu && lastReason.startsWith("contract:")) {
          lastRejectedDraft = undefined;
          break;
        }
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
      if (planned.every((p) => p.fact_pack_mode)) {
        // Foundation select returns earlier. Non-foundation fact-pack: soft-fix
        // claim-paste cites + personality/means tails, then hang + category gates.
        // Hang runs *after* soft-strip so mid-claim brochure removal can leave a
        // finished structure sentence (e.g. keep「与食神形成结构对比」).
        const gateOpts = {
          chart_fact_pack: input.opts.chart_fact_pack,
          eastern_calc_slice: input.opts.eastern_calc_slice,
          situation_material: [
            input.opts.question_expectation,
            input.opts.reality_constraints,
          ]
            .map((s) => (s ?? "").trim())
            .filter(Boolean)
            .join("\n"),
        };
        const soft = softRepairFactPackAssignCites(
          locked.units.map((u) => ({
            path: u.path,
            unit_claim: u.unit_claim ?? "",
            calc_cite: u.calc_cite ?? "",
          })),
          gateOpts,
        );
        let assignmentFact = locked;
        if (soft.repaired) {
          const byPath = new Map(soft.units.map((u) => [u.path, u]));
          assignmentFact = {
            ...locked,
            units: locked.units.map((u) => {
              const r = byPath.get(u.path);
              return r ? { ...u, calc_cite: r.calc_cite, unit_claim: r.unit_claim } : u;
            }),
          };
          console.info("[delivery/deep-evidence] assign fact-pack cite soft-repaired", {
            key: input.key,
            attempt,
            paths: soft.units
              .filter((u, i) => {
                const prev = locked.units[i];
                return (
                  u.calc_cite !== (prev?.calc_cite ?? "") ||
                  u.unit_claim !== (prev?.unit_claim ?? "")
                );
              })
              .map((u) => u.path),
          });
        }
        if (input.key === "metaphysics_action") {
          const hang = assignmentFact.units.find((u) =>
            isHangingUnitClaim(u.unit_claim ?? ""),
          );
          if (hang) {
            lastReason = `unit_claim_truncated:${hang.path}`;
            lastRejectedDraft = assignmentFact;
            if (attempt < 2) {
              user = `${userBase}\n\n【纠错】${hang.path} 的 unit_claim 是半截句（以「为/中/的/且…」等悬挂收尾或不完整）。请写成一句完整的本盘结构主张（日主/柱干支/用喜忌/十神/合冲/大运流年写满），禁止断在「为」「合伙中」之类；性格白话（思虑/求稳等）不要写进主张。`;
              continue;
            }
            return {
              ok: false,
              reason: lastReason,
              tokens_used,
              rejected_draft: assignmentFact,
              last_raw_text: text,
            };
          }
        }
        const claimFail = assessFactPackAssignClaims(
          assignmentFact.units.map((u) => ({
            path: u.path,
            unit_claim: u.unit_claim ?? "",
            calc_cite: u.calc_cite ?? "",
            moat_class: u.moat_class ?? null,
          })),
          gateOpts,
        );
        if (claimFail) {
          lastReason = claimFail;
          lastRejectedDraft = assignmentFact;
          console.warn("[delivery/deep-evidence] assign fact-pack claim gate", {
            key: input.key,
            attempt,
            reason: claimFail,
          });
          if (attempt < 2) {
            user = `${userBase}\n\n${factPackAssignClaimRetryHint(claimFail)}`;
            continue;
          }
          return {
            ok: false,
            reason: claimFail,
            tokens_used,
            rejected_draft: assignmentFact,
            last_raw_text: text,
          };
        }
        return { ok: true, assignment: assignmentFact, tokens_used };
      }
      if (input.key === "metaphysics_action") {
        const hang = locked.units.find((u) => isHangingUnitClaim(u.unit_claim ?? ""));
        if (hang) {
          lastReason = `unit_claim_truncated:${hang.path}`;
          lastRejectedDraft = locked;
          if (attempt < 2) {
            user = `${userBase}\n\n【纠错】${hang.path} 的 unit_claim 是半截句（以「为/中/的/且…」等悬挂收尾或不完整）。请写成一句完整的本盘结构主张（日主/柱干支/用喜忌/十神/合冲/大运流年写满），禁止断在「为」「合伙中」之类。`;
            continue;
          }
          return {
            ok: false,
            reason: lastReason,
            tokens_used,
            rejected_draft: locked,
            last_raw_text: text,
          };
        }
      }
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
        if (closedMenu) break;
        user = `${userBase}\n\n【纠错·主承重复用】${lastReason}。跨页+本页 chart_anchors[0] 同一主词不得超过 reuse_cap；请换未超限的真词作主承重（跟 prefer_primary / 库存），立刻输出完整 JSON。`;
        continue;
      }
      const moatFail = validateAssignmentMoatAnchors(assignment);
      if (moatFail) {
        // Closed-menu: model draft may carry non-moat primaries; restamp from
        // moat-aware locks below. Free-select still LLM-corrects here.
        if (!closedMenu) {
          lastReason = moatFail;
          lastRejectedDraft = assignment;
          console.warn("[delivery/deep-evidence] assign moat-anchor mismatch", {
            key: input.key,
            attempt,
            reason: moatFail,
          });
          user = `${userBase}\n\n【纠错·moat】${moatFail}。timing 槽须含大运/流年/岁运/气候交织或岁运干支或奇门局势（值符/值使/主客/门宫）；polarity 须含用神/忌神/身弱等；archetype 须含十神角色。从整份真算料重点，立刻输出完整 JSON。`;
          continue;
        }
      }
      const diversifyFail = validateAssignmentAnchorDiversity(assignment);
      if (diversifyFail) {
        // Rule 11: deterministic soft-repair — do not LLM-retry quality Jaccard.
        const softDiv = softRepairAssignmentAnchorDiversity(assignment, {
          pool,
          allowed_primaries: reserved.length > 0 ? reserved : undefined,
          thesis: input.opts.chart_thesis,
          page_primary_cap: 1,
        });
        if (softDiv.repaired) {
          assignment = softDiv.assignment;
          console.info("[delivery/deep-evidence] assign anchor-reuse soft-repaired", {
            key: input.key,
            attempt,
            before: diversifyFail,
            primaries: assignment.units.map((u) => u.chart_anchors[0]),
            still_fail: softDiv.still_fail ?? null,
          });
        }
        const stillDiv =
          softDiv.still_fail ?? validateAssignmentAnchorDiversity(assignment);
        if (stillDiv) {
          lastReason = stillDiv;
          lastRejectedDraft = assignment;
          console.warn("[delivery/deep-evidence] assign anchor reuse (soft-repair exhausted)", {
            key: input.key,
            attempt,
            reason: stillDiv,
          });
          break;
        }
      }
      if (closedMenu) {
        let lockPlan = planned;
        assignment = restampClosedMenuAssignment(assignment, lockPlan);
        // After restamp, moat must hold (P4 locks are moat-aware).
        let closedMoatFail = validateAssignmentMoatAnchors(assignment);
        if (closedMoatFail) {
          // Qualify-first: swap failing slots to unused moat-serving menu items.
          const swapped = softRepairPlannedMoatLocks(
            lockPlan,
            input.opts.chart_thesis,
          );
          if (swapped.repaired) {
            lockPlan = swapped.planned as PlannedAssignSlot[];
            assignment = restampClosedMenuAssignment(assignment, lockPlan);
            closedMoatFail = validateAssignmentMoatAnchors(assignment);
            if (!closedMoatFail) {
              console.info(
                "[delivery/deep-evidence] assign closed-menu moat slot-swapped",
                {
                  key: input.key,
                  attempt,
                  primaries: assignment.units.map((u) => u.chart_anchors[0]),
                },
              );
            }
          }
        }
        if (closedMoatFail) {
          // Re-alloc with prior avoids only (not page primaries — that starved moat).
          const reLocked = applyClosedMenuLocks(
            planned,
            input.opts.chart_thesis,
            input.key,
            {
              avoid_primaries: input.opts.prior_chart_anchors,
              prefer_by_path: input.opts.prealloc_prefer_by_path,
              group_by_path: input.opts.prealloc_term_groups,
            },
          );
          if (!reLocked.fail_reason && isClosedMenuAssign(reLocked.planned)) {
            lockPlan = reLocked.planned;
            assignment = restampClosedMenuAssignment(assignment, lockPlan);
            closedMoatFail = validateAssignmentMoatAnchors(assignment);
            if (closedMoatFail) {
              const swapped2 = softRepairPlannedMoatLocks(
                lockPlan,
                input.opts.chart_thesis,
              );
              if (swapped2.repaired) {
                lockPlan = swapped2.planned as PlannedAssignSlot[];
                assignment = restampClosedMenuAssignment(assignment, lockPlan);
                closedMoatFail = validateAssignmentMoatAnchors(assignment);
              }
            }
            if (!closedMoatFail) {
              console.info(
                "[delivery/deep-evidence] assign closed-menu moat soft-repaired",
                {
                  key: input.key,
                  attempt,
                  primaries: assignment.units.map((u) => u.chart_anchors[0]),
                },
              );
            }
          }
        }
        if (closedMoatFail) {
          lastReason = closedMoatFail;
          lastRejectedDraft = assignment;
          console.warn("[delivery/deep-evidence] assign moat-anchor mismatch", {
            key: input.key,
            attempt,
            reason: closedMoatFail,
          });
          break;
        }
        const thirdFixed = softRepairAssignmentThirdPartySignals(
          assignment,
          knownThirdParties,
        );
        if (thirdFixed.repaired) {
          assignment = thirdFixed.assignment;
          console.info("[delivery/deep-evidence] assign third_party soft-repaired", {
            key: input.key,
            attempt,
            known_parties: knownThirdParties,
          });
        }
        const trackNames = parsePrimaryBackupNamesFromFeed(
          feedForAssignKey(input.key, input.opts),
        );
        const polished = softPolishClosedMenuAssignment(
          assignment,
          lockPlan,
          knownThirdParties,
          {
            pageKey: input.key,
            primaryName: trackNames.primaryName,
            backupName: trackNames.backupName,
          },
        );
        if (polished.repaired) {
          assignment = polished.assignment;
          console.info("[delivery/deep-evidence] assign closed-menu soft-polished", {
            key: input.key,
            attempt,
          });
        }
        assignment = restampClosedMenuAssignment(assignment, lockPlan);
        // Restamp can re-inject over-cap locked primaries — re-enforce.
        const reuseAfterStamp = enforceAssignmentPrimaryReuseCap(assignment, {
          prior_primaries: input.opts.prior_chart_anchors,
          pool,
          allowed_primaries: reserved.length > 0 ? reserved : undefined,
          reuse_cap: input.opts.primary_reuse_cap ?? DEFAULT_PRIMARY_REUSE_CAP,
        });
        assignment = reuseAfterStamp.assignment;
        if (reuseAfterStamp.fail_reason) {
          lastReason = reuseAfterStamp.fail_reason;
          lastRejectedDraft = assignment;
          console.warn(
            "[delivery/deep-evidence] assign primary-reuse still over cap after restamp",
            { key: input.key, attempt, reason: lastReason },
          );
          break;
        }
        if (reuseAfterStamp.repaired) {
          // Keep lockPlan in sync so later restamps don't re-inject over-cap slugs.
          lockPlan = lockPlan.map((slot) => {
            const u = assignment.units.find((x) => x.path === slot.path);
            const slug = u?.chart_anchors[0]?.trim();
            const rawDim =
              u?.necessary_signals?.[0]?.dimension_id ??
              slot.locked_signals?.[0]?.dimension_id;
            if (!slug || !rawDim || !isThesisDimensionId(rawDim)) return slot;
            if (!slot.locked_signals?.length) return slot;
            const rest = slot.locked_signals.filter(
              (s) => normalizePrimaryReuseKey(s.slug) !== normalizePrimaryReuseKey(slug),
            );
            return {
              ...slot,
              prefer_primary: slug,
              locked_signals: [
                {
                  slug,
                  dimension_id: rawDim,
                  fact_hint: slot.locked_signals[0]?.fact_hint,
                },
                ...rest,
              ].slice(0, MAX_NECESSARY_SIGNALS),
            };
          });
        }
        let closedThesisFail = validateAssignmentThesisCoverage(
          assignment,
          input.opts.chart_thesis,
          thesisCoverageOpts,
        );
        if (closedThesisFail) {
          // Deterministic re-lock: drop the offending primary and re-pick from menu.
          const badTok =
            closedThesisFail.split(":").slice(2).find((p) => p.trim().length >= 2) ??
            "";
          const pagePrimariesNow = assignment.units
            .map((u) => u.chart_anchors[0]?.trim() ?? "")
            .filter(Boolean);
          const reLocked = applyClosedMenuLocks(
            planned,
            input.opts.chart_thesis,
            input.key,
            {
              avoid_primaries: [
                ...(input.opts.prior_chart_anchors ?? []),
                ...pagePrimariesNow,
                ...(badTok ? [badTok] : []),
              ],
              prefer_by_path: input.opts.prealloc_prefer_by_path,
              group_by_path: input.opts.prealloc_term_groups,
            },
          );
          if (!reLocked.fail_reason && isClosedMenuAssign(reLocked.planned)) {
            lockPlan = reLocked.planned;
            assignment = restampClosedMenuAssignment(assignment, lockPlan);
            closedThesisFail = validateAssignmentThesisCoverage(
              assignment,
              input.opts.chart_thesis,
              thesisCoverageOpts,
            );
            if (!closedThesisFail) {
              console.info(
                "[delivery/deep-evidence] assign closed-menu thesis_gap soft-repaired",
                {
                  key: input.key,
                  attempt,
                  dropped: badTok || null,
                  primaries: assignment.units.map((u) => u.chart_anchors[0]),
                },
              );
            }
          }
        }
        if (closedThesisFail) {
          lastReason = closedThesisFail;
          lastRejectedDraft = assignment;
          console.warn("[delivery/deep-evidence] assign closed-menu thesis_gap", {
            key: input.key,
            attempt,
            reason: closedThesisFail,
          });
          break;
        }
        // Same cross-page primary gate as write merge — fail here, don't burn 6 write invokes.
        const pagePrimaries = assignment.units
          .map((u) => u.chart_anchors[0]?.trim() ?? "")
          .filter(Boolean);
        let cross = assessCrossPagePrimaryAnchorReuse({
          page_primaries: pagePrimaries,
          prior_chart_anchors: input.opts.prior_chart_anchors ?? [],
          category_token_sets: input.opts.category_token_sets,
        });
        if (!cross.ok) {
          const reLocked = applyClosedMenuLocks(
            planned,
            input.opts.chart_thesis,
            input.key,
            {
              avoid_primaries: [
                ...(input.opts.prior_chart_anchors ?? []),
                ...pagePrimaries,
              ],
              prefer_by_path: input.opts.prealloc_prefer_by_path,
              group_by_path: input.opts.prealloc_term_groups,
            },
          );
          if (!reLocked.fail_reason && isClosedMenuAssign(reLocked.planned)) {
            assignment = restampClosedMenuAssignment(
              assignment,
              reLocked.planned,
            );
            const repairedPrimaries = assignment.units
              .map((u) => u.chart_anchors[0]?.trim() ?? "")
              .filter(Boolean);
            cross = assessCrossPagePrimaryAnchorReuse({
              page_primaries: repairedPrimaries,
              prior_chart_anchors: input.opts.prior_chart_anchors ?? [],
              category_token_sets: input.opts.category_token_sets,
            });
            if (cross.ok) {
              console.info(
                "[delivery/deep-evidence] assign cross-page primary soft-repaired",
                {
                  key: input.key,
                  attempt,
                  primaries: repairedPrimaries,
                },
              );
            }
          }
        }
        if (!cross.ok) {
          lastReason = cross.reason;
          lastRejectedDraft = assignment;
          console.warn("[delivery/deep-evidence] assign cross-page primary reuse", {
            key: input.key,
            attempt,
            reason: cross.reason,
            notes: cross.notes,
            primaries: assignment.units.map((u) => u.chart_anchors[0]),
          });
          break;
        }
        console.info("[delivery/deep-evidence] assign ok (closed-menu)", {
          key: input.key,
          units: assignment.units.length,
          primaries: assignment.units.map((u) => u.chart_anchors[0]),
          attempt,
        });
        return { ok: true, assignment, tokens_used };
      }
      let thesisFail = validateAssignmentThesisCoverage(
        assignment,
        input.opts.chart_thesis,
        thesisCoverageOpts,
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
            thesisCoverageOpts,
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
          thesisCoverageOpts,
        );
        if (stripped.stripped_slugs.length > 0) {
          console.info("[delivery/deep-evidence] assign soft-strip thesis gaps", {
            key: input.key,
            attempt,
            stripped: stripped.stripped_slugs,
            reminted: stripped.reminted_slugs,
            emptied: stripped.emptied_paths,
          });
        }
        if (stripped.emptied_paths.length > 0) {
          const { min } = pageEvidenceUnitBounds(input.key);
          const keptUnits = stripped.assignment.units.filter(
            (u) => (u.necessary_signals?.length ?? 0) > 0,
          );
          if (keptUnits.length >= min) {
            let trimmed: DeepEvidenceAssignment = {
              ...stripped.assignment,
              units: keptUnits,
            };
            const softDiv = softRepairAssignmentAnchorDiversity(trimmed, {
              pool: [
                ...reserved,
                ...trimmed.units.flatMap((u) => u.chart_anchors),
              ],
              allowed_primaries: reserved.length > 0 ? reserved : undefined,
              thesis: input.opts.chart_thesis,
              page_primary_cap: 1,
            });
            if (softDiv.repaired) trimmed = softDiv.assignment;
            const afterDrop = validateAssignmentThesisCoverage(
              trimmed,
              input.opts.chart_thesis,
              thesisCoverageOpts,
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
        let afterAssignment = stripped.assignment;
        const softDivAfterStrip = softRepairAssignmentAnchorDiversity(
          afterAssignment,
          {
            pool: [
              ...reserved,
              ...afterAssignment.units.flatMap((u) => u.chart_anchors),
            ],
            allowed_primaries: reserved.length > 0 ? reserved : undefined,
            thesis: input.opts.chart_thesis,
            page_primary_cap: 1,
          },
        );
        if (softDivAfterStrip.repaired) {
          afterAssignment = softDivAfterStrip.assignment;
          console.info(
            "[delivery/deep-evidence] assign anchor-reuse soft-repaired after strip",
            {
              key: input.key,
              attempt,
              primaries: afterAssignment.units.map((u) => u.chart_anchors[0]),
            },
          );
        }
        const afterStrip = validateAssignmentThesisCoverage(
          afterAssignment,
          input.opts.chart_thesis,
          thesisCoverageOpts,
        );
        const moatAfter = validateAssignmentMoatAnchors(afterAssignment);
        const divAfter = validateAssignmentAnchorDiversity(afterAssignment);
        if (!afterStrip && !moatAfter && !divAfter) {
          console.info("[delivery/deep-evidence] assign ok after soft-strip", {
            key: input.key,
            stripped: stripped.stripped_slugs,
            attempt,
          });
          return { ok: true, assignment: afterAssignment, tokens_used };
        }
        lastReason =
          afterStrip ?? moatAfter ?? divAfter ?? thesisFail ?? "thesis_gap";
        lastRejectedDraft = afterAssignment;
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
