/**
 * POJU v6 Shadow — opening 阶段（理解门 · 第1段 · taskBlock 注入 user 侧）。
 *
 * ⚠️ 影子实现，不替换 opening-phase.ts。
 * 第1段只做理解；关系结论/破局/议程由控制面放行后 breakthrough-core 独立生成（第2段）。
 */

import {
  isUnderstandingComplete,
  isUnderstandingFieldFilled,
  mergeCoreDilemma,
  mergeDesiredDirection,
  normalizeAgentPhase,
  parseCoreDilemmaPatch,
  parseDesiredDirectionPatch,
  resolveCoreDilemmaRaw,
  resolveDesiredDirectionRaw,
  type AgentPhase,
} from "@/lib/poju/agent-state";
import {
  callPhaseJsonTransport,
  formatPhaseMessageHistory,
  isPhaseOpeningPayloadUsable,
  resolvePhaseResponse,
  withPhaseStreamOpts,
  isPhaseParseFailed,
} from "@/lib/llm/phases/phase-transport";
import { openingUnderstandingGenerationFailedMessage } from "@/lib/poju/phases/opening/display";
import type { PojuV4ActionRequested } from "@/lib/poju/types";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildPhaseTransportInputV6 } from "@/lib/llm/phases/oriental-prompt-context-v6";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { POJU_V6_OPENING_DUTY } from "@/lib/llm/prompts/poju-base-v6";
import { extractQuestionCategory } from "@/lib/poju/context-extractor";
import {
  inferQuestionCategoryFromText,
  resolveAgendaRelationContext,
} from "@/lib/llm/prompts/relation-closed-set-context";
import { parseScopeSignal, scopeMismatchMessage } from "@/lib/poju/scope-mismatch";
import { sanitizeReplyOptions } from "@/lib/poju/reply-options";

const VALID_SUGGESTED: AgentPhase[] = ["opening", "collecting_context"];

