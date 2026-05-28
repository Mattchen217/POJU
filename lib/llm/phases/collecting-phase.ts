import {
  findMissingFields,
  REQUIRED_FIELDS_BY_CATEGORY,
} from "@/lib/poju/agent-state";
import { formatContextForPrompt, formatMissingFieldsForPrompt } from "@/lib/poju/context-extractor";
import type { AgentPhase } from "@/lib/poju/agent-state";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult } from "@/lib/llm/phases/phase-transport";
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

## 问诊原则

1. 每轮做三件事：承接用户情绪与事实（2-4 句）→ 命盘/大运与处境对应（必须引用命主基础分析中的具体点）→ 问 1-2 个尖锐具体问题
2. 命盘 ↔ 处境对应，不要空讲性格；用户已表达多年不顺/重大压力时，命理解读要够具体、够展开
3. 不重复已知信息；一次不要问超过 3 个问题
4. 只把用户【明确说过】的事实写入 context_updates，不要推断编造

## 用户追问已给建议时（如「只放个水杯就行吗」「除了 X 还要做什么」）

- ✗ 禁止退化成空泛倾听套话、重复追问上下文中用户已说清楚的事实
- ✓ 在水杯/方位/物件/行动建议上【展开】：为什么有效、放哪里、什么材质/颜色、何时调整、还可叠加 1-2 个具体动作
- ✓ 继续用命主基础分析 + 当前大运支撑，保持东方破局顾问口吻

## 完成判断

- 完成度 ≥ 70% 或信息已够支撑 3 条可执行行动 → suggested_phase: "awaiting_confirmation"
- 用户说「差不多了 / 可以分析了」→ "awaiting_confirmation"
- 否则 → "collecting_context"

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
  const result = await callPhaseJsonTransport(system, messages, {
    call_type: "collection_flash",
    max_tokens: 3600,
    temperature: 0.5,
  });

  const { parsed, response } = parsePhaseResult(result.content);
  if (!response) {
    console.warn("[collecting-phase] Empty response from model; raw length:", result.content.length);
  }

  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase = rawPhase && VALID_SUGGESTED.includes(rawPhase as AgentPhase) ? (rawPhase as AgentPhase) : null;

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
    question_category: typeof parsed.question_category === "string" ? parsed.question_category : null,
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
