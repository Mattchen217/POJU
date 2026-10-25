/**
 * Pipeline v3 · body prompt — short, greenfield.
 * No legacy fill-prompt ban lists / soft-strip priming.
 */

import type { DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import type { DeepEvidencePlan } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-call";
import { deepEvidenceUnitSpec } from "@/lib/llm/pro/delivery/page-schema/deep-evidence-prompt";
import { TEMPLATE_VOICE_DUTY_LINE, templateVoicePromptBlock } from "@/lib/llm/pro/delivery/pipeline-v3/template-voice";
import {
  INVENTED_USER_NUMBER_DUTY_LINE,
  inventedUserNumberPromptBlock,
} from "@/lib/llm/pro/delivery/pipeline-v3/invented-user-number";
import {
  INVENTED_PARTNER_CHART_DUTY_LINE,
  inventedPartnerChartPromptBlock,
} from "@/lib/llm/pro/delivery/pipeline-v3/invented-partner-chart";

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
质量靠「本页目标 + 允许轴 + 真算/批断」一次写合格——**不要**靠枚举禁词自查交差。

${templateVoicePromptBlock("zh")}
${inventedUserNumberPromptBlock("zh")}
${inventedPartnerChartPromptBlock("zh")}
`;

function pageDutyBlock(key: DeliverySegmentKey): string {
  switch (key) {
    case "decision_brief":
      return [
        `## 本页 duty · direct_answer（P1 · v1=decision_brief 决策简报）`,
        `【本页角色】交付报告「决策简报」主笔——两分钟给出真问题、主判断、推荐方向与最近一步；不铺长论证、不写执行清单。`,
        `【本页目标】让用户读完立刻知道：此刻最该走哪条路、为何对本案成立、何时必须切到辅路；整报告只有一主一辅。`,
        `【表达气场】冷静、决断、贴本案；像顾问当面拍板，不鸡汤、不恐吓、不空喊「你要相信自己」。`,
        `【本页禁忌】`,
        `  · **换壳同禁**：上列全局元规则适用；允许轴=一主一辅取舍节奏与边界（非协议SOP、非气场仪轨）`,
        TEMPLATE_VOICE_DUTY_LINE,
        `  · 三块散文 dimensions；P3 法务商务/里程碑步骤；P4 谋略段；冥想调候；把「对方该怎么改」写成主路径；模板副题「点明攻坚轨 vs 止损轨」`,
        `  · **可见层命理专名整类（硬）**：十神/干支/用喜忌报幕；大运·流年·流月字面（含「流月窗口」「流月金水」）；合冲刑害；奇门门星宫；命盘/宫位报幕——切辅信号只写「近窗/节奏松动/耗损气候缓解」白话`,
        `${INVENTED_USER_NUMBER_DUTY_LINE}`,
        `${INVENTED_PARTNER_CHART_DUTY_LINE}`,
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
        `- **#9 期望钉死（硬）**：开篇（core_judgment/主辅 name·why）须点名用户陈述的期望；至少一处引用收集事实（角色/期限/对方行为）；决策备忘口气非能量手册。`,
        `- 自检（类别）：可见字段是否零「岁运/用喜忌/十神/合冲/奇门」报幕整类？数字是否均能指回喂料（#11）？solo/absent 是否零对方日主/大运/合盘分数（#13）？backup 删掉批断 backup 后是否垮？`,
      ].join("\n");
    case "situation_analysis":
    case "foundation":
      return [
        `## 本页 duty · situation_analysis（处境与问题诊断）`,
        `【本页角色】「处境与障碍」译手——把冻结批断译成：问题结构、与本题相关的决策模式、优先障碍。不给执行处方。`,
        `【本页目标】读完明白：①表层 vs 深层问题；②这类决策上为何易卡（模式非泛人格）；③最值得先解的障碍。每张卡像报告段落；有「原来是这些在卡我」的清晰感。`,
        `【表达气场】沉稳、解释性、有厚度；对照处境但不抄原句；零鸡汤口号、零祈使收尾。`,
        `【本页禁忌】`,
        `  · **换壳同禁**：允许轴=结构张力归因白话（非怎么办处方、非执行清单）`,
        TEMPLATE_VOICE_DUTY_LINE,
        `  · 可见层命理专名（含宫位/合冲字面/岁运报幕/奇门局与门星名/十神用忌）；怎么办/警示祈使收尾整类；题头抄形状示意；一行电报式目录壳；预设固定生活题材；泛泛全盘性格报告；把命理写成已证实心理测量。`,
        `【数据来源】「本页原始批断」units（按 path 一一译）+ 处境/收集材料对照；表象与本质从批断长出，禁编造材料没有的事件数字。`,
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
    case "personal_decision_patterns":
      return [
        `## 本页 duty · personal_decision_patterns（个人决策模式）`,
        `【角色】解释用户在本题上如何判断/反应（非泛人格）。`,
        `【目标】1–3 短卡：模式 + 可纠正假设；区分事实/行为证据/命理解释。`,
        `【禁忌】全盘性格报告；把命理写成已证实心理测量；怎么办处方。`,
        `【硬约束】why_cards 1–3；essence 停在模式机制；chart_anchors 可含真词勿粘可见层。`,
      ].join("\n");
    case "bottleneck_analysis":
      return [
        `## 本页 duty · bottleneck_analysis（核心障碍）`,
        `【角色】识别最值得优先处理的 1–3 个障碍。`,
        `【目标】成因/维持机制/相互影响；可控 vs 暂不可控；解除哪个最可能改局面。不复读处境章。`,
        `【禁忌】执行处方；复读 situation 全文；泛泛列十个问题。`,
        `【硬约束】why_cards 1–3；每卡一障碍；删批断须垮。`,
      ].join("\n");
    case "strategic_options":
      return [
        `## 本页 duty · strategic_options（战略选项比较）`,
        `【角色】让用户看清 2–4 条现实路径的代价，而非只接受单一答案。`,
        `【目标】每选项：收益/成本/风险/可逆性；成立前提与失效条件。可含维持现状/小试验。`,
        `【禁忌】编造第四条假路；写成执行任务表；奇门仪轨。`,
        `【硬约束】options 2–4；每项须能指回批断或收集事实；科学轨=决策/经济/概率权衡。`,
      ].join("\n");
    case "recommended_strategy":
      return [
        `## 本页 duty · recommended_strategy（主策略与备选）`,
        `【角色】有理由有边界的主路径 + 切换/退出条件——付费核心。`,
        `【目标】主路径理由；备选与何时切换；前提/依赖；应放弃什么；停止触发。`,
        `【禁忌】第二份执行清单；与 decision_brief 拧轴；辅轨另编第三套故事。`,
        `【硬约束】core_judgment + primary + backup；从 synthesis/批断长出；命理轨承重主路径。`,
      ].join("\n");
    case "execution_guidance":
      return [
        `## 本页 duty · science_action（P3 · v1=战略选项+主策略+执行原则）`,
        `【本页角色】「策略与执行」主笔——对外做事：路径比较感 + 主辅策略 + 执行原则与可立即采取的示例动作。主语=协议/里程碑/清单/验证实验，不是气场仪轨。`,
        `【本页目标】带走：为何选这条主路、辅路何时切；现阶段优先验证/推进什么；可立刻做的动作与完成标准；推进/调整/停止条件。**禁止**固定 30 天/按周任务表（一次性产品无跟踪）。主轨三条角 + 辅轨三条角；≥1 主轨 means 含今晚可出示交付物或低成本验证。`,
        `【表达气场】说清楚、说准确：strategy=本案由头+打法；means=可核对动作或执行原则。禁空喊与半文言。读感加厚归润色。`,
        `【本页禁忌】`,
        `  · **换壳同禁**：允许轴=协议/里程碑/清单/低成本验证；半投入换皮/发明截止点/四周甘特仍算犯`,
        TEMPLATE_VOICE_DUTY_LINE,
        `  · **事实/门槛（硬 · 正文步闸）**：对方已拒兼职时路径闭集——**主轨允许**：全职门槛下护底线/显性贡献/书面权益；**主轨禁止**：兼职试水/阶段性非全职当默认。**辅轨允许**：婉拒、按次/按小时顾问计费（可写保住现职）、另寻；**辅轨禁止**：「项目制/半职深度参与+保留现职」换皮。时长只许收集已给量；禁自造前N月/两周内等 cliff。`,
        `  · **可见专名（尽量）**：零十神/用忌/干支岁运/合冲/宫位；真词进 chart_anchors。`,
        `  · 把批断译成 means；冥想正例；替对方写心理剧本；辅轨换皮复读主轨；「增强行动力」空建议。`,
        `【数据来源】P1 主辅 + 冻结批断 + 科学菜单 + 收集；**收集硬对齐高于 frames**。现代学科用于权衡与执行设计，不宣称验证八字。`,
        `【硬约束】`,
        `- primary/backup 各 3 angle；每角=name+strategy+means(1–6)+chart_anchors。`,
        `- strategy 须有一句删「能量画像」由头会垮的本案锚；means 回溯菜单/事实；≥1 主轨 means 含今晚可出示交付物或低成本验证。`,
        `- 本步北星=真·准·可执行·贴收集；禁为「写厚」发明截止点。`,
      ].join("\n");
    case "self_regulation":
      // v1=self_regulation；引擎仍八字+奇门；对己调频，非第二份 P3
      return [
        `## 本页 duty · metaphysics_action（P4 · v1=self_regulation 自我调频）`,
        `【角色】**对己**调频主笔——执行中如何维持判断力、节奏与行动能力。主语=身心/节奏/场域/进退，不是协议清单，也不是起卦解签。`,
        `【目标】means 读成压力下如何识别冲动/拖延、何时暂停重大决定、如何用可重复调节稳住自己；可含本案时位/意象/轻仪轨（须个性化）。删奇门+用忌锚后全文须垮。`,
        ``,
        `【与 P3 分界（硬）】本页不是第二份策略与执行。挪到 P3 应违和。禁复读合同/股权/里程碑/交付物词族。`,
        ``,
        `【口吻】时位进退的**现代决策白话**，不是半文言电报。`,
        `  · 允许：窗口未熟先别冲、对方虚高先旁观、气太燥先收——完整口语句。`,
        `  · **禁**卦名爻辞/吉凶断语/符咒物化；**禁**声称五行气场确定改结果；**禁**跨案养生三联（深呼吸/温凉饮/背靠实墙换壳同禁）。`,
        TEMPLATE_VOICE_DUTY_LINE,
        `  · **禁半文言电报**：strategy≥2 完整句；means≥1 完整句且「做什么+为何此刻」。维名白话（两边胶着/窗口收窄）；禁主客/门宫原名。`,
        ``,
        `【允许轴】dimensions 按批断 path 一一对应：局势/进退观局；意象调频（色气冷热收势）；行为仪轨恰好1（时方+体态收势）；可写情绪驱动识别/信息限制/重大决定前暂停（行为科学口径，非临床）。`,
        `【硬门槛】对方已钉死投入形态时：未熟别跟虚高/先旁观/先收底线；禁止把已被拒形态写成过渡路径。`,
        `【形状】dimensions=批断条数；≥1 局势感、≥1 意象、恰好1 仪轨向；不像第二份P3、不像卦辞墙。`,
      ].join("\n");
    case "validation_risk":
      return [
        `## 本页 duty · risk_guard（P5 · v1=validation_review 风险与验证）`,
        `【本页角色】风险与验证写手——翻车坑、红灯、退出条件；指回 P3/P4 已给动作。`,
        `【本页目标】走主辅时最易踩哪类坑、何信号说明原判断可能错、何时切辅/停止；不是第三份药方。大变口径=新购 PASS，非回访改旧报告。`,
        `【表达气场】清醒、警示但不恐吓；短而具体。`,
        `【本页禁忌】`,
        `  · **换壳同禁**：允许轴=指回已给 P3/P4 动作的坑与防法；另起第三份药方墙仍算犯`,
        TEMPLATE_VOICE_DUTY_LINE,
        `  · 另起无关新手段墙；恐吓预测；四周甘特；可见层命理专名；四桶并一条糊弄。`,
        `【数据来源】上游 P1 主辅 + P3/P4 正文与批断（及 Action Brief）；本页批断写「哪条结构易翻车」。`,
        `【硬约束】red_lights / traps / switch_to_backup / protection 分槽写清；逐条可回溯上游已给动作。时长只保留收集已给量。四桶勿塌成同一条停法。`,
      ].join("\n");
    case "validation_close":
      return [
        `## 本页 duty · signals_close（P6 · v1=validation_review 行动收束）`,
        `【本页角色】行动收束写手——身份对照 + 金句 + 可观察信号 + 今晚一事 + 近阶微清单 + 带走三样。一次性收尾，无回来追踪钩子。`,
        `【本页目标】对照哪些信号、今晚先做什么、近阶勾哪几条、带走哪三句；不是四周计划表，也不是任务催办。`,
        `【表达气场】沉稳收束、可执行、不多开新药方。`,
        `【本页禁忌】`,
        `  · **换壳同禁**：允许轴=摘自上游与本页批断扎根的出门动作/信号；四周甘特/第三份完整药方仍算犯`,
        TEMPLATE_VOICE_DUTY_LINE,
        `  · 四周甘特；第三次完整药方；可见层命理专名；空喊励志；对照信号写成新动作清单或复读 P5 切辅叙事。`,
        `  · **收集精力边界不同向**：用户已钉的本周第一步，day7 或今晚须至少一条同向承接。`,
        `【数据来源】上游 P1–P5 + 本页批断 + 出门菜单；收集只供时限/精力边界同向。`,
        `【硬约束】身份对照三槽 + 金句 + watch_signals 恰好3–5（只观察）+ 今晚闭环 + day7 恰好4 + takeaways 恰好3；删批断后须垮；禁四周甘特腔。`,
      ].join("\n");
    default:
      return "";
  }
}