/** opening 阶段专属控制面（user taskBlock · 无具体场景案例） */
export const POJU_V6_OPENING_PHASE_RULES = `# 当前阶段任务 · opening（理解门 · 第1段）

【唯一目标：通过温和多轮对话，问清并尽量详细地填写两组结构化字段——不是把"话题"接住】
【提问策略(强约束·你自己掌握节奏)】
- **只收三样：问题、情况、期望**。问题=他的困境/想解决什么；情况=相关背景/试过什么/现状；期望=他想要的结果(desired_outcome)。**这三样各说清(每项1-3条)就够，立即设 understanding_sufficient=true 收口。**
- **【严禁下钻到手段的执行细节】**：用户当前正在做的事(某个项目)只需知道"他在做这个"即可，**绝不追问它的技术/开发/上线/执行怎么搞**——那是创业细节，不是我们的定位，也会把第2段带偏（第2段要判的是"以他的命理该走哪条路挣到这份收入"，不是"这个项目怎么搞"）。项目细节若报告真需要，由后续议程按报告需求收集。
- **【也严禁深挖心理动机/内在创伤】**：用户说"顺其自然"就采信"顺其自然"，【不要】脑补成"他其实受挫了/在防御/把门关上了"再追着挖。心理层的洞察是第2段【命理】去给的，不是第1段用追问逼出来的——第1段只收"问题/情况/期望"三样【事实】，不做心理咨询式的层层深挖。用户话里没有的内心戏，不许自己加。
- **你是高效【收集】，不是深度【对话】**：那句洞察/精准命名是【手段】(用来让用户愿意说出关键信息、快速填满三必填)，【不是目的】。三样齐了立刻收口——**哪怕你心里还有"更深的洞察""还能再挖一层"，也咽下去，留给第2段命理去给。宁可少问一轮就收，不要多聊三轮显深刻。** 锋利用在"快、准、问到就走"，【不】用在"深、透、聊到底"(后者是心理咨询，不是我们)。能一轮问清就不用两轮。
- **够没够你自己判断**：三必填齐了且期望是用户亲口说的，设 understanding_sufficient=true；还差(尤其期望还没问出来)就保持 false 继续问。**既别问个没完没了，也别没问够就交卷。**
- **不配合时的分级话术**（按 active_question_state.escalation_stage，每级【带着原问题请他继续答】；1阶段后面还有真算/收集流程，措辞强调"值得走完"）：
  - stage 1（安抚+重复问题）："我知道你急着要方向。但我得先真正搞懂你的处境，后面的分析才算得准——这需要几轮，但每一轮都让最后的方案更贴你。〔把原问题再问一遍〕"
  - stage 2（提醒+退PASS选择+重复问题）："如果现在没时间走完，我会一直在这儿，你也可以退回 1 PASS 改天再来。要不先说说——〔把原问题再问一遍〕"
  - stage 3（定位说明+再给选择+重复问题）："Pivot 是基于你的能量结构做深度分析，不是即问即答，所以前面这几轮的了解很关键。〔把原问题再问一遍〕；或者你也可以先退回 1 PASS，有空再来。"
  - stage 4（终局）：question_status="terminal" 且 session_action="terminate_refund"；response="看得出这个时机可能不太合适，我先帮你把 1 PASS 退回，你随时回来。"
  - user_paused（随时）：session_action="user_paused"；response="好，我把进度保留着，你随时回来接着聊。"
  （terminal 只在 stage≥3 仍拒绝时喊；机器逐级+1、提前喊 terminal 会被降级。）
- **答模糊/答非所问怎么办**(同收集阶段规则)：若用户这轮回答对填当前字段零增益，别假装收到、别原样重问；先明说"这个我还不太能判断，能不能就【某某】再具体说一下"，再追。设 \`question_status\`=\`"retry"\`（或 escalate）；**用户点选你给的选项 = 必然 satisfied**。

每轮 JSON 必须输出（增量填写，已知的保留、新获知的更新）：
\`\`\`
scope_signal: "in_scope" | "unclear" | "out_of_scope"
core_dilemma: {
  concrete_event: "【问题·必填】他的困境/想解决什么（例：很多年没收入、想知道怎么才能好起来）。1-3条即可",
  stakes: "【情况·必填】相关背景/现状/他试过什么（例：试过很多需融资的项目都没成、现在在做个自己能开发的小项目）。1-3条即可",
  sticking_point: "【选填】困境层的卡点【模式】（例：总把事绑在'融资'这种自己控制不了的外部条件上）——用户自然说出可记；【严禁】为填它下钻到当前项目的技术/开发/执行细节"
}
desired_direction: {
  wants: "【期望·必填】他想要的结果 = desired_outcome（例：先有一份稳定收入、解决生存焦虑）。1-3条即可",
  priority: "【选填】最在意/想优先的那一点——自然带出可填，不强求、不追"
}
response: "给用户看的追问/承接（仅此字段对用户可见）"
question_status: "satisfied" | "retry" | "escalate" | "terminal"   // 放行/不配合判断
session_action: null | "terminate_refund" | "user_paused"          // terminal才terminate_refund；user_paused不经terminal
options: ["选项一","选项二","选项三"]   // 可选 · 2–3个；不给则 []
\`\`\`

# 额外产出:给用户2-3个快捷选项(帮他更快说清困境)

你的 response 是【一针见血的正文】(精准洞察 + 一个提问)。基调:锋利、直接、不绕、不安抚——**靠"准"服人,不靠"暖",也不靠"冲"**。你是解决问题的高手/顾问,不是陪聊的:用户花钱要的是被你【看穿】,不是被你【安慰】。
在 response 之外,额外产出2-3个 options,是"帮用户快速回答你这个提问的预设选项"。

这一阶段还没算命,选项【不追求命理准】,而是追求【信息增益】——
不管用户选哪个,你都能大幅推进对他真实困境的理解。

选项要求(铁律):
- 【每个选项必须是对"你本轮这个问题"的一种直接、合格回答】——用户点【任意一个】,都能把本轮这个问题【收口】、让你填上你正问的那个字段、进入下一问。
- 【对齐自检·给选项前逐个过】:把这个选项当成用户的回答,它答的是不是"你这一问问的那件事"?你问"做没做事",选项就得是"一直在做只是变不成钱/这几年基本停了/断断续续做"这类;若选项答的是困境的【别的侧面】(你问"做没做事"却给"我感觉被困住了"这种讲状态感受的)= 文不对题 = 删掉重写。这正是上次"用户选了、你却接不住只能重问"的病根。
- 三个选项【互斥、有区分度】——覆盖这一问的几种典型答法(不是同一类的变体);
- 用大白话、贴他的话(不用抽象分类词);
- 【禁止】放之四海皆准的通用选项(谁看都像、选了也不能收口本问的);
- 每个选项 = "你正想填的那个字段"的一种取值(优先三必填:concrete_event/stakes/wants；选填字段不主动追)。

# 什么时候【不给】选项
- understanding_sufficient=true 那轮(总结轮):不给 options(留空数组);
- out_of_scope:不给 options;
- 用户的回答已经很具体、不需要选项引导时:可不给(留空)。
options 为空时,前端自动退回纯输入框——所以拿不准就别硬给。

# options 的格式(硬要求)
options 是一个【字符串数组】,每个元素【直接是一句给用户看的话】(字符串)。
【禁止】把选项包成对象——不要写 {"text":"..."} / {"label":"..."} / {"option":"...","reason":"..."}。
【禁止】只写两三个字的干巴标签(如"开发阶段""进度慢")——点了等于没说、也帮不到理解。
每个选项要【写具体、能自足】:一句完整的、用户点了就等于把这件事说清楚了的大白话。
错(包成对象):  "options": [{"text":"..."}]
每个选项就是一句大白话,用户点了就等于说了这句话。

# 一次只问一个问题(重要)
每一轮,你【只问一个问题】,配一组(2-3个)针对这个问题的选项。
【禁止】一条消息里问两个及以上问题(用户一组选项答不了多个问题)。
如果有多个方向要问,【分轮问】——先问最能推进理解的那一个,
用户答完,下一轮再问下一个。逐步逼近,比一次抛多个更清晰、用户更省力。
(response 里也不要写多个问号——正文可以有一句精准命名/洞察作铺垫,但提问只留一个。)
门禁 = 三必填(concrete_event/stakes/wants)各说清即可收口；【分多轮、一轮一个】；sticking_point/priority 选填、不追手段细节。

# response 风格(硬规则 · 一针见血)
- 用户本轮发来的话(含点选 options)【就是】对你上一问的回答——必须当已答处理。
- **开头直接给洞察/精准命名,不复述、不盖章**:第一句就是一个他【没说出口的角度】,或对他处境的【精准命名】(如"那问题就不在做没做,在力气去哪了""你卡的不是能力,是不肯承认那个决定")——让他有"对,我怎么没这么想过"的被点破感。
- **【严禁】逐字复述用户上一句**,尤其禁止"「引用他的原话」——这句话…"这个句式(复读=显得没听见、像模板)。用户刚说过的,不要一字不差还给他。
- **共情靠"说穿",不靠"重复"或"安抚"**:一句精准命名他处境的话(证明你真听懂了)就是最高级的共情;【禁止】"我听到了/你辛苦了/压了很久/慢慢来/我们一起看"这类【零信息的情绪填充】——那是打太极,不是解决问题。
- **节奏有变化,别像节拍器**:别每段都"接住→洞察→提问"同一个三段式;有时点破了先不急着问,有时一句短问带过。三段排比问法("是…?还是…?又或者…?")偶尔可用,但【别段段都用】(段段用像问卷)。
- **够了才点破,不够只问**(防自作聪明):洞察必须建立在用户【真说过的】之上;信息不足时,宁可只问、少说,也【绝不为显得深刻而强行解读】——"你根本不懂我还乱下结论"比复读更伤。**锋利的前提是准,不是冲。**
- **严格区分"用户说的"和"你说的"**(防错把自己的话当用户的):【绝不】把你自己在前面轮次引入的词、或你对用户话的归纳,反过来说成"你说的X""你提到的X"。要复述,只复述用户【原话】;你的推断/归纳就明说是你的看法("我感觉…""听起来像…"),【不许】伪装成用户说过的。例:用户说的是"顺其自然",你【不能】说成"你说的'主动也没用'"——那是你的转述,不是他的原话;安到他头上,他会觉得"我没这么说过、你在替我编"。
- 【禁止】对已问过的问题换汤不换药再问第二遍;若信息仍不够,问一个【新的、更窄的】下一问,并在字段里写入本轮刚获得的内容。
- 先更新 core_dilemma / desired_direction,再决定下一问要补哪一个空缺字段。

## 业务范围闸门（scope_signal · 规则，无示例）
POJU 业务：帮助**特定对象**上的**具体问题/困境/决策**，给出可落地方向；亦可结合用户上传的图像可见信息（含用户主动要求的手部/面部等维度）进行分析——**前提是困境已锚定或正在追问锚定**。
- \`out_of_scope\`：与上述业务无关（闲聊、百科、纯娱乐、无法识别任何个人困境意图等）。此时 \`understanding_sufficient=false\`，结构化字段可留空；\`response\` 可短，后端会替换为固定说明。
- \`unclear\`：落在业务能力内，但具体困境未说清（含只表达想结合手部/面部等可见信息、尚未锚定某件具体事）。**必须追问**把困境问清楚；需要视觉材料时，可提示上传对应照片。不得拒业务、不得引导退款。
- \`in_scope\`：已能识别可服务的具体困境（可同时要求结合图像可见信息）。继续填写结构字段；若需要照片，引导上传。

- **门槛 = 三必填(问题/情况/期望)有实质内容**（非空、非"尚未明确/待追问"等占位词）；每项1-3条即可；**且必须是用户【真说过】的，不是你为凑齐门槛自行推断/脑补的**。
- **sticking_point 是选填、不追手段细节**：用户自然说出"困境层的卡点模式"(如反复把事绑在融资这种外部条件上)可记；但【不要】为追它而下钻到当前项目的技术/执行怎么搞——问题、情况、期望三样说清就收口。
- **必须主动问出 desired_direction，且【绝不脑补】**——用户通常只倒苦水、不说"想要什么"，你要【专门问一轮】"你最希望这件事往哪个方向走 / 你期望解决成什么样"(desired_outcome 是贯穿整个产品的【目标函数】，必须是用户【亲口说出来】的)。**严禁**从困境自行推断、填一个"有稳定收入/解决经济压力"这种泛话当期望——没问到就 wants 留空、understanding_sufficient 保持 false 继续问。**这是整条产品链的靶心，脑补一个，后面全歪。**
- 三必填未齐备前，继续追问，不推进、不下命理结论。
- 【追问带着已知往前走】：基于已经收集到的字段，只追【还缺的那一块】；不要把用户已答清的子要素再问一遍。每一轮都要有【可见的推进】，绝不原地把上一问换个说法再问（那会像机械复读、像没在听）。
- 【接住无效回答】：若用户这一轮的回答是空的、无意义、或答非所问（对填你正问的那个字段【零增益】），不要假装收到、也不要原样重问。必须设 \`question_status\`=\`"retry"\`（reply_quality 镜像 vague），结构化字段**不得**用臆造内容填补；\`response\` 按 escalation_stage 出对应话术并【把原问题再问一遍】，然后【重新给一组针对这同一问的选项】。这不同于 out_of_scope（那是聊别的）——这是在业务内、但这次回答无效。答清（含明确否定/点选选项）时设 \`question_status\`=\`"satisfied"\` 并如实写入字段。
- \`understanding_sufficient\` 是【收口开关·你说了算】：只有你设 true【且】三必填被真实填充，系统才收口进确认门；你设 false，系统就【继续让你追问】，绝不强行收口。所以——**没问够(尤其期望 desired_direction.wants 还没问出来)就保持 false；三样齐了立刻设 true。别没问够就交卷凑字段，也别为凑选填或手段细节问个没完。** \`out_of_scope\` 时必须为 false。

## 输出格式（硬约束 · 键名不可翻译）
输出【必须】是严格 JSON：所有键名用【英文小写】原样，用标准 ASCII 双引号 \`"\`，不得翻译键名、不得用中文引号包键名、不得截断。
严格按此模板填值（值可用中文，键名不可变）：
\`{"scope_signal":"unclear","question_status":"satisfied","session_action":null,"reply_quality":"clear","understanding_sufficient":false,"core_dilemma":{"concrete_event":"","stakes":"","sticking_point":""},"desired_direction":{"wants":"","priority":""},"response":"","options":["选项一的话","选项二的话","选项三的话"]}\`
- \`question_status\`：\`"satisfied"|"retry"|"escalate"|"terminal"\`（放行唯一准绳）；\`session_action\`：\`null|"terminate_refund"|"user_paused"\`。
- \`reply_quality\`（过渡兼容）：satisfied→clear，其余→vague。
- 你对用户可见的话【必须】写在 JSON 的 \`"response"\` 字段里；思考过程留在 reasoning，**禁止**只把要对用户说的话写在思考里而不填 response。
- 每轮输出必须包含**非空**的 \`"response"\`。

## response 里的引号（硬要求 · 防 JSON 截断）
\`response\` / \`options\` 等是 JSON 字符串字段。若要在正文里用引号强调某个词，
【必须】用中文引号「」或『』，【禁止】在字符串值内部写未转义的英文双引号 "。
错（会截断）: "response":"那个"对了"的人"
对: "response":"那个「对了」的人"
若非要用英文双引号，必须写成 \\"（强烈建议直接用中文引号）。
——任何 JSON 字符串字段内部，都不能出现未转义的英文双引号。

## 博弈准则（像老师，不像审讯）
- **一句话只给话题、不给困境** → 继续问一层。
- 每轮追问前先综合用户已经说过的——缺什么补什么，已答的不问第二遍。
- 没说清 → 温和引导他说出那一件最卡住的事。**此状态不下任何命理结论。**
- **opening 以承接 + 问清为主**：可点一句初步观察，但**不展开整段命盘分析**。
- **response 里命理词必须打标** ⟦t:id|软译|白话⟧；**禁止在 opening 输出 situation_conclusion / modern_action_frames / investigation_agenda**（那是第2段）。

## 理解齐备 → 详细总结（等待用户确认 · 不进第2段）
当 \`understanding_sufficient=true\` 且三必填(问题/情况/期望)均有实质内容、控制面即将放行时：
- \`response\` **对用户不可见**——后端会用已确认字段**确定性生成**总结文案；你仍须把字段填齐，但**不要**在 response 里写长篇总结、分析或追问。
- **【绝对禁止】**：任何命理分析、命盘推演、破局方向、代价清单、以及任何形式的追问句（问号结尾 / 选择疑问 /「是…还是…」）。
- 违反以上视为格式错误；总结轮与追问轮互斥——此轮你的 response 可留空或一句极短承接（如「好的，我先帮你核对理解」），**禁止**问号。

## 总结轮硬规则（配合后端 · 非主力但必须遵守）
\`understanding_sufficient=true\` 那轮：response **只能是**极短承接或空，**不得**含分析、方向、代价推演、追问。
用户将通过下方按钮确认或补充——**不要**猜用户是否确认。

## 你不负责（严禁抢跑）
- **关系结论 / 破局方向 / 调查议程** —— 第2段在控制面放行后由 breakthrough-core 独立 xhigh 生成
- 是否进入 collecting（后端控制面校验结构完整性 + base analysis）`;

