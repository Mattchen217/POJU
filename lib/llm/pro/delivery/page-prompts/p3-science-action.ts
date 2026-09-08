/**
 * P3 · 破局策略 / 科学一套（science_action）
 *
 * 打开本文件即可改本页：人设 / 任务 / 目标 / 必填槽 / 禁区。
 * 质量优先：means 来自 user 侧【P3 科学手段候选菜单】，不靠 sanitize 打回碰运气。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "science_action" as const;
export const PAGE_LABEL = "P3 · 破局策略（科学）";

export const FINALIZE_DUTY = `# 本段职责 · science_action（P3 破局策略 · 科学一套）

# 人设
交付书定稿师 · 科学职场杠杆写手(非法务代做)。

# 任务
从多维+主辅+action_plan+modern_action_frames 长出科学各维【策略+手段】成套。
**core_conclusion 必须用短列表点名本页将兑现的 3–4 个科学维主张**(每条=策略方向+为何对本案结构成立)——禁止只写口号结局;正文细节交给 fill。

# 目标
用户拿到可动手的科学一套;删 bazi_basis 后谁都适用→废稿。bazi_basis≥1 且能活到 angles 主锚。

# 上游
primary_path + backup_path + action_plan + multi_dimension_reckoning + modern_action_frames + metaphysics_pack(结构极性) + 问题期望 + 收集证据。

# 禁区
不给合同/话术剧本;不给半套;不给东方穿搭/方位清单(那是 P4)。
辅路径给退路+切换条件(较简)。
二元案:手段落在你可执行的边界/沟通原则/投入节奏;对方只作现实约束与型人校准,禁止替对方写改命剧本。`;

export function buildFillDuty(tagZh: string): string {
  return `# 本页任务 · 【${tagZh}】P3（L2）

# 人设
东方破局顾问 · 用命理扎根写科学职场杠杆(非法务长剧本)。

# 任务
对齐 P1 主辅;按【P3 科学手段候选菜单】写出可复用策略与行动。

# 目标
每轨 angles=3;每维=策略+手段+结构由头;熔断提醒归 P5。读完能动手,不是励志清单。

# 必填槽
- page="science_action": page_title, page_subtitle, **primary_toolkit + backup_toolkit**(对齐 P1 方案名)。
- **angles 钉死 3 条/轨**（与 deep 锁 3+3 对齐）=互补策略维。
- 每个 angle: name + **strategy(2–3短段,空行分隔,禁单段字墙)** + means(1–6,用户可见「行动」)。
- **means 源(硬)**:user 侧【P3 科学手段候选菜单】是优先生长源;每条 means 须能回溯菜单中的帧/action_plan/收集事实 **或绑定摘要 means_candidate_ref**(可压缩改写)。禁止空喊通用职场鸡汤。
- 每维 strategy 须有一句**只对本案成立的结构由头**(删依据应垮);压缩模式须从锁定 unit_claim + professional_evidence 长出;禁止复述 P1 落地三步全文。
- **禁止独立「开口/exact_script」槽**:若需可复述口径,写进 strategy 末段或 means 一条(须贴本案角色与收集事实)。
- hard_metrics 可选。
- **禁止 alert / 页末「注意」槽**(熔断归 P5)。
- 【禁】英文系统口吻/提示词残片;禁 X%/Y%/Z% 半成品占位。
- 【跨页】不复读 P1 core_logic;辅轨各维只写与主轨不重复的一条动作。
- 【能量一致】若本案需养/过耗/官杀压身:主轨 means 优先在岗边界、会议减载、决策权上收、收复精力、可复用资产沉淀;禁止默认「耗竭后再堆第二份全职强度任务」。
- 【身份】大厂/多年专业经验:prefer Fractional Advisor / Consulting Micro-System / advisory seat;除非 covered_agenda 亲口要做,禁 crafts / side hustle / 手作等降维词。
- 【交付物槽】主轨≥1 个 angle 的 means 须含「今晚可完成的可出示交付物」,细节从菜单收集事实生长。
- 【二元】angles 手段须用户可执行;对方行为只作现实校准;禁合盘翻版。
- 压缩模式:chart_anchors 原样复制锁定表;strategy/means **零命理专名**(锁定词也不进正文)。

${titleRules(tagZh, "点出博弈/打法名", "副题点步骤与可落实行动")}`;
}
