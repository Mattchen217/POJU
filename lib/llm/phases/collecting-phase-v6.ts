/**
 * POJU v6 Shadow — collecting 阶段控制面解耦。
 *
 * - 流程 Gate / 阶段跳转 100% 由后端 Node.js 判定（复用既有 gate 模块）
 * - LLM 专注对话提取与 agenda_updates 信号
 * - 阶段专属任务规则通过 buildCollectingTaskBlockV6 → buildPhaseTurnContextV6 注入 user 侧
 *
 * ⚠️ 影子实现，不替换 collecting-phase.ts。
 */

import {
  countEffectiveCollectingTurns,
  evaluateCollectingConfirmationGate,
} from "@/lib/poju/collecting-confirmation-gate";
import {
  evaluateStopLoss,
  isPrematureCollectingPhase,
  nextStallCount,
  parseCollectionProgress,
  projectCollectingStopLoss,
  shouldSuggestRefund,
} from "@/lib/poju/collection-progress";
import {
  applyAgendaStatusUpdates,
  extractAgendaStatusUpdates,
  formatAgendaForPrompt,
  selectCurrentAgendaFocus,
  stripAgendaFieldsFromContextUpdates,
} from "@/lib/poju/investigation-agenda";
import { callStallOfferPhase } from "@/lib/llm/phases/stall-offer-phase";
import { callOpeningPhaseV6 } from "@/lib/llm/phases/opening-phase-v6";
import { extractQuestionCategory, mergeContextUpdates, recordToLLMContextUpdates } from "@/lib/poju/context-extractor";
import type { AgentPhase, BreakthroughCore, POJUAgentState } from "@/lib/poju/agent-state";
import {
  calculateCompleteness,
  mergeBreakthroughCoreUpdates,
  normalizeAgentPhase,
  parseBreakthroughCoreUpdatesFromLlm,
} from "@/lib/poju/agent-state";
import {
  callPhaseJsonTransport,
  getPhaseResponseFallback,
  resolvePhaseResponse,
  withPhaseStreamOpts,
  isPhaseParseFailed,
} from "@/lib/llm/phases/phase-transport";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildPhaseTransportInputV6, buildDirectedRelationAuditAllowlistV6, shouldInjectDirectedRelationsV6 } from "@/lib/llm/phases/oriental-prompt-context-v6";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PojuV4ActionRequested } from "@/lib/poju/types";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildSpineBlock } from "@/lib/llm/phases/spine-block";
import { buildToolSuggestionPhaseAppendix } from "@/lib/llm/phases/tool-suggestion-phase-appendix";
import { parseToolSuggestionFromParsed } from "@/lib/poju/tool-suggestion";
import { parseTopicDriftFromParsed } from "@/lib/poju/topic-drift";
import { sanitizeReplyOptions } from "@/lib/poju/reply-options";

const VALID_SUGGESTED: AgentPhase[] = ["collecting_context", "awaiting_confirmation"];
const VALID_ACTIONS: PojuV4ActionRequested[] = ["continue_chat", "deliver_main", "track_progress"];

/* ── collecting 阶段专属控制面（user taskBlock · 无具体案例） ── */