function pageShapeHint(key: DeliverySegmentKey): string {
  switch (key) {
    case "decision_brief":
      return [
        `输出形状（必须遵守字段名）：`,
        `{`,
        `  "page": "decision_brief",`,
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
    case "situation_analysis":
    case "foundation":
      return [
        `输出形状（why_cards 条数 = 批断 units；字段值须自写，禁把本段示意字面抄进可见层）：`,
        `{`,
        `  "page": "situation_analysis",`,
        `  "page_title": "…",`,
        `  "page_subtitle": "…",`,
        `  "why_cards": [`,
        `    { "title":"…", "surface":"…", "essence":"…", "chart_anchors":["…"] }`,
        `  ]`,
        `}`,
        `硬自检：条数=批断（通常 4）；surface≈80–140字、essence≈120–200字；可见层零命理专名；真词只在 chart_anchors。`,
      ].join("\n");
    case "personal_decision_patterns":
      return [
        `输出形状：`,
        `{ "page":"personal_decision_patterns", "page_title":"…", "page_subtitle":"…",`,
        `  "why_cards":[ { "title":"…", "surface":"…", "essence":"…", "chart_anchors":[] } ] }`,
        `硬自检：1–3 卡；模式+可纠正假设；禁泛人格报告；禁怎么办处方。`,
      ].join("\n");
    case "bottleneck_analysis":
      return [
        `输出形状：`,
        `{ "page":"bottleneck_analysis", "page_title":"…", "page_subtitle":"…",`,
        `  "why_cards":[ { "title":"…", "surface":"…", "essence":"…", "chart_anchors":[] } ] }`,
        `硬自检：1–3 障碍卡；不复读处境章；禁执行处方。`,
      ].join("\n");
    case "strategic_options":
      return [
        `输出形状：`,
        `{ "page":"strategic_options", "page_title":"…", "page_subtitle":"…",`,
        `  "options":[ { "name":"…", "summary":"…", "upside":"…", "cost":"…", "risk":"…", "reversibility":"…", "chart_anchors":[] } ] }`,
        `硬自检：2–4 选项；禁编造假路；禁任务表。`,
      ].join("\n");
    case "recommended_strategy":
      return [
        `输出形状：`,
        `{ "page":"recommended_strategy", "page_title":"…", "page_subtitle":"…",`,
        `  "core_judgment":"…",`,
        `  "primary":{ "name":"…", "why":"…", "when":"…", "exit":"…", "chart_anchors":[] },`,
        `  "backup":{ "name":"…", "why":"…", "when":"…", "exit":"…", "chart_anchors":[] } }`,
        `硬自检：主辅与 brief 同轴；有前提/退出；禁第二份执行清单。`,
      ].join("\n");
    case "execution_guidance":
      return [
        `输出形状（字段名钉死）：`,
        `{`,
        `  "page": "execution_guidance",`,
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
    case "self_regulation":
      return [
        `输出形状（dimensions 条数 = 批断 units 条数，通常 6；下面仅示意结构，勿只输出 3 条）：`,
        `{`,
        `  "page": "self_regulation",`,
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
    case "validation_risk":
      return `输出：{ "page":"validation_risk", "page_title":"...", "page_subtitle":"...", "red_lights":[{ "name":"...", "narrative":"..." }], "traps":[{ "name":"...", "narrative":"..." }], "switch_to_backup":{ "name":"...", "narrative":"..." }, "protection":[{ "name":"...", "narrative":"..." }] }`;
    case "validation_close":
      return [
        `输出形状（字段名钉死 · 对齐产品 skeleton；禁止压成 tonight/next_7_days/close 三散文槽）：`,
        `{`,
        `  "page": "validation_close",`,
        `  "page_title": "贴本案出门仪式短名",`,
        `  "page_subtitle": "点清身份切换+今晚一事+近7日勾选（零专名）",`,
        `  "identity_before": "旧身份一句（本案具体）",`,
        `  "identity_after": "可执行新身份一句",`,
        `  "identity_shift": "为何必须切换（须能指回批断 identity_shift；白话）",`,
        `  "identity_shift_anchors": ["闭集短标签"],`,
        `  "quote": "一句可背金句（无引号外壳）",`,
        `  "quote_use": "摇摆时怎么用这句",`,
        `  "watch_signals": [`,
        `    "本周对照信号1（观察问句或可感知迹象；须能回溯喂料 self_check 正向）",`,
        `    "…",`,
        `    "…"`,
        `  ],`,
        `  "immediate_action": "今晚一件可出示的事",`,
        `  "tonight_done_looks_like": "做成什么样算完",`,
        `  "tonight_why": "为何是今晚（须能指回批断 tonight）",`,
        `  "tonight_anchors": ["闭集短标签"],`,
        `  "day7_micro_actions": [`,
        `    { "action":"近7日勾选项1", "why":"为何这周", "done_when":"勾选标准", "chart_anchors":[] },`,
        `    { "action":"…", "why":"…", "done_when":"…", "chart_anchors":[] },`,
        `    { "action":"…", "why":"…", "done_when":"…", "chart_anchors":[] },`,
        `    { "action":"…", "why":"…", "done_when":"…", "chart_anchors":[] }`,
        `  ],`,
        `  "takeaways": ["决策一句", "本周杠杆一句", "熔断一句"]`,
        `}`,
        `硬自检：①身份/金句/watch_signals×3–5/今晚/day7×4/带走三样齐全？②watch_signals 只观察不新开动作、不复读 P5 切辅？③day7 禁四周甘特腔？④删批断后身份切换与今晚为何是否垮？⑤可见层零专名；金句/对照信号/带走三样为封印句（不挂依据）？任一条否=整页重写。`,
      ].join("\n");
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
    input.key === "self_regulation"
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
  // P6：旧样本若落 dimensions[i]，喂正文前钉死出门槽 path（B 装配，不改机制文）。
  const p6Paths =
    pageKey === "validation_close"
      ? deepEvidenceUnitSpec("validation_close").paths
      : null;
  const units = p6Paths
    ? plan.units.slice(0, p6Paths.length).map((u, i) => ({
        ...u,
        path: p6Paths[i]!,
      }))
    : plan.units;
  const n = units.length;
  const cardName =
    pageKey === "foundation"
      ? "why_cards"
      : pageKey === "execution_guidance"
        ? "angles（主辅 toolkit）"
        : pageKey === "validation_close"
          ? "出门槽（identity_shift / tonight / day7×4；金句与带走三样为封印不挂依据）"
          : pageKey === "validation_risk"
            ? "护栏四桶"
            : "dimensions";
  const header =
    pageKey === "validation_close"
      ? `（共 ${n} 条批断 · 正文须用对应 path 扎根身份切换/今晚/近7日四条；禁止压成三散文槽；禁止压缩合并）\n`
      : `（共 ${n} 条 · 正文 ${cardName} 必须恰好 ${n} 条，按 path 一一对齐，禁止压缩合并）\n`;
  return (
    header +
    units
      .map((u, i) => {
        const claim = String(u.unit_claim ?? "").trim();
        const ev = String(u.evidence ?? "").trim();
        const moat = u.moat_class ? ` moat=${u.moat_class}` : "";
        return `[${i}] path=${u.path}${moat}\nclaim: ${claim}\nevidence: ${ev}`;
      })
      .join("\n\n")
  );
}
