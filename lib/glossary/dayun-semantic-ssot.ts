/**
 * Dayun / timing-phase semantic SSOT — stage rhythm + anti-prophecy.
 * Dual consumers: prompt slices + purity scan. No year-event iron mouths.
 */

export type DayunPhaseId =
  | "store_yin"
  | "express_output"
  | "structure_rebuild"
  | "pressure_edge"
  | "resource_flow"
  | "peer_friction";

export type DayunPhaseRow = {
  id: DayunPhaseId;
  /** Short stage theme for prompts. */
  theme: string;
  /** When to push vs hold — direction only. */
  pace: string;
  /** Element / ten-god polarity hints (not automatic assignment). */
  polarity_hints: readonly string[];
};

export const DAYUN_PHASE_SSOT: Record<DayunPhaseId, DayunPhaseRow> = {
  store_yin: {
    id: "store_yin",
    theme: "收敛蓄力期",
    pace: "少开新战场；加深恢复、学习与结构备份",
    polarity_hints: ["印", "水", "藏", "身弱求稳"],
  },
  express_output: {
    id: "express_output",
    theme: "外放表达/产出期",
    pace: "提高可见输出与试点；控制过度曝光",
    polarity_hints: ["食神", "伤官", "火", "表达"],
  },
  structure_rebuild: {
    id: "structure_rebuild",
    theme: "结构重建期",
    pace: "改流程、角色、交付标准；忌只会忙",
    polarity_hints: ["土", "正官", "偏官", "制度"],
  },
  pressure_edge: {
    id: "pressure_edge",
    theme: "高压边缘期",
    pace: "缩短决策周期、提高止损频率；忌硬扛",
    polarity_hints: ["七杀", "劫财", "金", "冲"],
  },
  resource_flow: {
    id: "resource_flow",
    theme: "资源流动期",
    pace: "谈交换与定价；忌只攒不结算",
    polarity_hints: ["财", "禄", "金", "水"],
  },
  peer_friction: {
    id: "peer_friction",
    theme: "同伴/竞争摩擦期",
    pace: "划清分工与利益；忌情绪对撞",
    polarity_hints: ["比肩", "劫财", "刑冲"],
  },
};

/** Banned prophecy / fate-timing phrases in user-facing prose. */
export const DAYUN_FORBIDDEN_PROPHECY: readonly string[] = [
  "这十年运势极好",
  "这十年运势极差",
  "十年大运极好",
  "十年大运极差",
  "必发财",
  "必然发财",
  "必结婚",
  "必然结婚",
  "必离婚",
  "某年必",
  "流年必",
  "明年必",
  "今年必",
  "注定发财",
  "注定结婚",
  "大运发财",
  "走好运必成",
  "走坏运必败",
  "铁口直断",
  "某月必",
  "某日必成",
];

export function textHitsDayunProphecy(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const p of DAYUN_FORBIDDEN_PROPHECY) {
    if (p && t.includes(p)) return p;
  }
  // Soft patterns
  if (/大运.{0,6}(极好|极差|大吉|大凶)/.test(t)) return "大运吉凶套话";
  if (/(今年|明年|流年).{0,8}(必|一定|注定).{0,8}(婚|财|升|败|死)/.test(t)) {
    return "流年事件铁口";
  }
  return null;
}

/**
 * Compact prompt: phase dictionary + anti-prophecy.
 * Optional `hintText` (e.g. current_da_yun_cycle dump) selects matching phases.
 */
export function formatDayunSemanticForPrompt(hintText?: string): string {
  const hint = (hintText ?? "").trim();
  let phases = Object.values(DAYUN_PHASE_SSOT);
  if (hint) {
    const matched = phases.filter((p) =>
      p.polarity_hints.some((h) => hint.includes(h)),
    );
    if (matched.length > 0) phases = matched;
  }
  const lines = [
    "【大运/阶段节奏 SSOT · 内部】",
    "只给阶段精力策略（冲/藏/守），禁止年份事件铁口（婚/财/生死）。",
    "主题须能对上本盘 current_da_yun / 用神忌神；对不上就写中性节奏，不编造吉凶十年。",
  ];
  for (const p of phases.slice(0, 4)) {
    lines.push(`- ${p.theme}: ${p.pace}（极性提示:${p.polarity_hints.join("/")}）`);
  }
  lines.push(`禁预言示例: ${DAYUN_FORBIDDEN_PROPHECY.slice(0, 6).join("、")}…`);
  return lines.join("\n");
}
