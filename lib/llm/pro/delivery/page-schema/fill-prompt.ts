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
  DELIVERY_FILL_L1_PLAIN_JUDGMENT,
  fillDutyForKey,
} from "@/lib/llm/pro/delivery/page-prompts";
import type { P5ActionBrief, P5WeekSummary } from "./types";
import {
  formatP3MeansBriefForP4Retune,
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
  P4_MIN_MEANS_PER_DIM,
  P4_MIN_STRATEGY_CHARS,
  P4_MIN_STRATEGY_SENTENCES,
} from "./p4-means-gate";
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
  /**
   * Step 1 fact-pack: evidence is unmarked 批断. Body translates it.
   * Do not ask the model to copy chart_anchors or emit word slots.
   */
  plain_judgment?: boolean;
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
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const shape_mode = opts.shape_mode ?? resolveDeliveryFillShapeMode();
  const shapeAnchor = buildShapeAnchorBlock(key, shape_mode);
  const isCompress = opts.fill_mode === "compress";
  const plainJudgment = opts.plain_judgment === true;
  /** P2 only：只译批断；剥处境/菜单噪声。P3+ 永不走这条（见 fill-call plainJudgment 收窄）。 */
  const foundationTranslateOnly = plainJudgment && key === "foundation";

  const expressionContract = foundationTranslateOnly
    ? [
        buildUserFacingExpressionContractBlock({
          locale: opts.locale,
          preset: "collecting",
          mappingIds: [],
        }),
        `# 第一步正文（P2 · 无映射表）
- 本步只译批断成大白话；不展开受控映射表，不教品牌自造术语。
- 柱位/干支层用「年这一层 / 日子这一层 / 深层根基」等生活白话；禁止【术语壳】。`,
      ].join("\n\n")
    : buildUserFacingExpressionContractBlock({
        locale: opts.locale,
        preset: "delivery",
      });

  const plainModeBlock =
    isCompress && foundationTranslateOnly
      ? `# 正文翻译模式（硬 · P2 第一步）
- user 侧「已锁定命理批断」是唯一出处。本步只把它译成大白话页内字段。
- 禁止重写批断，禁止另起一段与批断无关的故事，禁止重新真算。
- **用户可见正文零命理专名**。禁止输出 ⟦w:⟧、⟦t:⟧、⟦词:⟧，禁止品牌自造术语与【术语壳】。
- chart_anchors 留空（覆盖 L1「先有 anchors」——本步不锁词）。不要把批断里的词抄进正文。
- 每个内容单元只译对应那一条 professional_evidence（path / 顺序对齐）；禁止张冠李戴。
- surface/essence 都只翻译该条批断。禁止把处境、问题、core_conclusion 里的决策句填进正文。
- 禁止另写谈判剧本 / 职场教练案。
- 禁止行动处方腔（「因此你需要…」「这解释了为何你…」等）代替机制翻译。
- 禁止软框架套话与冷却液空壳。禁止「贵人支持」「生水/喜用」软漏。
- 删掉该条批断后，对应正文不得独自成立。`
      : null;

  const system = [
    foundationTranslateOnly ? DELIVERY_FILL_L1_PLAIN_JUDGMENT : DELIVERY_FILL_L1_IDENTITY,
    foundationTranslateOnly ? "" : POJU_KNOWLEDGE_ROOTS,
    expressionContract,
    fillDutyForKey(key, tag, { plain_judgment: foundationTranslateOnly }),
    plainModeBlock ??
      (isCompress
        ? `# 正文压缩模式（硬 · 首枪）
- 深度依据已由上一调用锁定（见 user 侧锁档）——命理真源。
- **用户可见正文（strategy/means/surface/essence…）= 零命理专名**。
- **P2**：若锁档要求译批断，surface/essence 只译对应 professional_evidence。
- **P3**：正文体裁=落实 P1 主辅的**科学策略+行动**；批断只扎根。禁止把批断译成 strategy。means 须回溯【P3 科学手段候选菜单】/ means_candidate_ref；须对齐【主辅对照】。每角 chart_anchors≥1（代码可从批断承重料 stamp；禁止整页空锚）。
- **P4+**：strategy/means 从 unit_claim + professional_evidence 长出；每维 chart_anchors≥1（优先复制/stamp 锁定结构真词）；有 mechanism_tag 时按 tag 成型。
- 删掉批断/依据后正文不得变成谁都适用的鸡汤。正文零命理词。
- 若专业依据/手段菜单出现阶段·柱支概念，按「正文平替提示」改写，禁止照抄真词。
${
  key === "metaphysics_action"
    ? `- **P4 护城河兑现（硬）**：dimensions **条数与顺序对齐锁定表**；每维 means.type = 锁定 \`moat_class\`；means≥${P4_MIN_MEANS_PER_DIM}、strategy ≥${P4_MIN_STRATEGY_SENTENCES} 句且 ≥${P4_MIN_STRATEGY_CHARS} 字；标明 \`主路径推进\`/\`切辅条件\`/\`守成窗口\`。
- **域自检**：means 必须是「我怎么调自己」（窗口收缩心力/用忌补给远离/十神内在站位）。若主体是文档/交付/书面化/谈判/股权 → 废稿（P3 换皮）。
- **优先整句抄【P4 东方谋略手段候选菜单】**局势/意象/仪轨草稿，只做贴案轻改；strategy 至多一句挂执行面。
- **chart_anchors 原词层**；勿填 leverage/avoid/field_matrix。`
    : ""
}`
        : `# 全文填充模式（无 deep 锁时）
- 仍须先机制后包装：strategy/means 从本案真算与候选菜单生长，禁止空壳口号。
- 删 chart_anchors / 依据后谁都适用 → 废稿。`),
    shapeAnchor,
  ]
    .filter(Boolean)
    .join("\n\n");

  const userParts: string[] = [`## 本页\n固定标签【${tag}】 · key=${key}`];
  if (!foundationTranslateOnly) {
    userParts.push(
      `## 本页 core_conclusion(finalize)\n${opts.core_conclusion.trim() || "(空)"}`,
    );
  }
  if (!foundationTranslateOnly && opts.reality_constraints?.trim()) {
    userParts.push(opts.reality_constraints.trim());
  }
  if (
    key === "foundation" &&
    opts.foundation_surface_feed?.trim() &&
    !foundationTranslateOnly
  ) {
    const feed = isCompress
      ? scrubMingliJargonOutsideSlots(opts.foundation_surface_feed.trim()).text
      : opts.foundation_surface_feed.trim();
    userParts.push(feed);
  }
  if (key === "science_action" && opts.science_means_feed?.trim()) {
    // P3: means menu is load-bearing growth source (even step-1). Soft-scrub jargon only.
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
  if (
    key === "foundation" &&
    opts.question_expectation?.trim() &&
    !foundationTranslateOnly
  ) {
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
  // Primary/backup hint: P3 / P5 / P6 — P3 step-1 必须喂（落实哪条主辅）；P2 仍不喂。
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
      `## 本地真算料(先东方谋略维:奇门局势/用忌意象/十神站位;仪轨白名单可选;禁编造数字/宫门)\n${opts.eastern_calc_slice.trim()}`,
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
  if (key === "metaphysics_action" && opts.action_brief) {
    userParts.push(formatP3MeansBriefForP4Retune(opts.action_brief));
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