export const POJU_V6_COLLECTING_PHASE_RULES = `# 当前阶段任务 · collecting_context（深测算 + 多元问诊）

在关系结论与破局方向已确立的前提下，按快照 agenda 逐项收齐验证信息——你是老师，不是问卷机。

## 首轮进入（关系结论/方向刚确立）
2–4 句第一阶段洞见 + 破局大方向；**收尾必须立刻问** snapshot \`current_focus\` 对应的那一个问题（**只问这一句**）。用户**看不到**内部议程列表，禁止「愿意的话我们顺着深入推演」等空邀请、**禁止列 pending 项**、**绝不**交付完整 3 条行动。

## 后续每一轮（克制律 · 核心 · 真判断 + 真推进）
只围绕 snapshot \`agenda_checklist.current_focus\` 给的【那一项】，把它化成一句共情、直击的人话来问。
· 用户回答后，**先判断再说话**（把判断写进思考）。你手上有 snapshot \`active_question_state\`（本项【全部来回】+ round_on_this_item + escalation_stage）——据此看全貌判断，输出 \`question_status\`：
  - 对照 \`current_focus_goal\`（验收尺，不靠"感觉答清没"）判断满足没；**\`active_question_state\` 告诉你这是本项第几轮、之前怎么答的——别把已答清的又判没答清（尤其别把用户点选的选项/明确否定判成没答）**。
  - \`question_status\` 是【放行唯一准绳】：\`satisfied\`=满足即放行；\`retry\`=没答清、还值得再问；\`escalate\`=漂移/不耐烦/要提前交付、仍可挽回；\`terminal\`=彻底不配合（安抚+退PASS都拒、也不认真答）。
  （\`reply_quality\` 过渡期镜像：satisfied→clear，其余→vague，仅兼容，判断以 question_status 为准。）
  - **满足 goal（拿到 goal 要的信息 / 明确否定 / 问题不适用 / 用户给不出 / 用户点选了你给的选项）** → \`question_status\`=\`"satisfied"\`（reply_quality 镜像 clear），把该项写进 \`agenda_updates.completed_in_this_turn\`，顺势问下一项。**只要 goal 达成就够，勿缠着要更「理想」的答案**；否定与「还没到那一步」都是有效信息——记下来、推进。**用户点选你给的选项 = 必然 satisfied（他选的就是有效答案，绝不可判没答清）。**
  - **没满足 goal（答案还缺 goal 要的某块关键信息，且不属于"给不出/不适用"）** → \`question_status\`=\`"retry"\`（或 escalate，若漂移/不耐烦；reply_quality 镜像 vague），\`completed_in_this_turn\` 必须为空。追问要【指名缺的那一块】(如"你说的X我清楚了，为了Y我还想确认一下Z")，**不是泛泛"再说清楚一点"**。**不要**假装听懂、**不要**把该项标完成。仍可为**同一问**给更具体的 options。禁止编造退款/锁会话话术（终局只走 session_action）。
  - **【第三类】问题前提不适用 / 用户已到不了这一步** → 【算 \`satisfied\`，绝不算 retry】。当用户明确说"我现在还在 X 阶段，不存在你问的 Y"（如"项目还在开发、还没上线，不存在你说的变现/失败/收钱"），这【就是】对这一项的有效回答——它告诉你：这一项在他当前状态下没有更多数据可给。**把该项写进 completed_in_this_turn（并在思考里记下事实：用户当前处于 X 阶段、此项暂无数据），顺势推进下一项。绝不换个说法再追同一件事。**（这类"答不出来"本身就是第4段要用的信息，不是必须逼出一个答案。）
· **【硬止损】同一项，用户已【两次】表明"答不了/不适用/还没到那一步"** → 立即 \`question_status\`=\`"satisfied"\`、标完成、推进，**禁止第三次追问**。反复追一个用户明确给不出的答案，是这一阶段最伤体验的错。
· **禁止假装没听懂逼重答**：用户答得清楚（哪怕不合你预期），就是清楚。【绝不】用"我没太理解，请再说一次"逼他重答——不合你预期 ≠ 没听懂。只有真的答非所问/乱码才可标 retry。
· **禁止机械重复**：用户已答清（含否定/不适用）后，把同一项换皮再问一遍；也【禁止】几乎一字不差重复上一轮的整段话（换个开头、内核照抄，也是复读）。
· **一轮只推进这一项，绝不把 pending 全列做成问卷砸过去。**

## 不配合时的分级话术（按 active_question_state.escalation_stage 出，每级都【带着原问题请他继续答】）
你根据全貌判 question_status；response 的【语气档】按 escalation_stage 走（stage 由机器逐级+1，你据它选档）：
- **stage 0（正常）**：正常问 / 正常追问缺口。
- **stage 1（retry·安抚+重复问题）**："我知道你想快点拿到结果——这正是最后报告要给你的。就差把这个弄清楚，答案才贴你。〔把原问题再问一遍〕"
- **stage 2（escalate·提醒+退PASS选择+重复问题）**："如果现在不方便，我会一直在这儿等你，你也可以退回 1 PASS 结束这次。要不我们先把这个说完——〔把原问题再问一遍〕"
- **stage 3（escalate·定位说明+差异化+再给选择+重复问题）**："Pivot 不是即问即答的通用助手，它是基于你的能量结构做深度决策分析，所以需要你几句实在的回答。〔把原问题再问一遍〕；或者你也可以先退回 1 PASS，改天有空再来。"
- **stage 4（terminal·终局）**：\`question_status\`=\`"terminal"\` 且 \`session_action\`=\`"terminate_refund"\`；response="看得出来这个时机可能不太合适。我先帮你把这次的 1 PASS 退回，你随时可以回来。"（后端据此退PASS+锁+关闭）
- **user_paused（随时·用户主动点"以后再来"）**：\`session_action\`=\`"user_paused"\`（不经 terminal）；response="好，我把这次进度保留着，你随时回来接着聊。"
【铁律】RETRY/ESCALATE 每一级都必须【把原问题再抛给他】——升级的是选择权与提示，不是放弃收集；到 stage 4 前一刻都不放弃收集。**terminal 只在你确实走到 stage≥3、用户仍拒绝时喊**（机器只在 stage≥3 才接纳 terminal，提前喊会被降级）。

## 末项与核对（硬闸 · 防"还在问却弹确认按钮"）
**每轮标完 \`completed_in_this_turn\` 后，先在思考里数一下：还有没有 pending 项？**
- **pending 已清空（本轮标完就没有待收集的了）** → 你这轮的 \`response\` 【必须】是"凝练总结 + 末尾邀请确认"，**【绝对禁止】再问任何问题**（包括"你每周投入多少时间""还有没有要补充"这类临时补充问题）。原因：后端会在这【同一轮】翻确认态、挂出「可以，没有补充了 / 我还要补充」按钮——**你若这轮还在问，按钮就挂在你的问题下面，前后矛盾**。所以 **pending 空 = 只出总结，绝不出问题。**
- **凝练总结**：把收集到的关键信息复述一遍请用户核对；**末尾邀请**用户选择「可以，没有补充了」或「我还要补充」。**禁止只总结不邀请，也禁止边总结边追问。**
- **pending 还有项** → 正常问下一项（不出总结、不弹邀请）。

## 边界
- **collecting / awaiting_confirmation 禁 tracking 话术**：不说"回来报数据/有进展再来汇报"。
- **锚定 original_question**：支线是证据，不另开调查线；勿深挖支线内部细节。
- 关系结论与方向已确立（✓）的后续轮：**不要重复**第一阶段洞见。

## 你不负责
- 判定是否进入 awaiting_confirmation（后端 Gate）
- 锁输入 / 退款的【物理执行】（后端按 session_action 执行；你只出信号+话术）
- 修改 agenda 顺序（无条件信任 current_focus）

## 输出格式（硬约束 · 键名不可翻译）
严格 JSON（值可用中文，键名不可变）：
\`{"response":"","question_status":"satisfied","session_action":null,"reply_quality":"clear","agenda_updates":{"completed_in_this_turn":[]},"options":["选项一的话","选项二的话","选项三的话"]}\`
- \`question_status\`：\`"satisfied"|"retry"|"escalate"|"terminal"\`（放行唯一准绳）。
- \`session_action\`：\`null|"terminate_refund"|"user_paused"\`；\`terminate_refund\` 仅当 question_status=terminal；\`user_paused\` 不经 terminal。
- \`reply_quality\`（过渡兼容）：satisfied→clear，其余→vague；判断不再以它为准。
- 仅当 \`question_status\`=\`"satisfied"\`（或 reply_quality=\`"clear"\`）时，才可把 current_focus 的 label 写入 \`completed_in_this_turn\`。
- 用户可见正文【必须】在 \`"response"\`；控制面信号照实填写。

## response 里的引号（硬要求 · 防 JSON 截断）
\`response\` / \`options\` 等是 JSON 字符串字段。若要在正文里用引号强调某个词，
【必须】用中文引号「」或『』，【禁止】在字符串值内部写未转义的英文双引号 "。
错（会截断）: "response":"那个"对了"的人"
对: "response":"那个「对了」的人"
若非要用英文双引号，必须写成 \\"（强烈建议直接用中文引号）。
——任何 JSON 字符串字段内部，都不能出现未转义的英文双引号。

# 额外产出:给用户2-3个选项(基于命理真算,帮他回答+印证假设)

你的 response 是【温暖的正文】(共情+提问),不变。
额外产出2-3个 options——但这一阶段的选项【必须从命理+骨架假设真算出来】,
贴合这个人,给他"很准、被看穿"的感觉。这是印证命理假设的关键。

选项从当前议题对应的骨架 needs_validation 出发,把"要验证什么"变成选项:
- 选项要有【这个命盘特有的指纹】,不是通用的(禁放之四海皆准);
- 三个选项要有【真实区分度】,对应不同的能量结构/可能性——
  这样用户选主推的=印证假设,选别的=真实修正假设(能承接证伪,不只印证);
- 【必须】保留开放出口(用户"以上都不是/我的情况是…"走输入框)。

例:骨架假设"食伤旺、遇挫易内耗",要验证他遇挫怎么反应 →
  选项覆盖"反复琢磨放不下(主推)""放下转做别的(另一结构)""找人倾诉(第三种)"。
  (这是讲【怎么设计选项的逻辑】,不是让你照抄这三句。)

# options 的格式(硬要求)
options 是一个【字符串数组】,每个元素【直接是一句给用户看的话】(字符串)。
【禁止】把选项包成对象——不要写 {"text":"..."} / {"label":"..."} / {"option":"...","reason":"..."}。
错:  "options": [{"text":"反复琢磨放不下"}]
对:  "options": ["反复琢磨放不下,好几天缓不过来"]
每个选项就是一句大白话,用户点了就等于说了这句话。

# 判断与选项的关系
你仍要判断用户上一轮答清楚没(\`question_status\` + \`agenda_updates\`);
如果没答清(\`retry\`/\`escalate\`),这一轮的 options 就是"帮他把没说清的说清"的选项(同一问)。**用户点选任一选项 = 下一轮必 satisfied。**

# 什么时候不给选项
收集已充分、要收尾进确认时,可不给 options(留空,前端退回输入框)。

# 一次只问一个问题(重要)
每一轮,你【只问一个问题】,配一组(2-3个)针对这个问题的选项。
【禁止】一条消息里问两个及以上问题(用户一组选项答不了多个问题)。
如果有多个方向要问,【分轮问】——先问最能推进印证/收集的那一个(通常就是 current_focus),
用户答完,下一轮再问下一个。逐步逼近,比一次抛多个更清晰、用户更省力。
(response 里也不要写多个问号——温暖正文可以有共情铺垫,但提问只留一个。)`;