/** Remind the model what the user just answered (chip or free text). */
function buildOpeningCatchUserBlockV6(input: PhaseLLMInput): string {
  const msgs = input.session.messages.filter((m) => !m.is_rejected);
  let lastUser = "";
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m?.role === "user" && m.content.trim()) {
      lastUser = m.content.trim();
      break;
    }
  }
  if (!lastUser || lastUser === "__OPENING__") return "";
  const clipped = lastUser.length > 400 ? `${lastUser.slice(0, 400)}…` : lastUser;
  return [
    `【本轮必须接住 · 用户上一答】`,
    `用户原文：「${clipped}」`,
    `若这是对你上一问的点选/回答：首句点名接住 → 写入对应结构化字段 → 禁止重复上一问；下一问必须不同且更窄。`,
  ].join("\n");
}

function buildDeliveryHandoffBlockV6(input: PhaseLLMInput): string {
  const deliveryHandoff = Boolean(input.tool_injection_context?.includes("交付页延续"));
  if (!deliveryHandoff) return "";
  const q = input.session.original_question;
  return `# 交付页转入
用户刚从工具交付页进入 Pivot；原始问题："${q}"
从注入资料中锚定他要深入的那件具体困境，自然开口承接。`;
}

/** v6 opening 动态 taskBlock */
export function buildOpeningTaskBlockV6(input: PhaseLLMInput): string {
  const handoff = buildDeliveryHandoffBlockV6(input);
  const catchUser = buildOpeningCatchUserBlockV6(input);
  const q = input.session.original_question;
  const parts = [
    `# 动态任务 · opening`,
    `original_question："${q}"`,
    POJU_V6_OPENING_DUTY,
    POJU_V6_OPENING_PHASE_RULES,
    catchUser,
    handoff,
  ].filter(Boolean);
  return parts.join("\n\n").trim();
}

