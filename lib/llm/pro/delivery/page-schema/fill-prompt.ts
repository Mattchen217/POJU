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
- **core_logic 必须写厚**(约380–560字,上限720),**空行分成 3–4 短段**,禁止一两句电报:
  ①路是什么(角色怎么换、你留什么/放手什么——叙事层,不是步骤表)
  ②为何对本案结构成立(一句命理扎根白话,删依据应垮)
  ③成功样貌 + 筹码感(老板/家庭/身体可见变化)
  ④边界何时不能硬走、何时准备切辅
- **禁止**展开完整 SOP 步骤表(交接清单细项/考核三项表/出差次数表归 P3);但叙事必须全面,让人读完就懂整条路。
- P3/P4 不再复述方案本身——方案叙事只在 core_logic;P3=科学杠杆,P4=东方杠杆。
- core_judgment 一句直答;整报告只有一主一辅。用户可见禁「玄学」→用「东方」。
- 【跨页】本页写过的主句,后续页禁止整段复读。

${titleRules(tag, "点出本案主辅双轨如何命名(如决策盘/取舍裁定)", "副题点明攻坚轨 vs 止损轨的推演裁定语气")}`;
    case "foundation":
      return `# 本页任务 · 【${tag}】P2（L2）
多表象对症诊断:剥离表象误区,锁定导致停滞的真实结构阻力;收束到「因此主辅成立」。

# 必填槽
- page="foundation": page_title, page_subtitle, dashboard[], **why_cards[≥4≤5]**(收集表象够就写满;至少4张不同表象)。不要写页级单一 surface_vs_essence。
- **每张 why_card = 一个不同的用户真实表象 + 对该表象的本质分析**:
  · surface:来自 opening/收集(禁编造;多表象分多卡;每卡一句具体可观察场景)
  · essence:命理扎根解释为何出现这一表象(约80–160字);删依据须垮掉;弱化飘意象,用可对症的结构白话;禁止三句敷衍
  · 各卡表象不得换皮复读
- dashboard.label 必须用人话且跟 locale(中文例:身体负荷/续航心力/外部阻力);禁止 Body load / Mind strain 英文壳。
- dashboard.score 只抄上游「仪表盘真分提示」里的数字;没有则 **null** + note「本盘暂缺量化档」或省略。**禁止** score=0 且 note「来自仪表盘」。
- **末卡** essence 只收束一句诊断句「因此主辅成立」;禁路径名清单、禁执行摘要、禁复读 P1 三步。

${titleRules(tag, "点出结构卡点/深层病灶", "副题点「剥表象→真阻力」")}`;
    case "science_action":
      return `# 本页任务 · 【${tag}】P3（L2）
显性操盘:用命理扎根的科学职场杠杆,写出可复用策略与行动(非法务长剧本)。

# 必填槽
- page="science_action": page_title, page_subtitle, **primary_toolkit + backup_toolkit**(对齐 P1)。
- 每轨 title 对齐 P1 方案名; **angles[≥3≤5]**=互补策略维。
- 每个 angle: name + **strategy(2–3短段,空行分隔,禁单段字墙)** + means(1–6,用户可见标签为「行动」)。
- 每维 strategy 须有一句**只对本案成立的结构由头**(删依据应垮);禁止复述 P1 落地三步全文。
- **禁止独立「开口/exact_script」槽**:若需可复述口径,写进 strategy 末段或 means 一条(例:「告诉副手:从下周起海外日常由你全权…」)。不要单独 opening 页级英文残片。
- hard_metrics 可选;alert 可选短注意。
- 【禁】英文系统口吻/提示词残片;禁 X%/Y%/Z% 半成品占位——改「两组可填空实测口径」或省略具体百分比。
- 【跨页】不复读 P1 core_logic;辅轨各维只写与主轨不重复的一条动作。

${titleRules(tag, "点出博弈/打法名", "副题点步骤与可落实行动")}`;
    case "metaphysics_action":
      return `# 本页任务 · 【${tag}】P4（L2）
隐性借势:锚定问题+期望,只写东方场域/调频杠杆(色/向/时/年窗/用神等);禁复读 P3 科学职场行动清单。

# 必填槽
- page="metaphysics_action": page_title, page_subtitle, question_anchor, desired_outcome, dimensions[≥2≤6]。
- **不要**写 primary/backup 轨。
- **不要**写 leverage(借力)/avoid(避坑)/field_matrix(场域矩阵)——这些槽已退役;避坑与熔断归 P5。
- 每维 name + **strategy(2–3短段)** + means(条目列表,用户可见为「行动」);策略里说清「为何这样调」与「怎么做」,用户不读术语也能懂。
- **硬禁 P3 复读 / 换皮**:邮件话术、授权清单、日历/Slack工具、谈判二选一、战绩夹、现金缓冲。协同/行业维只写东方定位→场域动作。
- 年窗/用神句须能挂 pack 真算;编不出就薄写并标明不足,禁止假精确。
- 合规:空间效能/精力高频/视觉能量锚定;禁吉方/凶/风水/属相;用「东方」不写「玄学」。

${titleRules(tag, "点出借势/调频主题", "副题点非对称杠杆(东方用语)")}`;
    case "thirty_day":
      return `# 本页任务 · 【${tag}】已退役(legacy)
