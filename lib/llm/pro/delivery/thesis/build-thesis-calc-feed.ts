/**
 * Deterministic thesis calc feed from ProfileStructured — checklist facts only, no LLM.
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { resolveCurrentDaYunStep } from "@/lib/base-analysis/core-judgments";
import { computeNatalChartRelations } from "@/lib/calculations/relation-engine";
import { buildTopicTypedFields } from "@/lib/calculations/topic-typed-fields";
import { fingerprintThesisStructured } from "@/lib/llm/pro/delivery/thesis/fingerprint";
import type {
  ChecklistItemStatus,
  ThesisCalcFeed,
  ThesisCalcFeedDimension,
  ThesisDimensionId,
} from "@/lib/llm/pro/delivery/thesis/types";
import { THESIS_ABSENT_SUMMARY_ZH, THESIS_DIMENSION_IDS } from "@/lib/llm/pro/delivery/thesis/types";

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

function buildDayMasterStrength(structured: ProfileStructured): ThesisCalcFeedDimension {
  const gods = pillarGods(structured);
  const dm = String(structured.day_master ?? "").trim();
  const strength = String(structured.strength ?? "").trim();
  const pattern = String(structured.pattern ?? "").trim();
  const verdict = strengthVerdictFromField(strength);

  const items: ChecklistItemStatus[] = [];

  items.push(
    item(
      "day_master",
      Boolean(dm),
      dm ? `日主${dm}` : THESIS_ABSENT_SUMMARY_ZH,
    ),
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
      item(
        "branch_he_ju",
        true,
        `地支合局：${heJu.map((r) => r.han).join("、")}`,
      ),
    );
  } else {
    items.push(item("branch_he_ju", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  const xingChong = natal.filter((r) => XING_CHONG_KINDS.has(r.kind));
  if (xingChong.length > 0) {
    items.push(
      item(
        "branch_xing_chong",
        true,
        `刑冲：${xingChong.map((r) => r.han).join("、")}`,
      ),
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

function buildFavorAvoid(structured: ProfileStructured): ThesisCalcFeedDimension {
  const yong = String(structured.yong_shen ?? "").trim();
  const xi = (structured.xi_shen ?? []).map((x) => String(x).trim()).filter(Boolean);
  const ji = (structured.ji_shen ?? []).map((x) => String(x).trim()).filter(Boolean);

  const items: ChecklistItemStatus[] = [
    item("yong_shen", Boolean(yong), yong ? `用神：${yong}` : THESIS_ABSENT_SUMMARY_ZH),
    item(
      "xi_shen",
      xi.length > 0,
      xi.length > 0 ? `喜神：${xi.join("、")}` : THESIS_ABSENT_SUMMARY_ZH,
    ),
    item(
      "ji_shen",
      ji.length > 0,
      ji.length > 0 ? `忌神：${ji.join("、")}` : THESIS_ABSENT_SUMMARY_ZH,
    ),
    // Structured has no dedicated 燥湿 field — do not invent balance narrative.
    item("climate_balance", false, THESIS_ABSENT_SUMMARY_ZH),
  ];

  const hints: string[] = [];
  if (yong) hints.push(`wuxing:yong:${yong}`);
  for (const x of xi) hints.push(`wuxing:xi:${x}`);
  for (const j of ji) hints.push(`wuxing:ji:${j}`);

  const empty = !yong && xi.length === 0 && ji.length === 0;
  return { empty, items, hints };
}

function buildInterpersonal(structured: ProfileStructured): ThesisCalcFeedDimension {
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
  return {
    empty: interpersonal.length === 0,
    items,
    hints,
  };
}

function buildCycleRhythm(
  structured: ProfileStructured,
  nowYear = new Date().getFullYear(),
): ThesisCalcFeedDimension {
  const step = resolveCurrentDaYunStep(structured.da_yun, nowYear);
  const items: ChecklistItemStatus[] = [];
  const hints: string[] = [];

  if (step != null && structured.da_yun?.[step]) {
    const entry = structured.da_yun[step]!;
    const summary = `当前大运：${entry.ganzhi}（起运年${entry.start_year}·起运龄${entry.start_age}）`;
    items.push(item("current_da_yun", true, summary));
    hints.push(`da_yun:${entry.ganzhi}`);
  } else {
    items.push(item("current_da_yun", false, THESIS_ABSENT_SUMMARY_ZH));
  }

  // LiuNian is not on ProfileStructured — never invent a year climate.
  items.push(item("current_liunian", false, THESIS_ABSENT_SUMMARY_ZH));
  items.push(item("dayun_liunian_stack", false, THESIS_ABSENT_SUMMARY_ZH));

  return {
    empty: step == null,
    items,
    hints,
  };
}

function buildResourcePattern(structured: ProfileStructured): ThesisCalcFeedDimension {
  const gods = pillarGods(structured);
  const wealth = listGods(gods, WEALTH_GODS);
  const typed = buildTopicTypedFields(structured, null);
  const wealthFields = typed.filter(
    (f) =>
      f.id.includes("wealth") ||
      f.chart_token.includes("财"),
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

  const hints = [
    ...wealth.map((g) => `ten_god:${g}`),
    ...wealthFields.map((f) => `topic:${f.id}:${f.chart_token}`),
  ];

  return {
    empty: wealth.length === 0,
    items,
    hints,
  };
}

function buildExpressionCreativity(structured: ProfileStructured): ThesisCalcFeedDimension {
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

  return {
    empty: output.length === 0,
    items,
    hints: output.map((g) => `ten_god:${g}`),
  };
}

export function buildThesisCalcFeed(
  structured: ProfileStructured,
  opts?: { nowYear?: number },
): ThesisCalcFeed {
  const nowYear = opts?.nowYear ?? new Date().getFullYear();
  const dimensions: Record<ThesisDimensionId, ThesisCalcFeedDimension> = {
    day_master_strength: buildDayMasterStrength(structured),
    favor_avoid_tuning: buildFavorAvoid(structured),
    interpersonal_pattern: buildInterpersonal(structured),
    cycle_rhythm: buildCycleRhythm(structured, nowYear),
    resource_pattern: buildResourcePattern(structured),
    expression_creativity: buildExpressionCreativity(structured),
  };

  // Ensure every id is present (Record completeness).
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
