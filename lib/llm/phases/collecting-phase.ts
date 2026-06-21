import {
  findMissingFields,
  REQUIRED_FIELDS_BY_CATEGORY,
  calculateCompleteness,
  AGENDA_COVERED_GATE,
  MIN_COLLECTING_USER_TURNS,
  PUSH_GATE,
  PUSH_MIN_TURNS,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
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
} from "@/lib/poju/collection-progress";
import {
  applyAgendaStatusUpdates,
  extractAgendaStatusUpdates,
  formatAgendaForPrompt,
  getNextAgendaFocus,
  parseInvestigationAgenda,
  stripAgendaFieldsFromContextUpdates,
} from "@/lib/poju/investigation-agenda";
import { callStallOfferPhase } from "@/lib/llm/phases/stall-offer-phase";
import { formatContextForPrompt, formatMissingFieldsForPrompt, extractQuestionCategory, mergeContextUpdates, recordToLLMContextUpdates } from "@/lib/poju/context-extractor";
import type { AgentPhase } from "@/lib/poju/agent-state";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import { callPhaseJsonTransport, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { preparePojuPhaseLLMCall } from "@/lib/llm/phases/oriental-prompt-context";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PojuV4ActionRequested } from "@/lib/poju/types";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildToolSuggestionPhaseAppendix } from "@/lib/llm/phases/tool-suggestion-phase-appendix";
import { parseToolSuggestionFromParsed } from "@/lib/poju/tool-suggestion";
import { parseTopicDriftFromParsed } from "@/lib/poju/topic-drift";

const VALID_SUGGESTED: AgentPhase[] = ["collecting_context", "awaiting_confirmation"];
const VALID_ACTIONS: PojuV4ActionRequested[] = [
  "continue_chat",
  "show_birth_form",
  "deliver_main",
  "track_progress",
];

function formatFieldKey(key: string): string {
  return key.replace(/_/g, " ");
}

function projectAgentAfterUpdates(
  agent: POJUAgentState,
  contextUpdates: Record<string, unknown>,
  questionCategory: string | null,
  investigationAgenda?: unknown,
): POJUAgentState {
  const stripped = stripAgendaFieldsFromContextUpdates(contextUpdates);
  const structured = recordToLLMContextUpdates(stripped);
  let investigation_agenda = agent.investigation_agenda ?? [];
  let agenda_generated = agent.agenda_generated ?? false;

  if (!agenda_generated && investigationAgenda) {
    const parsed = parseInvestigationAgenda(investigationAgenda);
    if (parsed) {
      investigation_agenda = parsed;
      agenda_generated = true;
    }
  }
  const statusUpdates = extractAgendaStatusUpdates(contextUpdates);
  if (agenda_generated && statusUpdates) {
    investigation_agenda = applyAgendaStatusUpdates(investigation_agenda, statusUpdates);
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
  investigationAgenda?: unknown,
): AgentPhase | null {
  if (suggested_phase !== "awaiting_confirmation") return suggested_phase;
  const projected = projectAgentAfterUpdates(
    agent,
    contextUpdates,
    questionCategory,
    investigationAgenda,
  );
  const userTurns = countEffectiveCollectingTurns(session);
  if (isPrematureCollectingPhase(projected, userTurns)) {
    console.warn("[collecting-phase] Blocked premature awaiting_confirmation: agenda or turns below gate");
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
      console.warn("[collecting-phase] Blocked awaiting_confirmation: stop-loss", stopLoss.reason);
      return "collecting_context";
    }
  }
  const gate = evaluateCollectingConfirmationGate(
    projected,
    countEffectiveCollectingTurns(session),
  );
  if (gate.allowed) return suggested_phase;
  console.warn("[collecting-phase] Blocked premature awaiting_confirmation:", gate.reason);
  return "collecting_context";
}

function buildPullbackBlock(input: PhaseLLMInput): string {
  if (!input.collecting_pullback) return "";
  const labels =
    input.uncovered_critical_labels?.length
      ? input.uncovered_critical_labels.slice(0, 2).join("；")
      : "关键处境细节";
  return `

## ★ 本轮 mandatory：用户催促交付 — 把他拉回来（不交付）

用户本轮在要报告/结论/「该怎么办」，但问诊议程尚未收齐。本轮【禁止交付、禁止给行动建议】，按以下结构回应（自然 POJU 语气，不要机械）：

1. **共情认可**急切——"我知道你现在最想要的就是一个明确答案/方向"
2. **坦诚说明代价**——"如果我现在就下结论，只能给你一份谁都适用的泛泛建议——这恰恰是最不值钱、对你最没用的东西。我想给你的是只对你成立的判断。"
3. **点名还差什么**——具体说出：${labels}。说明"这两点会直接改变结论方向"。
4. **立刻抛 1 个尖锐追问**接住对话。

措辞红线：不得说"系统要求/还没到轮数/流程规定"等暴露机制的话；让用户感到是为了把分析做准才追问。
`;
}

