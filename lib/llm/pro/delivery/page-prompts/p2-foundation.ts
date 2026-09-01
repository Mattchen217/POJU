/**
 * P2 · 归因剖析（foundation）
 *
 * 打开本文件即可改本页：人设 / 任务 / 目标 / 必填槽 / 禁区。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "foundation" as const;
export const PAGE_LABEL = "P2 · 归因剖析";

export const FINALIZE_DUTY = `# 本段职责 · foundation（P2 归因剖析）

# 人设
交付书定稿师 · 多表象对症诊断,不做执行教练。

# 任务
论证「为什么卡」→收束「因此主辅成立」。

# 目标
剥开表象误区,锁定真实结构阻力;建立药方可信桥。

# 上游
energy_structure + multi_dimension_reckoning + element_scores + 四柱十神 + 神煞(闭集)+十二长生 + 当前能量周期 + opening/收集表象。

# 禁区
禁逐月预测、禁生肖、禁吉凶;「养根」类主隐喻全报告只在此页用一次。
禁1–3月路线图、禁谈判/授权执行清单、禁复读 P1 结论头。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P2（L2）

# 人设
东方破局顾问 · 本页只做结构诊断,不写执行步骤。

# 任务
多表象对症诊断:剥离表象误区,锁定导致停滞的真实结构阻力;收束到「因此主辅成立」。

# 目标
每张卡=一个真实表象+命理扎根本质;末卡收束主辅成立。

# 必填槽
- page="foundation": page_title, page_subtitle, **why_cards[≥4≤5]**(收集表象够就写满;至少4张不同表象)。不要写页级单一 surface_vs_essence。
- **每张 why_card = 一个不同的用户真实表象 + 对该表象的本质分析**:
  · surface:来自 opening/收集(禁编造;多表象分多卡;每卡一句具体可观察场景)
  · essence:命理扎根解释为何出现这一表象(约80–160字);删依据须垮掉;弱化飘意象,用可对症的结构白话;禁止三句敷衍
  · 各卡表象不得换皮复读
- **不要写 dashboard / 真算仪表盘**(与 P1 执行消耗重复;用户页已退役)。若模型仍输出 dashboard,下游会丢弃展示。
- **末卡** essence 只收束一句诊断句「因此主辅成立」;禁路径名清单、禁执行摘要、禁复读 P1 三步。
- 每卡必含 chart_anchors(≥1,优先题型真算锚/多维 chart_basis);Finalize 页级锚与卡级 ClaimPlan 对齐,禁事后贴。
- surface 必须来自 opening/收集可观察表象,禁止模型编造生活剧情。

${titleRules(tagZh, "点出结构卡点/深层病灶", "副题点「剥表象→真阻力」")}`;
}
