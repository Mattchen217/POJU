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
      return `# 本页职责 · P1 直答+主辅对照
- 必须输出 JSON: page="direct_answer", core_judgment, primary, backup。
- primary/backup 各含: role, name, why, when, dims{body,mind,field}=high|mid|low|unknown。
- 严禁长论证;严禁无主辅标签;整报告只有一主一辅。
- 用户可见禁「玄学」字面 → 用「东方」。`;
    case "foundation":
      return `# 本页职责 · P2 为何卡
- page="foundation": surface_vs_essence, dashboard[], why_cards(≥2)。
- dashboard.score 只能抄上游真算/pack 数字;没有就 null——禁止编造。
- 严禁推销主辅;严禁完整月/10天路线图;本页只解释「为什么卡」。`;
    case "science_action":
      return `# 本页职责 · P3 科学药方(实现主辅)
- page="science_action": primary_toolkit + backup_toolkit。
- 每轨: title, strategy, steps[1–6], hard_metrics可选, exact_script可选(≤100字开口,可改写)。
- opening 短句可选;alert 可选。
- 严禁与 P1 脱节;严禁长专业代做剧本(律师/HR 全文)。`;
    case "metaphysics_action":
      return `# 本页职责 · P4 东方药方(服务主辅)
- page="metaphysics_action": primary_track + backup_track(strategy+methods), leverage, avoid, field_matrix≤4。
- 东方维多维生长服务主辅;整页禁止只剩方位/穿衣;禁止复读 P3 职场话术。
- 用户可见用「东方」不写「玄学」。`;
    case "thirty_day":
      return `# 本页职责 · P5 四周表
- page="thirty_day": weeks 恰好4项(week1–4: focus, actions, source_refs), day7_checklist≥3。
- 每个动作必须可追溯到 Action Brief 的 steps/metrics/主辅 when。
- 严禁空壳「蓄力/试探」阶段词;严禁再推销主路径长文。`;
    case "risk_guard":
      return `# 本页职责 · P6 熔断
- page="risk_guard": red_lights≥2, traps≥1, switch_to_backup, protection_rules≥2。
- 对齐主辅+P5;严禁复读背景故事。`;
    case "signals_close":
      return `# 本页职责 · P7 定心
- page="signals_close": identity_before, identity_after, quote, immediate_action(今晚单一一件事)。
- 严禁回来追踪钩子;严禁第三次总结长文。`;
    default:
      return "";
  }
}

export type PageSchemaFillPromptOpts = {
  locale: string;
  core_conclusion: string;
  bazi_basis?: readonly string[];
  /** Wave C+: sole upstream body for P5. */
  action_brief?: P5ActionBrief | null;
  /** Wave D: brief week summary. */
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
  if ((key === "risk_guard" || key === "signals_close") && opts.week_summary) {
    userParts.push(formatP5WeekSummaryForPrompt(opts.week_summary));
  }
  userParts.push(
    `## 输出\n只输出本页 JSON。顶层必须含 "page":"${key}"。不要包在段键里。`,
  );

  return { system, user: userParts.join("\n\n") };
}
