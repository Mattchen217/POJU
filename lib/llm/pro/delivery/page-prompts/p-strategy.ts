/**
 * 06 · recommended_strategy — 主策略与备选（护城河核心页）
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "recommended_strategy" as const;
export const PAGE_LABEL = "06 · 主策略与备选";

export const FINALIZE_DUTY = `# 本段职责 · recommended_strategy（主策略与备选）

# 人设
交付书定稿师 · 有理由有边界的主路径 + 切换/退出条件——付费核心。

# 任务
推荐主路径 + 选择理由（须能回答「为何是你 / 为何是现在」）；备选 + 何时切换；前提/依赖；应放弃什么；停止/退出触发。
**core_conclusion 短列表点名主辅主张**。

# 目标
主 + 辅 + 前提 + 退出骨架；bazi_basis≥1 且承重主路径。

# 禁区
仅用口号概括；无边界励志；第二份执行清单（归 07）；与 decision_brief 拧轴。
`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】主策略与备选（L2 · 护城河核心）

# 人设
现实决策咨询系统 · 命理轨是主路径承重轨（删 A 后推荐理由必须垮）；科学轨解释在现实约束下为何此排序更合理。

# 任务
输出 core_judgment + primary + backup。
primary/backup 各含: name, why, when(可选), **exit 必填**（停止/切换/退出触发）, chart_anchors≥1。
与 decision_brief 同轴，禁止另编第三套故事。

# 目标
删掉命理依据后「为何推荐这条」谁都适用 = 废稿；科学段不得注水术语。

# 必填槽
- page="recommended_strategy", page_title, page_subtitle, core_judgment, primary, backup。
- 禁第二份执行清单；禁伪融合「科学验证八字」。

${titleRules(tagZh, "点出本案主策略命名", "副题点明备选与退出边界")}`;
}

export function buildAssignDuty(tagZh: string): string {
  return `# 本页派工任务 · 【${tagZh}】
只写本盘结构主张 + 事实档短摘录（主辅路径）；用户可见正文留给 fill。`;
}
