/**
 * Build TopicCalcSupplement — deterministic second local calc.
 * Does NOT wire thesis/delivery yet. No push/hold/retreat verdict field (方案B).
 *
 * Scope lock (v1): cycles/relations use 大运+流年+流月 only.
 * Atmos 流日 (liuri) exists in relation-engine for other products — NOT ingested here.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { fingerprintThesisStructured } from "@/lib/llm/pro/delivery/thesis/fingerprint";
import { resolveLuckCycles } from "@/lib/calculations/resolve-luck-cycles";
import {
  computeDayunRelations,
  computeLiunianRelations,
  computeLiuyueRelations,
  filterRelationsByCategory,
  type RelationKind,
  type RelationLabel,
} from "@/lib/calculations/relation-engine";
import { buildTopicTypedFields } from "@/lib/calculations/topic-typed-fields";
import {
  calculateTenGod,
  STEMS,
  type HeavenlyStem,
  type WuXing,
} from "@/lib/match/data/stems-branches";
import type { QuestionCategory } from "@/lib/poju/agent-state";
import {
  TOPIC_CALC_DEFAULT_PALACES,
  TOPIC_CALC_DEFAULT_TEN_GODS,
  type TopicCalcAbsentNote,
  type TopicCalcCyclePillar,
  type TopicCalcRelationHit,
  type TopicCalcRelationKind,
  type TopicCalcRhythmSignal,
  type TopicCalcSupplement,
  type TopicCalcPalace,
  type YongShenElementStance,
} from "@/lib/calculations/topic-calc-supplement/types";
import { coerceNeutralRhythmSummary } from "@/lib/calculations/topic-calc-supplement/rhythm-summary-neutral";

const ENGINE_VERSIONS = {
  relation_engine: "relation-engine@dayun+liunian+liuyue-v1",
  liunian: "resolve-luck-cycles@v1",
  topic_typed: "topic-typed-fields@v1",
  yongshen_heuristic: "element-table@v1",
} as const;

const GENERATES: Record<WuXing, WuXing> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};

const CONTROLS: Record<WuXing, WuXing> = {
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
};

export type BuildTopicCalcSupplementInput = {
  structured: ProfileStructured;
  question_category?: QuestionCategory;
  as_of?: Date;
  timezone?: string;
  /** Reserved — may weight topic_slice later; must not mutate cycles. */
  original_question?: string;
  desired_outcome?: string;
  agenda_anchors?: string[];
};

function isStem(s: string): s is HeavenlyStem {
  return s in STEMS;
}

function stemWuxing(stem: string): WuXing | null {
  const ch = stem.trim().charAt(0);
  return isStem(ch) ? STEMS[ch].wuxing : null;
}

const EN_TO_WX: Record<string, WuXing> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
  木: "木",
  火: "火",
  土: "土",
  金: "金",
  水: "水",
};

function elementFromAny(raw: string): WuXing | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (EN_TO_WX[lower]) return EN_TO_WX[lower]!;
  if (EN_TO_WX[t]) return EN_TO_WX[t]!;
  if (/[木火土金水]/.test(t)) {
    const m = t.match(/[木火土金水]/);
    return (m?.[0] as WuXing) ?? null;
  }
  return stemWuxing(t);
}

/** Pure elemental table — no 宜冲/宜守 copy. */
export function elementalStanceVsYong(
  pillarStem: string | null | undefined,
  yongRaw: string,
): YongShenElementStance {
  if (!pillarStem?.trim()) return "unclear";
  const pillarWx = stemWuxing(pillarStem);
  const yongWx = elementFromAny(yongRaw);
  if (!pillarWx || !yongWx) return "unclear";
  if (pillarWx === yongWx || GENERATES[pillarWx] === yongWx) return "support";
  if (GENERATES[yongWx] === pillarWx) return "drain";
  if (CONTROLS[pillarWx] === yongWx || CONTROLS[yongWx] === pillarWx) return "control";
  return "neutral";
}

function mapKind(kind: RelationKind): TopicCalcRelationKind {
  switch (kind) {
    case "chong":
      return "chong";
    case "xing":
      return "xing";
    case "hai":
      return "hai";
    case "liuhe":
      return "he";
    case "banhe":
      return "banhe";
    case "sanhe":
      return "sanhe";
    case "stem_he":
      return "tiangan_he";
    case "ten_god_tension":
      return "ten_god_tension";
    default:
      return "other";
  }
}

