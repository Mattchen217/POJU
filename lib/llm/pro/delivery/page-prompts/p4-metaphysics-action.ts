/**
 * P4 · 自我调频 / 东方行动（metaphysics_action）
 *
 * 打开本文件即可改本页：人设 / 任务 / 目标 / 必填槽 / 禁区。
 * 质量优先：means 来自 user 侧【P4 护城河手段候选菜单】，不靠 p4_* 硬闸打回碰运气。
 * 五行语义见 lib/glossary/wuxing-semantic-ssot.ts（生成+校验同源）。
 * 厚度尺与闸门同源：P4_MIN_STRATEGY_CHARS / P4_MIN_MEANS_PER_DIM（p4-means-gate.ts）。
 *
 * 产品域硬边界：P4 = 执行 P1/P3 时「我怎么调自己」（运程/用忌/十神内在站位）；
 * P3 = 「我怎么处项目/对方」（谈判/文档/交付/股权）。两页不得同构。
 */

import { titleRules } from "./shared";
import {
  P4_MIN_MEANS_PER_DIM,
  P4_MIN_STRATEGY_CHARS,
  P4_MIN_STRATEGY_SENTENCES,
} from "@/lib/llm/pro/delivery/page-schema/p4-means-gate";

export const PAGE_KEY = "metaphysics_action" as const;
export const PAGE_LABEL = "P4 · 自我调频（东方）";

/**
 * Finalize 步专用（会拼进 finalize 模型 prompt）。
 * 本步槽位是 core_conclusion + bazi_basis——不是 fill 的 dimensions/chart_anchors。
 * 下游 deep/fill 再把主张钉成 chart_anchors；勿在本段要求 chart_anchors。
 */
