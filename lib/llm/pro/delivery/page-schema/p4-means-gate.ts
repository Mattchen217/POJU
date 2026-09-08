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

  const timingLine =
    withoutBanLine.match(/timing_ripeness:\s*([^\n]+)/) ??
    withoutBanLine.match(/(?:^|\n)-?\s*timing:\s*([^\n]+)/);
  const timingVal = (timingLine?.[1] ?? "").trim();
  const hasTimingVal =
    Boolean(timingVal) && timingVal !== "(缺失)" && timingVal !== "(无)";
  const hasPhaseDims = /阶段相关多维:\n\s*- 【/.test(withoutBanLine);
  const hasDayunSemantic =
    /【大运语义|大运语义 SSOT|dayun_semantic|【大运\/阶段节奏 SSOT|【大运\/阶段节奏/.test(
      withoutBanLine,
    ) && /干支|起运|岁|转折|阶段|冲|藏|守/.test(withoutBanLine);
  if (
    hasTimingVal ||
    hasPhaseDims ||
    hasDayunSemantic ||
    /current_da_yun_cycle/.test(withoutBanLine)
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

const P3_SCIENCE_EXEC =
  /邮件|话术|授权|日历|Slack|谈判|战绩夹|现金缓冲|buffer|calendar|email|script|ownership|副手|STAR|MVP|清单勾选|周报模板|KPI仪表/i;

/** Project-management / life-coach stems that must not dominate P4 means (东方药方页). */
const P3_COACH_PM =
  /兼职顾问|全职创业|止损线|应急储备|财务安全垫|安全垫增厚|周固定独处|深度独处|试水计划|里程碑|工时约定|每周\s*\d|辞职|追加资金|副业收入|写一份.{0,12}计划|合同协商|创业伙伴协商|KPI|项目管理/;

/** Strategy+means blob must cite mechanism — not atmosphere-only “纪元”. */
export function blobMentionsMoatMechanism(
  blob: string,
  cls: P4MoatMeansType,
): boolean {
  const t = blob ?? "";
  if (cls === "timing") {
    const hasEra = /大运|岁运|流年|运程|阶段窗|纪元|岁环|运势/.test(t);
    if (!hasEra) return false;
    return /多久|转折|切换|窗口|起运|交运|换运|阶段切换|等待|再图|节奏变化|运势转折|岁运交接|策略切换/.test(
      t,
    );
  }
  if (cls === "polarity") {
    return /用神|忌神|喜神|补泄|补给|消耗|虚旺|五行|靠近|远离|补泻/.test(t);
  }
  return /(比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印|十神|官杀|格局|借势|开创|角色|角色定位|官杀气质)/.test(
    t,
  );
}

function dimStrategyMeansBlob(dim: {
  means?: unknown;
  chart_anchors?: unknown;
  strategy?: unknown;
}): string {
  const strategy = String(dim.strategy ?? "");
  const anchors = Array.isArray(dim.chart_anchors)
    ? dim.chart_anchors.map(String).join(" ")
    : "";
  const meansBits: string[] = [];
  if (Array.isArray(dim.means)) {
    for (const m of dim.means) {
      if (typeof m === "string") meansBits.push(m);
      else if (m && typeof m === "object") {
        const o = m as Record<string, unknown>;
        meansBits.push(String(o.text ?? o.body ?? o.action ?? ""));
      }
    }
  }
  return `${strategy}\n${anchors}\n${meansBits.join("\n")}`;
}

/**
 * Batch3 B: strategy+means must carry ≥2 moat *mechanism* classes (when eligible),
 * and must not be dominated by P3 science-execution stems.
 */
export function gateP4StrategyMoat(input: {
  dimensions: readonly {
    means?: unknown;
    chart_anchors?: unknown;
    strategy?: unknown;
  }[];
  eastern_calc_slice?: string | null;
  /** Optional P3 page prose for coarse echo detection. */
  p3_body_excerpt?: string | null;
  notes?: string[];
}): P4PageMoatGateResult {
  const notes = [...(input.notes ?? [])];
  const eligible = inferP4MoatEligibleTypes(input.eastern_calc_slice);
  const covered = new Set<P4MoatMeansType>();
  let scienceHitDims = 0;
  let coachPmHitDims = 0;

  for (const dim of input.dimensions) {
    const blob = dimStrategyMeansBlob(dim);
    for (const cls of ["timing", "polarity", "archetype"] as const) {
      if (blobMentionsMoatMechanism(blob, cls)) covered.add(cls);
    }
    if (P3_SCIENCE_EXEC.test(blob)) scienceHitDims += 1;
    if (P3_COACH_PM.test(blob)) coachPmHitDims += 1;
  }

  const eligibleList = [...eligible];
  const coveredList = [...covered];
  notes.push(
    `p4_strategy_moat_eligible:${eligibleList.join(",") || "(none)"}`,
    `p4_strategy_moat_covered:${coveredList.join(",") || "(none)"}`,
    `p4_strategy_science_dims:${scienceHitDims}`,
    `p4_strategy_coach_pm_dims:${coachPmHitDims}`,
  );

  // Coarse P3 body echo (optional excerpt)
  const p3 = (input.p3_body_excerpt ?? "").trim();
  if (p3.length >= 40 && input.dimensions.length >= 2) {
    const p4Join = input.dimensions.map((d) => dimStrategyMeansBlob(d)).join("\n");
    const norm = (s: string) => s.replace(/\s+/g, "").slice(0, 800);
    const A = norm(p4Join);
    const B = norm(p3);
    let inter = 0;
    const grams = new Set<string>();
    for (let i = 0; i < B.length - 1; i++) grams.add(B.slice(i, i + 2));
    for (let i = 0; i < A.length - 1; i++) {
      if (grams.has(A.slice(i, i + 2))) inter++;
    }
    const denom = Math.max(1, A.length - 1);
    const ratio = inter / denom;
    notes.push(`p4_body_echo_p3_ratio:${ratio.toFixed(2)}`);
    if (ratio >= 0.35) {
      return {
        notes,
        structural: true,
        structural_reason: "p4_body_echo_p3",
        eligible: eligibleList,
        covered: coveredList,
      };
    }
  }

  if (scienceHitDims >= 2 && covered.size < 2) {
    return {
      notes,
      structural: true,
      structural_reason: "p4_science_exec_means",
      eligible: eligibleList,
      covered: coveredList,
    };
  }

  // Coach/PM stems dominating means — even if strategy name-drops 补给/窗口.
  if (coachPmHitDims >= 2) {
    return {
      notes,
      structural: true,
      structural_reason: "p4_coach_pm_means",
      eligible: eligibleList,
      covered: coveredList,
    };
  }

  if (eligible.size >= 2) {
    const hit = eligibleList.filter((t) => covered.has(t)).length;
    if (hit < 2) {
      return {
        notes,
        structural: true,
        structural_reason: "p4_strategy_moat_thin",
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
        structural_reason: "p4_strategy_moat_thin",
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

/**
 * Page-level moat coverage: when eastern slice supports ≥2 moat classes, means across
 * all dimensions must cover ≥2 of those eligible classes. Thin data → do not invent.
 * Also runs gateP4StrategyMoat (mechanism semantics + anti P3 echo).
 */
export function gateP4PageMoatCoverage(input: {
  dimensions: readonly {
    means?: unknown;
    chart_anchors?: unknown;
    strategy?: unknown;
  }[];
  eastern_calc_slice?: string | null;
  p3_body_excerpt?: string | null;
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

  const strategyMoat = gateP4StrategyMoat({
    dimensions: input.dimensions,
    eastern_calc_slice: input.eastern_calc_slice,
    p3_body_excerpt: input.p3_body_excerpt,
    notes: [],
  });
  notes.push(...strategyMoat.notes);
  if (strategyMoat.structural) {
    return {
      notes,
      structural: true,
      structural_reason: strategyMoat.structural_reason,
      eligible: eligibleList,
      covered: coveredList,
    };
  }

  return {
    notes,
    structural: false,
    eligible: eligibleList,
    covered: coveredList,
  };
}

/**
 * Code guarantee: deep assign already locked path → moat_class.
 * Stamp means.type from that table before sanitize/moat gates so coverage
 * does not depend on the model copying type into JSON.
 *
 * Mutates a shallow-cloned dimensions list on the page root; returns notes.
 */
export function stampP4MeansTypesFromDeepPlan(
  root: Record<string, unknown>,
  plan: {
    page?: string;
    units: readonly { path: string; moat_class?: P4MoatMeansType | null }[];
  } | null | undefined,
): string[] {
  const notes: string[] = [];
  if (!plan?.units?.length) return notes;
  if (plan.page && plan.page !== "metaphysics_action") return notes;

  const locks = new Map<number, P4MoatMeansType>();
  for (const u of plan.units) {
    if (!u.moat_class || !isP4MoatMeansType(u.moat_class)) continue;
    const m = /dimensions\[(\d+)\]/.exec(u.path);
    if (!m) continue;
    locks.set(Number(m[1]), u.moat_class);
  }
  if (locks.size === 0) return notes;

  const dimsRaw = root.dimensions ?? root.dims_list ?? root.angles;
  if (!Array.isArray(dimsRaw) || dimsRaw.length === 0) return notes;

  const nextDims = dimsRaw.map((d, i) => {
    const moat = locks.get(i);
    if (!moat) return d;
    if (!d || typeof d !== "object" || Array.isArray(d)) return d;
    const dim = { ...(d as Record<string, unknown>) };
    const meansRaw = Array.isArray(dim.means) ? [...dim.means] : [];
    if (meansRaw.length === 0) {
      notes.push(`p4_moat_type_stamp_skip_empty:${i}:${moat}`);
      return dim;
    }

    let stamped = false;
    const stampedMeans = meansRaw.map((item, mi) => {
      if (stamped) return item;
      if (typeof item === "string") {
        const text = item.trim();
        if (!text) return item;
        stamped = true;
        notes.push(`p4_moat_type_stamped:${i}:${moat}:str`);
        return { text, type: moat };
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const text = String(o.text ?? o.body ?? o.action ?? "").trim();
        if (!text) return item;
        const prev = String(o.type ?? "").trim().toLowerCase();
        stamped = true;
        if (prev === moat) {
          notes.push(`p4_moat_type_already:${i}:${moat}`);
          return item;
        }
        notes.push(
          prev
            ? `p4_moat_type_stamped:${i}:${prev}->${moat}`
            : `p4_moat_type_stamped:${i}:${moat}:obj`,
        );
        return { ...o, type: moat };
      }
      return item;
    });

    if (!stamped) {
      notes.push(`p4_moat_type_stamp_skip_empty:${i}:${moat}`);
      return dim;
    }
    // Ensure the locked class is first so soft order prefers it.
    const lockedIdx = stampedMeans.findIndex((m) => {
      if (!m || typeof m !== "object") return false;
      return String((m as { type?: unknown }).type ?? "").toLowerCase() === moat;
    });
    if (lockedIdx > 0) {
      const [hit] = stampedMeans.splice(lockedIdx, 1);
      stampedMeans.unshift(hit);
      notes.push(`p4_moat_type_promoted:${i}:${moat}`);
    }
    dim.means = stampedMeans;
    return dim;
  });

  if (Array.isArray(root.dimensions)) root.dimensions = nextDims;
  else if (Array.isArray(root.dims_list)) root.dims_list = nextDims;
  else if (Array.isArray(root.angles)) root.angles = nextDims;
  else root.dimensions = nextDims;

  return notes;
}

