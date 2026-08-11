/**
 * Block 2 Phase 3 — 深测算 pass（破局推理脊柱 + 议程倒推）
 * LLM 走 `POST /api/poju/breakthrough-core`；结果写入 `agent_v2.breakthrough_core` + `investigation_agenda`。
 */

import {
  formatSegment1UnderstandingForPrompt,
  type BreakthroughCore,
  type DimensionReckoning,
  type EnergyRetuneFrame,
  type KeyCrossroadsFrame,
  type ModernActionFrame,
  type POJUAgentState,
  type RhythmFrame,
} from "@/lib/poju/agent-state";
import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import {
  parseInvestigationAgenda,
  type AgendaFrameKind,
  type AgendaItem,
} from "@/lib/poju/investigation-agenda";
import {
  BLUEPRINT_PAGES_NEEDING_REALITY,
} from "@/lib/poju/report-blueprint";
import type { POJUSessionState } from "@/lib/poju/types";
import { pollBreakthroughCoreJobUntilDone, XHIGH_JOB_POLL_MAX_MS } from "@/lib/poju/poll-segment2-xhigh-job";
import { loadSessionProfileBundle } from "@/lib/poju/session-profile";
import { getStoredProfile } from "@/lib/profile/stored-profiles-service";
import { POJU_IDENTITY, POJU_KNOWLEDGE_ROOTS } from "@/lib/llm/prompts/poju-base";
import { buildOutputPolicyForPoju } from "@/lib/llm/compliance/output-policy";
import { buildStructuredInstanceInventory } from "@/lib/base-analysis/build-structured-instance-inventory";
import { formatBaseAnalysisForPrompt, normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { stitchPromptSections } from "@/lib/llm/prompts/oriental-counselor-base";
import { extractJson, tolerantJsonRepair, tryParseJsonObject } from "@/lib/llm/phases/phase-transport";
import { normalizeAgendaFromLlm } from "@/lib/poju/opening-conversion-payload";
import { sanitizeReplyOptions } from "@/lib/poju/reply-options";
import { buildChatFactGuardBlock } from "@/lib/llm/prompts/shen-sha-guard";
import { resolveAgendaRelationContext } from "@/lib/llm/prompts/relation-closed-set-context";
import { stripRedlineShenshaFromStructured } from "@/lib/glossary/strip-redline-shensha";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { RelationLabel } from "@/lib/calculations/relation-engine";
import {
  auditPaymentLeakResiduals,
  degradeMarkersToPlain,
  sanitizePaymentAuditLeaks,
  type ComplianceViolation,
} from "@/lib/llm/sanitize/compliance-terms";
import { isCriticalDeliveryAuditFailure } from "@/lib/llm/services/delivery-audit-regen";


/**
 * Call A (xhigh) — multi-dimension reckoning only (diverge, do NOT converge).
 * Skeleton + user-facing `response` (multi-dim observations; NO directions / NO questions).
 * Agenda / first_question → Call B; primary/backup converge → synthesis.
 */
export const DEEP_RECKONING_REPORT_TASK = `# 角色：多维真算师（真算 · 只发散不收敛）
【本段只做一件事：把这个盘和用户这个问题相关的【所有命理维度】都算出来、各出判断。绝不定"破局方向"、绝不收敛成一主一辅——那是后续【汇总段】的事。你只管算全、算准、算得多维。】
【本段无任何"术语打标/软译/双层交付排版"任务】：所有骨架字段是【内部数据】，直接用命理术语（裸词）写清楚即可；【绝不】写 ⟦t:…⟧ 标记、【绝不】写 ##/###/**加粗**/"依据与推理"这类排版——那些是第4段交付才有的事，与你无关。你只产出 JSON 骨架字段的纯内容。

你不是在跟用户闲聊寒暄。你先对【真实排算出的命盘结构】和他的问题做冷静、硬核、不注水的深度推演，
产出后续流程的【推理脊柱】（骨架，后台用）。同时，把【多维分析】用【自然语言】讲给用户听——
只讲各维度观察到什么，【不给方向、不收敛】。稍后另一次调用会据此倒推议程并提问；
汇总段才会收敛主辅方向。本次【只产出骨架 + response（多维观察）】，【禁止】输出 investigation_agenda / first_question，【禁止】在 response 里提问，【禁止】产出 primary_path / backup_path。

# 输入（structured + 技术事实 refs/climate 是你唯一的事实源 · 无通用解读）
- day_master / pattern / strength / yong_shen / xi_shen / ji_shen
- four_pillars 与 pillars_detail.{year|month|day|hour}.{ten_god, hidden_stems, shen_sha, life_stage}
- da_yun（当前走到第几步、主题、何时转）
- refs + climate_now（确定性技术事实）——【禁止改判 structured】；通用解读字段已剥离，你自己按用户问题重新解读
- 用户原始问题 + 已确认处境（第1段他说过的具体词句）

# 真算三铁律(违反=产品跑偏成"创业指导"或"脑补算命",逐条死守)

【铁律1 · 以 desired_outcome 为透镜选维度,绝不锚死用户当前手段】
用户的 desired_outcome(想要的结果)决定你该从哪些命理维度真算。用户当前正在做的事(某个项目/某份工作)只是【待评估的选项/可能载体】,【不是】既定方向——本段【也不定方向】。
你的核心任务 = 围绕 desired_outcome,把相关命理维度【全部算清、各出判断】;【严禁】只围着用户当前那个项目单点深挖,也【严禁】在本段收敛成"我最建议你走这条"。
收敛一主一辅是【汇总段】的事;本段把多维判断原样交出去即可。

【铁律2 · 全维度从命理找依据,再落回现实】
围绕他的问题和期望,【系统地】从命理各维度找依据,翻译成现实判断(不是只讲一个抽象的"能量结构"):
- 工作/谋生方式 ← 用神五行、十神格局:适合什么性质的挣钱方式(独立/依托/创造/管理…);
- 决策/行为模式 ← 十神、身强弱:他做决定的天生倾向与盲区;
- 性情/心理 ← 日主、格局:性格底色 → 影响适合的节奏与合作方式;
- 关系/合作 ← 命局合作助力状态:适不适合找伙伴、贵人是哪类人;
- 时机/阶段 ← 当前大运:这阶段适合进攻还是求稳。
每一维判断都要能追溯"命理某依据 → 现实某判断"。命理不是装点,是用来真判断各侧面。

【铁律3 · 命理只解释【机制】,绝不发明【事实】】
用户陈述的现实(卡在哪、有没有某种能力、是不是在逃避)【只能采信用户亲口说的】。命理(食神/身弱/印星…)只能用来解释"为什么会形成这个处境""该往哪个方向调",【严禁】从命理符号反推出用户没说过的现实事实——例如从"食神透干"推出"他技术扎实",从命理给用户扣"你在逃避上线"这种他没说过的动机。更【严禁】用命理去覆盖/推翻用户的自述(用户说"卡在技术上",就是遇到了搞不定的技术问题,不许改写成"你技术很强、是心理问题")。
信息不足时,标进 needs_validation 交给议程去问,【绝不】自己脑补填成事实。

# 任务:产出【方案骨架】(多维真算为主 · 只发散不收敛)

你要基于命盘 + 用户问题,推理出一套【破局分析的骨架】。
【骨架】= 各维判断 + 命理为什么 + 需验证什么现实证据。
【不是】具体行动步骤,也【不是】一主一辅方向——方向由汇总段收敛。

产出这些类(每类必须落在【不同侧面】,见下方多轴铁律):

0. energy_structure(能量结构·Part I):
   这个人能量的本质、补给从哪来/何时断、格局感、当前所处环境——【只讲他是谁、能量怎么运作】;
   不讲他这次的问题(那是 situation_conclusion),也不讲怎么调频(那是 energy_retune_frame)。
   锚到 structured 具体字段。

1. situation_conclusion(处境洞察):
   把困境翻译成结构性原因,点名 structured 具体字段;直答他问题的阶段趋势(进/守/转)。

2. key_crossroads(关键抉择):
   - real_fork:这个问题真正的分岔点(往往不是用户以为的A还是B,而是更深一层);
   - path_costs:每条路径的能量代价与收益(命理视角);
   - decision_traits:他这类人做这种决定的天生优势与盲区;
   - structural_basis:命理依据;
   - needs_validation:要确认这个抉择,还需要知道他的什么现实情况?

3. multi_dimension_reckoning(多维真算 · 本段核心 · 只发散不收敛):
   先认清本次问题类型(见下方【问题类别】),按类型从命理【多个维度】分别真算,每维出一个判断——【绝不】只抓一个点讲到底(单点=判失败),也【绝不】急着收敛成方向。
   - 工作/事业类,至少覆盖:十神格局→适合什么性质的谋生;身强弱+用神→独立还是依托;大运→当前阶段宜攻宜守、这几年事业能量走向;财星状态→和"钱"的关系/求财方式;性情·日主→决策盲区、为何反复换方向;八字宜忌→适合/不适合哪类工作。
   - 感情/婚姻类:配偶星状态、桃花、日主性情、大运的关系能量、比劫等;
   - 财富/财运类:财星、食伤生财、大运财运、身财平衡等;
   - 决策/选择类:十神倾向、用神方向、性情盲区等;
   - 其他类:按与该问题相关的命理维度自选(维度框架自定,别硬套)。
   每维写 { dimension:维度名, chart_basis:命理依据(真词), judgment:该维得出的判断 }。
   【务必多维】:覆盖该类型相关的几个维度都算全,彼此不同、各切一个命理侧面;【绝不】定方向、【绝不】收敛——把这些多维判断原样交给汇总段去收敛。

4. energy_retune_frame(能量调频方案骨架):
   - direction_fit:能量最该往哪个方向使力;
   - timing_ripeness:什么状态/条件成熟了再推进(阶段,不报日期);
   - daily_retune:日常怎么调频养能量的方向(方位/颜色/习惯,骨架);
   - complementary:该靠近什么能量特质的人、避开什么消耗;
   - structural_basis:命理为什么;
   - needs_validation:要给他贴合的调频建议,还需要知道他的什么现实情况?
   - status:"hypothesis"

5. rhythm_frame(30天节奏骨架):
   phase1_observe / phase2_adjust / phase3_consolidate 各写一个方向(骨架)。

6. self_check_signals(自检信号,3-4条):
   以后他遇到什么信号=在往对的方向走 / 该停下调整。

# 多轴铁律(反"通篇一个调"·下结论前逐类过)
这些类是【同一个人、同一个问题的不同侧面】,不是一个洞见换多种说法。
各类的靶各不相同:energy_structure=他是谁;situation=为什么卡在这件事;
key_crossroads=真正的分岔;multi_dimension_reckoning=按问题类型各维真算(发散·本段核心);
energy_retune=对内怎么养;rhythm=怎么排;self_check=怎么自检。
【禁止】在本段写 primary_path/backup_path(汇总段才收敛)。
【自检】把某一类的核心论点删掉,另一类还站得住吗?
——站得住 = 两类在讲同一根轴 = 其中一类是凑数的 → 换一个真正不同的侧面重写。
宁可某一类薄一点,也不许各类摊同一个主题。若这盘只算得出一根强轴,
就让各类从【那根轴的不同受力点】切入(起因/代价/对外/对内/节奏/信号),
而不是复读同一句结论。

# 收敛防线(action / retune / rhythm / self_check 最容易一起塌向"省力+求助")
- 这四类不许都锚在"收拢/借力/养能量"同一根轴。至少让 modern_action 有一条是【对外争取/主动出击】而非清一色"收着养着"。
- self_check_signals 必须【正负都给】:既有"什么迹象=该停/该调"(负向),也有"什么迹象=方向对了/在恢复"(正向),不要清一色"当心你要耗尽"。
- retune↔rhythm 专项:retune 只讲【往哪个方向调】(方向/内容),rhythm 只讲【30天分段怎么推进】(时序/节拍),不复述养能量内容。删掉 retune 的方向 rhythm 三段还站=塌成一轴=把 rhythm 重写成纯分段节拍。

# retune↔rhythm 专项(这两类最容易塌成一轴)
- energy_retune_frame 只讲【往哪个方向调、靠近/避开什么】(方向/内容),不讲时序。
- rhythm_frame 只讲【30天分三段怎么推进这件事】(时序/节拍),不复述"养能量/减少消耗"这类 retune 的内容。
- 【删除测试】把 retune 的方向整句删掉,rhythm 三段还成立吗?
  ——还成立 = 你把 rhythm 也写成了"养能量内容" = 塌成一轴 → 把 rhythm 重写成纯"分段推进节拍"
  (第1段先做什么动作、第2段加什么、第3段固定什么),不带 retune 的方向词。

# 额外产出:一段自然语言的多维分析（给用户看的）

你已经真算出完整骨架。骨架字段本身是后台数据；给用户看的是【多维分析】，
用【自然语言】讲，不是"报告格式"（不用编号小标题清单）。

这段 response 两部分，自然衔接、像高人跟你说话：

1. 【分析处境】:大白话说清"你为什么卡在这里"(基于 situation_conclusion)，
   口语化、有温度。

2. 【讲多维观察】:用【自然语言】把你算出的【几个不同维度】各讲一点(你在工作方式、决策模式、时机、性情等维度上分别看到了什么)——【只讲观察,不给方向、不收敛成一主一辅】(方向是汇总段的事)。让用户感到"你从好几个角度看透了他",而不是抓着一个点讲到底。

# 铁律:自然语言，不是报告；只观察，不给方向、不提问
- 【禁止】"破局方向一/二/三"编号小标题、###、清单——用自然语言串；
- 【禁止】说"我最建议你走这条"/收敛一主一辅——那是汇总段的事；
- 【禁止在这段提问】——不问用户问题，不说"你过去是…还是…?"。提问是议程调用(Call B)的事。
  你这步只【分析+多维观察+收尾定调】，把提问交给下一步；
- 结尾可自然收束("接下来还得看你的实际情况"),但【不提具体问题】；
- 纯白话、零命理标记、禁 ### / **加粗**。

# 不剧透方向与步骤
- 多维观察【要给】；破局方向 / 具体行动步骤 / 调频方案 / 30天节奏细节【不给】(方向归汇总段,步骤归交付)；
- 即:告诉"我从好几个侧面看到了什么",但不告诉"该走哪条主路、第一步做什么"。

# 关于 needs_validation(重要·连接第三阶段)
每个骨架的 needs_validation,是"要把这个骨架变成具体方案,还缺哪些【现实证据】"。
这些会变成第三阶段要向用户收集的东西。所以要具体、可收集:
- 好:"他过去独立做事 vs 团队协作,哪个成果更好"(可问、可验证命理假设);
- 差:"他的整体人生规划"(太大、没法收集、不针对性验证)。
needs_validation 不展示给用户,是给第三阶段议程用的(由 Call B 倒推提问)。

# 骨架≠步骤（硬约束）
【严禁】写具体行动步骤（"每天半小时"、"约老同事喝茶"、"写下方法论"…）——
那是第4段【完整交付】的任务；第2段骨架只给【方向 + 结构依据 + 需验证什么】。
timing_ripeness 只写【进 / 守 / 转 的阶段条件】，【严禁】报具体日期。

# 维度织入（反"只看五行"）
structural_basis / chart_basis ≥2 个不同维度：十神/格局、五行强弱/用神喜忌、大运时机、本盘实算神煞、十二长生。
本盘无实例就跳过，禁编造。multi_dimension_reckoning 须覆盖该问题类型相关的多个维度；energy_retune_frame 须带阶段判断。

# 硬核标准
- 每条结论可追溯到 structured，否则删掉。
- multi_dimension_reckoning 各维判断必须彼此不同、各切一个命理侧面，禁止同一句换皮。
- 命理词只用本次 structured 实例；严禁集外神煞。
- 命理为主：骨架的根都是 structural_basis / chart_basis。

# 篇幅
- situation_conclusion：2–4 短段，段间空行，每段 ≤120 字（内部数据，可裸命理词）。
- structural_basis / chart_basis：一句话点锚点，禁止段落复述；直接用命理术语写清逻辑。
- response：分析 + 多维观察的自然语言，约 280–560 字（中文）/ 180–360 words（英文），短段空行即可；禁报告小标题、禁提问、禁"我最建议你走这条"。
  【铁律·语言】response 是【唯一】按用户 locale 写的字段(直接给用户看)。【所有骨架字段(energy_structure / situation_conclusion / key_crossroads / multi_dimension_reckoning / modern_action_frames / energy_retune_frame / rhythm_frame / self_check_signals / structural_basis / needs_validation / chart_basis / judgment)一律用中文写】——内部数据,多语言由下游翻译步处理;即使 locale=en,骨架也写中文。

# 字段=纯内容（前端固定排版）
禁字段内标题/编号/markdown（###、**加粗**、"结构依据："前缀）。直接写句。needs_validation 不展示给用户。

# 第1段靶心
显式扣住 core_dilemma + desired_direction。structural_basis 从实例清单锚定 ≥3 项本地结构；【锚定=讲清意思】。

# 合规范围（硬边界）
【只有 response（给用户看的）要合规】：纯白话、零裸命理词、零 \`⟦t:…⟧\` 标记。
【response 表达公式 · 命理判断这样说（既合规、又保住"真算出来的"分量——这是护城河，不能冲淡成泛泛安慰）】
凡从命理得出的判断，用【依据感前缀 + 白话结论】说：既不出现命理术语/算命词，又让用户感到"这是看了我的底层结构才说的专属判断"。
- 依据感前缀【只用能量类词】：从你的【能量底座】看 / 从你的【能量结构】看 / 按你的【先天配置】 / 你的【底层结构】里……
- 白话结论：把命理判断翻成普通人能懂、但仍【具体】的话（不是万能安慰）。
对照（🔴裸命理 → 🟢带依据感的白话）：
  · "贵人运不弱，尤其长辈" → "从你的能量底座看，你天生就带着'容易得到帮助'的配置，尤其长辈会愿意拉你一把"；
  · "身弱食伤旺" → "从你的能量结构看，你是想法多、启动慢的类型，社交更多在消耗你、而不是充你的电"；
  · "用神水木" → "你这个底座，最能滋养你的是'流动'和'生长'类的东西"。

【禁词 · 绝不出现在 response】
- 命理/算命词：身弱身强、食伤食神伤官、官杀正官七杀、财星、用神喜神忌神、印星比劫、大运流年换运交运、贵人运桃花运运势、日主五行命里命中、合冲刑害、旺衰……
- 【尤其禁】"命盘 / 八字 / 算命 / 命里 / 命中注定"——前缀一律用"能量底座 / 能量结构 / 先天配置"，【绝不】说"从你的命盘看""你的八字里"。

【防套壳 · 硬边界】"从你的能量底座看 X"里的 X，必须【真的】来自这个盘的命理判断、和你内部 structural_basis 对得上。【严禁】给一句白话安慰套个"从能量底座看"的壳来假装有依据——那是"脑补披依据皮"，比裸脑补更隐蔽、更该禁。有依据才用前缀；没依据，就别用前缀、也别下那个判断。

【写完自检】逐句扫 response：①有没有普通人看不懂、或带命理/算命味的词（含命盘/八字）？②每个"从能量底座看…"背后是不是真有对应命理依据？ 有词→换成带依据感的白话；套壳→删前缀或补真依据。
骨架字段（energy_structure / situation_conclusion / key_crossroads / multi_dimension_reckoning / modern_action_frames / energy_retune_frame / rhythm_frame / self_check_signals / structural_basis / needs_validation / chart_basis / judgment）是【内部数据】，原始字段不直接展示 → 【不合规、不打标】，可用裸命理词写清楚。
（response 会用白话复述多维观察给用户看——那部分必须合规；【禁止】在 response 里给主辅方向。）

response【严禁】裸写：大运/流年/年柱/月柱/日柱/时柱/命盘/八字、正印/食神/伤官等十神原名、甲乙…壬癸 + 子丑…亥 / 金木水火土 连写（如"壬水"）、带煞/刃神煞原名、自创生克短语。
reasoning 可裸算；response 必须白话重组（禁抠词替换）。

# structural_basis（内部依据 · 不打标）
命理依据，【直接用命理术语写清楚】（裸词无妨：内部数据，不展示、不打标）。
要说清"为什么这个方向/判断成立"，用真实命理逻辑；【禁止】为骨架纠结 slug、【禁止】打 \`⟦t:…⟧\`。

# reasoning vs content
reasoning 可裸命理词；骨架字段可裸命理词；【仅 response】必须白话、零标记。

# 输出（严格 JSON · 骨架 + response · 无议程）
键名英文小写 ASCII 双引号，无围栏。
{
  "energy_structure": "...",
  "situation_conclusion": "...",
  "key_crossroads": { "real_fork":"...", "path_costs":"...", "decision_traits":"...", "structural_basis":"...", "needs_validation":"..." },
  "multi_dimension_reckoning": [
    { "dimension":"...", "chart_basis":"...", "judgment":"..." }
  ],
  "modern_action_frames": [
    { "direction":"...", "why_fits":"...", "structural_basis":"...", "needs_validation":"...", "status":"hypothesis" }
  ],
  "energy_retune_frame": { "direction_fit":"...", "timing_ripeness":"...", "daily_retune":"...", "complementary":"...", "structural_basis":"...", "needs_validation":"...", "status":"hypothesis" },
  "rhythm_frame": { "phase1_observe":"...", "phase2_adjust":"...", "phase3_consolidate":"..." },
  "self_check_signals": ["...", "..."],
  "response": "自然语言:分析处境 + 多维观察;不提问、不定方向、不说我最建议"
}
【禁止】输出 investigation_agenda / first_question —— 另一次调用(Call B)处理提问。
【禁止】输出 primary_path / backup_path —— 由后续【汇总段】收敛填写。
`;

/** @deprecated Alias — Call A deep reckoning task. */
export const DEEP_RECKONING_TASK = DEEP_RECKONING_REPORT_TASK;

export const AGENDA_BRIDGE_TASK = `# 角色：议程与首问撰写（承上启下）

你只拿到【Call A 已定稿的方案骨架 JSON】作为唯一事实源。不要重写分析，不要复述命盘。

# 任务:从方案骨架的 needs_validation 倒推议程
每个骨架(key_crossroads/primary_path/backup_path/modern_action_frames/energy_retune_frame)都有 needs_validation
(要把骨架变具体、要验证命理假设,还缺什么现实证据)。
你的议程 = 把这些 needs_validation 变成向用户收集的问题——优先服务主路径落地,其次辅路径切换条件。
1. investigation_agenda（3–5 项，宁少而锐）。
2. first_question：一条给用户的消息——先承上、再启下、直接问真问题。

# 议程规则
- 严禁通用问卷 / 摸现状（那是第1段的事）。
- 每项议程必须标注它验证哪个骨架：frame_kind（"key_crossroads" | "modern_action" | "energy_retune"）。
  若 frame_kind 是 modern_action，supports 里【写清它对应主路径或辅路径的意思】(用那条方向的关键词)——
  代码以 supports 内容锚定到具体骨架。frame_index 可写可不写(仅作提示,写错不影响:以 supports 内容为准)。
- 【每项议程还要标注它服务第4段报告的哪一页】：
  - serves_page：该现实信息用来写准哪一页 —— "science_action"(行为策略) / "metaphysics_action"(环境调频) / "thirty_day"(30天) / "risk_guard"(避坑)；
  - serves_path："primary"(服务主路径落地) / "backup"(服务辅路径切换) / "both"；
  - role："fill"(补料:让行动可执行) / "calibrate"(校准:可能修正主辅方向) / "personalize"(个性化:第4段"因为你说的X"的素材)。
  - **collection_goal（收集验收尺 · 给第3阶段判"够没够"）**：一句话说清"这条答案要用来写 serves_page 那页的什么、到什么程度就够写了"。
    · 【信息层目标】(要拿到什么信息)，【不是下钻指令】(严禁写"追到项目技术/执行细节"这种)——粒度 = 写那块 report 真正需要的【最少信息】；
    · 例："拿到用户每周可投入的时间与节奏，够为30天计划排节奏即可"；"确认用户对'借力合作'的接受度，够判主辅是否对调即可"；"了解用户已知会反复踩的坑，够写避坑页即可"。
    · 【要能被"用户给不出"满足】：若某信息用户当前阶段给不出(如还没上线、无变现数据)，goal 应允许"确认到'当前处于X阶段、暂无此数据'即算够"——不逼一个用户给不出的答案。
- 【只为"需要现实料才写得准"的行动页生成议程】(science_action/metaphysics_action/thirty_day/risk_guard)。
  纯命理就能写准的诊断页(direct_answer/foundation)【不生成议程】——别浪费用户耐心问它们。
- 自检:每条议程都要能回答"我问这个,是为了写准第4段的哪一页、服务主还是辅、什么作用"。答不上=废项,删。
- 优先收集能【验证/推翻命理假设】的现实行为信息(印证导向,不是泛泛了解)。
- ≥2 项 critical=true。
- 每项 { id, label, critical, status:"unexplored", frame_kind, frame_index?, supports, serves_page, serves_path, role, collection_goal }。
- **label（用户面板可见）**：必须用【第二人称】短名词短语（如"你的冷却时段"、"能吐槽的人"、"最硬的那块经验"）。
  【禁止】第三人称内部笔记句（"他目前有没有…"、"了解其冷却方式"）。
  【禁止】把完整问句当 label——完整问句只放 first_question。
- 换一个命盘/问题就不成立 → 够具体。

# first_question 硬要求（一条消息搞定）
1) 先承上：一句话呼应上面那段复盘对话（不要复述内容）；
2) 再启下：说明为了验证/落地【A 中某一条具体骨架】，需要先弄清什么；
3) 直接问出第一个议程项的真问题：具体、好回答、可带场景提示。
【禁止】yes/no 过场（「你看完了吗？」「可以开始了吗？」）。
【禁止】把议程 label 直接甩出来当问题。
【禁止】照抄任何固定范文——必须对着这位用户的复盘对话与骨架现场写。

# 零标记（硬约束）
first_question 与议程 label 都是【正文层】——**一个标记都不许写**，全部白话。
本次调用没有注入实例闭集，你写的任何 slug 都是猜的；代码会剥掉标记，只会让句子变难读。

# 输出（严格 JSON）
{
  "investigation_agenda": [
    { "id":"...", "label":"你的冷却时段", "critical":true, "status":"unexplored", "frame_kind":"modern_action", "supports":"验证行动骨架：先把火浇灭", "serves_page":"science_action", "serves_path":"primary", "role":"fill", "collection_goal":"拿到用户目前给自己降温的方式与频率，够写行动页的'先降温再决策'即可" }
  ],
  "first_question": "…",
  "options": ["选项一的话", "选项二的话", "选项三的话"]
}

# first_question 配一组选项(帮用户回答第一个问题)

你的 first_question 是第三阶段的第一个问题。给它配2-3个选项,帮用户快速回答。

选项要求(和收集阶段一致):
- options 是【字符串数组】,每个元素直接是一句给用户看的话(字符串);
  【禁止】包成对象 {"text":"..."}——错:[{"text":"..."}];对:["..."]。
- 选项从第一个议程项的 needs_validation 出发(first_question 问的就是它);
- 要有【这个命盘特有的指纹】,不是通用的(禁放之四海皆准);
- 三个选项有【真实区分度】,对应不同可能(用户选主推=印证假设,选别的=真实修正);
- 保留开放出口(用户可无视选项,在输入框写自己的情况)。

例:first_question 问"过去有没有合作顺利的经历" →
  选项覆盖"有,某次合作让事情推动起来了""基本没有,大多是自己单干""有但最后还是散了"。
  (讲选项设计逻辑,不是照抄这三句。)

# options 格式(硬要求)
字符串数组,每个是一句大白话。禁止对象。用户点了就等于说了这句话。
`;

export type BreakthroughCoreLLMResponse = {
  situation_conclusion: string;
  response?: string;
  key_crossroads: {
    real_fork: string;
    path_costs: string;
    decision_traits: string;
    structural_basis: string;
    needs_validation: string;
  };
  multi_dimension_reckoning?: Array<{
    dimension: string;
    chart_basis: string;
    judgment: string;
  }>;
  primary_path?: {
    direction: string;
    why_fits: string;
    structural_basis: string;
    needs_validation: string;
    status: string;
  };
  backup_path?: {
    direction: string;
    why_fits: string;
    structural_basis: string;
    needs_validation: string;
    status: string;
  };
  modern_action_frames?: Array<{
    direction: string;
    why_fits: string;
    structural_basis: string;
    needs_validation: string;
    status: string;
  }>;
  energy_retune_frame: {
    direction_fit: string;
    timing_ripeness: string;
    daily_retune: string;
    complementary: string;
    structural_basis: string;
    needs_validation: string;
    status: string;
  };
  rhythm_frame: {
    phase1_observe: string;
    phase2_adjust: string;
    phase3_consolidate: string;
  };
  self_check_signals: string[];
  investigation_agenda?: unknown;
  first_question?: string;
};

export function buildBreakthroughCorePrompt(input: {
  base_analysis: unknown | null;
  agent_v2: POJUAgentState | null | undefined;
  original_question: string;
  locale: string;
}): { system: string; user: string; structured: ProfileStructured; auditRelations: RelationLabel[] } {
  const { base_analysis, agent_v2, original_question, locale } = input;
  if (base_analysis == null) {
    throw new Error("[breakthrough-core] structured 命盘为空，拒绝生成脊柱（必锚命盘）。");
  }
  const bundle = normalizeBaseAnalysisInput(base_analysis);
  const structured = bundle.structured ?? null;
  if (structured == null) {
    throw new Error("[breakthrough-core] structured 命盘为空，拒绝生成脊柱（必锚命盘）。");
  }

  // 红线神煞(恐吓/宿命)输入端剔除;中性神煞全保留(真词真算)。
  const cleanStructured = stripRedlineShenshaFromStructured(structured);

  const questionCategory = agent_v2?.question_category ?? null;
  const { directedDynamic, auditAllowlist, directedInventoryBlock } = resolveAgendaRelationContext(
    cleanStructured,
    questionCategory,
  );

  const contextText = (() => {
    if (!agent_v2) return "（尚无结构化 agent_v2 语境，仅依赖问题。）";
    try {
      return formatContextForPrompt(agent_v2);
    } catch {
      return "（语境结构不完整，已省略格式化块。）";
    }
  })();

  // Layer 1 事实 only — structured + refs/climate；剥掉 question-blind 通用解读（identity_anchor 等）
  // 与「以 identity_anchor 为准」锚，第2段自己按 original_question 解读；绝不注入 display_text 叙事。
  const baseStr = formatBaseAnalysisForPrompt(base_analysis, locale, {
    includeInterpretive: false,
  });
  const factGuard = buildChatFactGuardBlock(cleanStructured, {
    directedRelations: directedDynamic,
    verbose: true,
  });

  const system = stitchPromptSections(
    POJU_IDENTITY,
    POJU_KNOWLEDGE_ROOTS,
    buildOutputPolicyForPoju(),
    // 【已拆】双层交付排版 + 打标规则 —— 第2段是纯多维真算/内部裸词,不打标不排版,
    // 与 DEEP_RECKONING_REPORT_TASK 的"无打标/软译/双层"总纲对齐(那两块是第4段交付才要的)。
    directedInventoryBlock,
    buildStructuredInstanceInventory(cleanStructured),
    DEEP_RECKONING_REPORT_TASK,
  );

  const segment1 = agent_v2 ? formatSegment1UnderstandingForPrompt(agent_v2) : "（第1段理解门字段尚未写入。）";

  const user = `【locale】${locale}

【第1段理解门产出（推演靶心 · 必须显式扣住）】
${segment1}

【能量底座 Layer1（structured + 技术事实 refs/climate · 无通用解读 · 你自己按下方问题解读）】
${baseStr}

【用户原始问题】
"${original_question}"

【问题类别】
${questionCategory ?? "other"}

【收集到的具体上下文】
${contextText}

${factGuard}

【任务 · Call A】
只输出骨架+对话 JSON（energy_structure + situation_conclusion + key_crossroads + multi_dimension_reckoning + modern_action_frames? + energy_retune_frame + rhythm_frame + self_check_signals + response）。multi_dimension_reckoning 必产(多维发散)。【禁止】输出 primary_path / backup_path / investigation_agenda / first_question。仅 JSON，无 markdown 围栏。
（8页报告蓝图不在本段——撑得起交付是汇总段/交付段的事；本段只把相关维度算全、算准。）`;

  return { system, user, structured, auditRelations: auditAllowlist };
}

/** Call B — A JSON is sole fact source; no full chart / layout handbook. */
export function buildAgendaBridgePrompt(input: {
  breakthrough_core: BreakthroughCore;
  original_question: string;
  locale: string;
}): { system: string; user: string } {
  const { breakthrough_core, original_question, locale } = input;
  const coreJson = JSON.stringify(
    {
      response: breakthrough_core.response,
      situation_conclusion: breakthrough_core.situation_conclusion,
      key_crossroads: breakthrough_core.key_crossroads,
      primary_path: breakthrough_core.primary_path,
      backup_path: breakthrough_core.backup_path,
      modern_action_frames: breakthrough_core.modern_action_frames,
      energy_retune_frame: breakthrough_core.energy_retune_frame,
      rhythm_frame: breakthrough_core.rhythm_frame,
      self_check_signals: breakthrough_core.self_check_signals,
    },
    null,
    2,
  );

  const reportPagesContext = BLUEPRINT_PAGES_NEEDING_REALITY.map(
    (p) =>
      `- ${p.id}（${p.title.zh}）需要的现实信息：${(p.reality_needs ?? []).join("；")}`,
  ).join("\n");

  const system = stitchPromptSections(
    POJU_IDENTITY,
    buildOutputPolicyForPoju(),
    AGENDA_BRIDGE_TASK,
  );

  const user = `【locale】${locale}

【用户原始问题（语境）】
"${original_question}"

【Call A 定稿方案骨架（唯一事实源 · 勿改写结论）】
${coreJson}

# 报告这几页需要现实料（据此倒推议程）
${reportPagesContext}

【任务 · Call B】
从 needs_validation + 上列报告页现实料需求倒推 investigation_agenda（每项标 serves_page/serves_path/role/collection_goal；只为行动页）+ first_question（承上启下真问题，禁 yes/no 过场）+ options（字符串数组，对应 first_question）。仅 JSON。`;

  return { system, user };
}

/**
 * Deterministic Call B anchor: prefer frame_kind (+ frame_index for modern_action).
 * Fallback only when kind missing — fuzzy match supports vs frame direction / needs_validation text.
 *
 * Soft rule: when the model already declares frame_kind="modern_action" but omits a usable
 * frame_index (and fuzzy match misses paraphrases), assign the next unused action slot instead
 * of failing the whole Call B — so a valid first_question is not dropped as
 * "agenda bridge failed".
 */
export function validateAgendaAnchorsToFrames(
  agenda: AgendaItem[],
  core: BreakthroughCore,
): { ok: true; agenda: AgendaItem[] } | { ok: false; reason: string } {
  if (!Array.isArray(agenda) || agenda.length === 0) {
    return { ok: false, reason: "empty_agenda" };
  }
  const maxAction = core.modern_action_frames?.length ?? 0;
  if (maxAction < 1) {
    return { ok: false, reason: "empty_action_frames" };
  }

  const resolved: AgendaItem[] = [];
  const usedActionIdx = new Set<number>();

  const nextUnusedActionIndex = (): number => {
    for (let i = 1; i <= maxAction; i++) {
      if (!usedActionIdx.has(i)) return i;
    }
    // All slots already used — cycle from 1 (duplicate ok; better than killing Call B).
    return 1;
  };

  for (const item of agenda) {
    // 内容匹配先算(置信才用),整数下标只当软提示 —— 模型系统性 0/1 基混淆,
    // supports 文案是它自己的语义意图,比整数计数更可信。
    const contentMatch = fuzzyMatchFrameRef(String(item.supports ?? ""), core);
    let kind = item.frame_kind ?? contentMatch?.ref.frame_kind;
    if (!kind) {
      return { ok: false, reason: `unanchored:${item.id || item.label}` };
    }

    let idx = item.frame_index;
    if (kind === "modern_action") {
      // Prefer content match *among* modern_action frames (even when global best is another kind).
      const actionOnly = fuzzyMatchModernActionFrame(String(item.supports ?? ""), core);
      if (actionOnly) {
        idx = actionOnly.frame_index;
      } else if (contentMatch && contentMatch.ref.frame_kind === "modern_action") {
        idx = contentMatch.ref.frame_index;
      } else if (idx != null) {
        // 无内容锚时容忍整数:1-based 直接用;0-based(0..max-1)+1 归一。
        if (idx >= 1 && idx <= maxAction) {
          // ok, 1-based
        } else if (idx >= 0 && idx <= maxAction - 1) {
          idx = idx + 1;
        } else {
          idx = undefined;
        }
      }
      if (idx == null || idx < 1 || idx > maxAction) {
        idx = nextUnusedActionIndex();
      }
      usedActionIdx.add(idx);
    }

    resolved.push({
      ...item,
      frame_kind: kind,
      ...(kind === "modern_action" && idx != null ? { frame_index: idx } : {}),
    });
  }

  return { ok: true, agenda: resolved };
}

/** @deprecated Use validateAgendaAnchorsToFrames. */
export function validateAgendaAnchorsToDirections(
  agenda: AgendaItem[],
  directions: BreakthroughCore["modern_action_frames"],
): { ok: true; agenda: AgendaItem[] } | { ok: false; reason: string } {
  const stubCore: BreakthroughCore = {
    energy_structure: "",
    situation_conclusion: "",
    key_crossroads: {
      real_fork: "",
      path_costs: "",
      decision_traits: "",
      structural_basis: "",
      needs_validation: "",
    },
    modern_action_frames: directions,
    energy_retune_frame: {
      direction_fit: "",
      timing_ripeness: "",
      daily_retune: "",
      complementary: "",
      structural_basis: "",
      needs_validation: "",
      status: "hypothesis",
    },
    rhythm_frame: { phase1_observe: "", phase2_adjust: "", phase3_consolidate: "" },
    self_check_signals: [],
    generated_at: new Date().toISOString(),
  };
  return validateAgendaAnchorsToFrames(agenda, stubCore);
}

/** Strip punctuation / whitespace / common prefixes for fuzzy frame compare. */
function normalizeForDirectionAnchor(text: string): string {
  return text
    .toLowerCase()
    .replace(/落地方向\s*[:：\-—–]*/g, "")
    .replace(/验证行动骨架\s*[:：\-—–]*/g, "")
    .replace(/验证骨架\s*[:：\-—–]*/g, "")
    .replace(/方向\s*[123一二三]\s*[:：\-—–]*/g, "")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，。、“”‘’！？：；、·•\-—–~～'".,:;!?()（）【】\[\]{}<>《》/\\|+*=]/g, "");
}

/** 字符 bigram 集合(抗插入的相似度基元)。 */
function charBigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

/** Sørensen–Dice(bigram)——比 LCS 抗插入,且不因长文本被稀释。 */
function diceBigram(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = charBigrams(a);
  const B = charBigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

type FrameAnchor = { frame_kind: AgendaFrameKind; frame_index?: number };

/**
 * 内容锚:supports 文案 ↔ 各骨架【逐字段】比对(direction / needs_validation 分开取最大),
 * 不拼长 hay、不用 LCS÷长串。返回带分数,让校验按置信度决定是否让内容盖过整数下标。
 */
function fuzzyMatchFrameRef(
  supports: string,
  core: BreakthroughCore,
): { ref: FrameAnchor; score: number } | null {
  const needle = normalizeForDirectionAnchor(supports);
  if (needle.length < 2) return null;

  const scoreAgainst = (...fields: (string | undefined)[]): number => {
    let best = 0;
    for (const f of fields) {
      const hay = normalizeForDirectionAnchor(f ?? "");
      if (hay.length < 2) continue;
      const s = diceBigram(needle, hay);
      if (s > best) best = s;
    }
    return best;
  };

  const candidates: Array<{ score: number; ref: FrameAnchor }> = [];
  const xc = core.key_crossroads;
  if (xc) {
    candidates.push({
      score: scoreAgainst(xc.real_fork, xc.needs_validation, xc.decision_traits),
      ref: { frame_kind: "key_crossroads" },
    });
  }
  const actionPool =
    core.modern_action_frames.length > 0
      ? core.modern_action_frames
      : [core.primary_path, core.backup_path].filter(
          (f): f is NonNullable<typeof f> => Boolean(f),
        );
  actionPool.forEach((f, i) => {
    candidates.push({
      // direction 是最强信号,故与 needs_validation 分开取最大,避免长文本稀释。
      score: Math.max(scoreAgainst(f.direction), scoreAgainst(f.needs_validation, f.why_fits)),
      ref: { frame_kind: "modern_action", frame_index: i + 1 }, // 1-based:与提示词/校验一致
    });
  });
  const er = core.energy_retune_frame;
  if (er) {
    candidates.push({
      score: scoreAgainst(er.direction_fit, er.needs_validation, er.daily_retune),
      ref: { frame_kind: "energy_retune" },
    });
  }

  let best: { score: number; ref: FrameAnchor } | null = null;
  for (const c of candidates) {
    if (!best || c.score > best.score) best = c;
  }
  // 阈值按 Dice 尺度(比旧 0.6 低):~0.34 足以区分,又不误配。
  return best && best.score >= 0.34 ? best : null;
}

/** Match supports against modern_action_frames only (ignores crossroads / retune). */
function fuzzyMatchModernActionFrame(
  supports: string,
  core: BreakthroughCore,
): { frame_kind: "modern_action"; frame_index: number } | null {
  const needle = normalizeForDirectionAnchor(supports);
  if (needle.length < 2) return null;

  // Avoid forEach+closure mutation — TS can narrow the outer `best` to `never`.
  let bestScore = -1;
  let bestIndex = 0;
  const pool =
    core.modern_action_frames.length > 0
      ? core.modern_action_frames
      : [core.primary_path, core.backup_path].filter(
          (f): f is NonNullable<typeof f> => Boolean(f),
        );
  for (let i = 0; i < pool.length; i++) {
    const f = pool[i]!;
    const score = Math.max(
      diceBigram(needle, normalizeForDirectionAnchor(f.direction ?? "")),
      diceBigram(needle, normalizeForDirectionAnchor(f.needs_validation ?? "")),
      diceBigram(needle, normalizeForDirectionAnchor(f.why_fits ?? "")),
    );
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i + 1;
    }
  }
  // Slightly softer than global fuzzy — paraphrases like「验证行动骨架：…」must land.
  if (bestScore < 0.28) return null;
  return { frame_kind: "modern_action", frame_index: bestIndex };
}

export class BreakthroughCoreParseError extends Error {
  constructor(message = "core_parse_failed") {
    super(message);
    this.name = "BreakthroughCoreParseError";
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function grabSalvageStringField(text: string, keyAliases: string[]): string | undefined {
  for (const k of keyAliases) {
    const key = escapeRegExp(k);
    const re = new RegExp(
      `["'「」]?${key}["'「」]?\\s*[:：]\\s*["'「」]((?:[^"'「」\\\\]|\\\\.)*)["'「」]`,
      "i",
    );
    const m = text.match(re);
    if (m?.[1]?.trim()) {
      return m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
    }
  }
  return undefined;
}

function extractJsonArrayBlock(text: string, containerAliases: string[]): string | null {
  for (const key of containerAliases) {
    const re = new RegExp(`["'「」]?${escapeRegExp(key)}["'「」]?\\s*[:：]\\s*\\[`, "i");
    const m = re.exec(text);
    if (!m || m.index === undefined) continue;
    const start = text.indexOf("[", m.index);
    if (start < 0) continue;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "[") depth++;
      else if (text[i] === "]") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    if (depth > 0) return text.slice(start);
  }
  return null;
}

function tryParseJsonArray(raw: string): unknown[] | null {
  const attempts = [
    raw,
    raw.replace(/,(\s*[}\]])/g, "$1"),
    tolerantJsonRepair(raw),
    tolerantJsonRepair(raw.replace(/,(\s*[}\]])/g, "$1")),
  ];
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* next */
    }
  }
  return null;
}

