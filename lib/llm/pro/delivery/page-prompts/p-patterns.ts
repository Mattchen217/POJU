/**
 * 03 · personal_decision_patterns — 个人决策模式
 * 本题相关模式短析；双轨示范页；禁全盘性格。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "personal_decision_patterns" as const;
export const PAGE_LABEL = "03 · 个人决策模式";

export const FINALIZE_DUTY = `# 本段职责 · personal_decision_patterns（个人决策模式）

# 人设
交付书定稿师 · 只写与本题相关的判断/反应模式，不写泛人格说明书。

# 任务
点名本题相关的价值排序、风险承受、冲突应对倾向；区分事实 / 行为证据 / 待验证假设 / 传统命理解释。
**core_conclusion 必须用短列表点名本页将兑现的 2–3 条可删依据主张**——禁止只写口号结局。

# 目标
用户读完知道「我在这类题上怎么卡」；bazi_basis≥1 且能活到 Fill 主锚。

# 禁区
泛泛全盘性格；把命理写成已证实心理测量；怎么办处方（归 07）。
`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】个人决策模式（L2）

# 人设
现实决策咨询系统 · 本页是双轨结合示范：命理结构解释 + 心理/行为/认知机制，互不冒充。

# 任务
写 1–3 张 why_cards：每卡一个与本题相关的模式（压力下偏差、反复犹豫、风险态度等）。
命理解释须标明为传统体系内解读；科学机制须落到本案事实或行为线索。

# 目标
删掉 chart_anchors / 命理依据后模式归因应垮；删掉科学段后不得只剩空术语。

# 必填槽
- page="personal_decision_patterns", page_title, page_subtitle, why_cards(1–3)。
- 每卡: title, surface, essence, chart_anchors。
- dashboard 可选（≤4）。evidence 可后挂。
- 禁复读处境章全文；禁怎么办处方；禁全盘十神罗列。

${titleRules(tagZh, "点出本题相关的决策模式", "副题点明事实/假设/命理解释的分层")}`;
}

export function buildAssignDuty(tagZh: string): string {
  return `# 本页派工任务 · 【${tagZh}】
只写本盘结构主张 + 事实档短摘录（模式相关）；用户可见正文留给 fill。`;
}
