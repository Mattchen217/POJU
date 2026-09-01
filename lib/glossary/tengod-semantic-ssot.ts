/**
 * Ten-god semantic SSOT — drive / load dictionary + anti ji-xiong slogans.
 * Keys = CLOSED_TEN_GODS. Must bind to chart; not a personality horoscope.
 */

import { CLOSED_TEN_GODS } from "@/lib/glossary/term-closed-set";
import type { TenGod } from "@/lib/match/data/stems-branches";

export type TenGodSemanticRow = {
  id: TenGod;
  drive: string;
  load: string;
  forbidden_ji_xiong: readonly string[];
  whitelist_anchors: readonly string[];
};

export const TENGOD_BIND_RULE =
  "必须挂本盘柱位/用忌/所问之事，禁止抽象人设标签墙。";

export const TENGOD_SEMANTIC_SSOT: Record<TenGod, TenGodSemanticRow> = {
  比肩: {
    id: "比肩",
    drive: "平行协作、自我主张、同侪动能",
    load: "资源争抢感、难让权",
    forbidden_ji_xiong: ["比肩夺财", "兄弟必克", "比肩主孤"],
    whitelist_anchors: ["协作", "主张", "同侪", "分担"],
  },
  劫财: {
    id: "劫财",
    drive: "快速抢位、竞争突破、行动锐度",
    load: "冲动耗财、关系摩擦",
    forbidden_ji_xiong: ["劫财必破财", "劫财克妻", "劫财主败"],
    whitelist_anchors: ["竞争", "突破", "锐度", "止损"],
  },
  食神: {
    id: "食神",
    drive: "稳态产出、技艺表达、从容输出",
    load: "享乐拖延、输出稀释",
    forbidden_ji_xiong: ["食神制杀必贵", "食神主寿"],
    whitelist_anchors: ["产出", "表达", "技艺", "节奏"],
  },
  伤官: {
    id: "伤官",
    drive: "打破常规的创新力与非传统表达",
    load: "顶撞权威、锋芒过伤",
    forbidden_ji_xiong: ["伤官见官", "祸百端", "伤官主灾", "伤官克官"],
    whitelist_anchors: ["创新", "锋芒", "非传统", "表达"],
  },
  偏财: {
    id: "偏财",
    drive: "机会型交换、广度经营、灵活变现",
    load: "分散下注、承诺过载",
    forbidden_ji_xiong: ["偏财主横财", "偏财必富"],
    whitelist_anchors: ["交换", "机会", "变现", "多元"],
  },
  正财: {
    id: "正财",
    drive: "稳定变现、可预期回报、账目清楚",
    load: "过度求稳、错失窗口",
    forbidden_ji_xiong: ["正财主富", "正财克妻"],
    whitelist_anchors: ["稳定", "回报", "账目", "兑现"],
  },
  七杀: {
    id: "七杀",
    drive: "高压下的危机处理力与硬边界",
    load: "外部压制感、易硬刚透支",
    forbidden_ji_xiong: ["七杀主血光", "七杀必灾", "七杀攻身", "羊刃七杀"],
    whitelist_anchors: ["高压", "危机", "边界", "决断"],
  },
  正官: {
    id: "正官",
    drive: "秩序、责任、制度内可信度",
    load: "规则过载、自我压缩",
    forbidden_ji_xiong: ["正官主贵", "官非牢狱", "见官有灾"],
    whitelist_anchors: ["秩序", "责任", "制度", "可信"],
  },
  偏印: {
    id: "偏印",
    drive: "非常规滋养、偏门学习、独自钻研",
    load: "吞没产出（枭印张力）、封闭",
    forbidden_ji_xiong: ["枭神夺食", "偏印主孤", "枭印必克"],
    whitelist_anchors: ["钻研", "非常规", "滋养", "独处"],
  },
  正印: {
    id: "正印",
    drive: "滋养型输入、心理安全、结构化支持",
    load: "依赖庇护、行动迟缓",
    forbidden_ji_xiong: ["正印主贵人不断", "印多为病"],
    whitelist_anchors: ["滋养", "安全", "支持", "学习"],
  },
};

/** Shared classic ji-xiong slogans across ten gods. */
export const TENGOD_SHARED_JI_XIONG: readonly string[] = [
  "伤官见官",
  "祸百端",
  "枭神夺食",
  "官杀混杂必灾",
  "财多身弱必贫",
  "杀重无制",
];

export function getTenGodRow(name: string): TenGodSemanticRow | null {
  const t = name.trim();
  if ((CLOSED_TEN_GODS as readonly string[]).includes(t)) {
    return TENGOD_SEMANTIC_SSOT[t as TenGod];
  }
  if (t === "偏官") return TENGOD_SEMANTIC_SSOT["七杀"];
  if (t === "枭神" || t === "枭印") return TENGOD_SEMANTIC_SSOT["偏印"];
  return null;
}

export function collectTenGodJiXiongPatterns(ids?: readonly string[]): string[] {
  const out = new Set<string>(TENGOD_SHARED_JI_XIONG);
  const list = ids && ids.length > 0 ? ids : [...CLOSED_TEN_GODS];
  for (const raw of list) {
    const row = getTenGodRow(raw);
    if (!row) continue;
    for (const c of row.forbidden_ji_xiong) out.add(c);
  }
  return [...out];
}

export function textHitsTenGodJiXiong(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const p of collectTenGodJiXiongPatterns()) {
    if (p && t.includes(p)) return p;
  }
  return null;
}

/** Pull closed-set ten-god names mentioned in spine / anchors text. */
export function extractTenGodNamesFromText(text: string): string[] {
  const t = text ?? "";
  if (!t) return [];
  const found: string[] = [];
  for (const id of CLOSED_TEN_GODS) {
    if (t.includes(id)) found.push(id);
  }
  if (t.includes("偏官") && !found.includes("七杀")) found.push("七杀");
  if ((t.includes("枭神") || t.includes("枭印")) && !found.includes("偏印")) {
    found.push("偏印");
  }
  return found;
}

/**
 * Compact policy for expression-contract (synthesis/delivery) — no full 10-row dump.
 * Chart-sliced rows belong in spine / guard via formatTenGodSemanticForPrompt.
 */
export function formatTenGodPolicyForPrompt(): string {
  return [
    "【十神语义 SSOT · 政策】",
    TENGOD_BIND_RULE,
    "正文讲动力/负荷白话；禁十神原名报幕、吉凶套话、抽象人设墙。",
    `共享禁: ${TENGOD_SHARED_JI_XIONG.join("、")}`,
  ].join("\n");
}

export function formatTenGodSemanticForPrompt(names: readonly string[]): string {
  const rows: TenGodSemanticRow[] = [];
  for (const n of names) {
    const row = getTenGodRow(n);
    if (row && !rows.some((r) => r.id === row.id)) rows.push(row);
  }
  if (rows.length === 0) return "";
  const lines = [
    "【十神语义 SSOT · 内部】",
    TENGOD_BIND_RULE,
    "只讲动力与负荷，禁止吉凶套话与抽象人设。",
  ];
  for (const r of rows) {
    lines.push(
      `- ${r.id}: 动力=${r.drive}｜负荷=${r.load}｜禁=${r.forbidden_ji_xiong.slice(0, 2).join("、")}｜锚=${r.whitelist_anchors.join("、")}`,
    );
  }
  return lines.join("\n");
}

export function assertTenGodSsotComplete(): void {
  for (const id of CLOSED_TEN_GODS) {
    if (!TENGOD_SEMANTIC_SSOT[id]) throw new Error(`missing tengod ssot: ${id}`);
  }
}
