/**
 * P3 · 破局策略 / 科学一套（science_action）
 *
 * 打开本文件即可改本页：人设 / 任务 / 目标 / 必填槽 / 禁区。
 * 质量优先：means 来自 user 侧【P3 科学手段候选菜单】，不靠 sanitize 打回碰运气。
 */

import { titleRules } from "./shared";

export const PAGE_KEY = "execution_guidance" as const;
export const PAGE_LABEL = "07 · 行动策略与执行原则";

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

export function buildFillDuty(
  tagZh: string,
  _opts?: { plain_judgment?: boolean },
): string {
  // plain_judgment is P2-only at fill-call; P3 always uses this normal duty.
  return `# 本页任务 · 【${tagZh}】P3（L2）

# 人设
现实决策咨询系统 · 用命理扎根写**对事**执行原则与可验证行动（非法务长剧本）。

# 产品定位（硬）
07 = 落实主辅的**执行原则与示例动作**（对事）。professional_evidence 是依据扎根，**不是**正文题材。
❌ 禁止把批断译成 strategy（互耗/生克链/泄掉过载…那是 02）。
❌ **与东方谋略分界**：toolkit 里不要写气场、仪轨、符咒。那不是近步原则。
✅ strategy = 近步原则；means = 完成样貌（做成什么样）。不是可勾选清单，不要写成今晚列出或打卡。
✅ **06-C 必填** \`self_retune\`: \`{ title, body }\`。body 写执行这一步时你怎么稳住自己的节奏和停手线。对己。不是勾选清单，不是对方的盘，不能整段只有缺盘声明。

# 任务
对齐 P1 主辅;按【P3 科学手段候选菜单】写出可复用策略与行动。
压缩模式：按锁定 path 对齐 angles；strategy+means 回溯 means_candidate_ref / 菜单；批断只钉「为何对本盘成立」。

# 目标
每轨 angles=3;每维=策略+手段+结构由头;熔断提醒归 P5。读完能动手,不是励志清单、不是机制译。

# 必填槽
- page="execution_guidance": page_title, page_subtitle, **primary_toolkit + backup_toolkit**(对齐 P1 方案名)。键名必须是这两个，不要改成 primary/backup/tracks。
- **两个 toolkit 必须是对象** \`{ role, title, angles }\`。禁止把方案名写成字符串。angles 写在该对象里面，不要只放在页根上。
- **angles 钉死 3 条/轨**（与 deep 锁 3+3 对齐）=互补策略维；每条须有非空 means≥1，否则整轨会被判缺工具包。
- **每个 angle.chart_anchors ≥1**，只取本页切片里的当前大运或大限短锚。禁止整页空锚。不要把全盘灌进锚。
- 每个 angle: name + **strategy(2–3短段,空行分隔,禁单段字墙)** + means(1–6,用户可见「行动」)。
- **对方写法**：strategy 和 means 只写求问者自己能核对的步骤（时间、底线、范围、完成样貌）。对方只作议题框或现实约束。禁止把「让对方同意 / 说服对方」这一类从句写进来。删掉这种从句后，原来的核对步骤必须留下。禁止用一整句缺盘声明替换整段 means。共同决定时也一样。
- **06-C**：\`self_retune.body\` 至少写清一个你自己的节奏或停手线。缺了这一槽，本页不合格。
- **means 源(硬)**:user 侧【P3 科学手段候选菜单】是优先生长源;每条 means 须能回溯菜单中的帧/action_plan/收集事实 **或绑定摘要 means_candidate_ref**(可压缩改写)。禁止空喊通用职场鸡汤。
- 每维 strategy 须有一句**只对本案成立的结构由头**(删依据应垮);压缩模式须从锁定 unit_claim + professional_evidence 扎根;禁止复述 P1 落地三步全文;禁止机制链复述当策略。
- **禁止独立「开口/exact_script」槽**:若需可复述口径,写进 strategy 末段或 means **一条**一层示意(须贴本案角色与收集事实);**禁止**多拍对话分镜、**禁止**“…”逐字开口稿、**禁止**替对方写心理/台词。
- hard_metrics 可选。
- **禁止 alert / 页末「注意」槽**(熔断归 P5)。
- 【禁】英文系统口吻/提示词残片;禁 X%/Y%/Z% 半成品占位。
- 【跨页】不复读 P1 core_logic;辅轨各维只写与主轨不重复的一条动作。
- 【能量一致】若本案需养/过耗/官杀压身:主轨 means 优先在岗边界、会议减载、决策权上收、收复精力、可复用资产沉淀;禁止默认「耗竭后再堆第二份全职强度任务」。
- 【身份】大厂/多年专业经验:prefer Fractional Advisor / Consulting Micro-System / advisory seat;除非 covered_agenda 亲口要做,禁 crafts / side hustle / 手作等降维词。
- 【完成样貌】主轨至少一条 means 写做成什么样，细节从菜单收集事实生长。不要写成今晚清单或勾选作业。
- 【二元】angles 手段须用户可执行，并且是求问者自己的条件。对方只作现实约束或议题框。禁止让对方同意、说服对方、替对方写心理或台词。禁合盘翻版。
- strategy/means **零命理专名**。chart_anchors 仍须有本页短锚，不要留空数组。

${titleRules(tagZh, "点出博弈/打法名", "副题点步骤与可落实行动")}`;
}

/**
 * Fact-pack assign (step 1) — structure claims only.
 * Fill carries strategy/means; do not put life-action prose into unit_claim.
 */
export function buildAssignDuty(tagZh: string): string {
  return `# 本页派工任务 · 【${tagZh}】P3

# 本页最终交付什么
科学主辅各 3 维：strategy + means（可动手的执行行动力）。那是 **fill** 的事。

# 本步（派工）只做什么
为 primary_toolkit.angles[0–2] 与 backup_toolkit.angles[0–2] 各写一句 **本盘结构主张** + 事实档短摘录。
下一步专写按此主张写命理批断；再下一步 fill 从批断扎根 + 手段菜单长出 strategy/means（正文≠批断翻译）。

# 合格 unit_claim
- 含日主/柱干支/用喜忌/十神/合冲刑害/大运流年等结构记号。
- 可写用喜忌通关方向（用神水制火、食神制杀、金泄土等）——这是结构，不是职场手段。
- 神煞/十神只作盘上结构名（如「月德贵人在月柱」「将星在年支」），不写成能力或人格。
- 六张卡结构切入须彼此不同。

# 合格 calc_cite
从【本页切片】或【本地真算料】**原样连续**摘一段（可截断一行，不要改写）。
禁止把年柱+用神+大运等**多段改写拼成一句**。
禁止把 means 菜单里的职场白话（技术核心价值、利于和解与协议、赢得尊重等）当作 calc_cite。
**禁止**把 unit_claim 原句贴进 calc_cite——两字段必须不同。

# 禁止写进 unit_claim（留给 fill 的 means/strategy）
- 生活执行白话：求财、技术转化、不可急进、沟通协作、开口谈、兼职/全职/股权/律师协议、话语权、实际贡献、赢得尊重、以协议明确权益、以柔克刚等。
- **处境/议题结论白话**（闸门 claim_situation_paste）：勿把【处境材料】或问题里的表象收成主张尾巴（关系压力、内耗感受、输出变数、合作远景等生活结论）。写到干支·十神·合冲刑害·用喜忌·运岁为止；生活感受与决策留给 fill。
- 神煞能力说明书：「借贵人之谋略/魄力/和解/洞察」这类人格化写法。
本步写进主张 = 槽位错位；下游批断会被拖成执行案或处境复述。`;
}