function mapSource(r: RelationLabel): TopicCalcRelationHit["source"] {
  if (r.kind === "ten_god_tension") return "ten_god_tension";
  if (r.source === "dayun") return "dayun_x_natal";
  if (r.source === "liunian") return "liunian_x_natal";
  if (r.source === "liuyue") return "liuyue_x_natal";
  if (r.source === "cross") {
    const hasLn = r.positions.includes("liunian");
    const hasDy = r.positions.includes("dayun");
    if (hasLn && hasDy) return "liunian_x_dayun";
    if (hasLn) return "liunian_x_natal";
    if (hasDy) return "dayun_x_natal";
  }
  return "other";
}

function pillarFromLuck(
  ganzhi: string | null | undefined,
  dayMaster: string,
  extra?: Partial<TopicCalcCyclePillar>,
): TopicCalcCyclePillar | null {
  if (!ganzhi || ganzhi.length < 2) return null;
  const stem = ganzhi.charAt(0);
  const branch = ganzhi.charAt(1);
  const dm = dayMaster.trim().charAt(0) as HeavenlyStem;
  let ten_god = "";
  try {
    if (isStem(dm) && isStem(stem as HeavenlyStem)) {
      ten_god = calculateTenGod(dm, stem as HeavenlyStem);
    }
  } catch {
    ten_god = "";
  }
  return { ganzhi, stem, branch, ten_god, ...extra };
}

function layersFromPositions(positions: string[]): TopicCalcRhythmSignal["layers"] {
  const out: TopicCalcRhythmSignal["layers"] = [];
  for (const p of positions) {
    if (p === "dayun" || p === "liunian" || p === "liuyue") {
      if (!out.includes(p)) out.push(p);
    } else if (["year", "month", "day", "hour"].includes(p)) {
      if (!out.includes("natal")) out.push("natal");
    }
  }
  return out.length > 0 ? out : ["natal"];
}

/**
 * TopicCalcSupplement v1 relation net: 大运 + 流年 + 流月 × 本命.
 * Explicitly excludes 流日 (liuri) — present in Atmos, out of this pack's contract.
 */
export function computeTopicCalcRelations(
  structured: ProfileStructured,
  cycles: ReturnType<typeof resolveLuckCycles>,
): RelationLabel[] {
  const out: RelationLabel[] = [];
  if (cycles.dayun) {
    out.push(...computeDayunRelations(structured, cycles.dayun));
  }
  out.push(...computeLiunianRelations(structured, cycles.liunian));
  out.push(...computeLiuyueRelations(structured, cycles.liuyue));
  return out.filter((r) => {
    if (r.source === "liuri") return false;
    if (r.positions.includes("liuri")) return false;
    return true;
  });
}

/**
 * 1:1 projection of cycle_relations → rhythm_signals (no silent drop).
 */
export function buildRhythmSignalsFromRelations(
  rels: RelationLabel[],
): TopicCalcRhythmSignal[] {
  return rels.map((r) => ({
    id: `rhythm:${r.id}`,
    kind: mapKind(r.kind),
    layers: layersFromPositions(r.positions),
    involved_ten_gods: [],
    summary_zh: coerceNeutralRhythmSummary({
      han: r.han,
      kind: r.kind,
      positions: r.positions,
    }),
  }));
}

function categoryKey(cat: QuestionCategory): Exclude<QuestionCategory, null> {
  return cat && cat !== null ? cat : "other";
}

/**
 * Deterministic topic-timed supplement. Same structured + as_of → same cycles
 * regardless of question_category (category only filters topic_slice).
 */
