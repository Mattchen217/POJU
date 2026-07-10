/**
 * POJU v6 Shadow — opening 阶段（理解门 · taskBlock 注入 user 侧）。
 *
 * ⚠️ 影子实现，不替换 opening-phase.ts。
 */

import {
  normalizeAgentPhase,
  type AgentPhase,
  isUnderstandingComplete,
  mergeCoreDilemma,
  mergeDesiredDirection,
  parseCoreDilemmaPatch,
  parseDesiredDirectionPatch,
} from "@/lib/poju/agent-state";
import { countSubstantiveOpeningTurns } from "@/lib/poju/agent";
import { shouldForceConverge } from "@/lib/poju/state-machine";
import {
  callPhaseJsonTransport,
  formatPhaseMessageHistory,
  resolvePhaseResponse,
  withPhaseStreamOpts,
  isPhaseParseFailed,
} from "@/lib/llm/phases/phase-transport";
import type { PojuV4ActionRequested } from "@/lib/poju/types";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildPhaseTransportInputV6 } from "@/lib/llm/phases/oriental-prompt-context-v6";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
import { parseOpeningConversionPayload } from "@/lib/poju/opening-conversion-payload";
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
\`\`\`
- **不限长度**——越详细越好，它们是第2段深度分析的唯一靶心。
- **门槛 = 子要素全部非空**（事件+利害+卡点 + 想要+优先项），不是字数。
- **必须主动问出 desired_direction**——用户通常只倒苦水、不说"想要什么"，你要专门追问：
  "你最希望这件事往哪个方向走？" / "如果能改变，你最想改变的是哪一点？"
- 两组字段的子要素【全部】填写完整前，继续追问，不推进、不下命理结论。
- \`understanding_sufficient\` 仅作你的自评参考；**后端放行只看上述字段是否齐备**，不靠你自报。

## 博弈准则（像老师，不像审讯）
- **一句话只给话题、不给困境** → 继续问一层，\`understanding_sufficient\` 可 false。
- 不要急着下判断、不要假装懂了。像一位有温度的老师：先共情、给一点点拨（一句照见），再问一层。通常要 1–2 轮，他把处境说开了再 sufficient。
- **每轮追问前先综合用户已经说过的**——不要重复问他已经交代过的信息；缺什么补什么，已答的不问第二遍。
- **追问最多再补 1 个真正缺的关键信息**（优先补 desired_direction 或缺失的子要素）；宁可推进后在 collecting 边给洞见边收集，也不要在 opening 兜圈子。
- 没说清（问候、元问题、只有情绪没有具体事、或只有话题没有困境）→ 温和而直指要害地让他知道"目前信息太少、POJU 还无法看清这个局"，引导他说出那一件最卡住的事。**此状态不下任何命理结论。**
- **opening 以承接 + 问清为主**：可点一句初步观察，但**不展开整段命盘分析**。
- **opening 回复哪怕短，也至少要有一处长在本盘结构上的具体判断**（点名一个真实字段并套 ⟦t:…⟧）。
- **每一轮都锚回 original_question。** 用户过程中提到的别的事——那是【破这个局的证据/线索】，不是新调查线。
- **禁 tracking 话术**："回来汇报进展/有结果再来"只属于交付之后。

## conversion envelope（仅 core_dilemma + desired_direction 全部齐备 · 同轮一次 JSON）

### ⚠️ 结构齐备硬约束（缺字段 = 格式错误）
当两组字段子要素【全部】非空时，本轮【必须】在同一个 JSON 里同时输出完整 conversion envelope：
  \`relationship_conclusion\`、\`breakthrough_directions\`（2–3 条）、\`investigation_agenda\`（3–4 项）、
  \`question_category\`、\`problem_summary\`，以及 \`response\`。
\`response\` 必须【直接问 investigation_agenda 的第一项】（带问号）。
结构未齐备时只出 \`response\` + 已填写的 core_dilemma/desired_direction，不带议程字段。

## 你不负责
- 是否进入 collecting（后端控制面校验结构完整性 + base analysis）
- 议程顺序（conversion 后由状态机写入快照）`;

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
  const baseAnalysisReady = Boolean(input.base_analysis ?? input.session.has_profile ?? structured);
  const substantiveOpeningTurns = countSubstantiveOpeningTurns(input.session.messages);
  const openingConversionRound =
    input.agent_state?.current_phase === "opening" &&
    shouldForceConverge(substantiveOpeningTurns, baseAnalysisReady);
  const openingThinkingEffort = openingConversionRound ? "xhigh" : "high";

  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "chat_flash",
      temperature: 0.55,
      max_tokens: openingConversionRound ? 20_000 : 16_000,
      thinking_effort: openingThinkingEffort,
    }),
  );

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

  const { parsed, response: rawResponse } = resolvePhaseResponse(result.content, {
    locale: input.locale,
    structured,
    phase_name: "opening",
    call_type: "chat_flash",
    provider: result.provider ?? undefined,
    model: result.model,
    finish_reason: result.finish_reason ?? undefined,
    raw_length: result.content.length,
    audit_relations: auditRelations,
  });
  let response = rawResponse;

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
    parseCoreDilemmaPatch(parsed.core_dilemma),
  );
  const desired_direction = mergeDesiredDirection(
    input.agent_state?.desired_direction ?? null,
    parseDesiredDirectionPatch(parsed.desired_direction),
  );
  const understandingStructComplete = isUnderstandingComplete({
    core_dilemma,
    desired_direction,
  });

  const suggestedRaw = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase : null;
  let suggested = suggestedRaw ? normalizeAgentPhase(suggestedRaw) : null;

  let question_category = extractQuestionCategory(parsed);
  let breakthrough_core: PhaseLLMResult["breakthrough_core"] = null;
  let investigation_agenda: PhaseLLMResult["investigation_agenda"] = null;
  let problem_summary: string | null = null;

  let conversion_envelope_failed = false;

  if (understandingStructComplete) {
    const conversion = parseOpeningConversionPayload(parsed, response, input.locale);
    if (conversion) {
      response = conversion.response;
      breakthrough_core = conversion.breakthrough_core;
      investigation_agenda = conversion.investigation_agenda;
      question_category = conversion.question_category ?? question_category;
      problem_summary = conversion.problem_summary;
      suggested = "collecting_context";
      console.info("[opening-phase-v6] conversion envelope parsed", {
        agenda: investigation_agenda.length,
        category: question_category,
      });
    } else {
      conversion_envelope_failed = true;
      response = "";
      console.warn(
        "[opening-phase-v6] understanding_sufficient but envelope parse failed — suppress orphan dialogue; core fallback will supply user-facing question",
      );
    }
  }

  const suggested_phase =
    understandingStructComplete && suggested && VALID_SUGGESTED.includes(suggested)
      ? suggested
      : understanding.sufficient && suggested && VALID_SUGGESTED.includes(suggested)
        ? suggested
        : null;

  console.log("[poju-diag] phase-transition-v6", {
    from: "opening",
    to: suggested_phase ?? "opening",
    sufficient: understanding.sufficient,
    understanding_sufficient,
    understanding_struct_complete: understandingStructComplete,
    suggested: suggested_phase,
    parse_failed: isPhaseParseFailed(parsed),
  });

  const rawAction = typeof parsed.action_requested === "string" ? parsed.action_requested.trim() : null;
  const action_requested: PojuV4ActionRequested | null =
    rawAction === "continue_chat" ? rawAction : "continue_chat";

  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  if (desired_direction?.wants) {
    context_updates.desired_outcome = desired_direction.wants;
  }

  return {
    response,
    suggested_phase,
    action_requested,
    context_updates,
    question_category,
    current_summary: problem_summary,
    problem_summary,
    breakthrough_core,
    investigation_agenda,
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
    conversion_envelope_failed: conversion_envelope_failed || undefined,
    llm_debug: result.llm_debug
      ? {
          ...result.llm_debug,
          phase: openingConversionRound ? "opening_conversion" : result.llm_debug.phase ?? "opening",
        }
      : undefined,
  };
}
