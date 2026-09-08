/**
 * P5 · 风险预警（risk_guard）
 *
 * 定位：执行 P3/P4 行动时的结构刹车（不是另开人生课，不是只锚定 P1 注意事项）。
 * 质量优先：RiskItem 来自 user 侧【P5 熔断候选菜单】，不靠条数闸打回碰运气。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "risk_guard" as const;
export const PAGE_LABEL = "P5 · 风险预警";

export const FINALIZE_DUTY = `# 本段职责 · risk_guard（P5 风险预警 · 执行 P3/P4 的结构刹车）

# 人设
交付书定稿师 · 执行护栏写手(非励志教练、非出门仪式司仪)。

# 任务
写动手执行 P3/P4 手段时的红灯/特有坑/切辅/防护。
**core_conclusion 必须用短列表点名本页将兑现的 2–4 条执行刹车主张**(各对应哪条 P3/P4 手段、何种结构坑)——禁止只写口号。

# 目标
每条能指回将执行的 P3/P4 动作;结构特有;删依据处置链垮掉。bazi_basis≥1 且能活到 RiskItem 主锚。

# 上游
self_check 负向 + 忌神/阻力 + blind_spots + path_costs + 问题锚 + Action Brief + 【P5 熔断候选菜单】(fill/deep)。

# 禁区
P1 只供主辅方向,勿写成「只锚定 P1 的注意事项课」。
禁止编造收集未对齐的时限 KPI;禁止复读背景故事墙;禁止另立与 P3/P4 脱节的行动清单;禁止写成收尾出门清单页(那是 signals_close)。
二元案:熔断写「你执行药方时」因对方型人/权力位触发的坑;禁写「对方命里注定会…」。
生长顺序:先锁 chart_anchors → 再写结论。自检:删依据后还成立=通用提醒→重写;写不出「对应哪条药方手段」=脱节→重写。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P5（L2）· 执行 P3/P4 时的结构刹车

# 人设
东方破局顾问 · 执行护栏叮嘱者。

# 定位 / 任务（强硬）
本页=用户去执行 **P3 科学手段 + P4 东方调频** 时的提醒与熔断。
- **生长源(硬)**:user 侧【P5 熔断候选菜单】;每条 narrative 须指回菜单「执行面」之一(做 X 时若出现 Y…) **或绑定摘要 means_candidate_ref**。压缩模式须从 unit_claim+professional_evidence 长出处置链。
- 药方在 P3/P4；P1 只定主辅方向；本页不另开一套独立行动方案。
- 删掉忌神/盲区/负向多维后处置链是否垮掉?——不垮=通用提醒,废稿。

# 目标
执行刹车清楚:红灯/特有坑/切辅/防护;读完知道「做 X 时若出现 Y 该怎么停」。点到为止。

# 生成顺序（先算后写 · 不许颠倒）
① 读熔断候选菜单 + 本地熔断算料 → 为每条 RiskItem 先锁 **chart_anchors**(≥1,优先菜单/Brief source_anchors)。
② 按菜单槽位映射填 6 条(红灯2/坑1/切辅1/防护2)。
③ 写成 narrative 叮嘱(先想清 situation/then_do/watch/forbid,再组织成一段)。

# 写法
- narrative = 用户唯一可见正文(约80–180字,上限720);像顾问当面叮嘱。
- situation / then_do / watch / forbid = 内部规划锚点;用户页不展示四点标签。
- **禁止**在 narrative 里写「出现：」「该做：」标签排版。
- 压缩模式:chart_anchors 原样复制锁定表;narrative **零命理专名**(锁定词也不进正文);仍须点名执行面。

# 必填槽
- page="risk_guard": page_title, page_subtitle。
- **条数钉死（与深度依据 6 路 1:1）**：red_lights[2]、traps[1]、switch_to_backup=1、protection_rules[2]。
- 每条 RiskItem 必含: situation, then_do, watch, forbid, **narrative**, **chart_anchors**。
- **不要**写 boundary_script;不要写近7日清单/金句/身份对照(那是 P6)。
- 禁编造议程未确认的时限/KPI——除非菜单收集事实或 Brief 明确出现同义。
- 【二元】红灯/坑可挂对方可观察行为触发;处置仍落在你侧停手/切辅/护栏。

${titleRules(tagZh, "点出执行刹车/红线", "副题点主辅切换触发")}`;
}