function buildAgendaTrackingBlockV6(agent: POJUAgentState): string {
  const agenda = agent.investigation_agenda ?? [];
  if (agenda.length === 0) return "";

  const focus = selectCurrentAgendaFocus(agenda);
  const focusText = focus
    ? `- ${focus.label} (${focus.id}, ${focus.status})`
    : "- 优先把必查项弄清楚";

  return `
## 调查议程（私有收集计划 · 用户不可见）

${formatAgendaForPrompt(agenda)}

本轮 current_focus：
${focusText}`;
}

function buildLastAgendaItemDirectiveV6(agent: POJUAgentState): string {
  const agenda = agent.investigation_agenda ?? [];
  const focus = selectCurrentAgendaFocus(agenda);
  if (!focus) return "";
  const pending = agenda.filter((a) => a.status !== "covered");
  if (pending.length !== 1 || pending[0]?.label !== focus.label) return "";
  return `
## 末项议程提示
用户刚回应的是最后一项。若判定答到位：写入 completed，不再追问新议程。
凝练总结 + 末尾邀请用户在输入框选择「可以，没有补充了」或「我还要补充」。`;
}

function buildPostConfirmationSupplementDirectiveV6(agent: POJUAgentState): string {
  const agenda = agent.investigation_agenda ?? [];
  if (agenda.length === 0) return "";
  if (!agenda.every((a) => a.status === "covered")) return "";
  return `
## 用户从核对阶段回来补充
议程已全部 covered。把新信息写入 context_updates；重新凝练总结；末尾邀请在输入框选择「可以，没有补充了」或「我还要补充」。不再开新调查追问。`;
}

