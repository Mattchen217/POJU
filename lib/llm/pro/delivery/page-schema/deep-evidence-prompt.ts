/**
 * Deep-evidence (Batch 3 call 1) — lock chart_anchors + write professional evidence
 * BEFORE vernacular page fill. Delivery-phase only.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import { formatAnchorCategoryUsageForPrompt, type CategoryTokenSets } from "./anchor-category-tally";
import { tallyAnchorCategoryUsage } from "./anchor-category-tally";
import { formatLayerBInventoryMenu } from "./layer-b-inventory-menu";

export type DeepEvidenceUnit = {
  /** Stable path hint (why_cards[0], primary_toolkit.angles[0], …). */
  path: string;
  chart_anchors: string[];
  /** Professional evidence with ⟦w:真词⟧ slots — not user vernacular. */
  evidence: string;
};

export type DeepEvidencePlan = {
  page: DeliverySegmentKey;
  units: DeepEvidenceUnit[];
};

/** Canonical unit paths / counts for deep-evidence (align with pageSchemaToArgumentBodies). */
export function deepEvidenceUnitSpec(key: DeliverySegmentKey): {
  min: number;
  max: number;
  paths: string[];
  note: string;
} {
  switch (key) {
    case "direct_answer":
      return {
        min: 3,
        max: 3,
        paths: ["core_judgment", "primary", "backup"],
        note: "核心判定 + 主路径 + 辅路径，各锁锚并写依据",
      };
    case "foundation":
      return {
        min: 4,
        max: 5,
        paths: ["why_cards[0]", "why_cards[1]", "why_cards[2]", "why_cards[3]", "why_cards[4]"],
        note: "why_cards 每卡一单元；默认 4，确有第五表象可写 5",
      };
    case "science_action":
      return {
        min: 6,
        max: 6,
        paths: [
          "primary_toolkit.angles[0]",
          "primary_toolkit.angles[1]",
          "primary_toolkit.angles[2]",
          "backup_toolkit.angles[0]",
          "backup_toolkit.angles[1]",
          "backup_toolkit.angles[2]",
        ],
        note: "主辅各 3 个 angle；不要写 opening/alert 单元",
      };
    case "metaphysics_action":
      return {
        min: 2,
        max: 6,
        paths: [
          "dimensions[0]",
          "dimensions[1]",
          "dimensions[2]",
          "dimensions[3]",
          "dimensions[4]",
          "dimensions[5]",
        ],
        note: "dimensions 有关尽给(2–6)；units 条数=维度条数",
      };
    case "risk_guard":
      return {
        min: 6,
        max: 6,
        paths: [
          "red_lights[0]",
          "red_lights[1]",
          "traps[0]",
          "switch_to_backup",
          "protection_rules[0]",
          "protection_rules[1]",
        ],
        note: "红灯2 + 坑1 + 切辅1 + 防护2",
      };
    case "signals_close":
      return {
        min: 6,
        max: 6,
        paths: [
          "identity_shift",
          "tonight",
          "day7_micro_actions[0]",
          "day7_micro_actions[1]",
          "day7_micro_actions[2]",
          "day7_micro_actions[3]",
        ],
        note: "身份切换+今晚+近7日四条(有锚单元)；勿写 quote/takeaways 单元",
      };
    default:
      return { min: 1, max: 4, paths: ["unit[0]"], note: key };
  }
}

export type DeepEvidencePromptOpts = {
  locale: string;
  core_conclusion: string;
  bazi_basis?: readonly string[];
  page_plan_slice?: string;
  eastern_calc_slice?: string;
  risk_calc_slice?: string;
  question_expectation?: string;
  primary_backup_hint?: string;
  reality_constraints?: string;
  structured_inventory?: string;
  prior_chart_anchors?: readonly string[];
  category_token_sets?: CategoryTokenSets | null;
  action_brief_block?: string;
};

export function buildDeepEvidencePrompt(
  key: DeliverySegmentKey,
  opts: DeepEvidencePromptOpts,
): { system: string; user: string } {
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const spec = deepEvidenceUnitSpec(key);
  const tally = tallyAnchorCategoryUsage(
    opts.prior_chart_anchors ?? [],
    opts.category_token_sets,
  );
  const layerA = formatAnchorCategoryUsageForPrompt(tally);
  const layerB = formatLayerBInventoryMenu(opts.category_token_sets);

  const system = [
    `# 你是谁\n你是交付页【深度依据推理】专员。只做一件事：为本页每个内容单元选闭集锚点并写专业命理依据。`,
    POJU_KNOWLEDGE_ROOTS,
    `# 本步边界（硬）
- 【不是】用户可见白话正文；正文由下一步「压缩」专员写。
- 【是】锁 chart_anchors + 写带 ⟦w:真词⟧ 的专业依据。
- 真词必须来自下方闭集分类菜单 / 完整闭集；禁止编造清单外词。
- 每个 unit ≥1 个 chart_anchors、≥1 个 ⟦w:⟧；禁软译替代真词。
- 不写 primary_path/backup_path 决策口号以外的执行步骤清单（那是正文页的事）。
- 输出严格 JSON，无 markdown 围栏。`,
    `# 输出形状
{
  "page": "${key}",
  "units": [
    { "path": "${spec.paths[0] ?? "unit[0]"}", "chart_anchors": ["真词"], "evidence": "⟦w:真词⟧ …" }
  ]
}
- units 长度必须在 ${spec.min}–${spec.max}；path 优先用给定路径名。
- ${spec.note}`,
  ].join("\n\n");

  const userParts: string[] = [
    `## 本页\n固定标签【${tag}】 · key=${key}`,
    `## 本页 core_conclusion(finalize)\n${opts.core_conclusion.trim() || "(空)"}`,
  ];
  if (opts.reality_constraints?.trim()) userParts.push(opts.reality_constraints.trim());
  if (opts.bazi_basis?.length) {
    userParts.push(`## bazi_basis\n${opts.bazi_basis.join(" · ")}`);
  }
  if (opts.page_plan_slice?.trim()) {
    userParts.push(`## 本页派工料 / 候选池\n${opts.page_plan_slice.trim()}`);
  }
  if (opts.eastern_calc_slice?.trim()) {
    userParts.push(`## 本地真算料\n${opts.eastern_calc_slice.trim()}`);
  }
  if (opts.risk_calc_slice?.trim()) {
    userParts.push(`## 熔断算料\n${opts.risk_calc_slice.trim()}`);
  }
  if (opts.question_expectation?.trim()) {
    userParts.push(`## 问题与期望\n${opts.question_expectation.trim()}`);
  }
  if (opts.primary_backup_hint?.trim()) {
    userParts.push(`## 主辅对照\n${opts.primary_backup_hint.trim()}`);
  }
  if (opts.action_brief_block?.trim()) {
    userParts.push(opts.action_brief_block.trim());
  }
  userParts.push(layerA);
  userParts.push(layerB);
  if (opts.structured_inventory?.trim()) {
    userParts.push(
      `【完整原始命盘闭集 · 与分类菜单互为补充；禁编造闭集外词】\n${opts.structured_inventory.trim()}`,
    );
  }
  userParts.push(
    `## 输出\n只输出 JSON：page="${key}", units 长度 ${spec.min}–${spec.max}。每条 path/chart_anchors/evidence。`,
  );

  return { system, user: userParts.join("\n\n") };
}
