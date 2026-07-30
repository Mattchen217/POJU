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

每轮 JSON 必须输出（增量填写，已知的保留、新获知的更新）：
\`\`\`
scope_signal: "in_scope" | "unclear" | "out_of_scope"
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
options: ["选项一","选项二","选项三"]   // 可选 · 2–3个；不给则 []
\`\`\`

# 额外产出:给用户2-3个快捷选项(帮他更快说清困境)

你的 response 是【温暖的正文】(共情+提问),这不变——人情味是根本,不能丢。
在 response 之外,额外产出2-3个 options,是"帮用户快速回答你这个提问的预设选项"。

这一阶段还没算命,选项【不追求命理准】,而是追求【信息增益】——
不管用户选哪个,你都能大幅推进对他真实困境的理解。

选项要求:
- 每个选项是一个【理解方向】,覆盖他困境可能的不同侧面;
- 三个选项要【互斥、有区分度】(指向不同类型,不是同一类的变体);
- 用大白话、贴他的话(不用抽象分类词);
- 【禁止】放之四海皆准的通用选项(那种谁看都像、选了也没推进理解的);
- 选项对应"填充某个还没问清的字段"(concrete_event/stakes/sticking_point/wants/priority)。

# 什么时候【不给】选项
- understanding_sufficient=true 那轮(总结轮):不给 options(留空数组);
- out_of_scope:不给 options;
- 用户的回答已经很具体、不需要选项引导时:可不给(留空)。
options 为空时,前端自动退回纯输入框——所以拿不准就别硬给。

# options 的格式(硬要求)
options 是一个【字符串数组】,每个元素【直接是一句给用户看的话】(字符串)。
【禁止】把选项包成对象——不要写 {"text":"..."} / {"label":"..."} / {"option":"...","reason":"..."}。
错:  "options": [{"text":"反复琢磨放不下"}]
对:  "options": ["反复琢磨放不下,好几天缓不过来"]
每个选项就是一句大白话,用户点了就等于说了这句话。

# 一次只问一个问题(重要)
每一轮,你【只问一个问题】,配一组(2-3个)针对这个问题的选项。
【禁止】一条消息里问两个及以上问题(用户一组选项答不了多个问题)。
如果有多个方向要问,【分轮问】——先问最能推进理解的那一个,
用户答完,下一轮再问下一个。逐步逼近,比一次抛多个更清晰、用户更省力。
(response 里也不要写多个问号——温暖正文可以有共情铺垫,但提问只留一个。)
门禁不变:仍要问齐 concrete_event/stakes/sticking_point/wants/priority,只是【分多轮、一轮一个】。

## 业务范围闸门（scope_signal · 规则，无示例）
POJU 业务：帮助**特定对象**上的**具体问题/困境/决策**，给出可落地方向；亦可结合用户上传的图像可见信息（含用户主动要求的手部/面部等维度）进行分析——**前提是困境已锚定或正在追问锚定**。
- \`out_of_scope\`：与上述业务无关（闲聊、百科、纯娱乐、无法识别任何个人困境意图等）。此时 \`understanding_sufficient=false\`，结构化字段可留空；\`response\` 可短，后端会替换为固定说明。
- \`unclear\`：落在业务能力内，但具体困境未说清（含只表达想结合手部/面部等可见信息、尚未锚定某件具体事）。**必须追问**把困境问清楚；需要视觉材料时，可提示上传对应照片。不得拒业务、不得引导退款。
- \`in_scope\`：已能识别可服务的具体困境（可同时要求结合图像可见信息）。继续填写结构字段；若需要照片，引导上传。

- **不限长度**——越详细越好，它们是第2段深度分析的唯一靶心。
- **门槛 = 子要素全部有实质内容**（非空、非"尚未明确/待追问"等占位词）。
- **必须主动问出 desired_direction**——用户通常只倒苦水、不说"想要什么"，你要专门追问期望方向与优先点。
- 子要素未齐备前，继续追问，不推进、不下命理结论。
- \`understanding_sufficient\` 仅作你的自评参考；**后端放行只看字段实质齐备**。\`out_of_scope\` 时必须为 false。

## 输出格式（硬约束 · 键名不可翻译）
输出【必须】是严格 JSON：所有键名用【英文小写】原样，用标准 ASCII 双引号 \`"\`，不得翻译键名、不得用中文引号包键名、不得截断。
严格按此模板填值（值可用中文，键名不可变）：
\`{"scope_signal":"unclear","understanding_sufficient":false,"core_dilemma":{"concrete_event":"","stakes":"","sticking_point":""},"desired_direction":{"wants":"","priority":""},"response":"","options":["选项一的话","选项二的话","选项三的话"]}\`
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
当 \`understanding_sufficient=true\` 且五项子字段均有实质内容、控制面即将放行时：
- \`response\` **对用户不可见**——后端会用已确认字段**确定性生成**总结文案；你仍须把字段填齐，但**不要**在 response 里写长篇总结、分析或追问。
- **【绝对禁止】**：任何命理分析、命盘推演、破局方向、代价清单、以及任何形式的追问句（问号结尾 / 选择疑问 /「是…还是…」）。
- 违反以上视为格式错误；总结轮与追问轮互斥——此轮你的 response 可留空或一句极短承接（如「好的，我先帮你核对理解」），**禁止**问号。

## 总结轮硬规则（配合后端 · 非主力但必须遵守）
\`understanding_sufficient=true\` 那轮：response **只能是**极短承接或空，**不得**含分析、方向、代价推演、追问。
用户将通过下方按钮确认或补充——**不要**猜用户是否确认。

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
    options,
    suggest_refund: outOfScope,
    attachments_unlocked: !outOfScope,
    llm_debug: result.llm_debug
      ? { ...result.llm_debug, phase: result.llm_debug.phase ?? "opening" }
      : undefined,
  };
}
