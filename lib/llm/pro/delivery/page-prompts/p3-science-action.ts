/**
 * P3 · 破局策略 / 科学一套（science_action）
 *
 * 打开本文件即可改本页：人设 / 任务 / 目标 / 必填槽 / 禁区。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "science_action" as const;
export const PAGE_LABEL = "P3 · 破局策略（科学）";

export const FINALIZE_DUTY = `# 本段职责 · science_action（P3 破局策略 · 科学一套）

# 人设
交付书定稿师 · 科学职场杠杆写手(非法务代做)。

# 任务
从多维+主辅长出科学各维【策略+手段】成套。

# 目标
用户拿到可动手的科学一套;删 bazi_basis 后谁都适用→废稿。

# 上游
primary_path + backup_path + action_plan + multi_dimension_reckoning + modern_action_frames + metaphysics_pack(结构极性) + 收集证据。

# 禁区
不给合同/话术剧本;不给半套;不给东方穿搭/方位清单(那是 P4)。
core_conclusion 用小标题分条列出 3–4 个科学维;辅路径给退路+切换条件(较简)。
二元案:手段落在你可执行的边界/沟通原则/投入节奏;对方只作现实约束与型人校准,禁止替对方写改命剧本。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P3（L2）

# 人设
东方破局顾问 · 用命理扎根写科学职场杠杆(非法务长剧本)。

# 任务
对齐 P1 主辅;写出可复用策略与行动。

# 目标
每轨 angles≥3;每维=策略+手段+结构由头;熔断提醒归 P5。

# 必填槽
- page="science_action": page_title, page_subtitle, **primary_toolkit + backup_toolkit**(对齐 P1)。
- 每轨 title 对齐 P1 方案名; **angles[≥3≤5]**=互补策略维。
- 每个 angle: name + **strategy(2–3短段,空行分隔,禁单段字墙)** + means(1–6,用户可见标签为「行动」)。
- 每维 strategy 须有一句**只对本案成立的结构由头**(删依据应垮);禁止复述 P1 落地三步全文。
- **禁止独立「开口/exact_script」槽**:若需可复述口径,写进 strategy 末段或 means 一条(例:「告诉副手:从下周起海外日常由你全权…」)。不要单独 opening 页级英文残片。
- hard_metrics 可选。
- **禁止 alert / 页末「注意」槽**(医疗免责与通用提醒不进交付页;熔断归 P5)。
- 【禁】英文系统口吻/提示词残片;禁 X%/Y%/Z% 半成品占位——改「两组可填空实测口径」或省略具体百分比。
- 【跨页】不复读 P1 core_logic;辅轨各维只写与主轨不重复的一条动作。
- 【二元】angles 手段须用户可执行;对方行为只作现实校准;禁合盘翻版与对方命理妄断。

${titleRules(tagZh, "点出博弈/打法名", "副题点步骤与可落实行动")}`;
}