function buildAgendaGenerationBlock(agent: POJUAgentState): string {
  if (agent.agenda_generated) return "";
  return `

## ★ 首轮 mandatory：生成本次问诊议程（仅本轮一次）

基于用户的原始问题，在 JSON 中额外输出 \`investigation_agenda\` 数组（6–8 项），每项针对**这个人这件事**定制（不要通用字段名），例如咖啡店困境：
- 竞争冲击的时间线与量级
- 已试手段及实际效果
- 现金流/债务可撑多久
- 真实诉求（止损 vs 死磕）
- 个人精力与心理临界
- 可动用的差异化资源
- 退出/转型的机会成本

格式：
"investigation_agenda": [
  { "id": "timeline", "label": "…", "critical": true, "status": "unexplored" },
  …
]

至少 3 项标 critical: true。生成后代码会持久化，**后续轮次不得重写此议程**。
同时正常输出本轮第一个尖锐问题。
`;
}

function buildAgendaTrackingBlock(agent: POJUAgentState): string {
  const agenda = agent.investigation_agenda ?? [];
  if (agenda.length === 0) return "";
  const focus = getNextAgendaFocus(agenda);
  const focusText = focus.map((a) => `- ${a.label} (${a.id}, ${a.status})`).join("\n");
  return `

## 问诊议程（持久 — 勿重写）
${formatAgendaForPrompt(agenda)}

## 本轮问诊焦点（mandatory）
从上面选 1–2 个 status 为 unexplored 或 partial 的角度发问：
${focusText || "- 优先补全必查项"}

每轮在 context_updates 里回报 agenda_status_updates，例如：
"agenda_status_updates": { "timeline": "partial", "what_tried": "covered" }
只把用户【明确说过】的事实写入 context_updates / agenda 状态，不要推断编造。
禁止重复问已 covered 的角度；禁止泛泛倾听。
`;
}

function buildCollectingTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  if (!agent) {
    return `# 当前任务：深入问诊\n\n原始问题: "${input.session.original_question}"\n问一个具体跟进问题。输出 JSON：response, suggested_phase, context_updates, collection_progress。`;
  }

  const contextText = formatContextForPrompt(agent);
  const missingFields = findMissingFields(agent);
  const missingText = formatMissingFieldsForPrompt(missingFields);
  const completeness = agent.collection_completeness;
  const cat = agent.question_category;
  const requiredList = cat
    ? (REQUIRED_FIELDS_BY_CATEGORY[cat] ?? []).map((f) => `  - ${formatFieldKey(f)}`).join("\n")
    : "  (先判断问题类别，再收集该类别的关键字段。)";

  const profileGate = !resolveSessionHasProfile(input.session)
    ? `
## 尚未关联命盘
在 response 中说明为何需要出生信息（仅保存在本设备）。准备好后设 action_requested 为 "show_birth_form"；若还需先聊情境则 "continue_chat"。
`
    : "";

  const majorGateNote = agent.agenda_generated
    ? `\n【硬下限】至少 ${MIN_COLLECTING_USER_TURNS} 轮有效 user 问诊、必查议程项全覆盖、整体覆盖 ≥ ${AGENDA_COVERED_GATE * 100}% 才能切 awaiting_confirmation。`
    : "";

  const resumeAfterStallNote = agent.resume_collecting_low_barrier
    ? `
## 止损后重新收集（本轮 mandatory）
用户刚选择了「愿意再聊」。不要再施压或连珠追问：
- 换角度、降低门槛：给 2-3 个具体选项或「是/否/大概范围」式问题，让用户好答
- 一次只问 1 个最容易补的关键点
- 语气轻松，允许用户跳过仍缺的项
`
    : "";

  return `# 当前任务：深入问诊（收集上下文）

你已经主动开场，用户开始回应。现在要像【医生问诊 + 律师询问】那样深入了解具体处境。
${profileGate}

## 用户的原始问题
"${input.session.original_question}"

## 已收集的信息
${contextText}

完成度（参考，非交付闸门）: ${(completeness * 100).toFixed(0)}%
${buildAgendaTrackingBlock(agent)}

## 还需要收集的字段
${missingText}

## 本类别必填字段
${requiredList}

## 收集阶段铁律（最高优先级，凌驾本段其他所有规则）
1. 收集阶段【只问诊，不开方】。response 严禁包含任何：具体行动建议、Step、Action、"你应该/可以做 X"、"今晚/这周去做 Y"、放置物件/选择方位/择时的操作指令。
2. 你只能做三件事：承接情绪与事实 → 用命盘对应处境 → 问 1-2 个问题。
3. "具体怎么破局、做什么"是 final-delivery 的专属内容。即使你已想清楚行动，也一律不得在收集/确认阶段提前给。
4. 若你觉得"已经能给出行动了"——那是该切 awaiting_confirmation 的信号：response 末尾必须用【明确征询问句】问用户是否现在就要完整分析（见「过渡句措辞铁律」），绝不能写行动本身。

## 过渡句措辞铁律（suggested_phase = "awaiting_confirmation" 时 mandatory）

切到 awaiting_confirmation / 准备交付前，response 必须：

1. 以一个【明确的征询问句】结尾，问号收尾，直接问用户「现在就要完整分析吗」，需要用户回 yes/no 才能推进。
   ✓ "I have what I need. Ready for me to lay out the full analysis and the concrete steps now?"
   ✓ "我已经看清这个局了。要我现在给你完整分析和三个具体行动吗？"

2. 严禁任何【异步告知式】措辞——它们暗示你会自己稍后推送，但你是回合制的、不会自动推送，会让用户被动等待→死锁：
   ✗ "Give me a moment" / "Let me assemble" / "I'll come back"
   ✗ "给我一点时间" / "稍等" / "我去整理一下" / "我会回来给你" / "让我整理一下你看看"

3. 触发权交给用户：用户回 yes/ready → 进入汇总/交付流程；用户要补充/修改 → 保持或回到 collecting_context。

## 问诊原则

1. 每轮做三件事：承接用户情绪与事实（2-4 句）→ 命盘/大运与处境对应（必须引用命主基础分析中的具体点）→ 问 1-2 个尖锐具体问题
2. 命盘 ↔ 处境对应，不要空讲性格；用户已表达多年不顺/重大压力时，命理解读要够具体、够展开
3. 不重复已知信息；一次不要问超过 3 个问题
4. 只把用户【明确说过】的事实写入 context_updates，不要推断编造

## 用户追问【已正式交付过的】建议时（仅限本 Session 已完成 final-delivery 之后）
- ✓ 在已给过的建议上【展开】：为什么有效、怎么做、何时调整、叠加 1-2 个动作
- ⚠️ 若本 Session 尚未正式交付（还在收集阶段），用户即使追问"该做什么"，也【不在收集阶段给新行动】，而是回应："这些具体做法我会在完整分析里一次给你，现在先把情况了解清楚。"然后继续问诊。
（当前为收集阶段：一律不得给出任何新行动或操作指令。）

## 完成判断（议程驱动）
- 必查 agenda 项全部 covered + 整体覆盖 ≥ ${AGENDA_COVERED_GATE * 100}% + 有效 user 轮 ≥ ${MIN_COLLECTING_USER_TURNS} → 才可 suggested_phase: "awaiting_confirmation"
- 未达标 → 每轮必须推进 1–2 个 unexplored/partial 议程角度，禁止重复 covered、禁止泛泛倾听
- 用户说「分析一下/给点建议」→ **不算** skip-ahead；保持 collecting_context 并继续问诊
- 仅当用户明确「直接给结论 / 不用再问了 / skip ahead / just give me the result」且 ≥ ${PUSH_MIN_TURNS} 轮 + 覆盖 ≥ ${PUSH_GATE * 100}% 时，才可因强催促提前 suggested_phase: "awaiting_confirmation"
- 否则 → "collecting_context"
${majorGateNote}
${buildAgendaGenerationBlock(agent)}
${resumeAfterStallNote}
（已删除"或信息已够支撑 3 条可执行行动"判据——该判据会诱导提前凑出行动并写进 response。）

## 风格

- 中文 220-520 字 / 英文 160-380 词
- **对话口吻**：短段、口语；展开时用 **粗体引导句** 切 2–3 个思路点；**至多 1 个**金句框（仅框最关键追问）；并列才用 \`- \` bullets
- 一句接话/澄清可纯短句，**不强套结构**
- 必须体现你已读过【完整】命主基础分析，至少点出 2 处与当前困境相关的命理结构（用 ⟦t:…⟧ 标记）
- 细则见上方「POJU 对话 response 规则」

## 话题偏移检测（相对 original_question）

- "none"：与本 Session 核心话题一致或紧密相关（类型 1）
- "edge"：可能相关，你已在 response 里简短确认（类型 2）
- "off_topic"：完全新维度，必须拒绝深入并在 response 中引导开新 Session（类型 3）

## 本轮收集进展判断（collection_progress，每轮必填）

根据【用户本轮消息】相对已收集信息的配合度，输出以下三者之一（与 suggested_phase 独立判断）：

- "advancing"：用户这轮给出了新的有效信息——你会写入 context_updates 的事实、细节、时间线、立场或情绪转折（非空 updates 通常是 advancing）
- "stalled"：用户这轮没给新信息——敷衍（「就那样」「还行」）、灌水、答非所问、重复已说过的、只回 emoji/单字无实质内容
- "resistant"：用户明确抗拒收集——「我不想说」「你直接说」「你是大师你来看」、拒绝回答关键问题、要求跳过问诊立刻给结论

注意：即使用户说「可以分析了/你来说吧」，若本轮没有补充新事实，collection_progress 仍可能是 "stalled" 或 "resistant"（不是 advancing）；suggested_phase 可单独切 awaiting_confirmation。

## 输出格式（严格 JSON，无 markdown 围栏）

{
  "response": "...",
  "suggested_phase": "collecting_context" | "awaiting_confirmation" | null,
  "action_requested": "continue_chat" | "show_birth_form",
  "question_category": "career" | "relationship" | "wealth" | "health" | "family" | "decision" | "interpersonal" | "other" | null,
  "context_updates": {
    "agenda_status_updates": { "agenda_id": "partial" | "covered" }
  },
  "investigation_agenda": [ { "id": "...", "label": "...", "critical": true, "status": "unexplored" } ],
  "collection_progress": "advancing" | "stalled" | "resistant",
  "topic_drift_signal": "none" | "edge" | "off_topic",
  "drift_reason": "若有偏离，一句话说明（无则空字符串）",
  "should_show_new_session_button": false
}

判断：topic_drift_signal 为 "off_topic" 时 should_show_new_session_button 必须为 true；其他情况为 false。
首轮且 agenda 未生成时 investigation_agenda 必填；已生成则省略 investigation_agenda 字段。

${buildToolSuggestionPhaseAppendix(input, { includeNewCycleDetection: false })}
${buildPullbackBlock(input)}`;
}

