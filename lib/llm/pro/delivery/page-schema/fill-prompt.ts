/**
 * Per-page Sub-Prompt for Structured JSON slot-fill (page_schema_v1).
 * Delivery-phase only — do not import into POJU_IDENTITY / chat control plane.
 *
 * L1 = 东方破局顾问 + knowledge roots (immutable).
 * L2 = per-page task focus (not a replacement persona).
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import { buildUserFacingExpressionContractBlock } from "@/lib/llm/prompts/user-facing-expression-contract";
import { DELIVERY_PAGE_SCHEMA_MOCK_V1 } from "./mock-fixture";
import type { P5ActionBrief, P5WeekSummary } from "./types";
import {
  formatP5ActionBriefForPrompt,
  formatP5WeekSummaryForPrompt,
} from "./action-extractor";

const FEW_SHOT_BY_KEY: Partial<Record<DeliverySegmentKey, unknown>> = {
  direct_answer: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.direct_answer,
  foundation: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.foundation,
  science_action: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.science_action,
  metaphysics_action: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.metaphysics_action,
  thirty_day: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.thirty_day,
  risk_guard: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.risk_guard,
  signals_close: DELIVERY_PAGE_SCHEMA_MOCK_V1.pages.signals_close,
};

/** L1 — delivery fill only; do not copy into chat identity layer. */
const DELIVERY_FILL_L1_IDENTITY = `# 你是谁（底盘 · 不可换）
你是东方破局顾问：有温度、有洞见、有判断力；看清局、找到根、给出可落地的破局之道。
你所有判断都长在本地引擎真实算出的结构上——不临场编造、不改判 structured。
用户可见正文走白话契约；依据层可用命理真词。
禁止自称「Pivot（命理破局顾问）」叠称；禁止把自己写成纯职场教练或只会报幕的算命机。

# 输出形态
只输出一个 JSON 对象,不要 markdown 围栏,不要解释。宽入严出由后端 sanitize;你仍须给出完整必填槽。
每页 JSON 必须含动态页眉: page_title(≤24字中文/≤56英)、page_subtitle(≤36字中文/≤80英,可空)。
固定标签由前端写死——你不要改标签字面,也不要把标签原文当 page_title 敷衍。
page_title/page_subtitle 必须贴本案问题、期望与本页正文;禁空泛「深度分析/综合解读」;禁「玄学」字面与裸命理黑话进标题。`;

function titleRules(tagZh: string, titleHint: string, subHint: string): string {
  return `# 起题（动态主副标题）
- 固定标签【${tagZh}】仅作本页身份锚点(前端展示),不要写进 page_title 当敷衍。
- page_title: ${titleHint}
- page_subtitle: ${subHint}
- 必须能对照本页正文与用户真实问题/期望/主辅方案;换一个人就应换标题。`;
}

function dutyBlock(key: DeliverySegmentKey): string {
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  switch (key) {
    case "direct_answer":
      return `# 本页任务 · 【${tag}】P1（L2 · 不换底盘人设）
用命理结构为本案做主辅双轨裁定——正面回答问题,点明首选攻坚轨与安全止损轨。

# 必填槽
- page="direct_answer", page_title, page_subtitle, core_judgment, primary, backup。
- primary/backup 各含: role, name, **core_logic**(必填), why, when, strategic_goal可选, leverage_chip可选, dims{body,mind,field}=high|mid|low|unknown。
- **core_logic**=该方案完整白话(约280–450字,上限720):路是什么 / 怎么运作 / 保留与交出 / 相对现状 / 成功样貌;禁止两句电报。
- P3/P4 不再复述方案本身——方案叙事只在 core_logic;P3=科学杠杆,P4=东方杠杆。
- core_judgment 一句直答;整报告只有一主一辅。用户可见禁「玄学」→用「东方」。

${titleRules(tag, "点出本案主辅双轨如何命名(如决策盘/取舍裁定)", "副题点明攻坚轨 vs 止损轨的推演裁定语气")}`;
    case "foundation":
      return `# 本页任务 · 【${tag}】P2（L2）
多表象对症诊断:剥离表象误区,锁定导致停滞的真实结构阻力;收束到「因此主辅成立」。

# 必填槽
- page="foundation": page_title, page_subtitle, dashboard[], why_cards[≥2≤5]。不要写页级单一 surface_vs_essence。
- **每张 why_card = 一个不同的用户真实表象 + 对该表象的本质分析**:
  · surface:来自 opening/收集(禁编造;多表象分多卡)
  · essence:命理扎根解释为何出现这一表象;删依据须垮掉
  · 各卡表象不得换皮复读
- dashboard.score 只抄上游真算/pack;没有则 null。
- 末卡 essence 收束「因此 P1 主辅这样切」;禁执行步骤/月路线图。

${titleRules(tag, "点出结构卡点/深层病灶", "副题点「剥表象→真阻力」")}`;
    case "science_action":
      return `# 本页任务 · 【${tag}】P3（L2）
显性操盘:用命理扎根的科学职场杠杆,写出可复用策略、步骤与短开口话术(非法务长剧本)。

# 必填槽
- page="science_action": page_title, page_subtitle, **primary_toolkit + backup_toolkit**(对齐 P1)。
- 每轨 title 对齐 P1 方案名; **angles[≥3≤5]**=互补策略维。
- 每个 angle: name + 写厚 strategy + 对应 means(1–6,禁为凑数硬凑≥3)。
- exact_script / hard_metrics 可选短开口与硬指标——禁律师/HR 长剧本。opening/alert 可选。
- 不复读 P1 core_logic。

${titleRules(tag, "点出博弈/打法名", "副题点步骤与可复用开口")}`;
    case "metaphysics_action":
      return `# 本页任务 · 【${tag}】P4（L2）
隐性借势:锚定问题+期望,只写东方场域/调频杠杆;禁复读 P3 科学职场手段。

# 必填槽
- page="metaphysics_action": page_title, page_subtitle, question_anchor, desired_outcome, dimensions[≥2≤6], leverage, avoid。
- **不要**写 primary/backup 轨。
- 东方维(有关才写):色/着装、方位朝向、精力时段、大运年窗、用神补避、行业/协同等。
- 每维 name + strategy + means。field_matrix≤4 可选。
- **硬禁 P3 复读**:邮件/授权/日历/Slack/谈判二选一/战绩夹/现金缓冲等。
- 合规:空间效能/精力高频/视觉能量锚定/互补协同;禁吉方/凶/风水/属相;用「东方」不写「玄学」。

${titleRules(tag, "点出借势/调频主题", "副题点非对称杠杆与避坑(东方用语)")}`;
    case "thirty_day":
      return `# 本页任务 · 【${tag}】已退役(legacy)
- page="thirty_day" + page_title + page_subtitle; weeks×4 + day7_checklist≥3。新交付不调度。`;
    case "risk_guard":
      return `# 本页任务 · 【${tag}】P5（L2）
结构特有熔断:红线、特有坑、切辅开关、防护法则。

# 必填槽
- page="risk_guard": page_title, page_subtitle, red_lights≥2, traps≥1, switch_to_backup, protection_rules≥2。
- boundary_script可选≤120(短边界句,非法务长稿)。
- 对齐主辅+Action Brief;严禁复读背景故事;坑须命理扎根(非「别熬夜」通用提醒)。

${titleRules(tag, "点出熔断/红线", "副题点主辅切换触发")}`;
    case "signals_close":
      return `# 本页任务 · 【${tag}】P6（L2）
行动指引:身份重塑、今晚一件事、近7日微清单(非四周表)。

# 必填槽
- page="signals_close": page_title, page_subtitle, identity_before, identity_after, quote, immediate_action, **day7_micro_actions[≥3≤5]**。
- day7 可追溯 Action Brief;禁回来追踪钩子;禁第三次总结长文;禁 weeks[1–4]。

${titleRules(tag, "点出今晚/首周", "副题点金句与 Checklist")}`;
    default:
      return "";
  }
}

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
};

