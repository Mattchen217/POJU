/**
 * Per-page Sub-Prompt for Structured JSON slot-fill (page_schema_v1).
 * Delivery-phase only — do not import into POJU_IDENTITY / chat control plane.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import { DELIVERY_SECTION_HEADINGS } from "@/lib/llm/pro/delivery/delivery-schema";
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

function dutyBlock(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return `# 本页职责 · P1 直答+主辅对照(卡片即正文)
- 必须输出 JSON: page="direct_answer", core_judgment, primary, backup。
- primary/backup 各含: role, name, **core_logic**(必填), why, when, strategic_goal可选(对比盘战略目标·缺则用why), leverage_chip可选, dims{body,mind,field}=high|mid|low|unknown。
- **core_logic**=该方案的完整白话描述(约280–450字,上限720):必须写清「这条路是什么 / 怎么运作 / 你保留什么·交出什么 / 相对现状怎么变 / 成功长什么样」;禁止两句电报式摘要。
- P3/P4 不再复述方案本身——方案叙事只能写在 core_logic;P3 只写科学杠杆,P4 只写东方杠杆。
- why/when 可短;leverage_chip=关键筹码/暗牌一句;strategic_goal=对比盘一行目标。
- core_judgment 一句直答;严禁无主辅标签;整报告只有一主一辅。
- 用户可见禁「玄学」字面 → 用「东方」。`;
    case "foundation":
      return `# 本页职责 · P2 可信桥(为何卡 → 为何主辅成立)
- page="foundation": surface_vs_essence, dashboard[], why_cards(≥2)。
- dashboard.score 只能抄上游真算/pack 数字;没有就 null——禁止编造。
- why_cards=多命理维论证;最后一张(或本质段)须收束到「因此 P1 主辅这样切」——桥接药方,不写执行步骤。
- 严禁推销主辅打法细则;严禁完整月/10天路线图;本页只解释「为什么卡 / 为什么这两条成立」。`;
    case "science_action":
      return `# 本页职责 · P3 科学药方(达成 P1 主辅 · 轨内多维 · 加厚内容)
- page="science_action": primary_toolkit + backup_toolkit。
- 每轨: title(对齐 P1 方案名), **angles[≥3≤5]**。
- 每个 angle 槽位不变: name, strategy, exact_script, means, hard_metrics。
- **加厚(必填更满,不是换槽)**: exact_script 必填约50–100字(上限160)=可直接复制的微信/邮件原话; means≥3 明确动作; hard_metrics≥1 成功标准。禁止律师/HR 长剧本。
- 同轨 angles=互补路径,共同服务该轨 P1 目标——禁止另立新罗马、禁止三条互斥平级菜单。
- 不复读 P1 core_logic;展开可执行达成路径。
- opening/alert 可选。`;
    case "metaphysics_action":
      return `# 本页职责 · P4 东方药方(达成 P1 主辅 · 相关真算维)
- page="metaphysics_action": primary_track + backup_track, leverage, avoid, field_matrix≤4。
- 每轨: title(对齐 P1), **dimensions[≥2≤6]**=仅与该轨目标相关的本地真算维(有关尽给、无关不硬凑)。
- 每个 dimension: name, strategy(补/避/借势), means[1–6](方位/色/时/人等可对照动作)。
- 护城河:删依据后「对他有用」须垮掉;禁止整页只剩穿衣口诀;禁止复读 P3 职场话术。
- 用户可见用「东方」不写「玄学」。`;
    case "thirty_day":
      return `# 本页职责 · 已退役(legacy only)
- page="thirty_day" 仅兼容旧会话;新交付不再调度本页。
- 若仍被调用: weeks×4 + day7_checklist≥3。`;
    case "risk_guard":
      return `# 本页职责 · P5 熔断(原 P6)
- page="risk_guard": red_lights≥2, traps≥1, switch_to_backup, protection_rules≥2。
- boundary_script可选≤120(短边界反击句,非法务长稿)。
- 对齐主辅+Action Brief;严禁复读背景故事。`;
    case "signals_close":
      return `# 本页职责 · P6 定心+近阶(原 P7;吸收退役四周表价值)
- page="signals_close": identity_before, identity_after, quote, immediate_action(今晚单一一件事), **day7_micro_actions[≥3≤5]**。
- day7_micro_actions 必须可追溯 Action Brief 的 steps/metrics/主辅 when——是近7日微清单,不是四周路线图。
- 严禁回来追踪钩子;严禁第三次总结长文;严禁再写 weeks[1–4]。`;
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
  /** Extra upstream for P3/P4 (primary/backup names). */
  primary_backup_hint?: string;
};

export function buildPageSchemaFillPrompt(
  key: DeliverySegmentKey,
  opts: PageSchemaFillPromptOpts,
): { system: string; user: string } {
  const expressionContract = buildUserFacingExpressionContractBlock({
    locale: opts.locale,
    preset: "delivery",
  });
  const heading = DELIVERY_SECTION_HEADINGS[key]?.zh ?? key;
  const few = FEW_SHOT_BY_KEY[key];
  const fewShot = few
    ? `\n# Few-shot 合格 JSON(形状参考·勿照抄案例剧情)\n\`\`\`json\n${JSON.stringify(few, null, 2)}\n\`\`\`\n`
    : "";

  const system = [
    "你是 POJU 交付报告 JSON 填槽器。只输出一个 JSON 对象,不要 markdown 围栏,不要解释。",
    "宽入严出由后端 sanitize;你仍须给出完整必填槽。",
    expressionContract,
    dutyBlock(key),
    fewShot,
  ]
    .filter(Boolean)
    .join("\n\n");

  const userParts: string[] = [
    `## 本页\n${heading} (${key})`,
    `## 本页 core_conclusion(finalize)\n${opts.core_conclusion.trim() || "(空)"}`,
  ];
  if (opts.bazi_basis?.length) {
    userParts.push(`## bazi_basis(仅依据层可用·正文勿裸报)\n${opts.bazi_basis.join(" · ")}`);
  }
  if (opts.primary_backup_hint?.trim()) {
    userParts.push(`## 主辅对照(来自上游)\n${opts.primary_backup_hint.trim()}`);
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
    `## 输出\n只输出本页 JSON。顶层必须含 "page":"${key}"。不要包在段键里。`,
  );

  return { system, user: userParts.join("\n\n") };
}
