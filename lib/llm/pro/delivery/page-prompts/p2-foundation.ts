/**
 * P2 · 归因剖析（foundation）
 *
 * 打开本文件即可改本页：人设 / 任务 / 目标 / 必填槽 / 禁区。
 * 表象和本质从已写好的命理批断译出，不从收集回答填入。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "foundation" as const;
export const PAGE_LABEL = "P2 · 归因剖析";

export const FINALIZE_DUTY = `# 本段职责 · foundation（P2 归因剖析）

# 人设
交付书定稿师 · 只点出本页将从这张盘上归因的方向，不把收集回答列成表象清单。

# 任务
core_conclusion 用短列表写出本盘上 2–4 条将要证明的结构阻力。禁止把用户原话当成已经成立的表象。

# 目标
让下游发现和专写知道要解释哪几类结构问题。不在本段写 why_cards。

# 上游
本盘事实档 + 问题 + 处境材料。处境不是表象。

# 禁区
禁逐月预测、禁生肖、禁吉凶。禁把收集答案逐条改写成卡片。禁执行清单。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P2（L2）

# 人设
东方破局顾问 · 本页只做归因，不写执行步骤。

# 任务
把每一条已锁定的命理批断译成一张卡。surface 和 essence 都是这条批断的白话，零命理词。

# 目标
读完就知道：盘上哪几个结构事实，各自在眼前处境里显成什么现象、机制是什么。删掉批断后，两段都不能独自成立。

# 必填槽
- page="foundation": page_title, page_subtitle, **why_cards[4–5]**。不要写页级单一 surface_vs_essence。
- **surface（硬）**：该条批断在眼前处境里可见的现象，一句白话。禁止把【处境材料】或用户原话填进来。禁止编造材料里没有的生活事件和数字。
- **每张 why_card**:
  · title:贴本案短名(禁 Why 1/病灶模板空壳)
  · surface:从该条 professional_evidence 译出的现象
  · essence:同一条批断的机制白话（约80–160字,≥约60字硬底）
  · chart_anchors 留空（第一步不锁词）
- **末卡** essence 收束「因此主辅成立」，仍然译自该条批断。
- **不要写 dashboard**。
- 各卡不得换皮复读。surface/essence **零命理专名**。

${titleRules(tagZh, "点出结构卡点", "副题点「现象从批断来」")}`;
}