function buildFirstCollectingInsightDirectiveV6(agent: POJUAgentState): string {
  if (!agent.breakthrough_core) return "";
  const collectingTurns = agent.collecting_turn_count ?? 0;
  if (collectingTurns > 0) {
    return `
## 本轮动作
关系结论与方向已确立（✓），勿重复第一阶段洞见；严格按 current_focus 推进。`;
  }
  return `
## 本轮动作 · 首次进入 collecting
2–4 句洞见 + 一个大方向。收尾立刻问 current_focus 对应问题（只问一句）。不交付完整行动方案。`;
}

/** v6 collecting 动态 taskBlock — 注入 user turn context */
export function buildCollectingTaskBlockV6(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const q = input.session.original_question;
  const spineBlock = buildSpineBlock(agent);
  const agendaBlock = agent ? buildAgendaTrackingBlockV6(agent) : "";
  const insightDirective = agent ? buildFirstCollectingInsightDirectiveV6(agent) : "";
  const lastItemDirective = agent ? buildLastAgendaItemDirectiveV6(agent) : "";
  const postConfirmDirective = agent ? buildPostConfirmationSupplementDirectiveV6(agent) : "";

  return `# 动态任务 · collecting_context
original_question："${q}"

${POJU_V6_COLLECTING_PHASE_RULES}

${spineBlock}

${agendaBlock}
${insightDirective}
${lastItemDirective}
${postConfirmDirective}

${buildToolSuggestionPhaseAppendix(input, { includeNewCycleDetection: false })}`.trim();
}

