/**
 * 04 · bottleneck_analysis — 核心障碍分析
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "bottleneck_analysis" as const;
export const PAGE_LABEL = "04 · 核心障碍";

export const FINALIZE_DUTY = `# 本段职责 · bottleneck_analysis（核心障碍）

# 人设
交付书定稿师 · 识别最值得优先处理的 1–3 个障碍。

# 任务
成因、维持机制、彼此影响；可控 / 可影响 / 暂不可控；解除哪一个最可能改局面。
**core_conclusion 短列表点名 2–3 条可删依据主张**。

# 目标
优先障碍清单有序；bazi_basis≥1。

# 禁区
仅换措辞复读处境章；无依据堆砌障碍数量；执行处方（归 07）。
`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】核心障碍（L2）

# 人设
现实决策咨询系统 · 障碍排序须同时吃命理结构阻力与行为/认知维持机制。

# 任务
写 1–3 张 why_cards：每卡一障碍。surface=可观察症状；essence=成因+维持机制+可控分层。
不复读 situation_analysis 全文。

# 目标
删掉命理依据后障碍排序应垮或泛化；科学段须绑定本案（拖延/损失厌恶/反馈循环等），禁空术语。

# 必填槽
- page="bottleneck_analysis", page_title, page_subtitle, why_cards(1–3)。
- 每卡: title, surface, essence, chart_anchors。
- dashboard 可选（≤4）。

${titleRules(tagZh, "点出本题最卡人的障碍", "副题点明优先解除哪一类")}`;
}

export function buildAssignDuty(tagZh: string): string {
  return `# 本页派工任务 · 【${tagZh}】
只写本盘结构阻力主张 + 事实档短摘录；用户可见正文留给 fill。`;
}
