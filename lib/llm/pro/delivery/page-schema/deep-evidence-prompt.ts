/**
 * Deep-evidence (Batch 3 call 1) — lock chart_anchors + write professional evidence
 * BEFORE vernacular page fill. Delivery-phase only.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import type { P4MoatMeansType } from "@/lib/glossary/wuxing-semantic-ssot";
import { formatAnchorCategoryUsageForPrompt, type CategoryTokenSets } from "./anchor-category-tally";
import { tallyAnchorCategoryUsage } from "./anchor-category-tally";
import { formatLayerBInventoryMenu } from "./layer-b-inventory-menu";

/** Write→Fill mechanism shaping tag (locked after write). */
export const DEEP_EVIDENCE_MECHANISM_TAGS = [
  "window_switch",
  "approach_avoid",
  "role_stance",
  "surface_why",
  "science_angle",
  "fuse",
  "ritual",
] as const;
export type DeepEvidenceMechanismTag = (typeof DEEP_EVIDENCE_MECHANISM_TAGS)[number];

export function isDeepEvidenceMechanismTag(t: string): t is DeepEvidenceMechanismTag {
  return (DEEP_EVIDENCE_MECHANISM_TAGS as readonly string[]).includes(t);
}

export type DeepEvidenceUnit = {
  /** Stable path hint (why_cards[0], primary_toolkit.angles[0], …). */
  path: string;
  chart_anchors: string[];
  /** Professional evidence with ⟦w:真词⟧ slots — not user vernacular. */
  evidence: string;
  /**
   * P4 only: Call0-assigned moat class for this unit.
   * Must survive write→compress so fill emits matching means types.
   */
  moat_class?: P4MoatMeansType | null;
  /** Assign lock: short quote from eastern/risk calc (≤80 chars). */
  calc_cite?: string;
  /** Assign lock: menu line id / short label for means growth. */
  means_candidate_ref?: string;
  /** Assign lock: one-line structural claim this unit must prove. */
  unit_claim?: string;
  /** Write output: mechanism shaping tag for compress means. */
  mechanism_tag?: DeepEvidenceMechanismTag | null;
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
      // Runtime skips deep-evidence for transition P1; spec kept for ClaimPlan alignment only.
      return {
        min: 3,
        max: 3,
        paths: ["core_judgment", "primary", "backup"],
        note: "P1 transition: deep-evidence skipped at runtime; anchors internal-only",
      };
    case "foundation":
      return {
        min: 4,
        max: 5,
        paths: ["why_cards[0]", "why_cards[1]", "why_cards[2]", "why_cards[3]", "why_cards[4]"],
        note: "why_cards 每卡一单元；默认 4，确有第五表象可写 5。path 与【P2 表象候选菜单】顺序对齐；末卡对应收束卡。",
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
        note: "主辅各 3 个 angle；path 与【P3 科学手段候选菜单】维序对齐；不要写 opening/alert 单元",
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
        note: "身份切换+今晚+近7日四条(有锚单元)；金句/带走三样为封印句——勿写 unit、勿复用身份依据",
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
  /** P2: numbered surface candidates for why_cards paths. */
  foundation_surface_feed?: string;
  /** P3: angle/means candidate menu. */
  science_means_feed?: string;
  /** P4: moat means candidate menu. */
  metaphysics_moat_feed?: string;
  /** P5: fuse / RiskItem candidate menu. */
  risk_fuse_feed?: string;
  /** P6: tonight/day7/identity candidate menu. */
  close_ritual_feed?: string;
  structured_inventory?: string;
  prior_chart_anchors?: readonly string[];
  /** Prior pages' slug+role fingerprints (cross-page 流展 copy gate). */
  prior_signal_roles?: readonly import("./assign-necessary-signals").PriorSignalRole[];
  /** Primaries reserved by job-level prealloc for other pages. */
  reserved_chart_primaries?: readonly string[];
  /** Path → prefer_primary from job prealloc. */
  prealloc_prefer_by_path?: Readonly<Record<string, string>>;
  /** Sparse merge: max units for this page. */
  prealloc_max_units?: number;
  /** Effective reuse cap from prealloc (default 2). */
  primary_reuse_cap?: number;
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

  const p4MoatBlock =
    key === "metaphysics_action"
      ? `# P4 护城河覆盖（硬优先）
- units 优先挂本案真算实有的三类：大运窗口(timing) / 用忌补泄(polarity) / 十神角色(archetype)。
- **timing 须写机制**：多久/转折/切换/窗口——禁止仅用「纪元/岁环」氛围词撑场。
- **跨 unit 禁止逐字复制** evidence（含「你为什么能这么做」类同段粘贴）。
- 有料才写、无料不编；**不**要求必须挂方位/色彩(symbol/field)。
- 跨 unit 锚点类别宜分散；禁止整页复用同一岁运/耗类锚。`
      : "";

  const system = [
    `# 你是谁\n你是交付页【深度依据推理】专员。只做一件事：为本页每个内容单元选闭集锚点并写专业命理依据。`,
    POJU_KNOWLEDGE_ROOTS,
    `# 本步边界（硬）
- 【不是】用户可见白话正文；正文由下一步「压缩」专员写。
- 【是】锁 chart_anchors + 写带 ⟦w:真词⟧ 的专业依据。
- 真词必须来自下方闭集分类菜单 / 完整闭集；禁止编造清单外词。
- 每个 unit ≥1 个 chart_anchors、≥1 个 ⟦w:⟧；禁软译替代真词。
- chart_anchors 必须全部进 ⟦w:⟧；**槽外连接语禁止再裸写其它命理专名**（下游压缩会当可抄真源）。
- 【供源≠润德】正印/供源只写「资源/能力补给、谁在供知识或结构」；月德/润德只写「关系场是否托住、柔和着陆」——禁止两词共用「有个稳定外部力量在支持你」套话。
- **扎实**：每条 evidence 至少两句机制链（因→果 / 结构→对本案题的作用），禁止单句标签。
- **贴题**：每条 evidence 必须能支撑本 unit 的 path 主题 + 本页 core_conclusion；写完自检「删掉这条依据，正文还能成立吗？」——若能，重写。
- **全面**：跨 unit 锚点类别勿高度复用；优先覆盖菜单里与本案相关的不同类目。
- 不写 primary_path/backup_path 决策口号以外的执行步骤清单（那是正文页的事）。
- 输出严格 JSON，无 markdown 围栏。`,
    p4MoatBlock,
    `# 输出形状
{
  "page": "${key}",
  "units": [
    { "path": "${spec.paths[0] ?? "unit[0]"}", "chart_anchors": ["真词"], "evidence": "⟦w:真词⟧ …（≥两句机制）" }
  ]
}
- units 长度必须在 ${spec.min}–${spec.max}；path 优先用给定路径名。
- ${spec.note}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const userParts: string[] = [
    `## 本页\n固定标签【${tag}】 · key=${key}`,
    `## 本页 core_conclusion(finalize)\n${opts.core_conclusion.trim() || "(空)"}`,
  ];
  if (opts.reality_constraints?.trim()) userParts.push(opts.reality_constraints.trim());
  if (key === "foundation" && opts.foundation_surface_feed?.trim()) {
    userParts.push(opts.foundation_surface_feed.trim());
  }
  if (key === "science_action" && opts.science_means_feed?.trim()) {
    userParts.push(opts.science_means_feed.trim());
  }
  if (key === "metaphysics_action" && opts.metaphysics_moat_feed?.trim()) {
    userParts.push(opts.metaphysics_moat_feed.trim());
  }
  if (key === "risk_guard" && opts.risk_fuse_feed?.trim()) {
    userParts.push(opts.risk_fuse_feed.trim());
  }
  if (key === "signals_close" && opts.close_ritual_feed?.trim()) {
    userParts.push(opts.close_ritual_feed.trim());
  }
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