/* ── 后端 Gate（与 v5 相同 · 100% Node 控制） ── */

function projectAgentAfterUpdates(
  agent: POJUAgentState,
  contextUpdates: Record<string, unknown>,
  questionCategory: string | null,
  breakthroughCoreUpdates?: Partial<BreakthroughCore> | null,
): POJUAgentState {
  const stripped = stripAgendaFieldsFromContextUpdates(contextUpdates);
  const structured = recordToLLMContextUpdates(stripped);
  let investigation_agenda = agent.investigation_agenda ?? [];
  const agenda_generated = agent.agenda_generated ?? false;

  const statusUpdates = extractAgendaStatusUpdates(contextUpdates);
  if (
    agenda_generated &&
    statusUpdates &&
    normalizeAgentPhase(agent.current_phase) !== "collecting_context"
  ) {
    investigation_agenda = applyAgendaStatusUpdates(investigation_agenda, statusUpdates);
  }

  let breakthrough_core = agent.breakthrough_core;
  if (breakthrough_core && breakthroughCoreUpdates) {
    breakthrough_core = mergeBreakthroughCoreUpdates(breakthrough_core, breakthroughCoreUpdates);
  }

  const merged: POJUAgentState = {
    ...agent,
    context_collected: mergeContextUpdates(agent.context_collected, structured),
    question_category:
      extractQuestionCategory(stripped) ??
      (questionCategory as POJUAgentState["question_category"]) ??
      agent.question_category,
    investigation_agenda,
    agenda_generated,
    breakthrough_core,
  };
  return { ...merged, collection_completeness: calculateCompleteness(merged) };
}

function clampCollectingSuggestedPhase(
  suggested_phase: AgentPhase | null,
  agent: POJUAgentState,
  session: PhaseLLMInput["session"],
  contextUpdates: Record<string, unknown>,
  questionCategory: string | null,
  collectionProgress: ReturnType<typeof parseCollectionProgress>,
  breakthroughCoreUpdates?: Partial<BreakthroughCore> | null,
): AgentPhase | null {
  if (suggested_phase !== "awaiting_confirmation") return suggested_phase;

  const projected = projectAgentAfterUpdates(
    agent,
    contextUpdates,
    questionCategory,
    breakthroughCoreUpdates,
  );
  const userTurns = countEffectiveCollectingTurns(session);

  if (isPrematureCollectingPhase(projected, userTurns)) {
    console.warn("[collecting-phase-v6] Blocked premature awaiting_confirmation: agenda or turns below gate");
    return "collecting_context";
  }

  if (collectionProgress) {
    const projectedStall = nextStallCount(agent.stall_count ?? 0, collectionProgress);
    const stopLoss = evaluateStopLoss({
      stall_count: projectedStall,
      collection_progress: collectionProgress,
      collecting_turn_count: agent.collecting_turn_count ?? userTurns,
    });
    if (stopLoss.triggered) {
      console.warn("[collecting-phase-v6] Blocked awaiting_confirmation: stop-loss", stopLoss.reason);
      return "collecting_context";
    }
  }

  const gate = evaluateCollectingConfirmationGate(projected, countEffectiveCollectingTurns(session));
  if (gate.allowed) return suggested_phase;

  console.warn("[collecting-phase-v6] Blocked premature awaiting_confirmation:", gate.reason);
  return "collecting_context";
}

/** v6 collecting LLM 入口（影子路径） */
export async function callCollectingPhaseV6(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const agent = input.agent_state;
  if (agent?.current_phase === "collecting_context" && agent.breakthrough_core == null) {
    return callOpeningPhaseV6(input);
  }

  const structured = normalizeBaseAnalysisInput(input.base_analysis ?? null).structured ?? null;
  const auditRelations =
    structured && shouldInjectDirectedRelationsV6(input)
      ? buildDirectedRelationAuditAllowlistV6(structured, input.agent_state?.question_category)
      : undefined;

  const { system, messages } = await buildPhaseTransportInputV6(
    input,
    buildCollectingTaskBlockV6(input),
  );

  const transport = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 12000,
      temperature: 0.5,
      thinking_effort: "high",
    }),
  );

  let resolved = resolvePhaseResponse(transport.content, {
    locale: input.locale,
    phase_name: "collecting_context",
    call_type: "collection_flash",
    model: transport.model,
    finish_reason: transport.finish_reason,
    provider: transport.provider,
    structured,
    audit_relations: auditRelations,
    use_fallback: true,
  });

  if (!resolved.response.trim()) {
    resolved = {
      ...resolved,
      response: getPhaseResponseFallback(input.locale),
      used_fallback: true,
    };
  }

  return finishCollectingPhaseV6(input, transport, resolved.parsed, resolved.response, structured);
}

