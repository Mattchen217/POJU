import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import {
  classifyStallOfferReply,
  stallOfferChoiceToSuggestedPhase,
} from "@/lib/poju/stall-offer-routing";
import type { AgentPhase, ContextSummary } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { buildOrientalSystemPrompt } from "@/lib/llm/phases/oriental-prompt-context";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";

const VALID_SUGGESTED: AgentPhase[] = ["awaiting_confirmation", "collecting_context", "delivered"];

function normalizeSummary(raw: unknown): ContextSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as ContextSummary;
  if (!Array.isArray(s.sections)) return null;
  return {
    generated_at: typeof s.generated_at === "string" ? s.generated_at : new Date().toISOString(),
    category: String(s.category ?? "other"),
    sections: s.sections,
  };
}

const TRANSITION_CONSENT_RULES = `# 过渡句措辞铁律（写死 · 防止死锁）

response 必须：

1. 以一个【明确的征询问句】结尾，问号收尾，直接问用户「现在就要完整分析吗」，需要用户回 yes/no 才能推进。
   ✓ "I have what I need. Ready for me to lay out the full analysis and the concrete steps now?"
   ✓ "我已经看清这个局了。要我现在给你完整分析和三个具体行动吗？"

2. 严禁任何【异步告知式】措辞——它们暗示你会自己稍后推送，但你是回合制的、不会自动推送，会让用户被动等待→死锁：
   ✗ "Give me a moment" / "Let me assemble" / "I'll come back"
   ✗ "给我一点时间" / "稍等" / "我去整理一下" / "我会回来给你" / "让我整理一下你看看"

3. 触发权交给用户：用户回 yes/ready → 可进入下一步；用户要补充/修改 → 回 collecting_context。`;

function buildSummaryTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const contextText = agent ? formatContextForPrompt(agent) : "";
  const completeness = agent?.collection_completeness ?? 0;

  return `# 当前任务：信息汇总

你已经和用户聊了几轮，信息基本完整。现在要整理成可编辑的汇总页供用户确认。

## 用户的原始问题
"${input.session.original_question}"

## 已收集的信息
${contextText}

完成度: ${(completeness * 100).toFixed(0)}%

## 你要做什么

1. response：50-100 字简短承接（说明汇总卡片已生成、请核对），**不要**复述整张表；**必须以明确征询问句结尾**（见下方过渡句铁律），问用户信息是否准确、是否现在就要完整分析。
2. current_summary：5-7 个 section，每节 2-5 个 item；value 尽量用用户原话；不要补充用户没说的

${TRANSITION_CONSENT_RULES}

## 输出格式（严格 JSON）

{
  "response": "...",
  "suggested_phase": null,
  "current_summary": {
    "generated_at": "<ISO8601>",
    "category": "career|relationship|wealth|health|family|decision|interpersonal|other",
    "sections": [{ "section_id": "...", "title": "...", "items": [{ "item_id": "...", "label": "...", "value": "...", "field_key": "..." }] }]
  },
  "context_updates": {}
}`;
}

async function handleConfirmProceed(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const existingSummary = input.agent_state?.current_summary ?? null;
  const system = await buildOrientalSystemPrompt(
    input,
    `# 当前任务：用户已确认汇总

用户已确认信息无误，准备进入深度破局交付。用 1-3 句自然承接（可提及将结合命盘与已收集信息），并设置 suggested_phase 为 "delivered"。不要输出完整交付正文。

输出 JSON：response, suggested_phase, context_updates`,
  );
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 800,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });
  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase =
    rawPhase === "delivered" ? "delivered" : ("delivered" as const);

  return {
    response,
    suggested_phase,
    context_updates:
      parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
        ? (parsed.context_updates as Record<string, unknown>)
        : {},
    question_category: null,
    current_summary: existingSummary,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}

async function generateSummaryPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = await buildOrientalSystemPrompt(input, buildSummaryTaskBlock(input));
  const messages = formatPhaseMessageHistory(input.session.messages);
  const trigger =
    input.user_message.trim() ||
    (input.locale.startsWith("zh") ? "请基于以上信息生成汇总。" : "Generate the confirmation summary from our conversation.");

  const result = await callPhaseJsonTransport(
    system,
    [...messages, { role: "user", content: trigger }],
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 3000,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  const summary = normalizeSummary(parsed.current_summary);
  if (summary && !summary.generated_at) {
    summary.generated_at = new Date().toISOString();
  }

  return {
    response,
    suggested_phase: null,
    context_updates: {},
    question_category: null,
    current_summary: summary,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}

async function handleStallOfferReply(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const choice = classifyStallOfferReply(input.user_message);
  const suggested_phase = stallOfferChoiceToSuggestedPhase(choice);
  const choiceHint =
    choice === "continue_collecting"
      ? "用户选择继续补充信息"
      : choice === "degraded_delivery"
        ? "用户选择基于现有信息先给方向"
        : "用户未明确选择，按兜底先给方向处理";

  const system = await buildOrientalSystemPrompt(
    input,
    `# 当前任务：止损选择回应

用户刚收到「继续聊 vs 先给方向」的二选一。代码已判定：${choiceHint}。

用 2-4 句自然承接即可：
- 若继续收集：欢迎补充，说明下一问会轻松具体
- 若先给方向 / 兜底：确认将基于现有信息与命盘给出方向（不要输出完整交付正文）

不要再次抛出二选一。不要「稍等我去整理」。

输出 JSON：
{
  "response": "...",
  "suggested_phase": "${suggested_phase}",
  "context_updates": {}
}`,
  );
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 900,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  return {
    response,
    suggested_phase,
    context_updates:
      parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
        ? (parsed.context_updates as Record<string, unknown>)
        : {},
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
    stall_offer: false,
  };
}

export async function callConfirmationPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const agent = input.agent_state;
  const userMsg = input.user_message.trim();
  const existingSummary = agent?.current_summary ?? null;

  if (agent?.stall_offer_pending) {
    return handleStallOfferReply(input);
  }

  if (!existingSummary) {
    return generateSummaryPhase(input);
  }

  if (userMsg.includes("confirmed summary") || userMsg.includes("[SYSTEM:")) {
    return await handleConfirmProceed(input);
  }

  const system = await buildOrientalSystemPrompt(
    input,
    `# 当前任务：确认阶段对话

用户已看到汇总，正在回应。根据用户消息：
- 要补充 → suggested_phase: "collecting_context"
- 明确确认可开始分析 → suggested_phase: "delivered"
- 否则保持 "awaiting_confirmation"

不要在此阶段输出完整破局交付。

${TRANSITION_CONSENT_RULES}

若用户尚未明确 yes/ready，你的 response 仍须以征询问句结尾（例如确认汇总无误后是否现在开始完整分析），禁止「稍等我去整理」类告知式措辞。

输出 JSON：response, suggested_phase, context_updates`,
  );
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 1200,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase =
    rawPhase && VALID_SUGGESTED.includes(rawPhase as AgentPhase) ? (rawPhase as AgentPhase) : "awaiting_confirmation";

  return {
    response,
    suggested_phase,
    context_updates:
      parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
        ? (parsed.context_updates as Record<string, unknown>)
        : {},
    question_category: null,
    current_summary: existingSummary,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}
