/**
 * P0-1 · 题型类型化真算字段（本地确定性）
 *
 * 从十神 / 宫位 / 本命关系推出可引用对象，供 inventory → Stage-2 chart_basis /
 * Synthesis chart_anchors 点选。禁止临场编造；无盘料则少写、不硬凑。
 */

import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { computeNatalChartRelations } from "@/lib/calculations/relation-engine";

export type TopicTypedPolarity = "favor" | "tension" | "drain" | "neutral";

export type TopicTypedField = {
  id: string;
  /** 相关题型；空 = 全题型可引 */
  topics: readonly string[];
  polarity: TopicTypedPolarity;
  /** 可进 chart_anchors / chart_basis 的闭集式真词句 */
  chart_token: string;
  note: string;
};

const WEALTH_GODS = new Set(["正财", "偏财"]);
const OFFICER_GODS = new Set(["正官", "七杀"]);
const PEER_GODS = new Set(["比肩", "劫财"]);
const OUTPUT_GODS = new Set(["食神", "伤官"]);

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

function isWeak(structured: ProfileStructured): boolean {
  const s = structured.strength?.trim() ?? "";
  return s === "weak" || s.includes("弱");
}

function isStrong(structured: ProfileStructured): boolean {
  const s = structured.strength?.trim() ?? "";
  return s === "strong" || s.includes("强");
}

function categoryMatch(
  topics: readonly string[],
  questionCategory: string | null | undefined,
): boolean {
  if (!questionCategory || topics.length === 0) return true;
  return topics.includes(questionCategory);
}

/**
 * 从主盘推出题型真算锚。可选按 question_category 过滤展示池（算仍全量时传 null）。
 */
