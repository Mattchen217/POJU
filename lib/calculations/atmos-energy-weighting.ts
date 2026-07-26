/**
 * Atmos energy weighting: 大运 ≫ 流年 ≫ 流月 ≫ 流日.
 * Structured tones only — no natural-language fortune claims.
 */

import type { RelationLabel, RelationSource } from "@/lib/calculations/relation-engine";
import type { DayElementHelp } from "@/lib/calculations/atmos-day-element";

/** Fixed, testable layer weights. */
export const ATMOS_LAYER_WEIGHT: Record<
  Exclude<RelationSource, "natal" | "cross">,
  number
> = {
  dayun: 8,
  liunian: 4,
  liuyue: 2,
  liuri: 1,
};

export type ClimateTone = "pressured" | "supportive" | "mixed" | "neutral";
export type DayWeather = "ease" | "friction" | "volatile" | "neutral";

export type AtmosOverrideRule = {
  /** When climate is pressured, block “sprint / great luck” day readings. */
  blockSprintNarrative: boolean;
  reasonCode: "climate_pressured" | "none";
};

export type AtmosFocusSignal = {
  /** Machine cue for LLM mapping (e.g. DayBranch_Clash). */
  cueCode: string;
  relationId: string;
  weight: number;
  polarity: RelationLabel["polarity"];
  source: RelationSource;
};

export type AtmosEnergyAssessment = {
  climateTone: ClimateTone;
  dayWeather: DayWeather;
  overrideRule: AtmosOverrideRule;
  focusSignals: AtmosFocusSignal[];
  climateScore: number;
  dayScore: number;
};

function layerWeight(source: RelationSource): number {
  if (source === "dayun") return ATMOS_LAYER_WEIGHT.dayun;
  if (source === "liunian") return ATMOS_LAYER_WEIGHT.liunian;
  if (source === "liuyue") return ATMOS_LAYER_WEIGHT.liuyue;
  if (source === "liuri") return ATMOS_LAYER_WEIGHT.liuri;
  return 0;
}

function polaritySign(polarity: RelationLabel["polarity"]): number {
  if (polarity === "red") return -1;
  if (polarity === "green") return 1;
  return 0;
}

function cueCodeForRelation(r: RelationLabel): string {
  if (r.kind === "ten_god_tension") {
    if (r.id.includes("shangguan")) return "Expression_Vs_Constraint";
    if (r.id.includes("xiaoshen")) return "Introspection_Crowds_Output";
    return "TenGod_Tension";
  }
  if (r.kind === "chong" && r.positions.includes("day")) return "DayBranch_Clash";
  if (r.kind === "chong" && r.positions.includes("month")) return "MonthBranch_Clash";
  if (r.kind === "chong") return "Branch_Clash";
  if (r.kind === "xing") return "Branch_Penalty";
  if (r.kind === "hai") return "Branch_Harm";
  if (r.kind === "liuhe") return "Branch_Combine";
  if (r.kind === "banhe") return "Branch_HalfCombine";
  if (r.kind === "stem_he") return "Stem_Combine";
  return `Relation_${r.kind}`;
}

function scoreLayers(
  rels: RelationLabel[],
  sources: RelationSource[],
): number {
  let score = 0;
  for (const r of rels) {
    if (!sources.includes(r.source)) continue;
    const w = layerWeight(r.source);
    if (w <= 0) continue;
    score += w * polaritySign(r.polarity);
  }
  return score;
}

function toneFromClimateScore(score: number): ClimateTone {
  if (score <= -6) return "pressured";
  if (score >= 6) return "supportive";
  if (score <= -2 || score >= 2) return "mixed";
  return "neutral";
}

function weatherFromDayScore(
  dayScore: number,
  dayElementHelp: DayElementHelp,
  hasDayBranchClash: boolean,
): DayWeather {
  if (hasDayBranchClash) return "volatile";
  if (dayElementHelp === "drains" || dayScore <= -2) return "friction";
  if (dayElementHelp === "helps" || dayScore >= 2) return "ease";
  if (dayScore !== 0 || dayElementHelp === "mixed") return "volatile";
  return "neutral";
}

/**
 * Weight dynamic relations into climate (dayun+liunian) vs day weather (liuyue+liuri).
 */
export function assessAtmosEnergy(
  interactions: RelationLabel[],
  dayElementHelp: DayElementHelp,
  topN = 6,
): AtmosEnergyAssessment {
  const climateScore = scoreLayers(interactions, ["dayun", "liunian"]);
  const dayScore = scoreLayers(interactions, ["liuyue", "liuri"]);
  const climateTone = toneFromClimateScore(climateScore);

  const hasDayBranchClash = interactions.some(
    (r) =>
      r.source === "liuri" &&
      r.kind === "chong" &&
      r.positions.includes("day"),
  );

  const dayWeather = weatherFromDayScore(dayScore, dayElementHelp, hasDayBranchClash);

  const overrideRule: AtmosOverrideRule =
    climateTone === "pressured"
      ? { blockSprintNarrative: true, reasonCode: "climate_pressured" }
      : { blockSprintNarrative: false, reasonCode: "none" };

  const scored = interactions
    .map((r) => {
      const weight = layerWeight(r.source) * (Math.abs(polaritySign(r.polarity)) || 0.5);
      return {
        cueCode: cueCodeForRelation(r),
        relationId: r.id,
        weight,
        polarity: r.polarity,
        source: r.source,
      } satisfies AtmosFocusSignal;
    })
    .filter((s) => s.weight > 0)
    .sort(
      (a, b) =>
        b.weight - a.weight || a.relationId.localeCompare(b.relationId),
    )
    .slice(0, topN);

  return {
    climateTone,
    dayWeather,
    overrideRule,
    focusSignals: scored,
    climateScore,
    dayScore,
  };
}