async function finishCollectingPhaseV6(
  input: PhaseLLMInput,
  result: Awaited<ReturnType<typeof callPhaseJsonTransport>>,
  parsed: Record<string, unknown>,
  response: string,
  _structured: ProfileStructured | null,
): Promise<PhaseLLMResult> {
  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  let suggested_phase =
    !isPhaseParseFailed(parsed) &&
    rawPhase &&
    VALID_SUGGESTED.includes(rawPhase as AgentPhase)
      ? (rawPhase as AgentPhase)
      : null;

  const questionCategory = typeof parsed.question_category === "string" ? parsed.question_category : null;
  const collection_progress = parseCollectionProgress(parsed.collection_progress);
  const breakthrough_core_updates = isPhaseParseFailed(parsed)
    ? null
    : parseBreakthroughCoreUpdatesFromLlm(parsed.breakthrough_core_updates);

  if (input.agent_state && suggested_phase) {
    suggested_phase = clampCollectingSuggestedPhase(
      suggested_phase,
      input.agent_state,
      input.session,
      context_updates,
      questionCategory,
      collection_progress,
      breakthrough_core_updates,
    );
  }

  const rawAction = typeof parsed.action_requested === "string" ? parsed.action_requested.trim() : null;
  const action_requested: PojuV4ActionRequested | null =
    rawAction && VALID_ACTIONS.includes(rawAction as PojuV4ActionRequested)
      ? (rawAction as PojuV4ActionRequested)
      : "continue_chat";

  const drift = parseTopicDriftFromParsed(parsed);
  const agenda_updates =
    parsed.agenda_updates &&
    typeof parsed.agenda_updates === "object" &&
    !Array.isArray(parsed.agenda_updates)
      ? (parsed.agenda_updates as { completed_in_this_turn?: string[] })
      : undefined;

  const question_status =
    parsed.question_status === "satisfied" ||
    parsed.question_status === "retry" ||
    parsed.question_status === "escalate" ||
    parsed.question_status === "terminal"
      ? parsed.question_status
      : undefined;
  const session_action =
    parsed.session_action === "terminate_refund" || parsed.session_action === "user_paused"
      ? parsed.session_action
      : parsed.session_action === null
        ? null
        : undefined;
  const reply_quality =
    question_status != null
      ? question_status === "satisfied"
        ? ("clear" as const)
        : ("vague" as const)
      : parsed.reply_quality === "clear" || parsed.reply_quality === "vague"
        ? parsed.reply_quality
        : undefined;

  const tool_suggestion = parseToolSuggestionFromParsed(parsed);

  let suggest_refund = false;
  if (input.agent_state && collection_progress) {
    const { stopLoss } = projectCollectingStopLoss(input.agent_state, collection_progress, true);
    suggest_refund = shouldSuggestRefund({
      agent: input.agent_state,
      collection_progress,
      stall_offer: false,
    });
    if (stopLoss.triggered && !suggest_refund) {
      console.info("[collecting-phase-v6] Stop-loss → stall offer:", stopLoss.reason);
      const stallResult = await callStallOfferPhase(input);
      return { ...stallResult, collection_progress };
    }
  }

  const options =
    suggested_phase === "awaiting_confirmation"
      ? undefined
      : sanitizeReplyOptions(parsed.options);

  return {
    response,
    suggested_phase,
    action_requested,
    context_updates,
    question_category: questionCategory,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
    tool_suggestion,
    start_new_cycle: false,
    new_cycle_question: null,
    collection_progress,
    investigation_agenda: null,
    breakthrough_core_updates,
    agenda_updates,
    reply_quality,
    question_status,
    session_action,
    options,
    suggest_refund,
    served_provider: result.provider ?? null,
    ...drift,
    llm_debug: result.llm_debug,
  };
}
