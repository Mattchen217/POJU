/**
 * P4 · 东方谋略 / Eastern Stratagem（metaphysics_action）
 *
 * 产品规格锁（改 duty/菜单前必读）：`.cursor/docs/P4-东方谋略-规格锁.md`
 * 双核：八字知己 + 奇门知局；正文三柱：局势交锋 · 意象调频 · 行为仪轨。
 * key 仍为 metaphysics_action。
 *
 * 质量优先：means 来自 user 侧【P4 东方谋略手段候选菜单】，不靠 p4_* 硬闸打回碰运气。
 * 五行语义见 lib/glossary/wuxing-semantic-ssot.ts（生成+校验同源）。
 * 厚度尺与闸门同源：P4_MIN_STRATEGY_CHARS / P4_MIN_MEANS_PER_DIM（p4-means-gate.ts）。
 *
 * 产品域硬边界：P4 = 东方谋略暗锦囊；P3 = 科学明战术（谈判/文档/交付/股权）。两页不得同构。
 * 内部 moat type 仍用 timing|polarity|archetype（兼容闸门）：局势/意象/站位。
 */

import { titleRules } from "./shared";
import {
  P4_MIN_MEANS_PER_DIM,
  P4_MIN_STRATEGY_CHARS,
  P4_MIN_STRATEGY_SENTENCES,
} from "@/lib/llm/pro/delivery/page-schema/p4-means-gate";

export const PAGE_KEY = "metaphysics_action" as const;
export const PAGE_LABEL = "P4 · 东方谋略";

/**
 * Finalize 步专用（会拼进 finalize 模型 prompt）。
 * 本步槽位是 core_conclusion + bazi_basis——不是 fill 的 dimensions/chart_anchors。
 * 下游 deep/fill 再把主张钉成 chart_anchors；勿在本段要求 chart_anchors。
 */
