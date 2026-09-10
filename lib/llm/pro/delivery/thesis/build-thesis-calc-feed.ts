/**
 * Deterministic thesis calc feed from ProfileStructured (+ TopicCalcSupplement by dimension).
 * Checklist facts only, no LLM. Per-dimension mapping — never dump whole supplement into one blob.
 *
 * SSOT map: `.cursor/docs/pivot-总纲维度-TopicCalcSupplement-映射.md`
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { resolveCurrentDaYunStep } from "@/lib/base-analysis/core-judgments";
import { computeNatalChartRelations } from "@/lib/calculations/relation-engine";
import { buildTopicTypedFields } from "@/lib/calculations/topic-typed-fields";
import {
  buildTopicCalcSupplement,
  type TopicCalcSupplement,
  type YongShenElementStance,
} from "@/lib/calculations/topic-calc-supplement";
import { fiveElementToZh } from "@/lib/llm/pro/delivery/locale-evidence-tokens";
import { fingerprintThesisStructured } from "@/lib/llm/pro/delivery/thesis/fingerprint";
import type { QuestionCategory } from "@/lib/poju/agent-state";
import type {
  ChecklistItemStatus,
  ThesisCalcFeed,
  ThesisCalcFeedDimension,
  ThesisDimensionId,
} from "@/lib/llm/pro/delivery/thesis/types";
import { THESIS_ABSENT_SUMMARY_ZH, THESIS_DIMENSION_IDS } from "@/lib/llm/pro/delivery/thesis/types";

function wxLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/[木火土金水]/.test(t)) return t;
  return fiveElementToZh(t);
}

const WEALTH_GODS = new Set(["正财", "偏财"]);
const OFFICER_GODS = new Set(["正官", "七杀"]);
const PEER_GODS = new Set(["比肩", "劫财"]);
const OUTPUT_GODS = new Set(["食神", "伤官"]);
const HE_JU_KINDS = new Set(["sanhe", "banhe", "liuhe"]);
const XING_CHONG_KINDS = new Set(["chong", "xing"]);

const POS_HAN: Record<"year" | "month" | "day" | "hour", string> = {
  year: "年",
  month: "月",
  day: "日",
  hour: "时",
};

type PillarGod = { pos: "year" | "month" | "day" | "hour"; god: string };

function pillarGods(structured: ProfileStructured): PillarGod[] {
  const detail = structured.pillars_detail;
  if (!detail) return [];
  const out: PillarGod[] = [];
  for (const pos of ["year", "month", "day", "hour"] as const) {
    const g = String(detail[pos]?.ten_god ?? "").trim();
    if (g) out.push({ pos, god: g });
  }
  return out;
}

function item(key: string, present: boolean, summary_zh: string): ChecklistItemStatus {
  return {
    key,
    present,
    summary_zh: present ? summary_zh : THESIS_ABSENT_SUMMARY_ZH,
  };
}

function strengthVerdictFromField(strength: string): string {
  const s = strength.trim();
  if (s === "strong" || s.includes("强")) return "身强";
  if (s === "weak" || s.includes("弱")) return "身弱";
  if (s === "balanced" || s.includes("中") || s.includes("平")) return "身中和";
  return s || "身中和";
}

function listGods(gods: PillarGod[], set: Set<string>): string[] {
  return [...new Set(gods.filter((g) => set.has(g.god)).map((g) => g.god))];
}

/** Elemental stance labels — factual, no 宜/该/冲守. */
function elementalStanceLabel(s: YongShenElementStance): string {
  switch (s) {
    case "support":
      return "扶（同气或生用）";
    case "drain":
      return "泄（用神生运干五行）";
    case "control":
      return "克（相克）";
    case "neutral":
      return "中性";
    default:
      return "不明";
  }
}

