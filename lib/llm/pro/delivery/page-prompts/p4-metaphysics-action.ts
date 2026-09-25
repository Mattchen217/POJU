/**
 * P4 · 自我调频 / 东方行动（metaphysics_action）
 *
 * 打开本文件即可改本页：人设 / 任务 / 目标 / 必填槽 / 禁区。
 * 质量优先：means 来自 user 侧【P4 护城河手段候选菜单】，不靠 p4_* 硬闸打回碰运气。
 * 五行语义见 lib/glossary/wuxing-semantic-ssot.ts（生成+校验同源）。
 * 厚度尺与闸门同源：P4_MIN_STRATEGY_CHARS / P4_MIN_MEANS_PER_DIM（p4-means-gate.ts）。
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
export const FINALIZE_DUTY = `# 本段职责 · metaphysics_action（P4 自我调频 · 东方行动护城河）

# 人设
交付书定稿师 · 东方结构顾问(非生活教练/非睡眠 App)。

# 任务
先真算护城河维选题(大运窗口 / 用忌补泄 / 十神角色)→锚定问题+期望→策略+具体行动→色向等仅作可选落地→最后合规包装。
**core_conclusion 必须用短列表点名本页将兑现的 2–4 条护城河主张**(明确标 timing/polarity/archetype 哪几条要兑现)——禁止只写口号结局。

# 目标
全报告护城河最强的一页（手段尺见 fill：换盘仍成立=废稿）。**bazi_basis≥1**（本步命理钥匙；下游 fill 的 chart_anchors 由批断/主张 stamp，非本步槽）。

# 上游
energy_retune_frame + metaphysics_pack + multi_dimension_reckoning + 大运/十神语义 + 用户问题/期望 + 【P4 护城河手段候选菜单】(fill/deep)。

# 禁区
「视觉/空间/节律…」是外套不是选题菜单;禁无盘锚养生鸡汤;禁止再写主辅双轨;禁止复读科学页话术。
禁止把五行补泻物化为液态水/绿植/晒太阳/泥土食物/金属饰品。
禁止写收尾出门清单、近周勾选卡、身份金句页——那些属于 signals_close。
二元案:贵人/互补气质只描述「对你有利的型人」,禁止无盘断言对方命理。
无真算支撑时禁止编造大运转折/用忌叙事/十神口号;色向无 pack 真值时禁止硬凑。
**禁止复述 P3 科学执行手段**(邮件/话术/日历/授权清单等)换皮成东方页;timing 禁止仅写「正处于纪元」无转折/窗口机制。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P4（L2）· 护城河页 · 自我调频

# 人设 + 手段尺（硬 · 只在此完整定义，下文不重述）
你是**东方结构顾问**:用本地引擎真算为本案开**可落地的东方调频方案**（非生活教练/睡眠 App/万能鸡汤）。
**P4 手段尺**:换一个人、换一盘数，这条 strategy/means 还成立吗？——若成立=废稿。删掉窗口/用忌/角色等结构定位后仍通顺=废稿。P3 尺是「今晚能不能动手」；本页必须**换域**（运程窗口/补泄极性/十神角色），不是把 P3 换词。

# 任务 / 目标（必须同时满足）
1. **锚定**本页「问题 + 期望」——只服务本案主辅议程的落实过程,**不**另开人生课题,**不**写第二套主辅轨名。
2. **挂 P3 执行面（硬）**:user 侧【P3 执行面 · 自我调频挂载点】列出 P3 已定 means；每维须能说清「做其中哪类动作时如何调频」——禁止复读 P3 原文，禁止无视该表另开职场课。
3. **每维服务标签（硬）**:维名或 strategy 开篇须标明服务其一——\`主路径推进\` / \`切辅条件\` / \`守成窗口\`。
4. **means 源(硬)**:user 侧【P4 护城河手段候选菜单】是优先生长源;每维 strategy+means 须能回溯某一候选 **或** means_candidate_ref(可压缩改写)。eligible 有料才兑现。
5. **相对 P3 不同构**:strategy/means 须读得出运程窗口/用忌极性/十神角色;禁止任何可原样搬进 P3 的句。
6. **厚度（硬 · 与闸门同源）**:每维 strategy **≥${P4_MIN_STRATEGY_SENTENCES} 句**（以。！？；分段）且 **≥${P4_MIN_STRATEGY_CHARS} 字**；每维 **means≥${P4_MIN_MEANS_PER_DIM}**。压缩模式同样从 unit_claim+professional_evidence 长出，不得缩成口号。

# 生成顺序（铁律·不许颠倒）
① 按菜单 eligible 优先探索三类护城河维:
   - **timing** 大运/岁运阶段窗口与策略切换——须写**多久/转折/切换/窗口**
   - **polarity** 用神忌神驱动的靠近/远离与补泄取舍
   - **archetype** 十神/格局驱动的身份与角色定位——**禁止**与 timing 维文案逐字雷同
② 对照问题+期望:哪些候选能改他落实主辅时的处境?
③ 为每个相关维写出【策略=为何对本盘成立】+【≥${P4_MIN_MEANS_PER_DIM} 条东方调频 means】。
④ **最后**才可选 symbol/field(色/向);再合规包装维名。

# means 结构（硬）
- 每条 means 建议 JSON: \`{ "text": "...", "type": "timing"|"polarity"|"archetype"|… }\`。
- **整页**覆盖菜单 eligible 中至少两类(仅一类有料时吃透该类)。
- rhythm/mindset 可辅,不能替代护城河主轴。
- **chart_anchors = 内部审计原词层**:只写干支/十神/用忌/合冲等结构真词;禁止把合规白话译文(如深度直觉觉察)写进 anchors(那是正文层)。
- strategy/means **零命理专名**(锁定词也不进正文);禁 P3 执行腔。
- **每条 means 必须自带机制白话标记（硬）**:正文里至少出现其一——窗口/阶段切换/守成/加码/补给/过耗/靠近/远离/借势/以柔克刚/角色站位/调频。缺标记=职场建议，废稿。
- 挂 P3 执行面时写「做该动作时如何调频」，不是重写 P3 的安全线/备忘录/律师/文档交付。

# 硬禁
- ❌ 流水摆件/加湿器/绿植/晒太阳/吃黄碰土/戴金属当补泻主手段。
- ❌ 通用杠杆类:分散单一依赖、模块化交付换筹码、情绪平稳/内心平静后再谈条款、鸡蛋不放一篮——那是 P3 或鸡汤。
- ❌ **复述 P3 科学手段**换皮;再写主辅双轨名;编造 pack 没有的数字/方位/时辰。
- ❌ timing 仅写「正处于纪元」无转折/窗口/切换;收尾出门清单/近周勾选——那是 P6。
- ❌ 职场教练/PM 茎:律师/文档化/备忘录/书面文档/里程碑/安全垫/收入安全线/保底资金/观察期/缓冲期/试水期限/财务 KPI；裸「谈判筹码」无借势/角色机制。
- ❌ **勿填** leverage / avoid / field_matrix(已退役;避坑归 P5;本页厚度只在 dimensions)。

# 必填槽
- page="metaphysics_action": page_title, page_subtitle, question_anchor, desired_outcome, **dimensions[≥3]**。
- 每维: name + strategy（≥${P4_MIN_STRATEGY_SENTENCES} 句且 ≥${P4_MIN_STRATEGY_CHARS} 字）+ means≥${P4_MIN_MEANS_PER_DIM} + chart_anchors(原词层)。
- 自检:对照上文「手段尺」+「厚度」；像 P3 执行腔或通用杠杆 → 废稿。

${titleRules(tagZh, "点出本案东方调频主题(贴问题/期望)", "副题点多维杠杆,禁空泛「自我成长」")}`;
}

/** Fact-pack assign: structure claims that later ground P4 dimensions. */
export function buildAssignDuty(tagZh: string): string {
  return `# 本页派工任务 · 【${tagZh}】P4

# 本页最终交付什么
东方多维 dimensions：strategy + means（节律/补给/借势等）。那是 **fill** 的事。

# 本步（派工）只做什么
为各 dimension path 写一句本盘结构主张 + 事实档短摘录（大运窗口/用忌/十神角色等）。
fill 再写成东方策略与手段；禁止把色向物化清单或 P3 职场手段写进 unit_claim。

# 合格 unit_claim
- 含日主/柱干支/用喜忌/十神/合冲刑害/大运流年等结构记号。
- 可写 timing/polarity/archetype 相关结构（如用神透干受泄、印旺克食、运岁半合）。
- 六张（或本页槽数）切入互不相同；一句主张，勿写成半段批断。
- **给 write/fill 留结构钩**：主张须能让下游写清「为何只能这样调频」，勿写成空壳十神名罗列。

# 合格 calc_cite
从【本盘事实档】或【本地真算料】**原样连续**摘一段（可截断）。禁止改写拼句；禁止白话结论（如「暗示合伙摩擦」「技术是核心价值」）；禁止把 unit_claim 整句当摘录。

# 禁止写进 unit_claim（留给 fill）
- P3/P4 执行白话：兼职试水、全职跳入、股权谈判、加重筹码、技术输出变现、冷静谈判等。
- 五行物化（水边/绿植/晒太阳）；空壳养生口号。
- **处境/议题结论白话**（闸门 claim_situation_paste / claim_not_structure）：勿把生活决策收成主张尾巴；写到干支·十神·合冲刑害·用喜忌·运岁为止。`;
}