- page="thirty_day" + page_title + page_subtitle; weeks×4 + day7_checklist≥3。新交付不调度。`;
    case "risk_guard":
      return `# 本页任务 · 【${tag}】P5（L2）
结构特有熔断:红灯、特有坑、切辅开关、防护法则。

# 写法（铁律）
每条 RiskItem **先**想清四点(出现了什么 / 该怎么做 / 要注意什么 / 不能怎么做),
**再**由你写成一条温暖、自然、可一口气读完的 **narrative** 段落交给用户。
- narrative = 用户唯一可见正文(约120–280字,上限720);像顾问当面叮嘱,不是表单。
- situation / then_do / watch / forbid = 内部规划锚点,须与 narrative 同义对齐,供依据层;用户页不展示四点标签。
- **禁止**在 narrative 里写「出现：」「该做：」「注意：」「禁做：」这类标签排版。
- **禁止**指望后端把四点拼成一段——拼句机械感,必须你自己组织语气。

# 必填槽
- page="risk_guard": page_title, page_subtitle。
- 目标密度: red_lights[2–3]、traps[2]、protection_rules[2–3] = RiskItem[]; switch_to_backup = 单个 RiskItem。
- 每条 RiskItem 必含: situation, then_do, watch, forbid, **narrative**(必填)。
- **不要**写 boundary_script。
- 每条必须是**结构特有熔断**(出现→停机),不是再教一遍授权/睡眠 SOP。
- 身体类:合并睡眠/血压/凌晨决策;可锚定用户自述,禁医疗处方硬阈值→「你已报告的血压持续偏高 / 医嘱未缓」。
- 对齐主辅+Action Brief+风险相关算料;严禁复读背景故事/P3行动清单。
- 依据层须支撑处置链(尤其 then_do/forbid)。

${titleRules(tag, "点出熔断/红线", "副题点主辅切换触发")}`;
    case "signals_close":
      return `# 本页任务 · 【${tag}】P6（L2）
行动指引=出门仪式页:身份对照+为何切换、金句+用法、今晚闭环、近7日条目卡、带走三样。
禁第三次药方总结、禁四周表、禁回来追踪钩子、禁英文提示词残片。

# 必填槽
- page="signals_close": page_title, page_subtitle,
  identity_before, identity_after, **identity_shift**(为何切换对本案成立;不复述 core_logic),
  quote(≤120可背), **quote_use**(摇摆时怎么用),
  immediate_action, **tonight_done_looks_like**, **tonight_why**,
  **day7_micro_actions[≥4≤5]** 每条={action, why, done_when},
  **takeaways[恰好3]**(决策一句/本周杠杆一句/熔断一句)。
- day7 从 Action Brief 拆近阶切片;禁止与 P3 行动逐字复读;每条须有勾选标准。
- takeaways 像印章不是摘要墙;不新开策略。

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
  /** P5: risk-polarity local calc (relevant-extract only). */
  risk_calc_slice?: string;
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
  if (key === "risk_guard" && opts.question_expectation?.trim()) {
    userParts.push(
      `## 问题与期望(熔断锚定)\n${opts.question_expectation.trim()}`,
    );
  }
  if (key === "metaphysics_action" && opts.eastern_calc_slice?.trim()) {
    userParts.push(
      `## 本地真算料(只抽取与上列问题/期望相关的维;禁编数字/方位)\n${opts.eastern_calc_slice.trim()}`,
    );
  }
  if (key === "risk_guard" && opts.risk_calc_slice?.trim()) {
    userParts.push(
      `## 本地熔断算料(只抽与本案相关的风险极性维;禁倾倒全盘/禁复读P3行动)\n${opts.risk_calc_slice.trim()}`,
    );
  }
  if (key === "foundation") {
    if (opts.dashboard_score_hints?.trim()) {
      userParts.push(
        `## 仪表盘真分提示(只能用这些数字;没有则 score=null)\n${opts.dashboard_score_hints.trim()}`,
      );
    } else {
      userParts.push(
        "## 仪表盘真分提示\n无上游真分。dashboard[].score 必须全部为 null；note 写「本盘暂缺量化档」或省略。禁止输出 0 · 来自仪表盘。",
      );
    }
  }
  if (key === "thirty_day" && opts.action_brief) {
    userParts.push(formatP5ActionBriefForPrompt(opts.action_brief));
  }
  if ((key === "risk_guard" || key === "signals_close") && opts.action_brief) {
    userParts.push(formatP5ActionBriefForPrompt(opts.action_brief));
  }
  if (key === "risk_guard") {
    userParts.push(
      "## 叙事约束\n每条 RiskItem 必须含 narrative：先想清 situation/then_do/watch/forbid，再写成一段温暖自然叮嘱；" +
        "禁止「出现：/该做：」标签句；禁止指望后端拼接四点。",
    );
  }
  if (key === "signals_close" && opts.action_brief) {
    userParts.push(
      "## 近阶约束\nimmediate_action=今晚一件事;tonight_done_looks_like=做成什么样;tonight_why=为何今晚;" +
        "day7_micro_actions=从 Brief 抽≥4条{action,why,done_when}(禁止四周表/按天甘特/P3行动复读);" +
        "takeaways=决策/本周杠杆/熔断各一行。",
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
