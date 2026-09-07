/**
 * P4 means gate — anti-literal wuxing + moat coverage (timing/polarity/archetype).
 * Uses wuxing-semantic-ssot (same table as prompt injection).
 *
 * Moat pass/fail is PAGE-level (see gateP4PageMoatCoverage). Per-dimension gate
 * only strips literals and normalizes means list — no rhythm-first / symbol-cap.
 */

import {
  classifyMeansActionType,
  inferWuxingElementsFromText,
  isP4MoatMeansType,
  textHitsBlacklist,
  type MeansActionType,
  type P4MoatMeansType,
  type WuxingElement,
} from "@/lib/glossary/wuxing-semantic-ssot";

export type RawMeansItem =
  | string
  | {
      text?: unknown;
      type?: unknown;
      body?: unknown;
      action?: unknown;
    };

function asMeansText(raw: RawMeansItem): { text: string; declared: MeansActionType | null } {
  if (typeof raw === "string") {
    return { text: raw.trim(), declared: null };
  }
  if (raw && typeof raw === "object") {
    const text = String(raw.text ?? raw.body ?? raw.action ?? "").trim();
    const ty = String(raw.type ?? "").trim().toLowerCase();
    const declared =
      ty === "timing" ||
      ty === "polarity" ||
      ty === "archetype" ||
      ty === "rhythm" ||
      ty === "mindset" ||
      ty === "symbol" ||
      ty === "field"
        ? (ty as MeansActionType)
        : null;
    return { text, declared };
  }
  return { text: "", declared: null };
}

export type P4MeansGateResult = {
  means: string[];
  notes: string[];
  /** Types kept after literal drop (for page-level moat tally). */
  kept_types: MeansActionType[];
  /** True when fill should retry (literal primary / empty after drops). */
  structural: boolean;
  structural_reason?: string;
};

/**
 * Infer which moat dimensions have real calc support in the eastern fill slice.
 * Conservative: ban-list / instruction lines alone do not count.
 */
export function inferP4MoatEligibleTypes(
  slice: string | null | undefined,
): Set<P4MoatMeansType> {
  const text = (slice ?? "").trim();
  const out = new Set<P4MoatMeansType>();
  if (!text) return out;

  const withoutBanLine = text.replace(/【用户可见禁词】[^\n]*/g, "");

  const yongMatch = withoutBanLine.match(/(?:^|\n)-?\s*yong:\s*([^\n;]+)/i);
  const yongVal = (yongMatch?.[1] ?? "").trim();
  if (yongVal && yongVal !== "(无)" && !yongVal.startsWith("(缺失")) {
    out.add("polarity");
  } else if (
    /pack_polarity:/.test(withoutBanLine) &&
    /(?:yong|ji|用神|忌神)\s*[:=：]/.test(withoutBanLine)
  ) {
    out.add("polarity");
  }

  const timingLine = withoutBanLine.match(/timing_ripeness:\s*([^\n]+)/);
  const timingVal = (timingLine?.[1] ?? "").trim();
  const hasTimingVal =
    Boolean(timingVal) && timingVal !== "(缺失)" && timingVal !== "(无)";
  const hasPhaseDims = /阶段相关多维:\n\s*- 【/.test(withoutBanLine);
  const hasDayunSemantic =
    /【大运语义|大运语义 SSOT|dayun_semantic/.test(withoutBanLine) &&
    /干支|起运|岁|转折|阶段/.test(withoutBanLine);
  if (
    (/current_da_yun_cycle/.test(withoutBanLine) && hasTimingVal) ||
    hasPhaseDims ||
    hasDayunSemantic
  ) {
    out.add("timing");
  }

  if (
    /【十神语义|十神语义 SSOT|tengod_semantic/.test(withoutBanLine) ||
    /(比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印)/.test(withoutBanLine)
  ) {
    out.add("archetype");
  }

  return out;
}