function normalizeSalvagedActionFrame(raw: unknown): ModernActionFrame | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const direction = typeof row.direction === "string" ? row.direction.trim() : "";
  const structural_basis = typeof row.structural_basis === "string" ? row.structural_basis.trim() : "";
  const why_fits = typeof row.why_fits === "string" ? row.why_fits.trim() : "";
  const needs_validation =
    (typeof row.needs_validation === "string" ? row.needs_validation.trim() : "") ||
    (typeof row.what_would_confirm === "string" ? row.what_would_confirm.trim() : "");
  if (!direction && !structural_basis && !needs_validation) return null;
  return {
    direction: direction || structural_basis.slice(0, 80) || "待补方向",
    why_fits: why_fits || "待补适配理由",
    structural_basis: structural_basis || "待补结构依据",
    needs_validation: needs_validation || direction || "待补验证点",
    status: "hypothesis",
  };
}

function normalizeSalvagedActionFrames(raw: unknown): ModernActionFrame[] {
  if (!Array.isArray(raw)) return [];
  const out: ModernActionFrame[] = [];
  for (const d of raw) {
    const frame = normalizeSalvagedActionFrame(d);
    if (frame) out.push(frame);
  }
  return out;
}

function mapRequiredActionFrame(raw: unknown, label: string): ModernActionFrame {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${label} invalid`);
  }
  const row = raw as Record<string, unknown>;
  const direction = typeof row.direction === "string" ? row.direction.trim() : "";
  const structural_basis = typeof row.structural_basis === "string" ? row.structural_basis.trim() : "";
  const why_fits = typeof row.why_fits === "string" ? row.why_fits.trim() : "";
  const needs_validation =
    (typeof row.needs_validation === "string" ? row.needs_validation.trim() : "") ||
    (typeof row.what_would_confirm === "string" ? row.what_would_confirm.trim() : "");
  if (!direction || !structural_basis || !needs_validation) {
    throw new Error(`${label} missing required fields`);
  }
  return {
    direction,
    why_fits: why_fits || "与本盘结构相合",
    structural_basis,
    needs_validation,
    status: "hypothesis",
  };
}

function placeholderKeyCrossroads(needs: string): KeyCrossroadsFrame {
  return {
    real_fork: "待补真正分岔点",
    path_costs: "待补路径代价",
    decision_traits: "待补决策特质",
    structural_basis: "待补结构依据",
    needs_validation: needs || "待补验证点",
  };
}

function placeholderEnergyRetune(needs: string): EnergyRetuneFrame {
  return {
    direction_fit: "待补使力方向",
    timing_ripeness: "条件成熟后再推进",
    daily_retune: "待补日常调频方向",
    complementary: "待补互补/避开",
    structural_basis: "待补结构依据",
    needs_validation: needs || "待补验证点",
    status: "hypothesis",
  };
}

function placeholderRhythm(): RhythmFrame {
  return {
    phase1_observe: "先观察关键信号",
    phase2_adjust: "再做小幅调整",
    phase3_consolidate: "巩固已验证方向",
  };
}

function agendaFromSalvagedFrames(frames: ModernActionFrame[]): AgendaItem[] | null {
  if (frames.length < 2) return null;
  const items: AgendaItem[] = [];
  for (let i = 0; i < frames.length; i++) {
    const d = frames[i]!;
    const label = (d.needs_validation || d.direction).trim().slice(0, 40);
    if (!label) continue;
    items.push({
      id: `agenda_${i + 1}`,
      label,
      critical: i < 2,
      status: "unexplored",
      frame_kind: "modern_action",
      frame_index: i + 1,
      supports: d.direction,
      serves_page: "science_action",
      serves_path: i === 0 ? "primary" : i === 1 ? "backup" : "both",
      role: "fill",
    });
  }
  if (items.length < 2) return null;
  while (items.length < 3) {
    items.push({
      id: `agenda_${items.length + 1}`,
      label: "待补关键信息",
      critical: false,
      status: "unexplored",
      serves_page: "science_action",
      serves_path: "both",
      role: "fill",
    });
  }
  return items;
}

/** Field-level salvage when xhigh JSON is malformed but content is present. */
export function salvageBreakthroughFields(cleaned: string): Record<string, unknown> | null {
  const base = tryParseJsonObject(cleaned) ?? {};

  const situation_conclusion =
    (typeof base.situation_conclusion === "string" ? base.situation_conclusion.trim() : "") ||
    (typeof base.relationship_conclusion === "string" ? base.relationship_conclusion.trim() : "") ||
    grabSalvageStringField(cleaned, [
      "situation_conclusion",
      "relationship_conclusion",
      "处境洞察",
      "关系结论",
    ]) ||
    "";
  if (!situation_conclusion) return null;

  let primary_path = normalizeSalvagedActionFrame(base.primary_path);
  let backup_path = normalizeSalvagedActionFrame(base.backup_path);

  let frames = normalizeSalvagedActionFrames(base.modern_action_frames);
  if (frames.length < 2) {
    frames = normalizeSalvagedActionFrames(base.breakthrough_directions);
  }
  if (frames.length < 2) {
    const block = extractJsonArrayBlock(cleaned, [
      "modern_action_frames",
      "breakthrough_directions",
      "破局方向",
      "行动骨架",
    ]);
    if (block) frames = normalizeSalvagedActionFrames(tryParseJsonArray(block));
  }
  if (!primary_path && frames[0]) primary_path = frames[0];
  if (!backup_path && frames[1]) backup_path = frames[1];
  // primary/backup optional (汇总段填); salvage only needs situation + multi_dim.

  let multi_dimension_reckoning = Array.isArray(base.multi_dimension_reckoning)
    ? base.multi_dimension_reckoning
    : undefined;
  if (!Array.isArray(multi_dimension_reckoning) || multi_dimension_reckoning.length === 0) {
    const dimBlock = extractJsonArrayBlock(cleaned, [
      "multi_dimension_reckoning",
      "多维真算",
    ]);
    if (dimBlock) {
      const parsedDims = tryParseJsonArray(dimBlock);
      if (Array.isArray(parsedDims)) multi_dimension_reckoning = parsedDims;
    }
  }
  if (!Array.isArray(multi_dimension_reckoning) || multi_dimension_reckoning.length === 0) {
    return null;
  }

  let investigation_agenda =
    parseInvestigationAgenda(base.investigation_agenda) ??
    normalizeAgendaFromLlm(base.investigation_agenda);
  if (!investigation_agenda) {
    const agendaBlock = extractJsonArrayBlock(cleaned, ["investigation_agenda", "调查议程"]);
    if (agendaBlock) {
      investigation_agenda = normalizeAgendaFromLlm(tryParseJsonArray(agendaBlock));
    }
  }
  if (!investigation_agenda && frames.length > 0) {
    investigation_agenda = agendaFromSalvagedFrames(frames);
  }
  if (!investigation_agenda) {
    investigation_agenda = [];
  }
  const first_question =
    (typeof base.first_question === "string" ? base.first_question.trim() : "") ||
    grabSalvageStringField(cleaned, ["first_question", "首问"]) ||
    "";

  // User-visible dialogue — must not be dropped on salvage (display must never
  // fall back to situation_conclusion, which is allowed to keep 命理词).
  const response =
    (typeof base.response === "string" ? base.response.trim() : "") ||
    grabSalvageStringField(cleaned, ["response", "对话", "用户回复"]) ||
    "";

  const needsSeed =
    frames[0]?.needs_validation ||
    (typeof (multi_dimension_reckoning[0] as { judgment?: string })?.judgment === "string"
      ? (multi_dimension_reckoning[0] as { judgment: string }).judgment
      : "") ||
    "";

  return {
    energy_structure:
      (typeof base.energy_structure === "string" ? base.energy_structure.trim() : "") || "",
    situation_conclusion,
    ...(response ? { response } : {}),
    key_crossroads:
      base.key_crossroads && typeof base.key_crossroads === "object"
        ? base.key_crossroads
        : placeholderKeyCrossroads(needsSeed),
    multi_dimension_reckoning,
    ...(primary_path ? { primary_path } : {}),
    ...(backup_path ? { backup_path } : {}),
    modern_action_frames: frames,
    energy_retune_frame:
      base.energy_retune_frame && typeof base.energy_retune_frame === "object"
        ? base.energy_retune_frame
        : placeholderEnergyRetune(needsSeed),
    rhythm_frame:
      base.rhythm_frame && typeof base.rhythm_frame === "object"
        ? base.rhythm_frame
        : placeholderRhythm(),
    self_check_signals: Array.isArray(base.self_check_signals)
      ? base.self_check_signals
      : ["走对了的信号待补", "该停下调整的信号待补", "外部反馈信号待补"],
    investigation_agenda,
    ...(first_question ? { first_question } : {}),
    _parse_salvaged: true,
  };
}

export function parseBreakthroughCoreResponseText(raw: string): unknown {
  const jsonStr = extractJson(raw);
  const direct = tryParseJsonObject(jsonStr);
  if (direct) return direct;

  const salvaged = salvageBreakthroughFields(jsonStr);
  if (salvaged) {
    console.info("[breakthrough-core] salvaged partial JSON from xhigh output");
    return salvaged;
  }

  throw new BreakthroughCoreParseError();
}

/** Parse + map with salvage retry when strict map fails on loosely-parsed JSON. */
export function parseAndMapBreakthroughCore(raw: string): ReturnType<typeof mapBreakthroughCorePayload> {
  let parsed: unknown;
  try {
    parsed = parseBreakthroughCoreResponseText(raw);
  } catch (e) {
    throw e instanceof BreakthroughCoreParseError ? e : new BreakthroughCoreParseError();
  }
  try {
    return mapBreakthroughCorePayload(parsed);
  } catch (firstError) {
    const salvaged = salvageBreakthroughFields(extractJson(raw));
    if (!salvaged) throw firstError;
    console.info("[breakthrough-core] map retry after field salvage");
    return mapBreakthroughCorePayload(salvaged);
  }
}

export function buildBreakthroughCoreAuditText(parsed: unknown): string {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "";
  const o = parsed as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.situation_conclusion === "string") parts.push(o.situation_conclusion);
  if (typeof o.relationship_conclusion === "string") parts.push(o.relationship_conclusion);
  const xc = o.key_crossroads;
  if (xc && typeof xc === "object" && !Array.isArray(xc)) {
    for (const v of Object.values(xc as Record<string, unknown>)) {
      if (typeof v === "string") parts.push(v);
    }
  }
  const pathFields = [o.primary_path, o.backup_path];
  for (const d of pathFields) {
    if (!d || typeof d !== "object" || Array.isArray(d)) continue;
    const row = d as Record<string, unknown>;
    for (const k of ["direction", "why_fits", "structural_basis", "needs_validation"] as const) {
      if (typeof row[k] === "string") parts.push(row[k]);
    }
  }
  const frames = o.modern_action_frames ?? o.breakthrough_directions;
  if (Array.isArray(frames)) {
    for (const d of frames) {
      if (!d || typeof d !== "object") continue;
      const row = d as Record<string, unknown>;
      for (const k of [
        "direction",
        "why_fits",
        "structural_basis",
        "needs_validation",
        "timing",
        "what_would_confirm",
      ] as const) {
        if (typeof row[k] === "string") parts.push(row[k]);
      }
    }
  }
  if (Array.isArray(o.multi_dimension_reckoning)) {
    for (const d of o.multi_dimension_reckoning) {
      if (!d || typeof d !== "object") continue;
      const row = d as Record<string, unknown>;
      for (const k of ["dimension", "chart_basis", "judgment"] as const) {
        if (typeof row[k] === "string") parts.push(row[k]);
      }
    }
  }
  const er = o.energy_retune_frame;
  if (er && typeof er === "object" && !Array.isArray(er)) {
    for (const v of Object.values(er as Record<string, unknown>)) {
      if (typeof v === "string") parts.push(v);
    }
  }
  const rhythm = o.rhythm_frame;
  if (rhythm && typeof rhythm === "object" && !Array.isArray(rhythm)) {
    for (const v of Object.values(rhythm as Record<string, unknown>)) {
      if (typeof v === "string") parts.push(v);
    }
  }
  if (Array.isArray(o.self_check_signals)) {
    for (const s of o.self_check_signals) {
      if (typeof s === "string") parts.push(s);
    }
  }
  const agenda = parseInvestigationAgenda(o.investigation_agenda);
  if (agenda) {
    for (const item of agenda) parts.push(item.label);
  }
  if (typeof o.first_question === "string") parts.push(o.first_question);
  return parts.join("\n");
}

function requireStringField(row: Record<string, unknown>, key: string, ctx: string): string {
  const v = typeof row[key] === "string" ? row[key].trim() : "";
  if (!v) throw new Error(`${ctx} missing ${key}`);
  return v;
}

function mapKeyCrossroads(raw: unknown): KeyCrossroadsFrame {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Missing key_crossroads");
  }
  const row = raw as Record<string, unknown>;
  return {
    real_fork: requireStringField(row, "real_fork", "key_crossroads"),
    path_costs: requireStringField(row, "path_costs", "key_crossroads"),
    decision_traits: requireStringField(row, "decision_traits", "key_crossroads"),
    structural_basis: requireStringField(row, "structural_basis", "key_crossroads"),
    needs_validation: requireStringField(row, "needs_validation", "key_crossroads"),
  };
}

function mapEnergyRetune(raw: unknown): EnergyRetuneFrame {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Missing energy_retune_frame");
  }
  const row = raw as Record<string, unknown>;
  return {
    direction_fit: requireStringField(row, "direction_fit", "energy_retune_frame"),
    timing_ripeness: requireStringField(row, "timing_ripeness", "energy_retune_frame"),
    daily_retune: requireStringField(row, "daily_retune", "energy_retune_frame"),
    complementary: requireStringField(row, "complementary", "energy_retune_frame"),
    structural_basis: requireStringField(row, "structural_basis", "energy_retune_frame"),
    needs_validation: requireStringField(row, "needs_validation", "energy_retune_frame"),
    status: "hypothesis",
  };
}

function mapRhythm(raw: unknown): RhythmFrame {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Missing rhythm_frame");
  }
  const row = raw as Record<string, unknown>;
  return {
    phase1_observe: requireStringField(row, "phase1_observe", "rhythm_frame"),
    phase2_adjust: requireStringField(row, "phase2_adjust", "rhythm_frame"),
    phase3_consolidate: requireStringField(row, "phase3_consolidate", "rhythm_frame"),
  };
}

export function mapBreakthroughCorePayload(parsed: unknown): {
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
} {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Breakthrough core response is not an object");
  }
  const o = parsed as Record<string, unknown>;
  const energy_structure =
    typeof o.energy_structure === "string" ? o.energy_structure.trim() : "";
  const situation_conclusion =
    (typeof o.situation_conclusion === "string" ? o.situation_conclusion.trim() : "") ||
    (typeof o.relationship_conclusion === "string" ? o.relationship_conclusion.trim() : "");
  if (!situation_conclusion) {
    throw new Error("Missing situation_conclusion");
  }

  const rawFrames = o.modern_action_frames ?? o.breakthrough_directions;
  let modern_action_frames: ModernActionFrame[] = [];
  if (Array.isArray(rawFrames) && rawFrames.length > 0) {
    modern_action_frames = rawFrames.map((d, i) => mapRequiredActionFrame(d, `modern_action_frames[${i}]`));
  }

  // 第2段只发散:primary/backup 由汇总段填;若旧模型仍吐出则兼容收下,不强制。
  const primary_path =
    o.primary_path != null ? mapRequiredActionFrame(o.primary_path, "primary_path") : undefined;
  const backup_path =
    o.backup_path != null ? mapRequiredActionFrame(o.backup_path, "backup_path") : undefined;
  if (modern_action_frames.length === 0 && primary_path && backup_path) {
    modern_action_frames = [primary_path, backup_path];
  }

  let multi_dimension_reckoning: DimensionReckoning[] | undefined;
  if (Array.isArray(o.multi_dimension_reckoning)) {
    const dims: DimensionReckoning[] = [];
    for (const entry of o.multi_dimension_reckoning) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const dimension = typeof e.dimension === "string" ? e.dimension.trim() : "";
      const judgment = typeof e.judgment === "string" ? e.judgment.trim() : "";
      if (!dimension || !judgment) continue;
      dims.push({
        dimension,
        chart_basis: typeof e.chart_basis === "string" ? e.chart_basis.trim() : "",
        judgment,
      });
    }
    if (dims.length > 0) multi_dimension_reckoning = dims;
  }
  if (!multi_dimension_reckoning?.length) {
    throw new Error("multi_dimension_reckoning is required (≥1 dimension)");
  }

  const salvaged = Boolean(o._parse_salvaged);
  const key_crossroads = salvaged
    ? o.key_crossroads && typeof o.key_crossroads === "object"
      ? {
          ...placeholderKeyCrossroads(modern_action_frames[0]?.needs_validation ?? ""),
          ...(o.key_crossroads as Partial<KeyCrossroadsFrame>),
          real_fork:
            typeof (o.key_crossroads as KeyCrossroadsFrame).real_fork === "string" &&
            (o.key_crossroads as KeyCrossroadsFrame).real_fork.trim()
              ? (o.key_crossroads as KeyCrossroadsFrame).real_fork.trim()
              : "待补真正分岔点",
          path_costs:
            typeof (o.key_crossroads as KeyCrossroadsFrame).path_costs === "string" &&
            (o.key_crossroads as KeyCrossroadsFrame).path_costs.trim()
              ? (o.key_crossroads as KeyCrossroadsFrame).path_costs.trim()
              : "待补路径代价",
          decision_traits:
            typeof (o.key_crossroads as KeyCrossroadsFrame).decision_traits === "string" &&
            (o.key_crossroads as KeyCrossroadsFrame).decision_traits.trim()
              ? (o.key_crossroads as KeyCrossroadsFrame).decision_traits.trim()
              : "待补决策特质",
          structural_basis:
            typeof (o.key_crossroads as KeyCrossroadsFrame).structural_basis === "string" &&
            (o.key_crossroads as KeyCrossroadsFrame).structural_basis.trim()
              ? (o.key_crossroads as KeyCrossroadsFrame).structural_basis.trim()
              : "待补结构依据",
          needs_validation:
            typeof (o.key_crossroads as KeyCrossroadsFrame).needs_validation === "string" &&
            (o.key_crossroads as KeyCrossroadsFrame).needs_validation.trim()
              ? (o.key_crossroads as KeyCrossroadsFrame).needs_validation.trim()
              : modern_action_frames[0]?.needs_validation || "待补验证点",
        }
      : placeholderKeyCrossroads(modern_action_frames[0]?.needs_validation ?? "")
    : mapKeyCrossroads(o.key_crossroads);

  const energy_retune_frame = salvaged
    ? o.energy_retune_frame && typeof o.energy_retune_frame === "object"
      ? {
          ...placeholderEnergyRetune(modern_action_frames[0]?.needs_validation ?? ""),
          ...(o.energy_retune_frame as Partial<EnergyRetuneFrame>),
          status: "hypothesis" as const,
        }
      : placeholderEnergyRetune(modern_action_frames[0]?.needs_validation ?? "")
    : mapEnergyRetune(o.energy_retune_frame);

  const rhythm_frame = salvaged
    ? o.rhythm_frame && typeof o.rhythm_frame === "object"
      ? { ...placeholderRhythm(), ...(o.rhythm_frame as Partial<RhythmFrame>) }
      : placeholderRhythm()
    : mapRhythm(o.rhythm_frame);

  let self_check_signals: string[] = [];
  if (Array.isArray(o.self_check_signals)) {
    self_check_signals = o.self_check_signals
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
  }
  if (self_check_signals.length < 3) {
    if (!salvaged) throw new Error("self_check_signals must have 3–4 items");
    while (self_check_signals.length < 3) {
      self_check_signals.push(`待补自检信号${self_check_signals.length + 1}`);
    }
  }

  const investigation_agenda =
    parseInvestigationAgenda(o.investigation_agenda) ??
    normalizeAgendaFromLlm(o.investigation_agenda) ??
    [];

  const first_question =
    typeof o.first_question === "string" && o.first_question.trim()
      ? o.first_question.trim()
      : undefined;

  const responseRaw = typeof o.response === "string" ? o.response.trim() : "";
  const response = responseRaw || undefined;

  const now = new Date().toISOString();
  return {
    breakthrough_core: {
      ...(energy_structure ? { energy_structure } : {}),
      situation_conclusion,
      ...(response ? { response } : {}),
      key_crossroads,
      modern_action_frames,
      multi_dimension_reckoning,
      ...(primary_path ? { primary_path } : {}),
      ...(backup_path ? { backup_path } : {}),
      energy_retune_frame,
      rhythm_frame,
      self_check_signals: self_check_signals.slice(0, 4),
      ...(first_question ? { first_question } : {}),
      generated_at: now,
    },
    investigation_agenda,
  };
}

function scrubUserField(s: string, locale: string): string {
  return sanitizePaymentAuditLeaks(s, locale);
}

/**
 * 用户可见正文（response / first_question）：合规清洗后【物理剥掉】所有标记，只留白话。
 * 提示词禁标记不够 —— 「提示词禁 ≠ 代码禁」，出口必须代码焊死。
 * 泄漏必须响亮：静默降级 = 提示词被稀释了也没人知道。
 */
function scrubBodyField(
  s: string,
  locale: string,
  field: string,
): { text: string; leaks: number } {
  const scrubbed = scrubUserField(s, locale);
  const markers = scrubbed.match(/⟦t:[^⟧]+⟧/g);
  if (!markers?.length) return { text: scrubbed, leaks: 0 };
  console.warn(
    `[breakthrough-core] BODY MARKER LEAK — ${field} 用户可见正文出现 ${markers.length} 个标记，已降级为白话。` +
      `模型违反「仅 response 合规、零标记」（见 DEEP_RECKONING_REPORT_TASK「合规范围」段）。`,
    { field, sample: markers.slice(0, 3) },
  );
  return { text: degradeMarkersToPlain(scrubbed, locale), leaks: markers.length };
}

/**
 * Call A sanitize：骨架是内部资料 → 原样保留（不合规、不打标）。
 * 只 scrub + 审计【response】（唯一给用户看的）；first_question 若误入也按用户可见处理。
 * agenda label 仍 scrub（面板可见）。
 */
export function sanitizeBreakthroughCoreMapped(
  mapped: {
    breakthrough_core: BreakthroughCore;
    investigation_agenda: AgendaItem[];
  },
  locale: string,
): {
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
  violations: ComplianceViolation[];
  body_marker_leaks: number;
} {
  const core = mapped.breakthrough_core;
  let bodyLeaks = 0;
  const body = (s: string, field: string): string => {
    const r = scrubBodyField(s, locale, field);
    bodyLeaks += r.leaks;
    return r.text;
  };

  const breakthrough_core: BreakthroughCore = {
    ...core,
    // 骨架字段：内部资料，不 scrub、不打标、不审计
    situation_conclusion: core.situation_conclusion,
    key_crossroads: core.key_crossroads,
    modern_action_frames: core.modern_action_frames,
    primary_path: core.primary_path,
    backup_path: core.backup_path,
    energy_retune_frame: core.energy_retune_frame,
    rhythm_frame: core.rhythm_frame,
    self_check_signals: core.self_check_signals,
    ...(core.response ? { response: body(core.response, "response") } : {}),
    ...(core.first_question
      ? { first_question: body(core.first_question, "first_question") }
      : {}),
  };
  const investigation_agenda = mapped.investigation_agenda.map((a) => ({
    ...a,
    label: scrubUserField(a.label, locale),
  }));

  // 只审 response（给用户看的）；骨架字段不审——内部资料，裸命理词无妨
  const auditBlob = breakthrough_core.response ?? "";

  const violations = auditPaymentLeakResiduals(auditBlob, locale);
  if (bodyLeaks > 0) {
    console.warn(
      `[breakthrough-core] 本轮共 ${bodyLeaks} 处用户可见正文标记被降级 —— 持续出现则回查提示词「合规范围」段是否被稀释。`,
    );
  }
  return { breakthrough_core, investigation_agenda, violations, body_marker_leaks: bodyLeaks };
}

export class BreakthroughCoreComplianceError extends Error {
  readonly violations: ComplianceViolation[];
  constructor(violations: ComplianceViolation[]) {
    const labels = [...new Set(violations.map((v) => v.label))].slice(0, 8).join(",");
    super(`compliance_block: ${labels}`);
    this.name = "BreakthroughCoreComplianceError";
    this.violations = violations;
  }
}

/** Parse + map; payment-audit only response. Throws BreakthroughCoreComplianceError if response still leaks. */
export function parseSanitizeBreakthroughCore(
  raw: string,
  locale: string,
): {
  breakthrough_core: BreakthroughCore;
  investigation_agenda: AgendaItem[];
} {
  const mapped = parseAndMapBreakthroughCore(raw);
  // Call A: drop any accidental agenda / first_question — B owns those.
  const reportOnly = {
    breakthrough_core: {
      ...mapped.breakthrough_core,
      first_question: undefined,
    },
    investigation_agenda: [] as AgendaItem[],
  };
  const sanitized = sanitizeBreakthroughCoreMapped(reportOnly, locale);
  if (
    sanitized.violations.length > 0 &&
    isCriticalDeliveryAuditFailure(sanitized.violations)
  ) {
    throw new BreakthroughCoreComplianceError(sanitized.violations);
  }
  return {
    breakthrough_core: sanitized.breakthrough_core,
    investigation_agenda: [],
  };
}

export class AgendaBridgeParseError extends Error {
  constructor(message = "agenda_bridge_parse_failed") {
    super(message);
    this.name = "AgendaBridgeParseError";
  }
}

export class AgendaAnchorError extends Error {
  constructor(message = "agenda_anchor_failed") {
    super(message);
    this.name = "AgendaAnchorError";
  }
}

/** Call B parse + anchor check against A's scheme skeletons. */
export function parseSanitizeAgendaBridge(
  raw: string,
  locale: string,
  core: BreakthroughCore,
): {
  investigation_agenda: AgendaItem[];
  first_question: string;
  options?: string[];
} {
  const cleaned = extractJson(raw) || raw;
  const repaired = tolerantJsonRepair(cleaned);
  const parsed = tryParseJsonObject(repaired) ?? tryParseJsonObject(cleaned);
  if (!parsed || typeof parsed !== "object") {
    throw new AgendaBridgeParseError("invalid_json");
  }
  const o = parsed as Record<string, unknown>;
  const investigation_agenda =
    parseInvestigationAgenda(o.investigation_agenda) ??
    normalizeAgendaFromLlm(o.investigation_agenda);
  if (!investigation_agenda || investigation_agenda.length === 0) {
    throw new AgendaBridgeParseError("missing_agenda");
  }
  const first_question =
    typeof o.first_question === "string" ? o.first_question.trim() : "";
  if (!first_question) {
    throw new AgendaBridgeParseError("missing_first_question");
  }
  // Reject yes/no 过场
  if (
    /看完了吗|阅读了吗|可以开始了吗|准备好了吗|did you (already )?read|ready to (start|continue)\?/i.test(
      first_question,
    )
  ) {
    throw new AgendaBridgeParseError("yes_no_bridge_forbidden");
  }

  const scrubbedAgenda = investigation_agenda.map((a) => ({
    ...a,
    label: scrubUserField(a.label, locale),
    ...(a.supports ? { supports: scrubUserField(a.supports, locale) } : {}),
  }));
  // first_question 是发给用户的正文 —— 零金字。
  const scrubbedQ = scrubBodyField(first_question, locale, "first_question").text;

  const anchor = validateAgendaAnchorsToFrames(scrubbedAgenda, core);
  if (!anchor.ok) {
    throw new AgendaAnchorError(anchor.reason);
  }

  const violations = auditPaymentLeakResiduals(scrubbedQ, locale);
  if (violations.length > 0 && isCriticalDeliveryAuditFailure(violations)) {
    throw new BreakthroughCoreComplianceError(violations);
  }

  const options = sanitizeReplyOptions(o.options);

  return { investigation_agenda: anchor.agenda, first_question: scrubbedQ, options };
}

export async function resolveBaseAnalysisForBreakthrough(
  session: POJUSessionState,
): Promise<unknown | null> {
  const id =
    uuidLike(session.selected_stored_profile_id) ??
    uuidLike(session.agent_v2?.selected_profile_id);
  if (id) {
    const stored = await getStoredProfile(id);
    const ba = stored?.base_analysis?.content ?? stored?.base_analysis ?? null;
    if (ba != null) return ba;
  }
  const { base_analysis } = await loadSessionProfileBundle(session);
  return base_analysis ?? null;
}

function uuidLike(s: string | null | undefined): string | null {
  if (!s || s === "active_user_profile") return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return s;
  return null;
}

export async function requestBreakthroughCore(
  session: POJUSessionState,
  locale: string,
  options?: {
    base_analysis?: unknown | null;
    onProgress?: (accumulated_chars: number) => void;
  },
): Promise<{
  session: POJUSessionState;
  tokens_used: number;
  llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
  model?: string;
}> {
  if (typeof window === "undefined") {
    throw new Error("requestBreakthroughCore is browser-only");
  }

  const agent = session.agent_v2;
  if (!agent) throw new Error("agent_v2 required for breakthrough-core");
  if (agent.breakthrough_core != null) {
    return { session, tokens_used: 0 };
  }

  let base_analysis = options?.base_analysis;
  if (base_analysis === undefined) {
    base_analysis = await resolveBaseAnalysisForBreakthrough(session);
  }
  if (base_analysis == null) {
    throw new Error(
      "[breakthrough-core] 命主基础分析缺失，无法锚定深测算（必锚命盘）。selected_stored_profile_id=" +
        (session.selected_stored_profile_id ?? "null"),
    );
  }

  const profileId =
    session.selected_stored_profile_id?.trim() ?? uuidLike(agent.selected_profile_id) ?? "";

  const original_question =
    session.agent_v2?.original_question?.trim() || session.original_question?.trim() || "";
  if (!original_question) {
    throw new Error(
      "[breakthrough-core] original_question empty — cannot anchor deep analysis to user dilemma",
    );
  }
  console.info("[breakthrough-core] input original_question:", original_question.slice(0, 120));

  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), XHIGH_JOB_POLL_MAX_MS);

  let breakthrough_core: BreakthroughCore | undefined;
  let investigation_agenda: AgendaItem[] | undefined;
  let tokens_used = 0;
  let llm_debug: import("@/lib/llm/llm-debug").LLMCallDebug | undefined;
  let model: string | undefined;

  try {
    const res = await fetch("/api/poju/breakthrough-core", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: session.session_id,
        original_question,
        agent_v2: agent,
        base_analysis,
        locale,
        selected_stored_profile_id: profileId || null,
      }),
      signal: ac.signal,
    });
    const createPayload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      job_id?: string;
      status?: string;
      retryable?: boolean;
      reason?: string;
      breakthrough_core?: BreakthroughCore;
      investigation_agenda?: AgendaItem[];
      model?: string;
      tokens_used?: number;
      llm_debug?: import("@/lib/llm/llm-debug").LLMCallDebug;
      error?: string;
    };
    if (!res.ok && !createPayload.job_id) {
      throw new Error(createPayload.error || `Breakthrough core create failed (${res.status})`);
    }

    breakthrough_core = createPayload.breakthrough_core;
    investigation_agenda = createPayload.investigation_agenda;
    tokens_used = typeof createPayload.tokens_used === "number" ? createPayload.tokens_used : 0;
    llm_debug = createPayload.llm_debug;
    model = createPayload.model;

    if (!breakthrough_core || !investigation_agenda) {
      const job_id = createPayload.job_id;
      if (!job_id) {
        if (createPayload.ok === false && createPayload.retryable) {
          console.warn("[breakthrough-core] soft failure (retryable):", createPayload.reason, createPayload.error);
          return { session, tokens_used: 0 };
        }
        throw new Error(createPayload.error || "Breakthrough core job missing job_id");
      }

      console.info("[breakthrough-core] async xhigh job started:", job_id);
      const polled = await pollBreakthroughCoreJobUntilDone({
        job_id,
        signal: ac.signal,
        callbacks: {
          onProgress: (chars) => options?.onProgress?.(chars),
        },
      });

      if (!polled.ok) {
        console.warn("[breakthrough-core] job failed (retryable):", polled.reason, polled.error);
        return { session, tokens_used: 0 };
      }

      breakthrough_core = polled.breakthrough_core;
      investigation_agenda = polled.investigation_agenda;
      tokens_used = typeof polled.tokens_used === "number" ? polled.tokens_used : 0;
      llm_debug = polled.llm_debug;
      model = polled.model;
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        locale.startsWith("zh")
          ? "深测算超时未完成，请点「重新生成分析」再试。"
          : "Deep analysis timed out — tap Regenerate analysis to retry.",
      );
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }

  if (!breakthrough_core) {
    throw new Error("Breakthrough core incomplete after job");
  }
  const agenda = investigation_agenda ?? [];

  const nextAgent: POJUAgentState = {
    ...agent,
    breakthrough_core,
    investigation_agenda: agenda,
    agenda_generated: true,
    has_situation_analysis: true,
  };

  console.info(
    "[breakthrough-core] persisted:",
    breakthrough_core.situation_conclusion.slice(0, 80),
    "action_frames:",
    breakthrough_core.modern_action_frames.length,
    "agenda:",
    agenda.map((a) => a.label),
  );

  return {
    session: {
      ...session,
      agent_v2: nextAgent,
      tokens_used: session.tokens_used + tokens_used,
    },
    tokens_used,
    llm_debug,
    model,
  };
}