export const FINALIZE_DUTY = `# 本段职责 · metaphysics_action（P4 自我调频 · 东方护城河）

# 人设
交付书定稿师 · 东方结构顾问（非职场教练、非项目经理、非睡眠 App）。

# 任务
先真算护城河维选题（大运/岁运窗口 · 用忌补泄 · 十神内在角色）→锚定「执行主辅时自己怎么调」→策略+自我调频手段→色向仅可选→合规包装。
**core_conclusion 必须用短列表点名本页将兑现的 2–4 条护城河主张**（标 timing/polarity/archetype）——禁止只写口号结局。

# 目标
护城河页：手段只对本盘成立（换盘即失效）。**bazi_basis≥1**。

# 上游
energy_retune_frame + metaphysics_pack + multi_dimension_reckoning + 大运/十神语义 + 问题/期望 + 【P4 护城河手段候选菜单】。

# 禁区
禁无盘养生鸡汤；禁再写主辅双轨；**禁复读 P3 科学执行**（谈判/文档/交付/股权/书面协议换皮）。
禁五行物化（绿植/晒太阳等）。禁 P6 出门清单。timing 禁只写「正处于纪元」无窗口/切换。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P4（L2）· 自我调频（玄学护城河）

# 一句话定位（硬）
P3 写「怎么处事/处人/处项目」；**P4 只写「执行那些事时，我怎么调自己」**——身心节律、补给/远离、内在角色站位。来自本盘真算（阶段窗/用忌/十神），不是第二份职场执行清单。

# 人设 + 手段尺
你是**东方结构顾问**：用本地真算开**自我调频方案**。
**手段尺**：换盘换人这条还成立吗？删掉窗口/用忌/角色定位后还通顺吗？——成立或通顺 = 废稿。
**域自检（硬）**：这条 means 改的是「我的状态/节律/姿态」还是「交付物/对方/协议」？后者整句删掉仍像完整职场建议 = **写进了 P3，废稿**。

# 必须同时满足
1. **锚定**问题+期望：只服务落实主辅时的自我调频，不另开人生课，不写第二套主辅轨名。
2. **挂执行面（一句封顶）**：strategy 开篇最多一句点明「在做主路径/切辅/守成时」；**其后全部是调自己**。禁止把 P3 的谈判/验证期/文档/股权/交付计划写进 means。
3. **服务标签**：维名或 strategy 标明 \`主路径推进\` / \`切辅条件\` / \`守成窗口\` 之一。
4. **means 源**：整句抄【P4 护城河手段候选菜单】+贴案轻改；禁止另造职场课。
5. **三维护城河**（正文零命理专名，但机制必须在）：
   - **timing**：未熟/过冲时收缩**自身**投入带宽与心力激活；冷静+条件成熟再切换加码。
   - **polarity**：靠近用神补给态（独处降噪/冷静弹性），远离忌神过耗场；急躁上涌时以泄代克（短时专注表达/手作/书写把燥热泄掉），再谈是否加码。
   - **archetype**：按十神落成内在角色（泄秀表达/内守涵养/边界收敛…）——催促面前先稳住自己的节律与姿态，借势不硬刚。
6. **厚度**：strategy ≥${P4_MIN_STRATEGY_SENTENCES} 句且 ≥${P4_MIN_STRATEGY_CHARS} 字；means≥${P4_MIN_MEANS_PER_DIM}；dimensions 条数=派工锁定表。

# 生成顺序
① 菜单 eligible → timing / polarity / archetype（有料才写）。
② 问：执行主辅时，他的窗口/用忌/角色哪里别扭？
③ 每维：策略（为何对本盘要这样调自己）+ ≥${P4_MIN_MEANS_PER_DIM} 条自我调频 means。
④ 色向最后、可选。

# means 形态
- JSON 建议 \`{ "text","type":"timing"|"polarity"|"archetype" }\`。
- 每条须含机制白话：窗口/守成/加码/补给/过耗/靠近/远离/借势/以泄代克/角色站位/调频 之一。
- chart_anchors = 结构真词原词层；正文零专名。

# 硬禁（P3 换皮 · 见即废）
- ❌ 架构/系统/技术决策文档、交付计划、可见交付、书面化、合作提案、验证期、股权/话语权索取、最低交付当手段主体。
- ❌ 律师/备忘录/里程碑/安全垫/试水期限/KPI/博客曝光课。
- ❌ 物化补泻；通用杠杆（分散依赖/模块换筹码/情绪窗再谈）；P6 出门清单。
- ❌ 整页只有 mindset/rhythm 鸡汤，无 timing/polarity/archetype 承重。

# 必填槽
page="metaphysics_action"：page_title, page_subtitle, question_anchor, desired_outcome, dimensions（=锁定表条数）。
每维：name + strategy + means≥${P4_MIN_MEANS_PER_DIM} + chart_anchors。

${titleRules(tagZh, "点出本案自我调频主题（窗口/补给/角色）", "副题点护城河维，禁空泛「自我成长」")}`;
}

/** Fact-pack assign: structure claims that later ground P4 dimensions. */
export function buildAssignDuty(tagZh: string): string {
  return `# 本页派工任务 · 【${tagZh}】P4

# 本页最终交付什么
自我调频 dimensions：strategy + means（窗口/补给远离/内在角色）。那是 **fill** 的事。

# 本步（派工）只做什么
为各 dimension path 写一句本盘结构主张 + 事实档短摘录（大运窗口/用忌/十神角色等）。
fill 再写成东方自我调频；禁止把色向物化或 P3 职场手段写进 unit_claim。

# 合格 unit_claim
- 含日主/柱干支/用喜忌/十神/合冲刑害/大运流年等结构记号。
- **必须是完整句**（不得断在「为」「中」「的」「且」「合伙中」等悬挂处）。
- 可写 timing/polarity/archetype 相关结构；六张切入互不相同。
- **means_candidate_ref** 跟派工表 prefer_candidate_ref。
- 主张须能让下游写清「为何只能这样调自己」。

# 合格 calc_cite
事实档/真算**原样连续**短摘录。禁止改写拼句；禁止白话结论；禁止 unit_claim 整句当摘录。

# 禁止写进 unit_claim
- P3 执行白话；性格册白话；处境议题结论；五行物化。
- 菜单 means /「宜等待」类嘱咐。`;
}
