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
  getPhaseEmptyGenerationFallback,
  isPhaseOpeningPayloadUsable,
  resolvePhaseResponse,
  withPhaseStreamOpts,
  isPhaseParseFailed,
} from "@/lib/llm/phases/phase-transport";
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

const VALID_SUGGESTED: AgentPhase[] = ["opening", "collecting_context"];

/** opening 阶段专属控制面（user taskBlock · 无具体场景案例） */
export const POJU_V6_OPENING_PHASE_RULES = `# 当前阶段任务 · opening（理解门 · 第1段）

【唯一目标：通过温和多轮对话，问清并尽量详细地填写两组结构化字段——不是把"话题"接住】

每轮 JSON 必须输出（增量填写，已知的保留、新获知的更新）：
\`\`\`
core_dilemma: {
  concrete_event: "具体发生了什么事（不是笼统话题）",
  stakes: "利害：他在意/害怕失去什么",
  sticking_point: "卡点：卡在哪、为什么过不去"
}
desired_direction: {
  wants: "他【期望】解决成什么样 / 想要什么",
  priority: "他最在意的那一点 / 想优先往哪走"
}
response: "给用户看的追问/承接（仅此字段对用户可见）"
\`\`\`
- **不限长度**——越详细越好，它们是第2段深度分析的唯一靶心。
- **门槛 = 子要素全部有实质内容**（非空、非"尚未明确/待追问"等占位词）。
- **必须主动问出 desired_direction**——用户通常只倒苦水、不说"想要什么"，你要专门追问：
  "你最希望这件事往哪个方向走？" / "如果能改变，你最想改变的是哪一点？"
- 子要素未齐备前，继续追问，不推进、不下命理结论。
- \`understanding_sufficient\` 仅作你的自评参考；**后端放行只看字段实质齐备**。

## 输出格式（硬约束 · 键名不可翻译）
输出【必须】是严格 JSON：所有键名用【英文小写】原样，用标准 ASCII 双引号 \`"\`，不得翻译键名、不得用中文引号、不得截断。
严格按此模板填值（值可用中文，键名不可变）：
\`{"understanding_sufficient":false,"core_dilemma":{"concrete_event":"","stakes":"","sticking_point":""},"desired_direction":{"wants":"","priority":""},"response":""}\`
- 你对用户可见的话【必须】写在 JSON 的 \`"response"\` 字段里；思考过程留在 reasoning，**禁止**只把要对用户说的话写在思考里而不填 response。
- 每轮输出必须包含**非空**的 \`"response"\`。

## 博弈准则（像老师，不像审讯）
- **一句话只给话题、不给困境** → 继续问一层。
- 每轮追问前先综合用户已经说过的——缺什么补什么，已答的不问第二遍。
- 没说清 → 温和引导他说出那一件最卡住的事。**此状态不下任何命理结论。**
- **opening 以承接 + 问清为主**：可点一句初步观察，但**不展开整段命盘分析**。
- **response 里命理词必须打标** ⟦t:id|软译|白话⟧；**禁止在 opening 输出 relationship_conclusion / breakthrough_directions / investigation_agenda**（那是第2段）。

## 理解齐备 → 详细总结（等待用户确认 · 不进第2段）
当 \`understanding_sufficient=true\` 且五项子字段均有实质内容、控制面即将放行时：
- \`response\` **只输出【详细总结】**——用连贯、有温度的话，**完整、具体**复述用户的困境（事件+利害+卡点）与期望方向（想要+优先），让用户核对你是否理解得准。
- **【不得】再提出任何追问问题**——追问只在 \`understanding_sufficient=false\` 的轮次；总结轮与追问轮互斥。
- **不做命理分析、不给结论/破局/议程**；结尾简短预告：确认后将结合其个性化数据做深度分析，给出方向与要聊清的几个点。
- 用户将通过下方按钮确认或补充——**不要**在此轮猜用户是否确认。

## 你不负责（严禁抢跑）
- **关系结论 / 破局方向 / 调查议程** —— 第2段在控制面放行后由 breakthrough-core 独立 xhigh 生成
- 是否进入 collecting（后端控制面校验结构完整性 + base analysis）`;

function buildDeliveryHandoffBlockV6(input: PhaseLLMInput): string {
  const deliveryHandoff = Boolean(input.tool_injection_context?.includes("交付页延续"));
  if (!deliveryHandoff) return "";
  const q = input.session.original_question;
  return `# 交付页转入
用户刚从工具交付页进入 POJU；原始问题："${q}"
从注入资料中锚定他要深入的那件具体困境，自然开口承接。`;
}

/** v6 opening 动态 taskBlock */
export function buildOpeningTaskBlockV6(input: PhaseLLMInput): string {
  const handoff = buildDeliveryHandoffBlockV6(input);
  const q = input.session.original_question;
  const parts = [
    `# 动态任务 · opening`,
    `original_question："${q}"`,
    POJU_V6_OPENING_DUTY,
    POJU_V6_OPENING_PHASE_RULES,
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

  if (!isPhaseOpeningPayloadUsable(parsed, response)) {
    console.warn("[opening-v6] unusable JSON payload — controlled retry once");
    const retried = await callPhaseJsonTransport(system, messages, transportOpts);
    result = retried;
    ({ parsed, response } = resolvePhaseResponse(retried.content, {
      ...resolveCtx,
      provider: retried.provider ?? undefined,
      model: retried.model,
      finish_reason: retried.finish_reason ?? undefined,
      raw_length: retried.content.length,
    }));
  }

  if (!isPhaseOpeningPayloadUsable(parsed, response)) {
    console.warn("[opening-v6] payload still unusable after retry — empty-generation fallback");
    response = getPhaseEmptyGenerationFallback(input.locale);
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

  return {
    response,
    suggested_phase,
    action_requested,
    context_updates,
    question_category,
    current_summary: null,
    problem_summary: null,
    breakthrough_core: null,
    investigation_agenda: null,
    core_dilemma,
    desired_direction,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    served_provider: result.provider ?? null,
    thinking_process: undefined,
    understanding,
    understanding_sufficient,
    llm_debug: result.llm_debug
      ? { ...result.llm_debug, phase: result.llm_debug.phase ?? "opening" }
      : undefined,
  };
}
