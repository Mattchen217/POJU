/**
 * Deep-evidence (Batch 3 call 1) — lock chart_anchors + write professional evidence
 * BEFORE vernacular page fill. Delivery-phase only.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import type { P4MoatMeansType } from "@/lib/glossary/wuxing-semantic-ssot";
import {
  pageFeedFlags,
  resolvePageFeedPathOpts,
} from "@/lib/llm/pro/delivery/pipeline-v3/page-feed-policy";
import type { PivotChartPath } from "@/lib/poju/pivot-chart-path";
import { formatAnchorCategoryUsageForPrompt, type CategoryTokenSets } from "./anchor-category-tally";
import { tallyAnchorCategoryUsage } from "./anchor-category-tally";
import { formatLayerBInventoryMenu } from "./layer-b-inventory-menu";
import { appendPageSliceFeed } from "@/lib/llm/pro/delivery/page-slice-feed";

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
  /**
   * Legacy combined evidence string (may embed 【命理】/【科学】).
   * Prefer metaphysics_evidence + science_evidence; keep `evidence` for mark/compat.
   */
  evidence: string;
  /** v1 双轨 · 命理机制（含 ⟦w:真词⟧）。 */
  metaphysics_evidence?: string;
  /** v1 双轨 · 科学机制（本案绑定，无伪科学融合）。 */
  science_evidence?: string;
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
    case "decision_brief":
      // Runtime skips deep-evidence for transition P1; spec kept for ClaimPlan alignment only.
      return {
        min: 3,
        max: 3,
        paths: ["core_judgment", "primary", "backup"],
        note: "P1 transition: deep-evidence skipped at runtime; anchors internal-only",
      };
    case "situation_analysis":
    case "situation_analysis":
      return {
        min: 4,
        max: 5,
        paths: ["why_cards[0]", "why_cards[1]", "why_cards[2]", "why_cards[3]", "why_cards[4]"],
        note: "why_cards 每卡一单元；默认 4，确有第五条归因可写 5。末卡收束诊断。",
      };
    case "personal_decision_patterns":
      return {
        min: 1,
        max: 3,
        paths: ["why_cards[0]", "why_cards[1]", "why_cards[2]"],
        note: "模式短卡 1–3；每卡一单元。",
      };
    case "bottleneck_analysis":
      return {
        min: 1,
        max: 3,
        paths: ["why_cards[0]", "why_cards[1]", "why_cards[2]"],
        note: "障碍卡 1–3；每卡一单元。",
      };
    case "strategic_options":
      return {
        min: 2,
        max: 4,
        paths: ["options[0]", "options[1]", "options[2]", "options[3]"],
        note: "每选项一单元；2–4 条。",
      };
    case "recommended_strategy":
      return {
        min: 3,
        max: 3,
        paths: ["core_judgment", "primary", "backup"],
        note: "主策略三槽：判断+主+辅。",
      };
    case "execution_guidance":
    case "execution_guidance":
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
        note: "主辅各 3 个 angle；path 与科学手段候选菜单维序对齐；不要写 opening/alert 单元",
      };
    case "self_regulation":
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
    case "validation_risk":
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
    case "validation_close":
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
  /** Stage-1 dyad relation structure (optional page feed). */
  dyad_relation_structure?: string;
  pivot_chart_path?: PivotChartPath | null;
  partner_bazi?: "absent" | "present" | null;
  primary_backup_hint?: string;
  reality_constraints?: string;
  /** P2: numbered surface candidates for why_cards paths. */
  foundation_surface_feed?: string;
  /** P3: angle/means candidate menu. */
  science_means_feed?: string;
  /** P3 批断枪：结构派工薄菜单（无 Q/E/收集）。 */
  science_means_judgment_feed?: string;
  /** P4: moat means candidate menu. */
  metaphysics_moat_feed?: string;
  /** P4 批断枪：moat 结构候选（无 Q/E/收集事实）。 */
  metaphysics_moat_judgment_feed?: string;
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
  /** Path → prefer_primary from job prealloc (lead of the term group). */
  prealloc_prefer_by_path?: Readonly<Record<string, string>>;
  /** Path → full this-chart term group. Ignored when chart_fact_pack is set. */
  prealloc_term_groups?: Readonly<Record<string, readonly string[]>>;
  /** This person's local-calc record. When set, assign does not lock a slug menu. */
  chart_fact_pack?: string;
  /** Optional. Page slice omits zfp when this is absent. */
  ziwei_fact_pack?: import("@/lib/ziwei/fact-pack").ZiweiFactPack | null;
  topic?: string | null;
  chart_fact_ganzhi?: readonly string[];
  chart_fact_shen_sha?: readonly string[];
  /** Sparse merge: max units for this page. */
  prealloc_max_units?: number;
  /** Effective reuse cap from prealloc (default 2). */
  primary_reuse_cap?: number;
  category_token_sets?: CategoryTokenSets | null;
  action_brief_block?: string;
  /** Job chart thesis block for assign/write cite-only. */
  chart_thesis_block?: string;
  /** Structured thesis object for coverage / thesis_gap gates. */
  chart_thesis?: import("@/lib/llm/pro/delivery/thesis/types").ChartThesis | null;
  /** Profile structured for extendThesisDimension on thesis_gap. */
  thesis_structured?: import("@/lib/calculations/build-profile-structured").ProfileStructured | null;
};