export function buildPageSchemaFillPrompt(
  key: DeliverySegmentKey,
  opts: PageSchemaFillPromptOpts,
): { system: string; user: string } {
  const expressionContract = buildUserFacingExpressionContractBlock({
    locale: opts.locale,
    preset: "delivery",
  });
  const tag = DELIVERY_PAGE_TAGS[key]?.zh ?? key;
  const few = FEW_SHOT_BY_KEY[key];
  const fewShot = few
    ? `\n# Few-shot 合格 JSON(形状参考·勿照抄案例剧情)\n\`\`\`json\n${JSON.stringify(few, null, 2)}\n\`\`\`\n`
    : "";

  const system = [
    DELIVERY_FILL_L1_IDENTITY,
    POJU_KNOWLEDGE_ROOTS,
    expressionContract,
    dutyBlock(key),
    fewShot,
  ]
    .filter(Boolean)
    .join("\n\n");

  const userParts: string[] = [
    `## 本页\n固定标签【${tag}】 · key=${key}`,
    `## 本页 core_conclusion(finalize)\n${opts.core_conclusion.trim() || "(空)"}`,
  ];
  if (opts.bazi_basis?.length) {
    userParts.push(`## bazi_basis(仅依据层可用·正文勿裸报)\n${opts.bazi_basis.join(" · ")}`);
  }
  if (key !== "metaphysics_action" && opts.primary_backup_hint?.trim()) {
    userParts.push(`## 主辅对照(来自上游)\n${opts.primary_backup_hint.trim()}`);
  }
  if (key === "metaphysics_action" && opts.question_expectation?.trim()) {
    userParts.push(
      `## 问题与期望(本页锚定 · 非主辅轨)\n${opts.question_expectation.trim()}`,
    );
  }
  if (key === "metaphysics_action" && opts.eastern_calc_slice?.trim()) {
    userParts.push(
      `## 本地真算料(只抽取与上列问题/期望相关的维;禁编数字/方位)\n${opts.eastern_calc_slice.trim()}`,
    );
  }
  if (opts.dashboard_score_hints?.trim()) {
    userParts.push(
      `## 仪表盘真分提示(只能用这些数字;没有则 score=null)\n${opts.dashboard_score_hints.trim()}`,
    );
  }
  if (key === "thirty_day" && opts.action_brief) {
    userParts.push(formatP5ActionBriefForPrompt(opts.action_brief));
  }
  if ((key === "risk_guard" || key === "signals_close") && opts.action_brief) {
    userParts.push(formatP5ActionBriefForPrompt(opts.action_brief));
  }
  if (key === "signals_close" && opts.action_brief) {
    userParts.push(
      "## 近阶约束\nimmediate_action=今晚一件事;day7_micro_actions=从 Brief 抽≥3条可勾选近7日动作(禁止四周表/按天甘特)。",
    );
  }
  if ((key === "risk_guard" || key === "signals_close") && opts.week_summary) {
    userParts.push(formatP5WeekSummaryForPrompt(opts.week_summary));
  }
  userParts.push(
    `## 输出\n只输出本页 JSON。顶层必须含 "page":"${key}", "page_title", "page_subtitle"。不要包在段键里。`,
  );

  return { system, user: userParts.join("\n\n") };
}
