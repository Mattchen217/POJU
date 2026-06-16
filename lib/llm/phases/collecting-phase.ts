import {
  findMissingFields,
  REQUIRED_FIELDS_BY_CATEGORY,
  calculateCompleteness,
  type POJUAgentState,
} from "@/lib/poju/agent-state";
import {
  countEffectiveCollectingTurns,
  evaluateCollectingConfirmationGate,
  isMajorQuestionCategory,
  MIN_MAJOR_COLLECTING_USER_TURNS,
} from "@/lib/poju/collecting-confirmation-gate";
import { formatContextForPrompt, formatMissingFieldsForPrompt, extractQuestionCategory, mergeContextUpdates, recordToLLMContextUpdates } from "@/lib/poju/context-extractor";
import type { AgentPhase } from "@/lib/poju/agent-state";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { buildOrientalSystemPrompt } from "@/lib/llm/phases/oriental-prompt-context";
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
): POJUAgentState {
  const structured = recordToLLMContextUpdates(contextUpdates);
  const merged: POJUAgentState = {
    ...agent,
    context_collected: mergeContextUpdates(agent.context_collected, structured),
    question_category:
      extractQuestionCategory(contextUpdates) ??
      (questionCategory as POJUAgentState["question_category"]) ??
      agent.question_category,
  };
  return { ...merged, collection_completeness: calculateCompleteness(merged) };
}

function clampCollectingSuggestedPhase(
  suggested_phase: AgentPhase | null,
  agent: POJUAgentState,
  session: PhaseLLMInput["session"],
  contextUpdates: Record<string, unknown>,
  questionCategory: string | null,
): AgentPhase | null {
  if (suggested_phase !== "awaiting_confirmation") return suggested_phase;
  const projected = projectAgentAfterUpdates(agent, contextUpdates, questionCategory);
  const gate = evaluateCollectingConfirmationGate(
    projected,
    countEffectiveCollectingTurns(session),
  );
  if (gate.allowed) return suggested_phase;
  console.warn("[collecting-phase] Blocked premature awaiting_confirmation:", gate.reason);
  return "collecting_context";
}

function buildCollectingTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  if (!agent) {
    return `# 当前任务：深入问诊\n\n原始问题: "${input.session.original_question}"\n问一个具体跟进问题。输出 JSON：response, suggested_phase, context_updates。`;
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

  const majorGateNote = cat && isMajorQuestionCategory(cat)
    ? `\n【硬下限】本议题为 career / relationship / decision 等重大类型：必须 ≥${MIN_MAJOR_COLLECTING_USER_TURNS} 轮有效问答且必填字段齐全，才能切 awaiting_confirmation；未达到一律保持 collecting_context。`
    : "";

  return `# 当前任务：深入问诊（收集上下文）

你已经主动开场，用户开始回应。现在要像【医生问诊 + 律师询问】那样深入了解具体处境。
${profileGate}

## 用户的原始问题
"${input.session.original_question}"

## 已收集的信息
${contextText}

完成度: ${(completeness * 100).toFixed(0)}%

## 还需要收集的字段
${missingText}

## 本类别必填字段
${requiredList}

## 收集阶段铁律（最高优先级，凌驾本段其他所有规则）
1. 收集阶段【只问诊，不开方】。response 严禁包含任何：具体行动建议、Step、Action、"你应该/可以做 X"、"今晚/这周去做 Y"、放置物件/选择方位/择时的操作指令。
2. 你只能做三件事：承接情绪与事实 → 用命盘对应处境 → 问 1-2 个问题。
3. "具体怎么破局、做什么"是 final-delivery 的专属内容。即使你已想清楚行动，也一律不得在收集/确认阶段提前给。
4. 若你觉得"已经能给出行动了"——那是该切 awaiting_confirmation 的信号，但 response 里【仍然只能写过渡确认句】（如"我了解得差不多了，让我整理一下你看看"），绝不能写出行动本身。

## 问诊原则

1. 每轮做三件事：承接用户情绪与事实（2-4 句）→ 命盘/大运与处境对应（必须引用命主基础分析中的具体点）→ 问 1-2 个尖锐具体问题
2. 命盘 ↔ 处境对应，不要空讲性格；用户已表达多年不顺/重大压力时，命理解读要够具体、够展开
3. 不重复已知信息；一次不要问超过 3 个问题
4. 只把用户【明确说过】的事实写入 context_updates，不要推断编造

## 用户追问【已正式交付过的】建议时（仅限本 Session 已完成 final-delivery 之后）
- ✓ 在已给过的建议上【展开】：为什么有效、怎么做、何时调整、叠加 1-2 个动作
- ⚠️ 若本 Session 尚未正式交付（还在收集阶段），用户即使追问"该做什么"，也【不在收集阶段给新行动】，而是回应："这些具体做法我会在完整分析里一次给你，现在先把情况了解清楚。"然后继续问诊。
（当前为收集阶段：一律不得给出任何新行动或操作指令。）

## 完成判断
- 本类别【必填字段】已全部收齐 → suggested_phase: "awaiting_confirmation"
- 用户明确说「差不多了 / 可以分析了 / 你来说吧」→ "awaiting_confirmation"
- 否则 → "collecting_context"
${majorGateNote}
（已删除"或信息已够支撑 3 条可执行行动"判据——该判据会诱导提前凑出行动并写进 response。）

## 风格

- 中文 220-520 字 / 英文 160-380 词
- 4-6 段自然叙述，少用 bullet
- 必须体现你已读过【完整】命主基础分析，至少点出 2 处与当前困境相关的命理结构（如大运、格局、用神、时间窗）

## 话题偏移检测（相对 original_question）

- "none"：与本 Session 核心话题一致或紧密相关（类型 1）
- "edge"：可能相关，你已在 response 里简短确认（类型 2）
- "off_topic"：完全新维度，必须拒绝深入并在 response 中引导开新 Session（类型 3）

## 输出格式（严格 JSON，无 markdown 围栏）

{
  "response": "...",
  "suggested_phase": "collecting_context" | "awaiting_confirmation" | null,
  "action_requested": "continue_chat" | "show_birth_form",
  "question_category": "career" | "relationship" | "wealth" | "health" | "family" | "decision" | "interpersonal" | "other" | null,
  "context_updates": { },
  "topic_drift_signal": "none" | "edge" | "off_topic",
  "drift_reason": "若有偏离，一句话说明（无则空字符串）",
  "should_show_new_session_button": false
}

判断：topic_drift_signal 为 "off_topic" 时 should_show_new_session_button 必须为 true；其他情况为 false。

${buildToolSuggestionPhaseAppendix(input, { includeNewCycleDetection: false })}`;
}

export async function callCollectingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = await buildOrientalSystemPrompt(input, buildCollectingTaskBlock(input));
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 3600,
      temperature: 0.5,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content);
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
  if (input.agent_state && suggested_phase) {
    suggested_phase = clampCollectingSuggestedPhase(
      suggested_phase,
      input.agent_state,
      input.session,
      context_updates,
      questionCategory,
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
    ...drift,
  };
}
