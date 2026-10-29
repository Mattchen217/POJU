/**
 * 旧出稿 key / 九模块 / pageSchema / fill duty → 内容 SoT pageId。
 *
 * `resolveDeliverySegmentKey("01"|"02"|"04"|"05"|"06"|"08")` 落到该页主 v1 键。
 * 07 与 03 没有内部键，返回 null。生成 JSON 的 page 字段仍是 v1 键。
 * 页结构真源是 DecisionPageId（2026-10-27）。书架脸与这条读路径共用 01–08。
 *
 * 旧字母 A–F 是 Phase-4 书键，不是新双轨段 A/B/C。
 */

import type { DecisionPageId } from "@/lib/llm/pro/delivery/page-feed-matrix";

export type RemapDisposition = "primary" | "folded" | "alias" | "retired";

export type LegacyKeyFamily =
  | "v1_module"
  | "v1_segment"
  | "legacy_six"
  | "legacy_alias"
  | "retired";

export interface LegacyPageRemap {
  legacyKey: string;
  family: LegacyKeyFamily;
  /** null = 退役，不进入新页序。 */
  pageId: DecisionPageId | null;
  alsoFeeds: readonly DecisionPageId[];
  /** 落到新页的段，例如 06-C。整页落地则为 null。 */
  segment: string | null;
  disposition: RemapDisposition;
  note: string;
}

export const LEGACY_PAGE_REMAP: readonly LegacyPageRemap[] = [
  {
    legacyKey: "decision_brief",
    family: "v1_module",
    pageId: "01",
    alsoFeeds: [],
    segment: null,
    disposition: "primary",
    note: "本题断语。模块与出稿段同键。",
  },
  {
    legacyKey: "situation_analysis",
    family: "v1_module",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "primary",
    note: "为何如此。",
  },
  {
    legacyKey: "personal_decision_patterns",
    family: "v1_module",
    pageId: "02",
    alsoFeeds: ["04"],
    segment: null,
    disposition: "folded",
    note: "性格长文不单开页。姿态句并入 02 与 04。",
  },
  {
    legacyKey: "bottleneck_analysis",
    family: "v1_module",
    pageId: "04",
    alsoFeeds: [],
    segment: null,
    disposition: "primary",
    note: "真正卡点。",
  },
  {
    legacyKey: "strategic_options",
    family: "v1_module",
    pageId: "05",
    alsoFeeds: [],
    segment: null,
    disposition: "primary",
    note: "路径排序。",
  },
  {
    legacyKey: "recommended_strategy",
    family: "v1_module",
    pageId: "05",
    alsoFeeds: ["01"],
    segment: "D",
    disposition: "folded",
    note: "切轨/停止进 05-D。主推荐句与 01 对齐，不另开页。",
  },
  {
    legacyKey: "execution_guidance",
    family: "v1_module",
    pageId: "06",
    alsoFeeds: [],
    segment: null,
    disposition: "primary",
    note: "怎么落地。近步原则与完成样貌，不是勾选作业。",
  },
  {
    legacyKey: "self_regulation",
    family: "v1_module",
    pageId: "06",
    alsoFeeds: [],
    segment: "C",
    disposition: "folded",
    note: "调频精华在 06-C，不单开页。",
  },
  {
    legacyKey: "validation_review",
    family: "v1_module",
    pageId: "08",
    alsoFeeds: [],
    segment: null,
    disposition: "primary",
    note: "自检清单。出稿仍拆成 validation_risk + validation_close。",
  },
  {
    legacyKey: "validation_risk",
    family: "v1_segment",
    pageId: "08",
    alsoFeeds: [],
    segment: "A",
    disposition: "primary",
    note: "红灯信号落到 08-A。",
  },
  {
    legacyKey: "validation_close",
    family: "v1_segment",
    pageId: "08",
    alsoFeeds: [],
    segment: "B",
    disposition: "folded",
    note: "复盘收束并入 08，不单独成主叙事页。",
  },
  {
    legacyKey: "appendix",
    family: "v1_module",
    pageId: "03",
    alsoFeeds: [],
    segment: null,
    disposition: "primary",
    note: "盘面附录。包尾固定，不进主翻页。",
  },
  {
    legacyKey: "direct_answer",
    family: "legacy_six",
    pageId: "01",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "旧 P1。运行时仍先落到 decision_brief。",
  },
  {
    legacyKey: "foundation",
    family: "legacy_six",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "旧 P2。运行时仍先落到 situation_analysis。",
  },
  {
    legacyKey: "science_action",
    family: "legacy_six",
    pageId: "06",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "旧 P3。运行时仍先落到 execution_guidance。",
  },
  {
    legacyKey: "metaphysics_action",
    family: "legacy_six",
    pageId: "06",
    alsoFeeds: [],
    segment: "C",
    disposition: "alias",
    note: "旧 P4。运行时仍先落到 self_regulation，内容归 06-C。",
  },
  {
    legacyKey: "risk_guard",
    family: "legacy_six",
    pageId: "08",
    alsoFeeds: [],
    segment: "A",
    disposition: "alias",
    note: "旧 P5。运行时仍先落到 validation_risk。",
  },
  {
    legacyKey: "signals_close",
    family: "legacy_six",
    pageId: "08",
    alsoFeeds: [],
    segment: "B",
    disposition: "alias",
    note: "旧 P6。运行时仍先落到 validation_close。",
  },
  {
    legacyKey: "thirty_day",
    family: "retired",
    pageId: null,
    alsoFeeds: [],
    segment: null,
    disposition: "retired",
    note: "退役。新规格禁止假日历，不映射到 06 或 08。",
  },
  {
    legacyKey: "preface",
    family: "legacy_alias",
    pageId: "01",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "更旧书键。运行时 → decision_brief。",
  },
  {
    legacyKey: "energy_base",
    family: "legacy_alias",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "更旧书键。运行时 → situation_analysis。",
  },
  {
    legacyKey: "talent_map",
    family: "legacy_alias",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "更旧书键。运行时 → situation_analysis。",
  },
  {
    legacyKey: "spirit_gifts",
    family: "legacy_alias",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "更旧书键。运行时 → situation_analysis。",
  },
  {
    legacyKey: "macro_cycle",
    family: "legacy_alias",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "更旧书键。运行时 → situation_analysis。",
  },
  {
    legacyKey: "energy",
    family: "legacy_alias",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "更旧书键。运行时 → situation_analysis。",
  },
  {
    legacyKey: "situation",
    family: "legacy_alias",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "更旧书键。运行时 → situation_analysis。",
  },
  {
    legacyKey: "crossroads",
    family: "legacy_alias",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "更旧书键。运行时 → situation_analysis。",
  },
  {
    legacyKey: "action",
    family: "legacy_alias",
    pageId: "06",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "更旧书键。运行时 → execution_guidance。",
  },
  {
    legacyKey: "retune",
    family: "legacy_alias",
    pageId: "06",
    alsoFeeds: [],
    segment: "C",
    disposition: "alias",
    note: "更旧书键。运行时 → self_regulation，内容归 06-C。",
  },
  {
    legacyKey: "rhythm",
    family: "retired",
    pageId: null,
    alsoFeeds: [],
    segment: null,
    disposition: "retired",
    note: "更旧书键，运行时仍指向 thirty_day。内容页不再单列。",
  },
  {
    legacyKey: "awareness",
    family: "legacy_alias",
    pageId: "08",
    alsoFeeds: [],
    segment: "A",
    disposition: "alias",
    note: "更旧书键。运行时 → validation_risk。",
  },
  {
    legacyKey: "epilogue",
    family: "legacy_alias",
    pageId: "08",
    alsoFeeds: [],
    segment: "B",
    disposition: "alias",
    note: "更旧书键。运行时 → validation_close。",
  },
  {
    legacyKey: "A",
    family: "legacy_alias",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "旧字母书键，不是双轨层 A。",
  },
  {
    legacyKey: "B",
    family: "legacy_alias",
    pageId: "02",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "旧字母书键，不是双轨层 B。",
  },
  {
    legacyKey: "C",
    family: "legacy_alias",
    pageId: "06",
    alsoFeeds: [],
    segment: null,
    disposition: "alias",
    note: "旧字母书键，不是双轨层 C。",
  },
  {
    legacyKey: "D",
    family: "legacy_alias",
    pageId: "06",
    alsoFeeds: [],
    segment: "C",
    disposition: "alias",
    note: "旧字母书键。运行时 → self_regulation。",
  },
  {
    legacyKey: "E",
    family: "retired",
    pageId: null,
    alsoFeeds: [],
    segment: null,
    disposition: "retired",
    note: "旧字母书键。运行时 → thirty_day，内容页不再单列。",
  },
  {
    legacyKey: "F",
    family: "legacy_alias",
    pageId: "08",
    alsoFeeds: [],
    segment: "A",
    disposition: "alias",
    note: "旧字母书键。运行时 → validation_risk。",
  },
];