export function buildTopicCalcSupplement(
  input: BuildTopicCalcSupplementInput,
): TopicCalcSupplement {
  const {
    structured,
    question_category = null,
    as_of = new Date(),
    timezone = "UTC",
  } = input;

  const cyclesResolved = resolveLuckCycles(structured, as_of, timezone);
  const dm = String(structured.day_master ?? "");

  const current_dayun = pillarFromLuck(cyclesResolved.dayun?.ganzhi, dm, {
    index: cyclesResolved.dayunIndex ?? undefined,
    start_age: cyclesResolved.dayunEntry?.start_age,
  });
  const current_liunian = pillarFromLuck(cyclesResolved.liunian.ganzhi, dm);
  const current_liuyue = pillarFromLuck(cyclesResolved.liuyue.ganzhi, dm);

  const dynamicRels = computeTopicCalcRelations(structured, cyclesResolved);
  const cycle_relations: TopicCalcRelationHit[] = dynamicRels.map((r) => ({
    id: r.id,
    kind: mapKind(r.kind),
    source: mapSource(r),
    positions: [...r.positions],
    summary_zh: r.han,
  }));

  const rhythm_signals = buildRhythmSignalsFromRelations(dynamicRels);

  const cat = categoryKey(question_category);
  const filtered = filterRelationsByCategory(dynamicRels, question_category, structured);
  const natal_fields = buildTopicTypedFields(structured, question_category);
  const palaces = [...TOPIC_CALC_DEFAULT_PALACES[cat]] as TopicCalcPalace[];
  const focusGods = [...TOPIC_CALC_DEFAULT_TEN_GODS[cat]];
  const priority_weights: Record<string, number> = {};
  for (const f of natal_fields) {
    priority_weights[f.id] = f.topics.includes(cat) ? 2 : 1;
  }
  for (const r of filtered) {
    priority_weights[r.id] = (priority_weights[r.id] ?? 0) + 1;
  }

  const yong = String(structured.yong_shen ?? "").trim();
  const dayun_element_stance = elementalStanceVsYong(current_dayun?.stem, yong);
  const liunian_element_stance = elementalStanceVsYong(current_liunian?.stem, yong);
  const element_stances_conflict =
    (dayun_element_stance === "support" &&
      (liunian_element_stance === "drain" || liunian_element_stance === "control")) ||
    (liunian_element_stance === "support" &&
      (dayun_element_stance === "drain" || dayun_element_stance === "control"));

  const yongshen_activation =
    yong.length > 0
      ? {
          yong,
          xi: [...(structured.xi_shen ?? [])].map(String),
          ji: [...(structured.ji_shen ?? [])].map(String),
          dayun_element_stance,
          liunian_element_stance,
          element_stances_conflict,
        }
      : null;

  const absent_notes: TopicCalcAbsentNote[] = [];
  if (!current_dayun) {
    absent_notes.push({ key: "current_dayun", summary_zh: "未见相关特征" });
  }
  if (!current_liunian) {
    absent_notes.push({ key: "current_liunian", summary_zh: "未见相关特征" });
  }
  if (!yongshen_activation) {
    absent_notes.push({ key: "yongshen_activation", summary_zh: "未见相关特征" });
  }
  if (rhythm_signals.length === 0) {
    absent_notes.push({
      key: "cycle_tension_signals",
      summary_zh: "未见相关特征",
    });
  }
  if (
    question_category === "decision" &&
    filtered.length === 0 &&
    natal_fields.length === 0
  ) {
    absent_notes.push({
      key: "decision_structural_fork",
      summary_zh: "未见结构性区分依据",
    });
  }

  return {
    meta: {
      version: 1,
      structured_fingerprint: fingerprintThesisStructured(structured),
      question_category,
      as_of: cyclesResolved.asOf.iso,
      engine_versions: { ...ENGINE_VERSIONS },
    },
    cycles: {
      current_dayun,
      current_liunian,
      current_liuyue,
      dayun_index: cyclesResolved.dayunIndex,
    },
    cycle_relations,
    yongshen_activation,
    topic_slice: {
      primary_palaces: palaces,
      focus_ten_gods: focusGods,
      natal_fields,
      relation_focus_ids: filtered.map((r) => r.id),
      priority_weights,
    },
    rhythm_signals,
    absent_notes,
    thesis_feed_hooks: {
      current_liunian: Boolean(current_liunian),
      dayun_liunian_stack: Boolean(current_dayun && current_liunian),
      liuyue_slice: Boolean(current_liuyue),
      yongshen_element_stance: Boolean(yongshen_activation),
      cycle_tension_signals: rhythm_signals.length > 0,
    },
  };
}
