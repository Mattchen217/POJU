/**
 * P2 · 归因剖析（foundation）
 *
 * 打开本文件即可改本页：人设 / 任务 / 目标 / 必填槽 / 禁区。
 * 质量优先：表象来自 user 侧「P2 表象候选菜单」+ 派工料，不靠 sanitize 打回碰运气。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "foundation" as const;
export const PAGE_LABEL = "P2 · 归因剖析";

export const FINALIZE_DUTY = `# 本段职责 · foundation（P2 归因剖析）

# 人设
交付书定稿师 · 多表象对症诊断,不做执行教练。

# 任务
论证「为什么卡」→收束「因此主辅成立」。core_conclusion 写清:本案有哪些真实表象、各对应哪类结构阻力、为何因此主辅成立。

# 目标
剥开表象误区,锁定真实结构阻力;建立药方可信桥。bazi_basis≥1 承重真词。

# 上游
energy_structure + multi_dimension_reckoning + situation/crossroads + 收集表象菜单 + element_scores/仪表盘真分(仅内部)。

# 禁区
禁逐月预测、禁生肖、禁吉凶;「养根」类主隐喻全报告只在此页用一次。
禁1–3月路线图、禁谈判/授权执行清单、禁复读 P1 结论头。
禁空壳「为什么卡」——下游 fill 会写 why_cards,本段须把表象清单与结构阻力对上。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P2（L2）

# 人设
东方破局顾问 · 本页只做结构诊断,不写执行步骤。

# 任务
多表象对症诊断:剥离表象误区,锁定导致停滞的真实结构阻力;收束到「因此主辅成立」。

# 目标
读完就懂「卡在哪几张真实面上、为何结构上走不通、因此主辅成立」——可信桥,不是第二套药方。

# 必填槽
- page="foundation": page_title, page_subtitle, **why_cards[4–5]**。不要写页级单一 surface_vs_essence。
- **surface 源(硬)**:user 侧【P2 表象候选菜单】是唯一合法 surface 源;每卡 surface 须能回溯某一候选(可压缩改写)。候选不足时按菜单规则拆子面,禁止编造生活剧情/未确认数字。
- **每张 why_card**:
  · title:贴本案短名(禁 Why 1/病灶模板空壳)
  · surface:一句可观察场景(来自菜单)
  · essence:命理扎根解释(约80–160字,≥约60字硬底);删 chart_anchors 后应垮;弱化飘意象
  · chart_anchors≥1(优先锁定深据 / 多维 chart_basis / 题型真算锚)
- **末卡** essence 只收束诊断句「因此主辅成立」;禁路径名清单、禁执行摘要、禁复读 P1。
- **不要写 dashboard**(UI 已退役;真分若出现在对照块,只作内部,勿写入用户可见字段)。
- 各卡表象不得换皮复读;压缩模式须原样复制锁定 chart_anchors。

${titleRules(tagZh, "点出结构卡点/深层病灶", "副题点「剥表象→真阻力」")}`;
}