function classifyMeansList(
  meansRaw: unknown,
  chart_anchors: readonly string[],
  strategy: string,
  notes: string[],
): {
  kept: Array<{ text: string; type: MeansActionType }>;
  droppedLiteral: number;
} {
  const elements: WuxingElement[] = inferWuxingElementsFromText(
    [...chart_anchors, strategy].join(" "),
  );
  const rawList = Array.isArray(meansRaw) ? meansRaw : [];
  const classified: Array<{ text: string; type: MeansActionType | "literal_object" }> = [];

  for (const item of rawList.slice(0, 8)) {
    const { text, declared } = asMeansText(item as RawMeansItem);
    if (!text) continue;
    const hit = textHitsBlacklist(text, elements);
    if (hit) {
      notes.push(`p4_literal_wuxing:${hit}`);
      classified.push({ text, type: "literal_object" });
      continue;
    }
    const type = classifyMeansActionType(text, declared, elements);
    if (type === "literal_object") {
      notes.push("p4_literal_wuxing:classified");
      classified.push({ text, type });
      continue;
    }
    if (declared && declared !== type && (declared === "field" || declared === "symbol")) {
      notes.push(`p4_means_type_override:${declared}->${type}`);
    }
    classified.push({ text: text.slice(0, 240), type });
  }

  const kept = classified.filter(
    (c): c is { text: string; type: MeansActionType } => c.type !== "literal_object",
  );
  const droppedLiteral = classified.length - kept.length;
  if (droppedLiteral > 0) {
    notes.push(`p4_literal_means_dropped:${droppedLiteral}`);
  }
  return { kept, droppedLiteral };
}

/**
 * Per-dimension: drop literal-object lines; keep all other types (no symbol/field cap,
 * no rhythm/mindset primacy). Empty after drops → structural.
 */
export function gateP4DimensionMeans(input: {
  meansRaw: unknown;
  chart_anchors: readonly string[];
  strategy: string;
  notes: string[];
}): P4MeansGateResult {
  const notes = [...input.notes];
  const { kept, droppedLiteral } = classifyMeansList(
    input.meansRaw,
    input.chart_anchors,
    input.strategy,
    notes,
  );

  if (kept.length === 0) {
    return {
      means: [],
      notes,
      kept_types: [],
      structural: true,
      structural_reason:
        droppedLiteral > 0 ? "p4_literal_wuxing_means" : "p4_means_empty",
    };
  }

  // Prefer moat means first in list, then rhythm/mindset, then symbol/field — soft order only
  const rank = (t: MeansActionType): number => {
    if (isP4MoatMeansType(t)) return 0;
    if (t === "rhythm" || t === "mindset") return 1;
    return 2;
  };
  const ordered = [...kept].sort((a, b) => rank(a.type) - rank(b.type)).slice(0, 8);

  return {
    means: ordered.map((c) => c.text),
    notes,
    kept_types: ordered.map((c) => c.type),
    structural: false,
  };
}

export type P4PageMoatGateResult = {
  notes: string[];
  structural: boolean;
  structural_reason?: string;
  eligible: P4MoatMeansType[];
  covered: P4MoatMeansType[];
};

/**
 * Page-level moat coverage: when eastern slice supports ≥2 moat classes, means across
 * all dimensions must cover ≥2 of those eligible classes. Thin data → do not invent.
 */
export function gateP4PageMoatCoverage(input: {
  dimensions: readonly {
    means?: unknown;
    chart_anchors?: unknown;
    strategy?: unknown;
  }[];
  eastern_calc_slice?: string | null;
  notes?: string[];
}): P4PageMoatGateResult {
  const notes = [...(input.notes ?? [])];
  const eligible = inferP4MoatEligibleTypes(input.eastern_calc_slice);
  const covered = new Set<P4MoatMeansType>();

  for (const dim of input.dimensions) {
    const anchors = Array.isArray(dim.chart_anchors)
      ? dim.chart_anchors.map((a) => String(a))
      : [];
    const strategy = String(dim.strategy ?? "");
    const { kept } = classifyMeansList(dim.means, anchors, strategy, notes);
    for (const k of kept) {
      if (isP4MoatMeansType(k.type)) covered.add(k.type);
    }
  }

  const eligibleList = [...eligible];
  const coveredList = [...covered];
  notes.push(
    `p4_moat_eligible:${eligibleList.join(",") || "(none)"}`,
    `p4_moat_covered:${coveredList.join(",") || "(none)"}`,
  );

  if (eligible.size >= 2) {
    const hit = eligibleList.filter((t) => covered.has(t)).length;
    if (hit < 2) {
      return {
        notes,
        structural: true,
        structural_reason: "p4_missing_moat_means",
        eligible: eligibleList,
        covered: coveredList,
      };
    }
  } else if (eligible.size === 1) {
    const only = eligibleList[0]!;
    if (!covered.has(only)) {
      return {
        notes,
        structural: true,
        structural_reason: "p4_missing_moat_means",
        eligible: eligibleList,
        covered: coveredList,
      };
    }
  }

  return {
    notes,
    structural: false,
    eligible: eligibleList,
    covered: coveredList,
  };
}
