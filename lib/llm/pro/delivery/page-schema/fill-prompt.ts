/**
 * Per-page Sub-Prompt assembler for Structured JSON slot-fill (page_schema_v1).
 * Delivery-phase only — do not import into POJU_IDENTITY / chat control plane.
 *
 * 逐页人设/任务/目标 → lib/llm/pro/delivery/page-prompts/p1…p6
 * 本文件只负责：L1 共用 + 本页 L2 + 形状锚（skeleton / legacy）+ user 料组装。
 *
 * Gate 0: never import ./mock-fixture here (CI). Legacy few-shot only via
 * fill-shape-legacy-fewshot when DELIVERY_FILL_SHAPE_MODE=mock.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import { buildUserFacingExpressionContractBlock } from "@/lib/llm/prompts/user-facing-expression-contract";
import {
  DELIVERY_FILL_L1_IDENTITY,
  fillDutyForKey,
} from "@/lib/llm/pro/delivery/page-prompts";
import type { P5ActionBrief, P5WeekSummary } from "./types";
import {
  formatP5ActionBriefForPrompt,
  formatP5WeekSummaryForPrompt,
} from "./action-extractor";
import { legacyFillFewShotForKey } from "./fill-shape-legacy-fewshot";
import {
  resolveDeliveryFillShapeMode,
  type DeliveryFillShapeMode,
} from "./fill-shape-mode";
import { fillShapeSkeletonForKey } from "./fill-shape-skeleton";
import { scrubMingliJargonOutsideSlots } from "./compress-jargon-repair";
import {
  formatAnchorCategoryUsageForPrompt,
  tallyAnchorCategoryUsage,
  type CategoryTokenSets,
} from "./anchor-category-tally";

export type PageSchemaFillPromptOpts = {
  locale: string;
  core_conclusion: string;
  bazi_basis?: readonly string[];
  /** Wave C: upstream body for risk + close. */
  action_brief?: P5ActionBrief | null;
  /** @deprecated 30-day retired — unused. */
  week_summary?: P5WeekSummary | null;
  /** Optional pack score hints (never invent beyond these). */
  dashboard_score_hints?: string;
  /** Extra upstream for P3 (primary/backup names). Not for P4. */
  primary_backup_hint?: string;
  /** P4: original question + desired outcome from collecting. */
  question_expectation?: string;
  /** P4: local metaphysics_pack + retune + multi-dim dump (relevant-extract only). */
  eastern_calc_slice?: string;
  /** P5: risk-polarity local calc (relevant-extract only). */
  risk_calc_slice?: string;
  /** P1/P2/P3/P6: plan must_use slice (thin feed). */
  page_plan_slice?: string;
  /**
   * Hard reality lines from collecting (covered_agenda). Compact; all pages.
   * Injected on user side — never invent conflicting numbers/tracks.
   */
  reality_constraints?: string;
  /** P2: numbered surface candidates (why_cards quality-first feed). */
  foundation_surface_feed?: string;
  /** P3: angle/means candidate menu (quality-first feed). */
  science_means_feed?: string;
  /** P4: moat means candidate menu (quality-first feed). */
  metaphysics_moat_feed?: string;
  /** P5: fuse / RiskItem candidate menu (keep on compress). */
  risk_fuse_feed?: string;
  /** P6: tonight/day7/identity candidate menu (keep on compress). */
  close_ritual_feed?: string;
  /**
   * Layer A: chart_anchors already used on ready upstream pages.
   * User-side only (never static system) — soft diversity hint, not quota.
   */
  prior_chart_anchors?: readonly string[];
  /** Optional inventory token sets from structured (improves category labels). */
  category_token_sets?: CategoryTokenSets | null;
  /**
   * Full structured closed-set inventory (buildStructuredInstanceInventory).
   * Complements multi_dim / page_plan slices — user-side only.
   */
  structured_inventory?: string;
  /**
   * Batch 3: "compress" = vernacular rewrite from locked deep evidence (no new reckoning).
   * Default "full" keeps legacy single-shot fill (transition / fallback).
   */
  fill_mode?: "full" | "compress";
  /** Locked deep-evidence plan dump for compress mode. */
  deep_evidence_lock?: string;
  /** Override shape mode (tests). Default: env DELIVERY_FILL_SHAPE_MODE. */
  shape_mode?: DeliveryFillShapeMode;
};

