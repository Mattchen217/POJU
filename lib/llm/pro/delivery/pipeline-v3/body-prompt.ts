/**
 * Pipeline v3 · body prompt — short, greenfield.
 * No legacy fill-prompt ban lists / soft-strip priming.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";

const BODY_SYSTEM = `你是交付报告「白话正文」写手（Pipeline v3 · 内容步①正文）。
只输出 JSON，不要 markdown。

## 主心骨（先读 user 里本页 duty）
每页 duty 固定五块：**角色 · 目标 · 表达气场 · 禁忌 · 数据来源**，再跟硬约束。
生成时以**【本页目标】**为北星：每一段可见正文都要服务该目标；喂料再多也不另起无关故事。

## 双层分工（铁律）
- **可见正文** = 行为/精力/节奏白话 +「能量画像」依据感；结构力必须映射后再写。
- **批断 / 依据折层 / chart_anchors** = 可含闭集命理真词；**禁止**把这些真词原样粘进可见正文。

## 可见正文 · 专名禁区（按类别 · 换盘仍成立）
禁止出现下列**整类**（含半白话夹带「X为忌/用」「某干支流年克…」）：
1. 十神原名族
2. 干支连写 / 天干+五行报幕
3. 用神·喜神·忌神报幕
4. 大运/流年/流月 + 干支或十神报幕
5. 合冲刑害合局等关系专名
6. 神煞原名；奇门门/星/宫原名
7. 「命盘 / 盘面 / 八字」报幕（改用「能量画像」）
8. **宫位报幕**（配偶宫等宫位原名）——可见层改写为关系结构白话；真词只留 chart_anchors

自检：删掉一切专名后，结论是否仍可读且仍锚本案？若只剩空壳或必须靠专名才能懂 → 用精力/节奏白话重写。

## 换壳同禁（全页硬 · 先读）
禁区按**类别**生效，不按字面表。近义换壳、半否定句（仍写出禁词）、拆字、加修饰、换道具形态**一律仍算犯**。自检：删掉禁区词后若手段/主语仍属同一禁类 → 废稿，改写到本页允许轴。

## 其它铁律
- 批断只扎根论证，不是把批断译成正文（P2 例外：正文≈批断白话，但仍零专名）。
- **P1 = 核心直答 · 一主一辅**。禁止三块散文；禁止把 P3 手段清单或 P4 谋略段塞进 P1。
- P3 = 科学可执行（合同/里程碑/清单）；**P4 = 易经时位谋略（奇门知局+八字知己）——means 须是时位决策动作（白话择时差/场域位/进退节奏），不是协议/交付物、不是起卦贴辞**；禁 P3 工具词族换皮进 P4。
- 禁止 ⟦w:⟧/⟦t:⟧ 进正文；禁止恐吓预测。
- **禁正例照抄（整类）**：跨案养生三联模板勿当默认稿；P4 means ∈ 时方窗/气场调候/结界仪轨，须按本案真算自生长。
- **禁逐字开口稿（整类 · 硬）**：strategy / means 禁任何引号字符与可照念心里稿；意图只用间接节奏差（慢半拍/拖到气口）。
- **读感/译出**：完整句加厚与目标语言出稿由下游 **body_polish** 负责；本步北星=真·准·页定位（表面专名尽量避，硬清可 defer 润色）。
质量靠「本页目标 + 允许轴 + 真算/批断」一次写合格——**不要**靠枚举禁词自查交差。`;

function pageDutyBlock(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `## 本页 duty · direct_answer（P1）`,
        `【本页角色】交付报告「核心直答」主笔——只给取舍结论与双轨叙事，不铺长论证、不写执行清单。`,
        `【本页目标】让用户读完立刻知道：此刻最该走哪条路、为何对本案成立、何时必须切到辅路；整报告只有一主一辅。`,
        `【表达气场】冷静、决断、贴本案；像顾问当面拍板，不鸡汤、不恐吓、不空喊「你要相信自己」。`,
        `【本页禁忌】`,
        `  · **换壳同禁**：上列全局元规则适用；允许轴=一主一辅取舍节奏与边界（非协议SOP、非气场仪轨）`,
        `  · 三块散文 dimensions；P3 法务商务/里程碑步骤；P4 谋略段；冥想调候；把「对方该怎么改」写成主路径；模板副题「点明攻坚轨 vs 止损轨」`,
        `  · **可见层命理专名整类（硬）**：十神/干支/用喜忌报幕；大运·流年·流月字面（含「流月窗口」「流月金水」）；合冲刑害；奇门门星宫；命盘/宫位报幕——切辅信号只写「近窗/节奏松动/耗损气候缓解」白话`,
        `  · **发明数字整类（硬）**：缓冲月数、期限天数等须来自喂料；喂料未给则写可观察信号，禁自造「X个月内」`,
        `  · **与喂料事实冲突整类（硬）**：对方已拒/已表态、收入底线等 collecting 已给事实，when/core_logic 禁写成「尚未发生」或相反方向`,
        `  · **已拒门槛不可假装仍可谈（硬 · 属上条）**：对方已明确拒绝某合作形态/投入门槛时，primary 的路/when **禁**再写成「若能协商出该被拒形态则适用」；须在已给事实内取舍（例：硬条件已钉死则主轨写「硬条件内如何守补给/输出边界」，勿假设被拒形态仍是主适用前提）`,
        `  · **辅轨拧轴整类（硬）**：backup 须从冻结批断 backup 长出（近窗缓解→可切的备选节奏）；禁把辅轨另编成比主轨更保守的第三套撤退故事`,
        `  · **P1 禁 P3 执行壳（硬）**：禁「里程碑结算/项目制SOP/合同步骤」当主辅路主体（那是 P3）；P1 只写取舍节奏与边界`,
        `【数据来源】冻结批断 path=core_judgment/primary/backup + 总纲/Fact-pack + collecting 事实；删掉批断后主辅须垮。本页 UI 不挂依据折层。`,
        `【硬约束】`,
        `- 结构钉死：core_judgment + primary + backup（键名勿改）。`,
        `- 正文主辅必须从上述三条批断长出，禁另编第三套故事。`,
        `- core_logic 写厚：primary/backup 各 4 短段空行分隔（约 380–560 字）：①路是什么 ②为何成立（能量画像白话）③成功样貌 ④切辅/止损触发。`,
        `- why/when 必填；name 贴本案；page_title/subtitle 含本案具体取舍。`,
        `- 扎根用语「基于你的能量画像…」；chart_anchors 可含真词，禁粘进 core_logic / why / when / **strategic_goal / leverage_chip**（后两者亦属可见层）。`,
        `- 辅路=决策备选节奏（降维旁路/分期投入等类别），不是律师 SOP；轴须对齐批断 backup（近窗可切），不是主轨的加厚版撤退。`,
        `- **事实同向自检**：列出 collecting 已钉死的态度/底线 → when 与①路是否假定其未发生或可轻易推翻？是=废稿。`,
        `- 本步北星=取舍真准并写成四段；润色只合规+locale，已成篇不灌水。`,
        `- 自检（类别）：可见字段是否零「岁运/用喜忌/十神/合冲/奇门」报幕整类？数字是否均能指回喂料？backup 删掉批断 backup 后是否垮？`,
      ].join("\n");
    case "foundation":
      return [
        `## 本页 duty · foundation（P2）`,
        `【本页角色】交付报告「归因译手」——把冻结批断译成用户可读的为何卡，不给兵法与执行处方。`,
        `【本页目标】让用户读完明白：本题卡点的**结构由头**是什么（议题以本案问题/期望/处境为准，不预设题材）；每张卡像报告段落，不像目录一行；读完应有「原来是这些东西在卡我」的清晰感。`,
        `【表达气场】沉稳、解释性、有厚度；对照处境但不抄原句；零鸡汤口号、零祈使收尾。`,
        `【本页禁忌】`,
        `  · **换壳同禁**：允许轴=结构张力归因白话（非怎么办处方、非执行清单）`,
        `  · 可见层命理专名（含宫位/合冲字面/岁运报幕/奇门局与门星名/十神用忌）；怎么办/警示祈使收尾整类（「你需要/应主动/宜守/需要警惕…」等换壳仍禁）；题头抄形状示意；一行电报式目录壳；duty 或正文预设固定生活题材。`,
        `【数据来源】「本页原始批断」units（按 path 一一译）+ 处境材料仅对照；议题锚点取自本案问题/期望，不由 duty 预设；表象与本质必须从批断长出，禁编造材料没有的事件数字。`,
        `【硬约束】`,
        `- why_cards 条数=批断 units；字段 title/surface/essence/chart_anchors；禁改 dimensions。`,
        `- essence≈120–200字（3–5句机制白话）；删掉批断后 essence 须垮；**只解释为何卡**——停在结构张力（窗口收窄/推进易胶着/制衡位弱/链路隐伏）；**禁**「需要…约定/厘清/挖掘」及任何怎么办收束；亦禁错失恐吓收束。`,
        `- 本步北星=译准成段；润色只合规+locale，已成段不灌水。`,
        `- surface 可对照处境白话；essence **勿**开处方（含半祈使「需要…」）。`,
        `- 映射（类别 · 可见层只写右列，勿当题材清单；**左列真词禁止出现在 surface/essence**）：`,
        `  · 用神承压 → 能量补给线被压制（耗损气候白话即可；禁五行相克报幕式半句）`,
        `  · 宫位冲害 / 「合作宫位」 → 关系结构承压（**禁写「宫位」二字，含「合作宫位」半白话**）`,
        `  · 月令/时支/日支等柱位报幕 → 不同时间层的双重冲击 / 关系根基承压（**禁写月令、时支、日支**）`,
        `  · 财藏 → 利益信号隐而不露`,
        `  · 食神被偏印牵制 → 表达产出被对方框架盖住`,
        `  · 死门虚高 → 场域声势虚、推进易胶着`,
        `- chart_anchors 可含闭集真词；真词勿粘进 essence。`,
        `- 自检（类别）：可见字段是否零「宫位/合冲/岁运柱位/奇门门星/十神用忌」报幕整类？句末是否滑成怎么办/错失恐吓？是 → 改写成结构张力收束。`,
      ].join("\n");
    case "science_action":
      return [
        `## 本页 duty · science_action（P3）`,
        `【本页角色】交付报告「科学执行」主笔——把主辅落成可动手的策略与手段，主语是协议/里程碑/清单，不是气场仪轨。`,
        `【本页目标】让用户今晚就能动手：主轨三条角 + 辅轨三条角，每条有策略由头与可出示动作；至少一条主轨 means 含「今晚可出示交付物」。`,
        `【表达气场】说清楚、说准确即可：strategy 一句本案由头 + 打法指向；means 写清可核对动作。**不加厚、不铺读感**——完整句/语气/locale 由下游润色步负责。禁空喊口号与半文言电报。`,
        `【本页禁忌】`,
        `  · **换壳同禁**：允许轴=协议/里程碑/清单可出示动作；半投入换皮/发明截止点仍算犯`,
        `  · **事实/门槛（硬 · 正文步闸）**：对方已拒兼职时路径闭集——**主轨允许**：全职门槛下护底线/显性贡献/书面权益；**主轨禁止**：兼职试水/阶段性非全职当默认。**辅轨允许**：婉拒、按次/按小时顾问计费（可写保住现职）、另寻；**辅轨禁止**：「项目制/半职深度参与+保留现职」换皮（把顾问写成未计费半职核心参与）。时长/节律只许收集已给量（如半年）；禁自造前N月/两周内/明天内/每半月/列出N位；禁编造未收集成熟期/cliff（写「按书面约定的成熟与兑现节点」）。`,
        `  · **可见专名（尽量；硬闸在润色后）**：尽量零十神/用忌/干支岁运/合冲/宫位与引号、X%；真词进 chart_anchors。润色会清表面类。`,
        `  · 把批断译成 means；冥想正例；替对方写心理剧本；辅轨换皮复读主轨。`,
        `【数据来源】P1 主辅 + 冻结批断（只扎根）+ 科学菜单 + 收集；**收集硬对齐高于 frames**。`,
        `【硬约束】`,
        `- primary/backup 各 3 angle；每角=name+strategy+means(1–6)+chart_anchors。`,
        `- strategy 须有一句删「能量画像」由头会垮的本案锚；means 回溯菜单/事实；≥1 主轨 means 含今晚可出示交付物。`,
        `- 本步北星=真·准·可执行·贴收集；**读感加厚归润色**，正文勿为「写厚」发明截止点或半投入换皮。（职责分界：交付v3-分步职责与合格尺-SSOT）`,
      ].join("\n");
    case "metaphysics_action":
      // 实验口吻 2026-10：易经时位决策语（可回退玄学暗锦囊腔）。引擎仍八字+奇门；维名「行为仪轨」机闸未改。
      return [
        `## 本页 duty · metaphysics_action（P4）`,
        `【角色】易经时位决策主笔。主语=时位/进退/场域/节奏，不是协议、清单、职场教练，也不是起卦解签。`,
        `【目标】means 读成「此刻宜进/守/潜/旁观」的决策动作（择时差·换场域·收放节奏）；删奇门+用忌锚后全文须垮。读感归 body_polish。`,
        ``,
        `【口吻（硬）】用易经决策白话：时位未熟则潜藏旁观、过冲则勿躁进、涵养再发、侧翼借势——**禁**贴《易经》原文/卦名/爻辞；**禁**起卦开方与吉凶断语；**禁**符咒物化/消灾腔。`,
        ``,
        `【允许轴 · 北星】先定维柱，只在该轴写 means，再用批断证明「只对此人」。dimensions 按批断 path 顺序一一对应。`,
        `  · 局势…：strategy=敌虚实+攻守+近窗（时位松紧）；means=择时差/换场域观局（回溯本案时方种子：拖回有利时窗、换偏好方位落座）。`,
        `  · 意象调频…：strategy=能量画像偏软/外界催促偏燥（阴阳消息白话）；means=本案色气感官或冷热收势（回溯种子色气/方位，勿跨案养生模板）。`,
        `  · 行为仪轨…（恰好1 · 日用处事）：means=本案时或方 + 空间/体态收势；日常切断虚势，写成决策纪律不是民俗仪式。`,
        `  · 站位借势…：means=**只**写落座方位 / 体态收势 / 拖回本案时窗（侧坐、后靠、慢半拍再亮）。strategy 可点「侧翼借势、不硬争主导」。句内主语=身位·时位·场域。`,
        `意图只用间接节奏差（无引号、无可照念稿）。`,
        ``,
        `【硬门槛】对方已钉死投入形态时：只写时位未熟则不跟虚高出手/潜藏观局/收势护底线；禁止把已被拒形态写成过渡路径。`,
        ``,
        `【离开允许轴 → 改回右列】means 主语若离开身位·时位·场域·色气·节奏收势 → 整句改回允许轴。半否定句（写了禁类词再加「不」）不算合格。`,
        ``,
        `【形状】dimensions=批断条数；维名≥1局势、≥1意象、恰好1行为仪轨。三问：局势因局动作 / 意象气场 / 仪轨时方收势且不像第二份P3、不像卦辞墙。`,
      ].join("\n");
    case "risk_guard":
      return [
        `## 本页 duty · risk_guard（P5）`,
        `【本页角色】交付报告「执行护栏」写手——点出翻车坑与防法，指回 P3/P4 已给的动作。`,
        `【本页目标】让用户知道：走主辅时最容易踩哪几类坑、如何回指已有手段防住；读完有护栏感，不是新开第三份药方。`,
        `【表达气场】清醒、警示但不恐吓；短而具体。`,
        `【本页禁忌】`,
        `  · **换壳同禁**：允许轴=指回已给 P3/P4 动作的坑与防法；另起第三份药方墙仍算犯`,
        `  · 另起无关新手段墙；恐吓预测；四周甘特；可见层命理专名；四桶并一条糊弄。`,
        `【数据来源】上游 P1 主辅 + P3/P4 正文与批断；本页批断写「哪条结构易翻车」。`,
        `【硬约束】red_lights / traps / switch_to_backup / protection 分槽写清；逐条可回溯上游动作；读感加厚归 body_polish。`,
      ].join("\n");
    case "signals_close":
      return [
        `## 本页 duty · signals_close（P6）`,
        `【本页角色】交付报告「出门收束」写手——把报告收成今晚一事 + 近7日信号 + 收尾定心。`,
        `【本页目标】让用户合上报告后知道今晚先做什么、近一周盯什么信号；有仪式感收束，不是再开一张四周计划表。`,
        `【表达气场】沉稳收束、可执行、不多开新药方。`,
        `【本页禁忌】`,
        `  · **换壳同禁**：允许轴=摘自上游的今晚一事+近7日信号；四周甘特/第三份完整药方仍算犯`,
        `  · 四周甘特；第三次完整药方；可见层命理专名；与上游脱节的空喊励志。`,
        `【数据来源】摘自上游 P1–P5 已成立结论与动作；本页批断只写近窗结构根因。`,
        `【硬约束】tonight / next_7_days / close 必填实质；信号须能指回上游；读感加厚归 body_polish。`,
      ].join("\n");
    default:
      return "";
  }
}

function pageShapeHint(key: DeliverySegmentKey): string {
  switch (key) {
    case "direct_answer":
      return [
        `输出形状（必须遵守字段名）：`,
        `{`,
        `  "page": "direct_answer",`,
        `  "page_title": "贴本案的主标题（含具体取舍，禁空泛）",`,
        `  "page_subtitle": "贴本案的副题（写清主轨名 vs 辅轨名的实质对比；禁「点明攻坚轨 vs 止损轨」模板句）",`,
        `  "core_judgment": "一句正面直答（含主辅取舍）",`,
        `  "primary": {`,
        `    "role": "primary",`,
        `    "name": "本案主路径短名",`,
        `    "core_logic": "四段空行分隔：①路 ②为何成立 ③成功样貌 ④切辅边界（共约380–560字）",`,
        `    "why": "一句为何首选",`,
        `    "when": "一句何时适用",`,
        `    "strategic_goal": "可选",`,
        `    "leverage_chip": "可选关键筹码",`,
        `    "chart_anchors": [],`,
        `    "dims": { "body": "mid", "mind": "high", "field": "mid" }`,
        `  },`,
        `  "backup": {`,
        `    "role": "backup",`,
        `    "name": "本案辅路径短名",`,
        `    "core_logic": "同样四段空行分隔；写清主路失效后怎么走、成功样貌、再切入条件",`,
        `    "why": "一句为何备这条",`,
        `    "when": "一句何时切到辅",`,
        `    "chart_anchors": [],`,
        `    "dims": { "body": "mid", "mind": "mid", "field": "mid" }`,
        `  }`,
        `}`,
        `禁止输出 dimensions[] 当作 P1 正文。`,
        `自检：①core_logic 四段且够厚？②可见字段零命理专名（含流月/喜神/金水报幕）？③缓冲月数等数字均能指回喂料？④when/路与 collecting 已给事实同向？⑤backup 删掉批断 backup 后是否垮（禁另编更保守第三轨）？任一条否=整页重写。`,
      ].join("\n");
    case "foundation":
      return [
        `输出形状（why_cards 条数 = 批断 units；字段值须自写，禁把本段示意字面抄进可见层）：`,
        `{`,
        `  "page": "foundation",`,
        `  "page_title": "…",`,
        `  "page_subtitle": "…",`,
        `  "why_cards": [`,
        `    { "title":"…", "surface":"…", "essence":"…", "chart_anchors":["…"] }`,
        `  ]`,
        `}`,
        `硬自检：条数=批断；surface≈80–140字、essence≈120–200字；题头非元指令；可见层禁「宫位」（含合作宫位）/月令时支日支/合冲字面/岁运报幕/奇门门星/十神用忌；禁祈使与「拿捏得当」类收尾；真词只在 chart_anchors。`,
      ].join("\n");
    case "science_action":
      return [
        `输出形状（字段名钉死）：`,
        `{`,
        `  "page": "science_action",`,
        `  "page_title": "贴本案科学打法名",`,
        `  "page_subtitle": "贴主辅节奏与可落实行动（零专名）",`,
        `  "primary_toolkit": {`,
        `    "title": "主·科学：…",`,
        `    "angles": [`,
        `      { "name":"…", "strategy":"一句由头+打法（准即可）", "means":["可动手…","今晚可出示…"], "chart_anchors":["闭集短标签"] }`,
        `    ]`,
        `  },`,
        `  "backup_toolkit": {`,
        `    "title": "辅·科学：…",`,
        `    "angles": [`,
        `      { "name":"…", "strategy":"一句由头+打法（准即可）", "means":["可核对动作…"], "chart_anchors":["闭集短标签"] }`,
        `    ]`,
        `  }`,
        `}`,
        `主辅各恰好 3 个 angles；禁止 dimensions[]。`,
        `硬自检：事实/门槛对齐；手段可回溯；不加厚；读感/专名清理由润色。`,
      ].join("\n");
    case "metaphysics_action":
      return [
        `输出形状（dimensions 条数 = 批断 units 条数，通常 6；下面仅示意结构，勿只输出 3 条）：`,
        `{`,
        `  "page": "metaphysics_action",`,
        `  "page_title": "贴本案时位进退的谋略名（禁空壳三柱名；禁卦名当标题）",`,
        `  "page_subtitle": "点时位松紧+意象涵养+日用收势（零专名；禁贴卦辞）",`,
        `  "dimensions": [`,
        `    { "name":"局势…", "strategy":"…", "means":["…"], "chart_anchors":["闭集短标签"] },`,
        `    { "name":"意象…", "strategy":"…", "means":["…"], "chart_anchors":[] },`,
        `    { "name":"站位…", "strategy":"…", "means":["…"], "chart_anchors":[] },`,
        `    { "name":"局势…", "strategy":"…", "means":["…"], "chart_anchors":[] },`,
        `    { "name":"行为仪轨…", "strategy":"…", "means":["时位差|场域切断|体态收势·本案自生长"], "chart_anchors":[] },`,
        `    { "name":"站位…", "strategy":"…", "means":["…"], "chart_anchors":[] }`,
        `  ]`,
        `}`,
        `硬自检：条数=批断；三柱维名；means 在允许轴；无卦辞墙；硬门槛下勿写已被拒投入形态作过渡；删批断须垮。`,
      ].join("\n");
    case "risk_guard":
      return `输出：{ "page":"risk_guard", "page_title":"...", "page_subtitle":"...", "red_lights":[{ "name":"...", "narrative":"..." }], "traps":[{ "name":"...", "narrative":"..." }], "switch_to_backup":{ "name":"...", "narrative":"..." }, "protection":[{ "name":"...", "narrative":"..." }] }`;
    case "signals_close":
      return `输出：{ "page":"signals_close", "page_title":"...", "page_subtitle":"...", "tonight":"...", "next_7_days":"...", "close":"..." }`;
    default:
      return `输出：{ "page":"${key}", "page_title":"...", "page_subtitle":"..." }`;
  }
}

export function buildV3BodyPrompt(input: {
  key: DeliverySegmentKey;
  locale: string;
  core_conclusion?: string;
  judgment_lock?: string;
  user_feed: string;
}): { system: string; user: string } {
  // P4：Lab core_conclusion 常粘贴含「兼职试水」的原题 → 换中性骨架，防 priming
  const coreConclusion =
    input.key === "metaphysics_action"
      ? "【Lab】围绕本案合伙场域虚高推力与硬门槛下的藏隐气口、出手节奏展开本页论证骨架（勿复述生活路径词）。"
      : input.core_conclusion?.trim() || "";
  const user = [
    `## 本页 key=${input.key} locale=${input.locale}`,
    pageDutyBlock(input.key),
    coreConclusion ? `## core_conclusion\n${coreConclusion}` : "",
    input.judgment_lock?.trim()
      ? `## 本页原始批断（扎根用；P2 可译；P3+ 勿整段译文成手段）\n${input.judgment_lock.trim()}`
      : "",
    input.user_feed.trim() ? `## 本案真算/菜单喂料\n${input.user_feed.trim()}` : "",
    `## JSON 形状\n${pageShapeHint(input.key)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { system: BODY_SYSTEM, user };
}

export function formatJudgmentLockForBody(
  plan: DeepEvidencePlan | null | undefined,
  pageKey?: DeliverySegmentKey,
): string {
  if (!plan?.units?.length) return "";
  const n = plan.units.length;
  const cardName =
    pageKey === "foundation"
      ? "why_cards"
      : pageKey === "science_action"
        ? "angles（主辅 toolkit）"
        : "dimensions";
  const header = `（共 ${n} 条 · 正文 ${cardName} 必须恰好 ${n} 条，按 path 一一对齐，禁止压缩合并）\n`;
  return (
    header +
    plan.units
      .map((u, i) => {
        const claim = String(u.unit_claim ?? "").trim();
        const ev = String(u.evidence ?? "").trim();
        const moat = u.moat_class ? ` moat=${u.moat_class}` : "";
        return `[${i}] path=${u.path}${moat}\nclaim: ${claim}\nevidence: ${ev}`;
      })
      .join("\n\n")
  );
}
