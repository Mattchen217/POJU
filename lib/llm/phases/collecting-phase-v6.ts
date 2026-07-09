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

const VALID_SUGGESTED: AgentPhase[] = ["collecting_context", "awaiting_confirmation"];
const VALID_ACTIONS: PojuV4ActionRequested[] = ["continue_chat", "deliver_main", "track_progress"];

/* ── collecting 阶段专属控制面（user taskBlock · 无具体案例） ── */

export const POJU_V6_COLLECTING_PHASE_RULES = `# 当前阶段任务 · collecting_context（深测算 + 多元问诊）

在关系结论与破局方向已确立的前提下，按快照 agenda 逐项收齐验证信息——你是老师，不是问卷机。

## 首轮进入（关系结论/方向刚确立）
2–4 句第一阶段洞见 + 破局大方向；**收尾必须立刻问** snapshot \`current_focus\` 对应的那一个问题（**只问这一句**）。用户**看不到**内部议程列表，禁止「愿意的话我们顺着深入推演」等空邀请、**禁止列 pending 项**、**绝不**交付完整 3 条行动。

## 后续每一轮（克制律 · 核心）
只围绕 snapshot \`agenda_checklist.current_focus\` 给的【那一项】，把它化成一句共情、直击的人话来问。
· 用户回答后，先判断：他这次有没有真正回答到这一项？
  - 答到位了 → 把这一项写进 \`agenda_updates.completed_in_this_turn\`，顺势带向下一项。
  - 含糊 / 答非所问 / 没答 → 【不要】写进 completed；温和指出还缺哪一块、请他说具体，并加一句软提示："你说得越具体，我最后给你的方案就越贴合、越能落地；含糊或跳过，方案的可行性会打折扣。"
· 这一项你最多追问一轮。若再问一轮他仍说不清或不愿细说，就接受现有信息、轻轻带一句"那这块我们先这样"，把它写进 completed，推进下一项——**绝不把同一项问第三遍、不把用户问烦**。
· **一轮只推进这一项，绝不把 pending 全列做成问卷砸过去。**

## 末项与核对
当议程即将全部 covered（本轮 completed 后无 pending），**必须**按 awaiting_confirmation 规则收尾：凝练总结 + **末尾明确问**「回复可以或没有了我就生成方案」——**禁止只总结不提问**。

## 边界
- **collecting / awaiting_confirmation 禁 tracking 话术**：不说"回来报数据/有进展再来汇报"。
- **锚定 original_question**：支线是证据，不另开调查线；勿深挖支线内部细节。
- 关系结论与方向已确立（✓）的后续轮：**不要重复**第一阶段洞见。

## 你不负责
- 判定是否进入 awaiting_confirmation（后端 Gate）
- 止损 / 退款（后端 stop-loss）
- 修改 agenda 顺序（无条件信任 current_focus）`;

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
凝练总结 + 末尾必须问：「回复可以或没有了我就生成完整破局方案」。`;
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

  return `# 动态任务 · collecting_context
original_question："${q}"

${POJU_V6_COLLECTING_PHASE_RULES}

${spineBlock}

${agendaBlock}
${insightDirective}
${lastItemDirective}

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
    suggest_refund,
    served_provider: result.provider ?? null,
    ...drift,
  };
}