function buildShapeAnchorBlock(
  key: DeliverySegmentKey,
  mode: DeliveryFillShapeMode,
): string {
  if (mode === "skeleton") {
    const skeleton = fillShapeSkeletonForKey(key);
    if (!skeleton) return "";
    return (
      `\n# 形状锚 JSON(字段必填·空串须全部换成本案料·禁止把空串当正文)\n` +
      "```json\n" +
      `${JSON.stringify(skeleton, null, 2)}\n` +
      "```\n"
    );
  }
  const few = legacyFillFewShotForKey(key);
  if (!few) return "";
  return (
    `\n# Few-shot 合格 JSON(形状参考·勿照抄案例剧情·legacy)\n` +
    "```json\n" +
    `${JSON.stringify(few, null, 2)}\n` +
    "```\n"
  );
}

export function buildPageSchemaFillPrompt(
  key: DeliverySegmentKey,
  opts: PageSchemaFillPromptOpts,
): { system: string; user: string; shape_mode: DeliveryFillShapeMode } {
  const expressionContract = buildUserFacingExpressionContractBlock({
    locale: opts.locale,
    preset: "delivery",
  });
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const shape_mode = opts.shape_mode ?? resolveDeliveryFillShapeMode();
  const shapeAnchor = buildShapeAnchorBlock(key, shape_mode);
  const isCompress = opts.fill_mode === "compress";

  const system = [
    DELIVERY_FILL_L1_IDENTITY,
    POJU_KNOWLEDGE_ROOTS,
    expressionContract,
    fillDutyForKey(key, tag),
    isCompress
      ? `# 正文压缩模式（硬 · 首枪）
- 深度依据与 chart_anchors 已由上一调用锁定（见 user 侧「已锁定深度依据」）——**唯一**命理真源。
- 本步【只】把专业依据压缩改写成大白话页内字段；禁止重新真算、禁止另选主承重真词。
- **用户可见正文（strategy/means/surface/essence…）= 零命理专名**：锁定允许表里的词也不许进正文；只许写进 JSON \`chart_anchors\`（原样复制允许表）。
- **绑定摘要（硬）**：每单元 strategy 须从 \`unit_claim\` + professional_evidence 长出；means/surface 须能回溯 \`means_candidate_ref\`；有 \`mechanism_tag\` 时按 tag 成型（window_switch/approach_avoid/role_stance/surface_why/science_angle/fuse/ritual）。
- 若专业依据/手段菜单出现阶段·柱支概念，按「正文平替提示」改写，禁止照抄真词（含训练记忆里「想起」的词）。
${
  key === "metaphysics_action"
    ? `- **P4 护城河兑现（硬）**：每个锁定 \`moat_class\` 对应维的 means 须写出该类**机制白话**（转折窗口 / 补给远离 / 借势开创角色定位）。\`type\` 由后端按锁定表回填——你负责字写对；禁止只写 mindset/P3 执行腔却宣称过闸。
- 禁止整页 means 全是 polarity；锁定了 archetype 却未写出角色/借势机制=废稿。`
    : ""
}`
      : `# 全文填充模式（无 deep 锁时）
- 仍须先机制后包装：strategy/means 从本案真算与候选菜单生长，禁止空壳口号。
- 删 chart_anchors / 依据后谁都适用 → 废稿。`,
    shapeAnchor,
  ]
    .filter(Boolean)
    .join("\n\n");

  const userParts: string[] = [
    `## 本页\n固定标签【${tag}】 · key=${key}`,
    `## 本页 core_conclusion(finalize)\n${opts.core_conclusion.trim() || "(空)"}`,
  ];
  if (opts.reality_constraints?.trim()) {
    userParts.push(opts.reality_constraints.trim());
  }
  if (key === "foundation" && opts.foundation_surface_feed?.trim()) {
    const feed = isCompress
      ? scrubMingliJargonOutsideSlots(opts.foundation_surface_feed.trim()).text
      : opts.foundation_surface_feed.trim();
    userParts.push(feed);
  }
  if (key === "science_action" && opts.science_means_feed?.trim()) {
    // Keep on compress too — means cannot be invented from ⟦w:⟧ alone.
    // Scrub unmarked 年支/大运 so compress does not copy synthesis anchors into body.
    const feed = isCompress
      ? scrubMingliJargonOutsideSlots(opts.science_means_feed.trim()).text
      : opts.science_means_feed.trim();
    userParts.push(feed);
  }
  if (key === "metaphysics_action" && opts.metaphysics_moat_feed?.trim()) {
    const feed = isCompress
      ? scrubMingliJargonOutsideSlots(opts.metaphysics_moat_feed.trim()).text
      : opts.metaphysics_moat_feed.trim();
    userParts.push(feed);
  }
  if (key === "risk_guard" && opts.risk_fuse_feed?.trim()) {
    const feed = isCompress
      ? scrubMingliJargonOutsideSlots(opts.risk_fuse_feed.trim()).text
      : opts.risk_fuse_feed.trim();
    userParts.push(feed);
  }
  if (key === "signals_close" && opts.close_ritual_feed?.trim()) {
    const feed = isCompress
      ? scrubMingliJargonOutsideSlots(opts.close_ritual_feed.trim()).text
      : opts.close_ritual_feed.trim();
    userParts.push(feed);
  }
  if (key === "foundation" && opts.question_expectation?.trim()) {
    userParts.push(
      `## 问题与期望(表象收束锚 · 非另立目标)\n${opts.question_expectation.trim()}`,
    );
  }
  if (key === "science_action" && opts.question_expectation?.trim()) {
    userParts.push(
      `## 问题与期望(手段交付物锚定 · 非另立第三套药方)\n${opts.question_expectation.trim()}`,
    );
  }
  // Compress: lock is the only 命理 source — do not feed inventory / eastern / page_plan / bare bazi.
  if (!isCompress && opts.bazi_basis?.length) {
    userParts.push(`## bazi_basis(仅依据层可用·正文勿裸报)\n${opts.bazi_basis.join(" · ")}`);
  }
  if (!isCompress && opts.page_plan_slice?.trim()) {
    userParts.push(
      `## 本页派工料(只写 must_use · 禁 for forbid 项)\n${opts.page_plan_slice.trim()}`,
    );
  }
  // Dashboard hints: full fill only (compress must not burn tokens on retired chrome).
  if (
    !isCompress &&
    key === "foundation" &&
    opts.dashboard_score_hints?.trim()
  ) {
    userParts.push(
      `## dashboard 真分(仅内部对照·UI 已退役·禁止写入用户可见正文/why_cards)\n${opts.dashboard_score_hints.trim()}`,
    );
  }
  // Primary/backup hint: P3 / P5 / P6 only (not P4; P1/P2 get via core_conclusion).
  if (
    (key === "science_action" || key === "risk_guard" || key === "signals_close") &&
    opts.primary_backup_hint?.trim()
  ) {
    const hint = isCompress
      ? scrubMingliJargonOutsideSlots(opts.primary_backup_hint.trim()).text
      : opts.primary_backup_hint.trim();
    userParts.push(`## 主辅对照(来自上游)\n${hint}`);
  }
  if (key === "metaphysics_action" && opts.question_expectation?.trim()) {
    userParts.push(
      `## 问题与期望(本页锚定 · 非主辅轨)\n${opts.question_expectation.trim()}`,
    );
  }
  if (key === "risk_guard" && opts.question_expectation?.trim()) {
    userParts.push(
      `## 问题与期望(执行刹车锚定 · 非另立目标)\n${opts.question_expectation.trim()}`,
    );
  }
  if (key === "signals_close" && opts.question_expectation?.trim()) {
    userParts.push(
      `## 问题与期望(出门收束锚定 · 非另立第三套药方)\n${opts.question_expectation.trim()}`,
    );
  }
  if (!isCompress && key === "metaphysics_action" && opts.eastern_calc_slice?.trim()) {
    userParts.push(
      `## 本地真算料(先护城河维:人生阶段窗口/用忌补泄/十神角色;色向可选;禁编造数字/方位)\n${opts.eastern_calc_slice.trim()}`,
    );
  }
  if (!isCompress && key === "risk_guard" && opts.risk_calc_slice?.trim()) {
    userParts.push(
      `## 本地熔断算料(先锁 RiskItem.chart_anchors;只抽与本案相关的风险极性维;禁倾倒全盘;禁编造未确认时限 KPI)\n${opts.risk_calc_slice.trim()}`,
    );
  }
  if (!isCompress && opts.structured_inventory?.trim()) {
    userParts.push(
      `【完整原始命盘闭集 · 与上面的多维真算摘要互为补充,如果本页主题需要摘要里没覆盖到的角度(比如具体某一步大运、某个神煞),可以直接从这里取,禁止编造闭集外的词】\n${opts.structured_inventory.trim()}`,
    );
  }
  if (isCompress && opts.deep_evidence_lock?.trim()) {
    userParts.push(opts.deep_evidence_lock.trim());
  }
  if (key === "thirty_day" && opts.action_brief) {
    userParts.push(formatP5ActionBriefForPrompt(opts.action_brief));
  }
  if ((key === "risk_guard" || key === "signals_close") && opts.action_brief) {
    userParts.push(formatP5ActionBriefForPrompt(opts.action_brief));
  }
  if (key === "risk_guard") {
    userParts.push(
      "## 叙事约束（先算后写）\n每条 RiskItem：①先写 chart_anchors(≥1,可继承 Brief.source_anchors/忌神盲区) → ②再 narrative；" +
        "narrative 须点明【P5 熔断候选菜单】中哪条执行面（做 X 时若出现 Y…）；" +
        "禁止「出现：/该做：」标签句；禁止指望后端拼接四点；禁止编造议程未确认的时限 KPI；禁止与 P3/P4 脱节另开行动课。",
    );
  }
  if (key === "signals_close" && opts.action_brief) {
    userParts.push(
      "## 近阶约束\nimmediate_action=今晚一件事;tonight_done_looks_like=做成什么样;tonight_why=为何今晚;" +
        "day7_micro_actions=从【P6 出门候选菜单】近阶茎抽恰好4条{action,why,done_when}(禁止四周表/按天甘特/P3行动逐字复读);" +
        "takeaways=决策/本周杠杆/熔断各一行；identity_shift 须写清为何切换对本案成立。",
    );
  }
  if (key === "signals_close" && opts.week_summary) {
    userParts.push(formatP5WeekSummaryForPrompt(opts.week_summary));
  }
  // Layer A · soft category tally (user message only — prefix-cache safe)
  {
    const tally = tallyAnchorCategoryUsage(
      opts.prior_chart_anchors ?? [],
      opts.category_token_sets,
    );
    const tallyBlock = formatAnchorCategoryUsageForPrompt(tally);
    userParts.push(
      isCompress ? scrubMingliJargonOutsideSlots(tallyBlock).text : tallyBlock,
    );
  }
  userParts.push(
    `## 输出\n只输出本页 JSON。顶层必须含 "page":"${key}", "page_title", "page_subtitle"。不要包在段键里。`,
  );

  return { system, user: userParts.join("\n\n"), shape_mode };
}