function buildDayMasterStrength(structured: ProfileStructured): ThesisCalcFeedDimension {
  const gods = pillarGods(structured);
  const dm = String(structured.day_master ?? "").trim();
  const strength = String(structured.strength ?? "").trim();
  const pattern = String(structured.pattern ?? "").trim();
  const verdict = strengthVerdictFromField(strength);

  const items: ChecklistItemStatus[] = [];

  items.push(
    item("day_master", Boolean(dm), dm ? `日主${dm}` : THESIS_ABSENT_SUMMARY_ZH),
  );
  items.push(
    item(
      "strength",
      Boolean(strength),
      strength ? `综合旺衰：${verdict}（strength=${strength}）` : THESIS_ABSENT_SUMMARY_ZH,
    ),
  );
  items.push(
    item(
      "pattern",
      Boolean(pattern) && pattern !== "test",
      pattern && pattern !== "test" ? `格局：${pattern}` : THESIS_ABSENT_SUMMARY_ZH,
    ),
  );

  if (gods.length > 0) {
    const dist = gods.map((g) => `${POS_HAN[g.pos]}柱${g.god}`).join("、");
    items.push(item("pillar_gods_distribution", true, `四柱十神分布：${dist}`));
  } else {
    items.push(item("pillar_gods_distribution", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  const natal = computeNatalChartRelations(structured);
  const heJu = natal.filter((r) => HE_JU_KINDS.has(r.kind));
  if (heJu.length > 0) {
    items.push(
      item("branch_he_ju", true, `地支合局：${heJu.map((r) => r.han).join("、")}`),
    );
  } else {
    items.push(item("branch_he_ju", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  const xingChong = natal.filter((r) => XING_CHONG_KINDS.has(r.kind));
  if (xingChong.length > 0) {
    items.push(
      item("branch_xing_chong", true, `刑冲：${xingChong.map((r) => r.han).join("、")}`),
    );
  } else {
    items.push(item("branch_xing_chong", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  const hints: string[] = [];
  if (dm) hints.push(`day_master:${dm}`);
  hints.push(`strength_verdict:${verdict}`);

  return {
    empty: false,
    items,
    strength_verdict: verdict,
    hints,
  };
}

function buildFavorAvoid(
  structured: ProfileStructured,
  supplement: TopicCalcSupplement | null,
): ThesisCalcFeedDimension {
  const yong = String(structured.yong_shen ?? "").trim();
  const xi = (structured.xi_shen ?? []).map((x) => String(x).trim()).filter(Boolean);
  const ji = (structured.ji_shen ?? []).map((x) => String(x).trim()).filter(Boolean);
  const yongZh = yong ? wxLabel(yong) : "";
  const xiZh = xi.map(wxLabel);
  const jiZh = ji.map(wxLabel);

  const items: ChecklistItemStatus[] = [
    item("yong_shen", Boolean(yongZh), yongZh ? `用神：${yongZh}` : THESIS_ABSENT_SUMMARY_ZH),
    item(
      "xi_shen",
      xiZh.length > 0,
      xiZh.length > 0 ? `喜神：${xiZh.join("、")}` : THESIS_ABSENT_SUMMARY_ZH,
    ),
    item(
      "ji_shen",
      jiZh.length > 0,
      jiZh.length > 0 ? `忌神：${jiZh.join("、")}` : THESIS_ABSENT_SUMMARY_ZH,
    ),
    // Stub: no climate/燥湿 engine on ProfileStructured yet — always absent (not a true-negative).
    item("climate_balance", false, THESIS_ABSENT_SUMMARY_ZH),
  ];

  const act = supplement?.yongshen_activation ?? null;
  const dy = supplement?.cycles.current_dayun;
  const ln = supplement?.cycles.current_liunian;

  if (dy?.ganzhi) {
    items.push(
      item(
        "current_dayun_for_yong",
        true,
        `当前大运干支：${dy.ganzhi}${dy.ten_god ? `（十神${dy.ten_god}）` : ""}`,
      ),
    );
  } else {
    items.push(item("current_dayun_for_yong", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  if (act) {
    items.push(
      item(
        "dayun_element_stance",
        true,
        `大运对用神元素姿态：${elementalStanceLabel(act.dayun_element_stance)}`,
      ),
    );
    items.push(
      item(
        "liunian_element_stance",
        true,
        `流年对用神元素姿态：${elementalStanceLabel(act.liunian_element_stance)}`,
      ),
    );
    items.push(
      item(
        "element_stances_conflict",
        act.element_stances_conflict,
        act.element_stances_conflict
          ? "大运与流年对用神元素姿态冲突（布尔）"
          : THESIS_ABSENT_SUMMARY_ZH,
      ),
    );
  } else {
    items.push(item("dayun_element_stance", false, THESIS_ABSENT_SUMMARY_ZH));
    items.push(item("liunian_element_stance", false, THESIS_ABSENT_SUMMARY_ZH));
    items.push(item("element_stances_conflict", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  if (ln?.ganzhi) {
    items.push(
      item(
        "current_liunian_for_yong",
        true,
        `当前流年干支：${ln.ganzhi}${ln.ten_god ? `（十神${ln.ten_god}）` : ""}`,
      ),
    );
  }

  const hints: string[] = [];
  if (yongZh) hints.push(`wuxing:yong:${yongZh}`);
  for (const x of xiZh) hints.push(`wuxing:xi:${x}`);
  for (const j of jiZh) hints.push(`wuxing:ji:${j}`);
  if (act) {
    hints.push(`yong_stance:dayun:${act.dayun_element_stance}`);
    hints.push(`yong_stance:liunian:${act.liunian_element_stance}`);
  }

  const empty = !yongZh && xiZh.length === 0 && jiZh.length === 0;
  return { empty, items, hints };
}

function buildInterpersonal(
  structured: ProfileStructured,
  supplement: TopicCalcSupplement | null,
): ThesisCalcFeedDimension {
  const gods = pillarGods(structured);
  const officers = listGods(gods, OFFICER_GODS);
  const peers = listGods(gods, PEER_GODS);
  const interpersonal = [...officers, ...peers];

  const items: ChecklistItemStatus[] = [];
  if (officers.length > 0) {
    const detail = gods
      .filter((g) => OFFICER_GODS.has(g.god))
      .map((g) => `${POS_HAN[g.pos]}柱${g.god}`)
      .join("、");
    items.push(item("officer_gods", true, `官杀：${detail}`));
  } else {
    items.push(item("officer_gods", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  if (peers.length > 0) {
    const detail = gods
      .filter((g) => PEER_GODS.has(g.god))
      .map((g) => `${POS_HAN[g.pos]}柱${g.god}`)
      .join("、");
    items.push(item("peer_gods", true, `比劫：${detail}`));
  } else {
    items.push(item("peer_gods", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  const hints = interpersonal.map((g) => `ten_god:${g}`);
  const cat = supplement?.meta.question_category;
  if (
    cat === "relationship" ||
    cat === "interpersonal" ||
    cat === "family"
  ) {
    for (const f of supplement?.topic_slice.natal_fields ?? []) {
      hints.push(`topic_menu:${f.id}:${f.chart_token}`);
    }
  }

  return {
    empty: interpersonal.length === 0,
    items,
    hints,
  };
}

function buildCycleRhythm(
  structured: ProfileStructured,
  supplement: TopicCalcSupplement | null,
  nowYear: number,
): ThesisCalcFeedDimension {
  const items: ChecklistItemStatus[] = [];
  const hints: string[] = [];

  const dy = supplement?.cycles.current_dayun;
  const ln = supplement?.cycles.current_liunian;
  const ly = supplement?.cycles.current_liuyue;

  if (dy?.ganzhi) {
    const age =
      dy.start_age != null ? `·起运龄${dy.start_age}` : "";
    items.push(
      item(
        "current_da_yun",
        true,
        `当前大运：${dy.ganzhi}${dy.ten_god ? `（十神${dy.ten_god}）` : ""}${age}`,
      ),
    );
    hints.push(`da_yun:${dy.ganzhi}`);
  } else {
    const step = resolveCurrentDaYunStep(structured.da_yun, nowYear);
    if (step != null && structured.da_yun?.[step]) {
      const entry = structured.da_yun[step]!;
      items.push(
        item(
          "current_da_yun",
          true,
          `当前大运：${entry.ganzhi}（起运年${entry.start_year}·起运龄${entry.start_age}）`,
        ),
      );
      hints.push(`da_yun:${entry.ganzhi}`);
    } else {
      items.push(item("current_da_yun", false, THESIS_ABSENT_SUMMARY_ZH));
    }
  }

  if (ln?.ganzhi) {
    items.push(
      item(
        "current_liunian",
        true,
        `当前流年：${ln.ganzhi}${ln.ten_god ? `（十神${ln.ten_god}）` : ""}`,
      ),
    );
    hints.push(`liunian:${ln.ganzhi}`);
  } else {
    items.push(item("current_liunian", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  if (dy?.ganzhi && ln?.ganzhi) {
    items.push(
      item(
        "dayun_liunian_stack",
        true,
        `大运×流年叠层：${dy.ganzhi}×${ln.ganzhi}`,
      ),
    );
    hints.push(`stack:${dy.ganzhi}x${ln.ganzhi}`);
  } else {
    items.push(item("dayun_liunian_stack", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  if (ly?.ganzhi) {
    items.push(
      item(
        "current_liuyue",
        true,
        `当前流月：${ly.ganzhi}${ly.ten_god ? `（十神${ly.ten_god}）` : ""}`,
      ),
    );
    hints.push(`liuyue:${ly.ganzhi}`);
  }

  const signals = supplement?.rhythm_signals ?? [];
  if (signals.length > 0) {
    // Cap for prompt size; full list remains on supplement for Lab.
    const shown = signals.slice(0, 12);
    items.push(
      item(
        "cycle_tension_signals",
        true,
        `岁运关系信号：${shown.map((s) => s.summary_zh).join("；")}${
          signals.length > shown.length ? `（另有${signals.length - shown.length}条）` : ""
        }`,
      ),
    );
    for (const s of shown) {
      hints.push(`rhythm:${s.id}:${s.kind}`);
    }
  } else {
    items.push(item("cycle_tension_signals", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  const conflict = supplement?.yongshen_activation?.element_stances_conflict;
  if (conflict === true) {
    items.push(
      item(
        "yongshen_element_conflict_signal",
        true,
        "用神元素姿态：大运与流年冲突（布尔信号，非冲守裁决）",
      ),
    );
    hints.push("yong_conflict:true");
  }

  const empty = !dy?.ganzhi && !ln?.ganzhi && signals.length === 0;
  return { empty, items, hints };
}

function buildResourcePattern(
  structured: ProfileStructured,
  supplement: TopicCalcSupplement | null,
): ThesisCalcFeedDimension {
  const gods = pillarGods(structured);
  const wealth = listGods(gods, WEALTH_GODS);
  const typed = buildTopicTypedFields(structured, null);
  const wealthFields = typed.filter(
    (f) => f.id.includes("wealth") || f.chart_token.includes("财"),
  );

  const items: ChecklistItemStatus[] = [];
  if (wealth.length > 0) {
    const detail = gods
      .filter((g) => WEALTH_GODS.has(g.god))
      .map((g) => `${POS_HAN[g.pos]}柱${g.god}`)
      .join("、");
    items.push(item("wealth_gods", true, `财星：${detail}`));
  } else {
    items.push(item("wealth_gods", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  const output = listGods(gods, OUTPUT_GODS);
  const hasShiShangShengCai = wealth.length > 0 && output.length > 0;
  items.push(
    item(
      "output_to_wealth",
      hasShiShangShengCai,
      hasShiShangShengCai
        ? `食伤生财链路：${output.join("、")}→${wealth.join("、")}`
        : THESIS_ABSENT_SUMMARY_ZH,
    ),
  );

  const lnGod = supplement?.cycles.current_liunian?.ten_god?.trim() ?? "";
  if (lnGod && WEALTH_GODS.has(lnGod)) {
    items.push(
      item(
        "liunian_wealth_ten_god",
        true,
        `流年十神见财：${supplement!.cycles.current_liunian!.ganzhi}·${lnGod}`,
      ),
    );
  }

  const hints = [
    ...wealth.map((g) => `ten_god:${g}`),
    ...wealthFields.map((f) => `topic:${f.id}:${f.chart_token}`),
  ];
  const cat = supplement?.meta.question_category;
  if (cat === "wealth" || cat === "career") {
    for (const f of supplement?.topic_slice.natal_fields ?? []) {
      if (f.id.includes("wealth") || f.chart_token.includes("财")) {
        hints.push(`topic_menu:${f.id}:${f.chart_token}`);
      }
    }
  }

  return {
    empty: wealth.length === 0,
    items,
    hints,
  };
}

function buildExpressionCreativity(
  structured: ProfileStructured,
  supplement: TopicCalcSupplement | null,
): ThesisCalcFeedDimension {
  const gods = pillarGods(structured);
  const output = listGods(gods, OUTPUT_GODS);
  const items: ChecklistItemStatus[] = [];

  if (output.length > 0) {
    const detail = gods
      .filter((g) => OUTPUT_GODS.has(g.god))
      .map((g) => `${POS_HAN[g.pos]}柱${g.god}`)
      .join("、");
    items.push(item("output_gods", true, `食神/伤官：${detail}`));
  } else {
    items.push(item("output_gods", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  const hints = output.map((g) => `ten_god:${g}`);
  if (supplement?.meta.question_category === "career") {
    for (const f of supplement.topic_slice.natal_fields) {
      if (f.id.includes("output") || f.id.includes("peer")) {
        hints.push(`topic_menu:${f.id}:${f.chart_token}`);
      }
    }
  }

  return {
    empty: output.length === 0,
    items,
    hints,
  };
}

export type BuildThesisCalcFeedOpts = {
  nowYear?: number;
  as_of?: Date;
  timezone?: string;
  question_category?: QuestionCategory;
  /** Prebuilt second calc; if omitted, built from structured + as_of. */
  supplement?: TopicCalcSupplement | null;
};

function resolveAsOf(opts?: BuildThesisCalcFeedOpts): Date {
  if (opts?.as_of) return opts.as_of;
  const y = opts?.nowYear ?? new Date().getUTCFullYear();
  return new Date(Date.UTC(y, 5, 15, 12, 0, 0));
}

/**
 * Build thesis checklist feed. Dimensions pull TopicCalcSupplement by map — not whole-pack dump.
 */
export function buildThesisCalcFeed(
  structured: ProfileStructured,
  opts?: BuildThesisCalcFeedOpts,
): ThesisCalcFeed {
  const nowYear = opts?.nowYear ?? resolveAsOf(opts).getUTCFullYear();
  const supplement =
    opts?.supplement === null
      ? null
      : opts?.supplement ??
        buildTopicCalcSupplement({
          structured,
          question_category: opts?.question_category ?? null,
          as_of: resolveAsOf(opts),
          timezone: opts?.timezone ?? "UTC",
        });

  const dimensions: Record<ThesisDimensionId, ThesisCalcFeedDimension> = {
    day_master_strength: buildDayMasterStrength(structured),
    favor_avoid_tuning: buildFavorAvoid(structured, supplement),
    interpersonal_pattern: buildInterpersonal(structured, supplement),
    cycle_rhythm: buildCycleRhythm(structured, supplement, nowYear),
    resource_pattern: buildResourcePattern(structured, supplement),
    expression_creativity: buildExpressionCreativity(structured, supplement),
  };

  for (const id of THESIS_DIMENSION_IDS) {
    if (!dimensions[id]) {
      dimensions[id] = { empty: true, items: [], hints: [] };
    }
  }

  return {
    fingerprint: fingerprintThesisStructured(structured),
    dimensions,
  };
}