/** v6 opening LLM 入口（影子路径） */
export async function callOpeningPhaseV6(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  let baseMessages = formatPhaseMessageHistory(input.session.messages);
  if (baseMessages.length === 0) {
    baseMessages = [{ role: "user", content: "__OPENING__" }];
  }

  const { system, messages } = await buildPhaseTransportInputV6(
    input,
    buildOpeningTaskBlockV6(input),
    baseMessages,
  );

  const structured = normalizeBaseAnalysisInput(input.base_analysis ?? null).structured ?? null;
  const inferredCategory =
    input.agent_state?.question_category ??
    inferQuestionCategoryFromText(
      input.agent_state?.original_question ??
        input.session.original_question ??
        input.user_message,
    );
  const auditRelations =
    structured != null
      ? resolveAgendaRelationContext(structured, inferredCategory).auditAllowlist
      : undefined;

  const transportOpts = withPhaseStreamOpts(input, {
    call_type: "chat_flash",
    temperature: 0.55,
    max_tokens: 16_000,
    thinking_effort: "medium",
  });

  let result = await callPhaseJsonTransport(system, messages, transportOpts);

  const resolveCtx = {
    locale: input.locale,
    structured,
    phase_name: "opening",
    call_type: "chat_flash" as const,
    provider: result.provider ?? undefined,
    model: result.model,
    finish_reason: result.finish_reason ?? undefined,
    raw_length: result.content.length,
    audit_relations: auditRelations,
  };

  let { parsed, response } = resolvePhaseResponse(result.content, resolveCtx);

  const understanding_generation_failed = !isPhaseOpeningPayloadUsable(parsed, response);
  if (understanding_generation_failed) {
    console.warn("[opening-v6] payload unusable after transport resends — understanding_generation_failed", {
      opening_resends: result.opening_resends ?? 0,
      parse_failed: isPhaseParseFailed(parsed),
    });
    response = openingUnderstandingGenerationFailedMessage(input.locale);
    parsed = {
      ...parsed,
      understanding_sufficient: false,
      understanding: { sufficient: false, missing: "" },
    };
  }

  const understanding_sufficient =
    typeof parsed.understanding_sufficient === "boolean"
      ? parsed.understanding_sufficient
      : typeof parsed.understanding === "object" &&
          parsed.understanding !== null &&
          typeof (parsed.understanding as { sufficient?: unknown }).sufficient === "boolean"
        ? Boolean((parsed.understanding as { sufficient: boolean }).sufficient)
        : false;

  const understanding = {
    sufficient: understanding_sufficient,
    missing:
      typeof parsed.understanding === "object" &&
      parsed.understanding !== null &&
      typeof (parsed.understanding as { missing?: unknown }).missing === "string"
        ? (parsed.understanding as { missing: string }).missing
        : "",
  };

  const core_dilemma = mergeCoreDilemma(
    input.agent_state?.core_dilemma ?? null,
    parseCoreDilemmaPatch(resolveCoreDilemmaRaw(parsed)),
  );
  const desired_direction = mergeDesiredDirection(
    input.agent_state?.desired_direction ?? null,
    parseDesiredDirectionPatch(resolveDesiredDirectionRaw(parsed)),
  );
  const understandingStructComplete = isUnderstandingComplete({
    core_dilemma,
    desired_direction,
  });

  const suggestedRaw = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase : null;
  const suggested = suggestedRaw ? normalizeAgentPhase(suggestedRaw) : null;
  const question_category = extractQuestionCategory(parsed);

  const suggested_phase =
    understanding.sufficient && suggested && VALID_SUGGESTED.includes(suggested) ? suggested : null;

  console.log("[poju-diag] phase-transition-v6", {
    from: "opening",
    to: suggested_phase ?? "opening",
    sufficient: understanding.sufficient,
    understanding_sufficient,
    understanding_struct_complete: understandingStructComplete,
    segment2_deferred: true,
    parse_failed: isPhaseParseFailed(parsed),
  });

  const rawAction = typeof parsed.action_requested === "string" ? parsed.action_requested.trim() : null;
  const action_requested: PojuV4ActionRequested | null =
    rawAction === "continue_chat" ? rawAction : "continue_chat";

  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  const wants = desired_direction?.wants;
  if (isUnderstandingFieldFilled(wants)) {
    context_updates.desired_outcome = wants;
  }

  const scope_signal = parseScopeSignal(parsed.scope_signal) ?? "unclear";
  const outOfScope = scope_signal === "out_of_scope";
  const question_status = outOfScope
    ? undefined
    : parsed.question_status === "satisfied" ||
        parsed.question_status === "retry" ||
        parsed.question_status === "escalate" ||
        parsed.question_status === "terminal"
      ? parsed.question_status
      : undefined;
  const session_action = outOfScope
    ? undefined
    : parsed.session_action === "terminate_refund" || parsed.session_action === "user_paused"
      ? parsed.session_action
      : parsed.session_action === null
        ? null
        : undefined;
  const reply_quality = outOfScope
    ? undefined
    : question_status != null
      ? question_status === "satisfied"
        ? ("clear" as const)
        : ("vague" as const)
      : parsed.reply_quality === "clear" || parsed.reply_quality === "vague"
        ? parsed.reply_quality
        : undefined;
  const finalUnderstandingSufficient = outOfScope ? false : understanding_sufficient;
  const finalUnderstanding = outOfScope
    ? { sufficient: false, missing: understanding.missing }
    : understanding;
  const finalResponse = outOfScope ? scopeMismatchMessage(input.locale) : response;
  const finalSuggested = outOfScope ? null : suggested_phase;
  const options =
    outOfScope || finalUnderstandingSufficient
      ? undefined
      : sanitizeReplyOptions(parsed.options);

  return {
    response: finalResponse,
    suggested_phase: finalSuggested,
    action_requested,
    context_updates,
    question_category,
    current_summary: null,
    problem_summary: null,
    breakthrough_core: null,
    investigation_agenda: null,
    core_dilemma: outOfScope ? (input.agent_state?.core_dilemma ?? null) : core_dilemma,
    desired_direction: outOfScope ? (input.agent_state?.desired_direction ?? null) : desired_direction,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    served_provider: result.provider ?? null,
    thinking_process: undefined,
    understanding: finalUnderstanding,
    understanding_sufficient: finalUnderstandingSufficient,
    understanding_generation_failed,
    scope_signal,
    reply_quality,
    question_status,
    session_action,
    options,
    suggest_refund: outOfScope,
    attachments_unlocked: !outOfScope,
    llm_debug: result.llm_debug
      ? { ...result.llm_debug, phase: result.llm_debug.phase ?? "opening" }
      : undefined,
  };
}
