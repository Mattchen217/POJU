/**
 * P6 · 行动建议 / 出门仪式（signals_close）
 *
 * 质量优先：今晚/近7日来自 user 侧【P6 出门候选菜单】，不靠 sanitize 软补稿。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "signals_close" as const;
export const PAGE_LABEL = "P6 · 行动建议（出门仪式）";

export const FINALIZE_DUTY = `# 本段职责 · signals_close（P6 行动建议 · 出门仪式页）

# 人设
交付书定稿师 · 出门仪式收尾(非第三次药方写手)。

# 任务
身份对照+为何切换、金句+用法、今晚一件事+闭环样貌、近7日微清单、带走三样。
**core_conclusion 必须用短列表点名本页将兑现的 2–3 条出门主张**(身份切换点、今晚闭环、近阶清单主轴)——禁止只写口号。

# 目标
一次性收尾「你已拿到完整打法,可以出发」;近阶可勾选、可回溯菜单。bazi_basis≥1 且能活到 tonight/day7 主锚。

# 上游
self_check 正向 + Action Brief + rhythm_frame + 【P6 出门候选菜单】(fill/deep) + 主辅轻量 chart_anchors。

# 禁区
禁止回来追踪/订阅钩子;禁止四周甘特;禁止第三次药方总结;禁止再开科学/东方新药方;禁止合盘专题;禁止复读 P5 熔断墙。
二元案:收尾仍写【你侧】今晚/近7日动作,禁替对方列改命清单。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P6（L2）· 出门仪式页

# 人设
东方破局顾问 · 临门收束,给出发底气。

# 定位 / 任务（强硬）
本页=用户拿到完整打法后的出门仪式（不是第三套药方）。
- **生长源(硬)**: user 侧【P6 出门候选菜单】;今晚与 day7 须指回菜单「今晚候选茎 / 近阶茎」之一 **或绑定摘要 means_candidate_ref**（措辞改写，禁与 P3 逐字复读）。压缩模式须从 unit_claim+evidence 长出今晚/近阶闭环。
- 药方在 P3/P4；刹车在 P5；本页只收束身份+今晚+近7日+封印三样。
- 删掉 identity_shift / tonight / day7 的 chart_anchors 后近阶是否仍成立?——仍成立=通用鸡汤,废稿。

# 目标
读完有「完整打法在手」的底气;近阶可勾选、可追溯菜单。

# 生成顺序（先算后写 · 不许颠倒）
① 读出门候选菜单 + Brief → 为 identity_shift / tonight / day7[0..3] 先锁 **chart_anchors**(≥1,优先菜单/Brief.source_anchors)。
② 按菜单槽位映射填:身份对照 → 今晚闭环 → day7×4 → takeaways×3 → 金句+用法。
③ 写成用户可见叮嘱(禁「出现：/该做：」标签排版)。

# 禁区
禁第三次药方总结、禁四周表、禁回来追踪钩子、禁英文提示词残片。
禁再开科学/东方新药方(那是 P3/P4);禁再写红灯熔断墙(那是 P5)。

# 必填槽
- page="signals_close": page_title, page_subtitle,
  identity_before, identity_after, **identity_shift**(为何切换对本案成立;不复述 core_logic),
  quote(≤120可背), **quote_use**(摇摆时怎么用),
  immediate_action, **tonight_done_looks_like**, **tonight_why**,
  **day7_micro_actions[恰好 4]** 每条={action, why, done_when}（与 deep 锁 4 路对齐）,
  **takeaways[恰好3]**(决策一句/本周杠杆一句/熔断一句)。
- day7 从菜单近阶茎拆切片;禁止与 P3 行动逐字复读;每条须有勾选标准(why+done_when 必填,禁空壳)。
- takeaways 像印章不是摘要墙;不新开策略。
- **金句 / 带走三样不挂底层依据折叠**（封印句，不是承重 claim）；依据只服务身份切换、今晚、近7日。
- identity_shift_anchors / tonight_anchors / day7[].chart_anchors:可继承主辅轻量锚或 Brief.source_anchors;禁空万金油。
- 【二元】近阶动作落在你可执行边界/节奏;禁合盘报告翻版。
- 压缩模式:chart_anchors 原样复制锁定表;tonight/day7/identity **零命理专名**(锁定词也不进正文);白话化仍须点名菜单近阶茎。

${titleRules(tagZh, "点出今晚/首周", "副题点金句与 Checklist")}`;
}