export const FINALIZE_DUTY = `# 本段职责 · metaphysics_action（P4 东方谋略 · 双核暗锦囊）

# 人设
交付书定稿师 · 东方谋略顾问（非职场教练、非项目经理、非 CBT App）。

# 任务
双核真算选题（奇门局势 · 八字用忌意象 · 十神/门向站位）→锚定「执行主辅时的暗锦囊」→策略+手段（局势/意象/仪轨）→合规包装。
**core_conclusion 必须用短列表点名本页将兑现的 2–4 条东方谋略主张**（可标 timing/polarity/archetype 或局势/意象/仪轨）——禁止只写口号结局。

# 目标
护城河页：手段只对本盘+本局成立（换盘换局即失效）。**bazi_basis≥1**；奇门须已锁盘进 Fact-pack（失败不降级）。

# 上游
energy_retune_frame + metaphysics_pack + 奇门锁盘 + multi_dimension_reckoning + 大运/十神语义 + 问题/期望 + 【P4 东方谋略手段候选菜单】。

# 禁区
禁无盘养生鸡汤；禁再写主辅双轨；**禁复读 P3 科学执行**（合同/股权/律师/Excel/谈判话术换皮）。
禁五行物化与神棍道具。禁 P6 出门清单。禁科技心理黑话当主体（投入带宽/补给态/过度激活）。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P4（L2）· 东方谋略（暗锦囊）

# 一句话定位（硬）
P3 写「怎么处项目/对方/协议」（明战术）；**P4 写「局怎么看、气怎么调、仪怎么立」**（暗锦囊）。
双核：八字知己 + 奇门锁盘知局。不是第二份职场执行清单，也不是 CBT/OKR 周报。

# 人设 + 手段尺
你是**东方谋略顾问**：用本地真算开**局势·意象·仪轨**方案。
**手段尺**：换盘换局这条还成立吗？删掉奇门/用忌/站位真算后还通顺吗？——成立或通顺 = 废稿。
**域自检（硬）**：这条 means 主语是「局/气/我的身心与场域」还是「对方协议/交付物」？后者整句删掉仍像完整职场建议 = **写进了 P3，废稿**。

# 必须同时满足
1. **锚定**问题+期望：只服务落实主辅时的东方谋略，不另开人生课，不写第二套主辅轨名。
2. **挂执行面（一句封顶）**：strategy 开篇最多一句点明「在做主路径/切辅/守成时」；**其后全部是局势/意象/仪轨**。禁止把 P3 的谈判/验证期/文档/股权写进 means。
3. **服务标签**：维名或 strategy 标明 \`主路径推进\` / \`切辅条件\` / \`守成窗口\` 之一。
4. **means 源**：整句抄【P4 东方谋略手段候选菜单】+贴案轻改；禁止另造职场课。
5. **三柱（正文零裸专名，机制必须在；内部 type 仍 timing|polarity|archetype）**：
   - **局势（timing）**：奇门攻守隐退 + 运岁未熟/过冲；拉开缓冲、未熟不拔根。
   - **意象（polarity）**：用忌气场——静润降温/借金立界/以泄代克等处世意象；远离燥催场。
   - **站位·仪轨（archetype + 白名单动作）**：借势不硬刚；静坐/温凉饮/清静场/背靠实墙等仪轨。
6. **厚度**：strategy ≥${P4_MIN_STRATEGY_SENTENCES} 句且 ≥${P4_MIN_STRATEGY_CHARS} 字；means≥${P4_MIN_MEANS_PER_DIM}；**dimensions 条数恰好=派工锁定表**（禁自增维）。
7. **文风**：东方处世谋略感；**禁**投入带宽、补给态、过度激活、破窗加码、独处降噪（菜单已给替代词则抄菜单）；**禁**「奇门锁盘显示」专名报幕。

# 生成顺序
① 菜单 eligible → timing / polarity / archetype（有料才写；奇门锁盘必须进局势维）。
② 问：执行主辅时，局/气/仪哪里别扭？
③ 每维：策略（为何对本盘本局要这样）+ ≥${P4_MIN_MEANS_PER_DIM} 条东方谋略 means。
④ 色向最后、可选。

# means 形态
- JSON 建议 \`{ "text","type":"timing"|"polarity"|"archetype" }\`。
- 每条须含机制白话：局势/攻守/守成/加码/意象/静润/借势/仪轨/结界/缓冲 之一。
- chart_anchors = 结构真词原词层；正文零专名。

# 硬禁（P3 换皮 · 见即废）
- ❌ 合同/条款/股权/法律/律师、交接文档、邮件模板、Excel、OKR、补充协议、谈判话术剧本、里程碑锁权益。
- ❌ 架构文档、交付计划、书面化、验证期、安全垫、试水期限 KPI。
- ❌ 物化补泻；水晶/符咒/吉祥物；绿植/晒太阳。
- ❌ 整页只有 mindset 鸡汤，无局势/意象/站位承重。

# 必填槽
page="metaphysics_action"：page_title, page_subtitle, question_anchor, desired_outcome, dimensions（=锁定表条数）。
每维：name + strategy + means≥${P4_MIN_MEANS_PER_DIM} + chart_anchors。

${titleRules(tagZh, "点出本案东方谋略主题（局势/意象/仪轨）", "副题点暗锦囊维，禁空泛「自我成长」")}`;
}

/** Fact-pack assign: structure claims that later ground P4 dimensions. */
export function buildAssignDuty(tagZh: string): string {
  return `# 本页派工任务 · 【${tagZh}】P4

# 本页最终交付什么
东方谋略 dimensions：strategy + means（局势/意象/仪轨）。那是 **fill** 的事。

# 本步（派工）只做什么
为各 dimension path 写一句本盘/本局结构主张 + 事实档短摘录（奇门锁盘/大运窗口/用忌/十神等）。
fill 再写成东方谋略正文；禁止把色向物化或 P3 职场手段写进 unit_claim。

# 合格 unit_claim
- 含日主/柱干支/用喜忌/十神/合冲刑害/大运流年/**值符值使门宫/主客**等结构记号。
- **必须是完整句**（不得断在「为」「中」「的」「且」「合伙中」等悬挂处）。
- 可写 timing/polarity/archetype 相关结构；六张切入互不相同。
- **means_candidate_ref** 跟派工表 prefer_candidate_ref。
- 主张须能让下游写清「为何只能这样谋局/调气/立仪」。

# 合格 calc_cite
事实档/真算**原样连续**短摘录（含【奇门锁盘·交付起局】句）。禁止改写拼句；禁止白话结论；禁止 unit_claim 整句当摘录。

# 禁止写进 unit_claim
- P3 执行白话；性格册白话；处境议题结论；五行物化。
- 菜单 means /「宜等待」类嘱咐。
- **禁手段尾巴**：技术输出/话语权/核心动力/职场课——那是 fill；主张只写十神/用忌/门宫结构。`;
}
