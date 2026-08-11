import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import {
  classifyStallOfferReply,
  stallOfferChoiceToSuggestedPhase,
} from "@/lib/poju/stall-offer-routing";
import type { AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { buildPhaseTransportInput } from "@/lib/llm/phases/oriental-prompt-context";
import { buildSpineBlock } from "@/lib/llm/phases/spine-block";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";

const VALID_SUGGESTED: AgentPhase[] = ["awaiting_confirmation", "collecting_context"];

export type ConfirmationSignal = "confirmed" | "wants_to_add" | "unclear";

function parseConfirmationSignal(parsed: Record<string, unknown>): ConfirmationSignal | undefined {
  const raw = parsed.confirmation_signal;
  if (raw === "confirmed" || raw === "wants_to_add" || raw === "unclear") return raw;
  const phase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : "";
  if (phase === "delivered") return "confirmed";
  if (phase === "collecting_context") return "wants_to_add";
  if (typeof parsed.user_confirms_delivery === "boolean" && parsed.user_confirms_delivery) {
    return "confirmed";
  }
  return undefined;
}

function buildConfirmationTaskBlock(input: PhaseLLMInput, mode: "wrap_up" | "follow_up"): string {
  const agent = input.agent_state;
  const contextText = agent ? formatContextForPrompt(agent) : "";
  const spineBlock = buildSpineBlock(agent);

  if (mode === "wrap_up") {
    return `# 动态上下文 · awaiting_confirmation（收集完成 · 对话式核对）

用户的问题："${input.session.original_question}"

${spineBlock}

## 已收集（用户亲口）
${contextText}

## 任务
你已收齐该问的关键信息。用一段【聊天口吻】的话，把你对他处境的理解做一次凝练总结
（不是复述他的原话，而是你看懂了什么：核心困局 + 你已掌握的几个关键事实），
让他感到"被真正听懂了"。
末尾明确邀请：如果以上都准确，请点「可以，没有补充了」——确认后我将为你生成最终交付的完整 Plan；若还有要补充或修正的，请点「我还要补充」。
confirmation_signal 填 "unclear"（等待用户回应）。

输出 JSON：response, confirmation_signal, suggested_phase, context_updates`;
  }

  return `# 动态上下文 · awaiting_confirmation（用户回应核对）

用户的问题："${input.session.original_question}"

${spineBlock}

## 已收集
${contextText}

## 任务
用户刚回应你的总结/核对邀请。判断他是要补充、确认可以交付、还是还没说清：
- 明确确认（可以/没有了/继续/开始吧）→ confirmation_signal: "confirmed"，1-3 句自然承接，suggested_phase: "awaiting_confirmation"
- 要补充或修正 → confirmation_signal: "wants_to_add"，接住新信息，suggested_phase: "collecting_context"
- 含糊未决 → confirmation_signal: "unclear"，温和再确认一次，suggested_phase: "awaiting_confirmation"
不要在此输出完整破局交付正文。

输出 JSON：response, confirmation_signal, suggested_phase, context_updates`;
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

  const { system, messages } = await buildPhaseTransportInput(
    input,
    `# 任务：止损选择回应

用户刚收到「继续聊 vs 先给方向」二选一。代码已判定：${choiceHint}。2-4 句自然承接，不要再次二选一，不要「稍等我去整理」。

输出 JSON：response, suggested_phase, context_updates`,
  );
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 8000,
      temperature: 0.45,
      thinking_effort: "xhigh",
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
    served_provider: result.provider ?? null,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
    stall_offer: false,
  };
}

function isWrapUpTurn(input: PhaseLLMInput): boolean {
  const userMsg = input.user_message.trim();
  if (!userMsg || userMsg === "__OPENING__" || userMsg.startsWith("[SYSTEM:")) return true;
  const lastAssistant = [...input.session.messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return true;
  const confirmCue =
    /补充|修正|完整|推演|破局|还有什么|anything (?:else|more)|add or correct|ready for (?:the )?(?:full )?(?:analysis|plan)/i;
  return !confirmCue.test(lastAssistant.content);
}

export async function callConfirmationPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const agent = input.agent_state;

  if (agent?.stall_offer_pending) {
    return handleStallOfferReply(input);
  }

  const wrapUp = isWrapUpTurn(input);
  const task = buildConfirmationTaskBlock(input, wrapUp ? "wrap_up" : "follow_up");
  const baseMessages = wrapUp
    ? [
        ...formatPhaseMessageHistory(input.session.messages),
        {
          role: "user" as const,
          content: input.locale.startsWith("zh")
            ? "关键信息已收齐，请用聊天口吻总结并问我是否还要补充。"
            : "Collection is complete — summarize in chat and ask if I want to add anything.",
        },
      ]
    : formatPhaseMessageHistory(input.session.messages);

  const { system, messages } = await buildPhaseTransportInput(input, task, baseMessages);

  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: 8000,
      temperature: 0.45,
      thinking_effort: "xhigh",
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });
  const confirmation_signal = parseConfirmationSignal(parsed as Record<string, unknown>);
  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  let suggested_phase: AgentPhase =
    rawPhase && VALID_SUGGESTED.includes(rawPhase as AgentPhase)
      ? (rawPhase as AgentPhase)
      : "awaiting_confirmation";

  if (confirmation_signal === "wants_to_add") suggested_phase = "collecting_context";
  if (confirmation_signal === "confirmed") suggested_phase = "awaiting_confirmation";

  const user_confirms_delivery = confirmation_signal === "confirmed" ? true : undefined;

  return {
    response,
    suggested_phase,
    confirmation_signal,
    user_confirms_delivery,
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
    served_provider: result.provider ?? null,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}