const REMAP_BY_KEY = new Map(LEGACY_PAGE_REMAP.map((row) => [row.legacyKey, row]));

/** Fill duty 文件仍服务运行时 key。此表只标明它们对应的内容页。 */
export const FILL_DUTY_FILE_REMAP = [
  { file: "page-prompts/p1-direct-answer.ts", runtimeKey: "decision_brief", pageId: "01" },
  { file: "page-prompts/p2-foundation.ts", runtimeKey: "situation_analysis", pageId: "02" },
  { file: "page-prompts/p-patterns.ts", runtimeKey: "personal_decision_patterns", pageId: "02" },
  { file: "page-prompts/p-bottleneck.ts", runtimeKey: "bottleneck_analysis", pageId: "04" },
  { file: "page-prompts/p-options.ts", runtimeKey: "strategic_options", pageId: "05" },
  { file: "page-prompts/p-strategy.ts", runtimeKey: "recommended_strategy", pageId: "05" },
  { file: "page-prompts/p3-science-action.ts", runtimeKey: "execution_guidance", pageId: "06" },
  { file: "page-prompts/p4-metaphysics-action.ts", runtimeKey: "self_regulation", pageId: "06" },
  { file: "page-prompts/p5-risk-guard.ts", runtimeKey: "validation_risk", pageId: "08" },
  { file: "page-prompts/p6-signals-close.ts", runtimeKey: "validation_close", pageId: "08" },
  { file: "page-prompts/thirty-day-legacy.ts", runtimeKey: "thirty_day", pageId: null },
] as const;

export function remapRowForLegacyKey(raw: string | null | undefined): LegacyPageRemap | null {
  if (!raw) return null;
  const key = raw.trim();
  return REMAP_BY_KEY.get(key) ?? REMAP_BY_KEY.get(key.toUpperCase()) ?? null;
}

/** 内容页。退役键返回 null。未知键返回 null，不猜测。 */
export function contentPageIdForLegacyKey(raw: string | null | undefined): DecisionPageId | null {
  if (!raw?.trim()) return null;
  const key = raw.trim();
  // Face ids are already canonical page ids (new books).
  if (
    key === "01" ||
    key === "02" ||
    key === "03" ||
    key === "04" ||
    key === "05" ||
    key === "06" ||
    key === "07" ||
    key === "08"
  ) {
    return key;
  }
  return remapRowForLegacyKey(key)?.pageId ?? null;
}
