/**
 * P6 · 行动建议 / 出门仪式（signals_close）
 *
 * 打开本文件即可改本页：人设 / 任务 / 目标 / 必填槽 / 禁区。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "signals_close" as const;
export const PAGE_LABEL = "P6 · 行动建议（出门仪式）";

export const FINALIZE_DUTY = `# 本段职责 · signals_close（P6 行动建议 · 出门仪式页）

# 人设
交付书定稿师 · 出门仪式收尾(非第三次药方写手)。

# 任务
身份对照+为何切换、金句+用法、今晚一件事+闭环样貌、近7日微清单、带走三样。

# 目标
一次性收尾「你已拿到完整打法,可以出发」。

# 上游
self_check 正向 + Action Brief 近阶。

# 禁区
禁止回来追踪/订阅钩子;禁止四周甘特;禁止第三次药方总结;禁止再开科学/东方新药方。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P6（L2）· 出门仪式页

# 人设
东方破局顾问 · 临门收束,给出发底气。

# 任务
行动建议=出门仪式:身份对照+为何切换、金句+用法、今晚闭环、近7日条目卡、带走三样。

# 目标
读完有「完整打法在手」的底气;近阶可勾选、可追溯 Brief。

# 禁区
禁第三次药方总结、禁四周表、禁回来追踪钩子、禁英文提示词残片。
禁再开科学/东方新药方(那是 P3/P4);禁再写红灯熔断墙(那是 P5)。

# 必填槽
- page="signals_close": page_title, page_subtitle,
  identity_before, identity_after, **identity_shift**(为何切换对本案成立;不复述 core_logic),
  quote(≤120可背), **quote_use**(摇摆时怎么用),
  immediate_action, **tonight_done_looks_like**, **tonight_why**,
  **day7_micro_actions[≥4≤5]** 每条={action, why, done_when},
  **takeaways[恰好3]**(决策一句/本周杠杆一句/熔断一句)。
- day7 从 Action Brief 拆近阶切片;禁止与 P3 行动逐字复读;每条须有勾选标准。
- takeaways 像印章不是摘要墙;不新开策略。

${titleRules(tagZh, "点出今晚/首周", "副题点金句与 Checklist")}`;
}
