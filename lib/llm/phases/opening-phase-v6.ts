/**
 * POJU v6 Shadow — opening 阶段（理解门 · taskBlock 注入 user 侧）。
 *
 * ⚠️ 影子实现，不替换 opening-phase.ts。
 */

import { normalizeAgentPhase, type AgentPhase } from "@/lib/poju/agent-state";
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
export const POJU_V6_OPENING_PHASE_RULES = `# 当前阶段任务 · opening（理解门）

【唯一目标：把"困境"问清楚，不是把"话题"接住】

\`understanding_sufficient\` 只有在你真正看懂这个人的【困境】时才可置 true——即你能说清三件事：
  ① 具体处境（不是话题，是他生活里到底发生了什么、卡在什么场景）；
  ② 真正的利害（为什么是现在、卡住的代价是什么、他在怕/想要什么）；
  ③ 让他觉得"过不去"的那个点（试过什么、为何无解感）。

## 博弈准则（像老师，不像审讯）
- **一句话只给话题、不给困境**（如时效焦虑类"什么时候/能不能"）→ \`understanding_sufficient\` = false。不报日期、不断吉凶；把它升级成对底层阻碍与心理耐受度的照见，再【自然地引他多说一层】——不是连珠炮发问。
- 不要急着下判断、不要假装懂了。像一位有温度的老师：先共情、给一点点拨（一句照见），再问一层。通常要 1–2 轮，他把处境说开了，你才真正 sufficient。
- **每轮追问前先综合用户已经说过的**——不要重复问他已经交代过的信息；缺什么补什么，已答的不问第二遍。
- **具体处境 + 利害 + 卡点 三者齐备时**，置 \`understanding_sufficient=true\` 推进；不要无限深挖。
- **追问最多再补 1 个真正缺的关键信息**；宁可推进后在 collecting 边给洞见边收集，也不要在 opening 兜圈子。
- 没说清（问候、元问题、只有情绪没有具体事、或只有话题没有困境）→ 温和而直指要害地让他知道"目前信息太少、POJU 还无法看清这个局"，引导他说出那一件最卡住的事。**此状态不下任何命理结论。**
- **opening 以承接 + 问清为主**：可点一句初步观察，但**不展开整段命盘分析、不重复上一轮已说过的框架**（如《易经》时位、大运宜进宜守等整段解读）。整段深度解读留给 collecting（core 就绪后只给一次）。
- **opening 回复哪怕短，也至少要有一处长在本盘结构上的具体判断**（点名一个真实字段——如某柱十神 / strength / 用神 / 本盘实算神煞实例——并套 ⟦t:…⟧ 解释它对【这个问题】意味着什么）。
- **锚点必须落在他真实的结构字段上**；禁止不点名具体结构、谁都适用的泛泛比喻散文。一两处锚点即可，不堆术语，但**零锚点的笼统散文不合格**。
- **每一轮都锚回 original_question。** 用户过程中提到的别的事——那是【破这个局的证据/线索】，不是新调查线：简短接住 → 抽出它与原问题的关联 → 立刻拐回原问题。
- **严禁钻进支线本身。** 不要连问两句都在聊支线、而没回到原问题；一旦发现跑偏，立刻拉回。
- **禁 tracking 话术**："回来汇报进展/有结果再来"只属于交付之后；opening 收尾永远是问清下一层，或 conversion 时问 agenda 第一项。

## conversion envelope（仅 understanding_sufficient=true · 同轮一次 JSON）

### ⚠️ understanding_sufficient=true 硬约束（缺字段 = 格式错误）
当 \`understanding_sufficient=true\` 时，本轮【必须】在同一个 JSON 里同时输出完整 conversion envelope：
  \`relationship_conclusion\`、\`breakthrough_directions\`（2–3 条）、\`investigation_agenda\`（3–4 项）、
  \`question_category\`、\`problem_summary\`，以及 \`response\`。
\`response\` 必须【直接问 investigation_agenda 的第一项】（带问号）——不得只给与议程无关的泛问。
**严禁** sufficient=true 却只输出 \`response\` 而不带 agenda / core 字段；否则后端视为格式错误并丢弃该句对话。

- 输出 \`relationship_conclusion\`、\`breakthrough_directions\`（2–3 条，宁少而锐）、\`investigation_agenda\`（3–4 项，label ≤20 字）、\`question_category\`、\`problem_summary\`
- \`response\` = 关系结论讲给用户 + **直接问 investigation_agenda 的第一项**（带问号）
- 不要说"我去深入推演"再停顿。understanding_sufficient=false 的普通轮只出 \`response\` + false，不带议程字段。

## 你不负责
- 是否进入 collecting（后端 Gate + 轮数护栏）
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

  const suggestedRaw = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase : null;
  let suggested = suggestedRaw ? normalizeAgentPhase(suggestedRaw) : null;

  let question_category = extractQuestionCategory(parsed);
  let breakthrough_core: PhaseLLMResult["breakthrough_core"] = null;
  let investigation_agenda: PhaseLLMResult["investigation_agenda"] = null;
  let problem_summary: string | null = null;

  let conversion_envelope_failed = false;

  if (understanding_sufficient) {
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
    understanding_sufficient && suggested && VALID_SUGGESTED.includes(suggested)
      ? suggested
      : understanding.sufficient && suggested && VALID_SUGGESTED.includes(suggested)
        ? suggested
        : null;

  console.log("[poju-diag] phase-transition-v6", {
    from: "opening",
    to: suggested_phase ?? "opening",
    sufficient: understanding.sufficient,
    understanding_sufficient,
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