export function buildTopicTypedFields(
  structured: ProfileStructured,
  questionCategory?: string | null,
): TopicTypedField[] {
  const gods = pillarGods(structured);
  const godNames = gods.map((g) => g.god);
  const list = (set: Set<string>) =>
    [...new Set(godNames.filter((g) => set.has(g)))].join("、");

  const fields: TopicTypedField[] = [];

  // —— 财 / 官张力与极性（career / wealth）——
  const wealthList = list(WEALTH_GODS);
  const officerList = list(OFFICER_GODS);
  if (wealthList && officerList) {
    fields.push({
      id: "wealth_officer_tension",
      topics: ["career", "wealth", "decision"],
      polarity: "tension",
      chart_token: `财官同现·${wealthList}+${officerList}`,
      note: "资源回流与规范约束同盘；主辅须说清先守边界还是先变现",
    });
  } else if (wealthList) {
    fields.push({
      id: "wealth_focus",
      topics: ["wealth", "career", "decision"],
      polarity: "favor",
      chart_token: `财星显·${wealthList}`,
      note: "盘面资源/交换链路显；财富与事业题可引为承重锚",
    });
  } else if (officerList) {
    fields.push({
      id: "officer_focus",
      topics: ["career", "decision", "interpersonal"],
      polarity: "neutral",
      chart_token: `官杀显·${officerList}`,
      note: "规范/权责链路显；事业与决策题可引边界策略",
    });
  }

  // —— 身财 / 身官粗平衡（decision / wealth）——
  if (wealthList) {
    if (isWeak(structured)) {
      fields.push({
        id: "body_wealth_imbalance_weak",
        topics: ["wealth", "decision", "career"],
        polarity: "drain",
        chart_token: `身弱见财·${wealthList}`,
        note: "续航偏薄却见资源星；忌硬扛扩张，宜借结构缓冲",
      });
    } else if (isStrong(structured)) {
      fields.push({
        id: "body_wealth_balance_strong",
        topics: ["wealth", "decision", "career"],
        polarity: "favor",
        chart_token: `身旺载财·${wealthList}`,
        note: "承载力相对够；可谈可控扩张，仍须防过载窗口",
      });
    }
  }
  if (officerList) {
    if (isWeak(structured)) {
      fields.push({
        id: "body_officer_pressure_weak",
        topics: ["career", "decision", "interpersonal"],
        polarity: "tension",
        chart_token: `身弱见官杀·${officerList}`,
        note: "权责/规范压在薄续航上；决策代价偏高，宜降档边界",
      });
    } else if (isStrong(structured)) {
      fields.push({
        id: "body_officer_capacity_strong",
        topics: ["career", "decision"],
        polarity: "favor",
        chart_token: `身旺任官杀·${officerList}`,
        note: "有承载力接权责；仍须防连续高压内耗",
      });
    }
  }

  // —— 比劫 / 食伤合作极性（career / decision）——
  const peerList = list(PEER_GODS);
  const outputList = list(OUTPUT_GODS);
  if (peerList && outputList) {
    fields.push({
      id: "peer_output_coop",
      topics: ["career", "decision", "interpersonal"],
      polarity: "favor",
      chart_token: `比劫食伤同盘·${peerList}+${outputList}`,
      note: "并行协作 + 产出表达同在；合作型路径可引，防内耗抢功",
    });
  } else if (peerList) {
    fields.push({
      id: "peer_coop_polarity",
      topics: ["career", "decision", "interpersonal"],
      polarity: isWeak(structured) ? "favor" : "tension",
      chart_token: `比劫显·${peerList}`,
      note: isWeak(structured)
        ? "并行借力放大推进；单打硬顶更易折"
        : "同辈并行易放大也易内耗；合作边界要写清",
    });
  } else if (outputList) {
    fields.push({
      id: "output_express_polarity",
      topics: ["career", "decision", "wealth"],
      polarity: "favor",
      chart_token: `食伤显·${outputList}`,
      note: "产出/表达链路显；适合独立产出或内容变现型路径",
    });
  }

  // —— 配偶宫 + 关系焦点（relationship / interpersonal / family）——
  const dayGod = gods.find((g) => g.pos === "day")?.god;
  if (dayGod && (WEALTH_GODS.has(dayGod) || OFFICER_GODS.has(dayGod))) {
    fields.push({
      id: "spouse_palace_day_star",
      topics: ["relationship", "interpersonal", "family"],
      polarity: "neutral",
      chart_token: `日柱关系星·${dayGod}`,
      note: "日柱落关系/交换星；二元案写【你侧】型人适配，禁无盘断对方命",
    });
  }

  const spouseRels = computeNatalChartRelations(structured).filter((r) =>
    r.palaces.includes("spouse"),
  );
  if (spouseRels.length > 0) {
    const top = spouseRels.slice(0, 2);
    const tokens = top.map((r) => r.han).join("、");
    const red = top.some((r) => r.polarity === "red");
    fields.push({
      id: "spouse_palace_relations",
      topics: ["relationship", "interpersonal", "family"],
      polarity: red ? "tension" : "neutral",
      chart_token: `配偶宫关系·${tokens}`,
      note: "本命触及配偶宫的结构关系；只解释你侧张力/缓冲，不作合盘",
    });
  }

  // 用神/忌神作通用承重（全题型）
  const yong = String(structured.yong_shen ?? "").trim();
  if (yong) {
    fields.push({
      id: "yong_shen_anchor",
      topics: [],
      polarity: "favor",
      chart_token: `用神·${yong}`,
      note: "本盘用神；各题型策略须能对上补给方向",
    });
  }
  const ji = (structured.ji_shen ?? []).map((j) => String(j).trim()).filter(Boolean);
  if (ji.length > 0) {
    fields.push({
      id: "ji_shen_anchor",
      topics: [],
      polarity: "drain",
      chart_token: `忌神·${ji.slice(0, 3).join("、")}`,
      note: "本盘忌神；P5 熔断与避坑须能指回",
    });
  }

  const pattern = String(structured.pattern ?? "").trim();
  if (pattern && pattern !== "test" && !/^日主/.test(pattern)) {
    fields.push({
      id: "pattern_heuristic",
      topics: [],
      polarity: "neutral",
      chart_token: `格局·${pattern}`,
      note: "本地格局粗标签；只作机制倾向，不作职业/吉凶裁定",
    });
  }

  const filtered = fields.filter((f) => categoryMatch(f.topics, questionCategory));
  // 去重 id
  const seen = new Set<string>();
  return filtered.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

/** 拼进 structured instance inventory。 */
export function formatTopicTypedFieldsForInventory(
  fields: readonly TopicTypedField[],
): string {
  if (fields.length === 0) {
    return "- 题型真算锚: （本盘未推出类型化锚 — chart_basis 仍须引用上方十神/关系/用神闭集，禁止编造）";
  }
  const body = fields
    .map((f) => `${f.chart_token}〔${f.polarity}〕`)
    .join("；");
  return `- 题型真算锚（优先点选进 chart_basis / chart_anchors · 仅可引用下列）: ${body}`;
}

export function buildTopicTypedInventoryLine(
  structured: ProfileStructured,
  questionCategory?: string | null,
): string {
  return formatTopicTypedFieldsForInventory(
    buildTopicTypedFields(structured, questionCategory),
  );
}
