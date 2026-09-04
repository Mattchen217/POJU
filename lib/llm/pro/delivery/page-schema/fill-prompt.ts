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

  const system = [
    DELIVERY_FILL_L1_IDENTITY,
    POJU_KNOWLEDGE_ROOTS,
    expressionContract,
    fillDutyForKey(key, tag),
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
  if (opts.bazi_basis?.length) {
    userParts.push(`## bazi_basis(仅依据层可用·正文勿裸报)\n${opts.bazi_basis.join(" · ")}`);
  }
  if (opts.page_plan_slice?.trim()) {
    userParts.push(
      `## 本页派工料(只写 must_use · 禁 for forbid 项)\n${opts.page_plan_slice.trim()}`,
    );
  }
  if (key === "foundation" && opts.dashboard_score_hints?.trim()) {
    userParts.push(
      `## dashboard 真分(只抄真数·禁编造)\n${opts.dashboard_score_hints.trim()}`,
    );
  }
  // Primary/backup hint: P3 / P5 / P6 only (not P4; P1/P2 get via core_conclusion).
  if (
    (key === "science_action" || key === "risk_guard" || key === "signals_close") &&
    opts.primary_backup_hint?.trim()
  ) {
    userParts.push(`## 主辅对照(来自上游)\n${opts.primary_backup_hint.trim()}`);
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
  if (key === "metaphysics_action" && opts.eastern_calc_slice?.trim()) {
    userParts.push(
      `## 本地真算料(先按真算维选题;最后才合规包装命名;禁编造数字/方位)\n${opts.eastern_calc_slice.trim()}`,
    );
  }
  if (key === "risk_guard" && opts.risk_calc_slice?.trim()) {
    userParts.push(
      `## 本地熔断算料(先锁 RiskItem.chart_anchors;只抽与本案相关的风险极性维;禁倾倒全盘;禁编造未确认时限 KPI)\n${opts.risk_calc_slice.trim()}`,
    );
  }
  if (opts.structured_inventory?.trim()) {
    userParts.push(
      `【完整原始命盘闭集 · 与上面的多维真算摘要互为补充,如果本页主题需要摘要里没覆盖到的角度(比如具体某一步大运、某个神煞),可以直接从这里取,禁止编造闭集外的词】\n${opts.structured_inventory.trim()}`,
    );
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
        "narrative 须点明在执行 Brief 中哪类 P3/P4 手段时会踩坑；" +
        "禁止「出现：/该做：」标签句；禁止指望后端拼接四点；禁止编造议程未确认的时限 KPI；禁止与 P3/P4 脱节另开行动课。",
    );
  }
  if (key === "signals_close" && opts.action_brief) {
    userParts.push(
      "## 近阶约束\nimmediate_action=今晚一件事;tonight_done_looks_like=做成什么样;tonight_why=为何今晚;" +
        "day7_micro_actions=从 Brief 抽≥4条{action,why,done_when}(禁止四周表/按天甘特/P3行动复读);" +
        "takeaways=决策/本周杠杆/熔断各一行。",
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
    userParts.push(formatAnchorCategoryUsageForPrompt(tally));
  }
  userParts.push(
    `## 输出\n只输出本页 JSON。顶层必须含 "page":"${key}", "page_title", "page_subtitle"。不要包在段键里。`,
  );

  return { system, user: userParts.join("\n\n"), shape_mode };
}