export async function callCollectingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const { system, messages } = await preparePojuPhaseLLMCall(input, buildCollectingTaskBlock(input));
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      phase_name: "collecting",
      max_tokens: 3600,
      temperature: 0.5,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });
  if (!response) {
    console.warn("[collecting-phase] Empty response from model; raw length:", result.content.length);
  }

  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  let suggested_phase = rawPhase && VALID_SUGGESTED.includes(rawPhase as AgentPhase) ? (rawPhase as AgentPhase) : null;

  const questionCategory = typeof parsed.question_category === "string" ? parsed.question_category : null;
  const collection_progress = parseCollectionProgress(parsed.collection_progress);
  const investigation_agenda_raw = !input.agent_state?.agenda_generated
    ? parsed.investigation_agenda
    : null;
  if (input.agent_state && suggested_phase) {
    suggested_phase = clampCollectingSuggestedPhase(
      suggested_phase,
      input.agent_state,
      input.session,
      context_updates,
      questionCategory,
      collection_progress,
      investigation_agenda_raw,
    );
  }

  const rawAction = typeof parsed.action_requested === "string" ? parsed.action_requested.trim() : null;
  let action_requested: PojuV4ActionRequested | null =
    rawAction && VALID_ACTIONS.includes(rawAction as PojuV4ActionRequested)
      ? (rawAction as PojuV4ActionRequested)
      : null;
  if (!action_requested && rawAction === "show_birth_form") {
    action_requested = "show_birth_form";
  }

  const drift = parseTopicDriftFromParsed(parsed);
  const tool_suggestion = parseToolSuggestionFromParsed(parsed);

  if (input.agent_state && collection_progress) {
    const { stopLoss } = projectCollectingStopLoss(input.agent_state, collection_progress, true);
    if (stopLoss.triggered) {
      console.info("[collecting-phase] Stop-loss → stall offer:", stopLoss.reason);
      const stallResult = await callStallOfferPhase(input);
      return {
        ...stallResult,
        collection_progress,
      };
    }
  }

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
    investigation_agenda: parseInvestigationAgenda(investigation_agenda_raw),
    ...drift,
  };
}