export function buildDeepEvidencePrompt(
  key: DeliverySegmentKey,
  opts: DeepEvidencePromptOpts,
): { system: string; user: string } {
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const spec = deepEvidenceUnitSpec(key);
  const feed = pageFeedFlags(
    key,
    "body",
    resolvePageFeedPathOpts({
      pivot_chart_path: opts.pivot_chart_path,
      partner_bazi: opts.partner_bazi,
      dyad_relation_structure: opts.dyad_relation_structure,
    }),
  );
  const tally = tallyAnchorCategoryUsage(
    opts.prior_chart_anchors ?? [],
    opts.category_token_sets,
  );
  const layerA = formatAnchorCategoryUsageForPrompt(tally);
  const layerB = formatLayerBInventoryMenu(opts.category_token_sets);

  const p4MoatBlock =
    key === "self_regulation"
      ? `# P4 护城河覆盖（硬优先）
- units 优先挂本案真算实有的三类：大运窗口(timing) / 用忌补泄(polarity) / 十神角色(archetype)。
- **timing 须写机制**：多久/转折/切换/窗口——禁止仅用「纪元/岁环」氛围词撑场。
- **跨 unit 禁止逐字复制** evidence（含「你为什么能这么做」类同段粘贴）。
- 有料才写、无料不编；**不**要求必须挂方位/色彩(symbol/field)。
- 跨 unit 锚点类别宜分散；禁止整页复用同一岁运/耗类锚。`
      : "";

  const dualEvidenceDuty =
    key === "decision_brief"
      ? ""
      : `# v1 双轨依据（硬 · 结构化双字段）
- 每个 unit **必须**写两个字段（勿只靠文内标签凑合）：
  - metaphysics_evidence：≥两句命理机制链，含 ⟦w:真词⟧，删掉后主张须垮
  - science_evidence：≥一句本案绑定的现代机制（决策/行为/认知/概率等），须点名落到用户事实或本 unit 行动；禁止空术语；禁止「科学验证了八字」
- 命理承重；科学加固可执行/可验证，不单独撑起「谁都适用」的主路径。
- 另写 evidence = metaphysics_evidence + "\\n" + science_evidence（兼容下游 mark）；槽 ⟦w:⟧ 只出现在 metaphysics_evidence。
- 若模型仍输出旧式「【命理】…【科学】…」单字段，下游会拆分，但新稿请直接用双字段。`;

  const system = [
    `# 你是谁\n你是交付页【深度依据推理】专员。为本页每个内容单元锁闭集锚点，并写**双轨**专业依据（命理 + 科学）。`,
    POJU_KNOWLEDGE_ROOTS,
    `# 本步边界（硬）
- 【不是】用户可见白话正文；正文由下一步「压缩」专员写。
- 【是】锁 chart_anchors + 写带 ⟦w:真词⟧ 的【命理】段 + 本案绑定的【科学】段。
- 真词必须来自下方闭集分类菜单 / 完整闭集；禁止编造清单外词。
- 每个 unit ≥1 个 chart_anchors、≥1 个 ⟦w:⟧；禁软译替代真词。
- chart_anchors 必须全部进 ⟦w:⟧；**槽外连接语禁止再裸写其它命理专名**（下游压缩会当可抄真源）。
- 【供源≠润德】正印/供源只写「资源/能力补给、谁在供知识或结构」；月德/润德只写「关系场是否托住、柔和着陆」——禁止两词共用「有个稳定外部力量在支持你」套话。
- **扎实**：【命理】至少两句机制链；【科学】至少一句本案机制；禁止单句标签。
- **贴题**：每条 evidence 必须能支撑本 unit 的 path 主题 + 本页 core_conclusion；写完自检「删掉【命理】后正文还能成立吗？」——若能，重写命理段。
- **全面**：跨 unit 锚点类别勿高度复用；优先覆盖菜单里与本案相关的不同类目。
- 【五行关系链】wuxing_relations 写成通顺自然语言；禁止【元素】动词【元素】模板；每句最多 2 元素 + 1 关系。
- 【thesis】引用 inference_zh 展开，禁止粘贴 conclusion_zh 原文。
- 不写 primary_path/backup_path 决策口号以外的执行步骤清单（那是正文页的事）。
- 输出严格 JSON，无 markdown 围栏。`,
    dualEvidenceDuty,
    p4MoatBlock,
    `# 输出形状
{
  "page": "${key}",
  "units": [
    { "path": "${spec.paths[0] ?? "unit[0]"}", "chart_anchors": ["真词"], "metaphysics_evidence": "⟦w:真词⟧ …（≥两句）", "science_evidence": "…（本案机制≥一句）", "evidence": "⟦w:真词⟧ …\\n…" }
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
  if (feed.reality && opts.reality_constraints?.trim()) {
    userParts.push(opts.reality_constraints.trim());
  }
  if (
    feed.foundation_surface &&
    (key === "situation_analysis" ||
      key === "personal_decision_patterns" ||
      key === "bottleneck_analysis") &&
    opts.foundation_surface_feed?.trim()
  ) {
    userParts.push(opts.foundation_surface_feed.trim());
  }
  if (feed.science_means && key === "execution_guidance" && opts.science_means_feed?.trim()) {
    userParts.push(opts.science_means_feed.trim());
  }
  if (
    feed.metaphysics_moat &&
    key === "self_regulation" &&
    opts.metaphysics_moat_feed?.trim()
  ) {
    userParts.push(opts.metaphysics_moat_feed.trim());
  }
  if (feed.risk_fuse && key === "validation_risk" && opts.risk_fuse_feed?.trim()) {
    userParts.push(opts.risk_fuse_feed.trim());
  }
  if (feed.close_ritual && key === "validation_close" && opts.close_ritual_feed?.trim()) {
    userParts.push(opts.close_ritual_feed.trim());
  }
  if (opts.bazi_basis?.length) {
    userParts.push(`## bazi_basis\n${opts.bazi_basis.join(" · ")}`);
  }
  if (opts.page_plan_slice?.trim()) {
    userParts.push(`## 本页派工料 / 候选池\n${opts.page_plan_slice.trim()}`);
  }
  if (feed.qimen && opts.eastern_calc_slice?.trim()) {
    userParts.push(`## 本地真算料\n${opts.eastern_calc_slice.trim()}`);
  }
  if (opts.risk_calc_slice?.trim()) {
    userParts.push(`## 熔断算料\n${opts.risk_calc_slice.trim()}`);
  }
  if (feed.question_expectation && opts.question_expectation?.trim()) {
    userParts.push(`## 问题与期望\n${opts.question_expectation.trim()}`);
  }
  if (feed.dyad_relation_structure && opts.dyad_relation_structure?.trim()) {
    userParts.push(opts.dyad_relation_structure.trim());
  }
  if (feed.primary_backup_hint && opts.primary_backup_hint?.trim()) {
    userParts.push(`## 主辅对照\n${opts.primary_backup_hint.trim()}`);
  }
  if (feed.upstream_action_excerpt && opts.action_brief_block?.trim()) {
    userParts.push(opts.action_brief_block.trim());
  }
  if (feed.thesis_factpack && opts.chart_thesis_block?.trim()) {
    userParts.push(opts.chart_thesis_block.trim());
  }
  userParts.push(layerA);
  userParts.push(layerB);
  const pageSliceFed = appendPageSliceFeed(userParts, {
    key,
    chartText: opts.chart_fact_pack,
    ziwei: opts.ziwei_fact_pack,
    question: opts.question_expectation,
    topic: opts.topic,
  });
  if (feed.structured_inventory && opts.structured_inventory?.trim() && !pageSliceFed) {
    userParts.push(
      `【完整原始命盘闭集 · 与分类菜单互为补充；禁编造闭集外词】\n${opts.structured_inventory.trim()}`,
    );
  }
  userParts.push(
    `## 输出\n只输出 JSON：page="${key}", units 长度 ${spec.min}–${spec.max}。每条 path/chart_anchors/evidence。`,
  );

  return { system, user: userParts.join("\n\n") };
}
