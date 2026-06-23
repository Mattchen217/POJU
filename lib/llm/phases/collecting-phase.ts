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
  getNextAgendaFocus,
  parseInvestigationAgenda,
  stripAgendaFieldsFromContextUpdates,
} from "@/lib/poju/investigation-agenda";
import { callStallOfferPhase } from "@/lib/llm/phases/stall-offer-phase";
import { formatContextForPrompt, extractQuestionCategory, mergeContextUpdates, recordToLLMContextUpdates } from "@/lib/poju/context-extractor";
import type { AgentPhase, POJUAgentState } from "@/lib/poju/agent-state";
import { calculateCompleteness } from "@/lib/poju/agent-state";
import {
  callPhaseJsonTransport,
  getPhaseResponseFallback,
  resolvePhaseResponse,
  withPhaseStreamOpts,
} from "@/lib/llm/phases/phase-transport";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { buildPhaseTransportInput } from "@/lib/llm/phases/oriental-prompt-context";
import { normalizeBaseAnalysisInput } from "@/lib/llm/prompts/base-analysis-context";
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

function buildAgendaGenerationBlock(agent: POJUAgentState): string {
  if (agent.agenda_generated) return "";
  return `

## 首轮：先定调查议程（仅这一轮 · 持久）
这是第一轮。先在心里想清楚：要负责任地帮他破这个局，你**必须**搞清楚哪些事？把它们列成调查议程，写进 investigation_agenda：
- 6–8 项，针对【这个人这件事】定制（不要用通用字段名）。
- 至少 3 项 critical=true（缺了它就无法下判断）。
- 每项 { id, label, critical, status:"unexplored", supports }；supports 用一两句写它支撑你心里哪条破局方向。
- 破局方向/假设只放进 thought（不进 response）；收集阶段不开方。
议程一旦生成，后续轮**不再重写**，只更新各项 status。
response 里：自然接住他的问题、给一句真实判断，再抛出议程里第一个、最关键的问题。`;
}

function buildAgendaTrackingBlock(agent: POJUAgentState): string {
  const agenda = agent.investigation_agenda ?? [];
  if (agenda.length === 0) return "";
  const focus = getNextAgendaFocus(agenda);
  const focusText = focus.map((a) => `- ${a.label} (${a.id}, ${a.status})`).join("\n") || "- 优先把必查项弄清楚";
  return `

## 调查议程（你的收集计划 · 持久，勿重写）
${formatAgendaForPrompt(agenda)}

下一个该弄清的：
${focusText}

每轮判断用户上一答把当前项说清了没——说清 → agenda_status_updates 标 "covered"，推进到下一个还没弄清的关键项；没说清/答偏 → 标 "partial"，换个角度再问一次。已 covered 的别重复问。`;
}

function buildCollectingTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const q = input.session.original_question;
  if (!agent) {
    return `# 任务：开始了解这个局

用户的问题："${q}"
你还没有调查议程——先定议程（见下），接住他的问题、给一句真实判断，再问第一个关键问题。`;
  }
  const contextText = formatContextForPrompt(agent);

  return `# 任务：收集阶段——把这个局弄清楚

用户的问题："${q}"

## 已了解到的
${contextText}

${buildAgendaTrackingBlock(agent)}

## 这一阶段你在做什么
你在通过对话把判断这个局所需的信息收齐，同时在你确有所见时给他真实洞见。
- **有真东西就给**：看到一个值得说的判断（锚在他命盘真实结构上）就讲透；没有就别硬凑命盘、别每句"你的核心是…"。有时一整轮只是认真听、接住、把话头引到你要弄清的关键点，也很好。
- **带着方向聊**：每轮朝"还没弄清的关键项"推进一步，别只顺着他上一句无限展开，也别停在原地。但怎么说完全自然，不套固定结构。
- **还不交付完整方案**：完整的分析和行动留到信息齐了之后。现在如果他催"快给建议"，就告诉他"我会在完整分析里一次给你，先把情况弄清楚"，继续了解。
- **信息齐了**：必查项都弄清楚后，问他要不要现在就出完整分析（用明确的征询问句，问号收尾）。

## 每轮必判：他有没有跑题（topic_drift_signal）
- 与本问题相关 → "none"
- 沾边但偏 → "edge"，回复里简短确认相关性
- 完全跑到另一件事 → "off_topic"：委婉说明这要另开一个会话才聊得透，should_show_new_session_button 设 true，并问他要不要回到原来的问题

## 他不配合时（委婉拉回，直到配合）
- 答得含糊 → 温和请他说具体点："这点我没太抓准，能具体说说吗？越具体，我给的判断越准。"
- 敷衍/想跳过 → 认真而不指责："我想给你的是只对你成立的判断，不是谁都适用的泛泛话，这需要你认真回答几个关键点。"
- 一直不配合 → 坦诚："一直收集不到足够信息，我给的建议会失真、对你没意义。如果现在不是深入聊的好时机，可以考虑申请退款，准备好再回来。"
- 绝不说"系统要求/还没到轮数/流程规定"。他一旦开始配合，就回到正常聊。

${buildAgendaGenerationBlock(agent)}

## 输出格式（严格 JSON，response 第一个键）
{
  "response": "...",
  "suggested_phase": "collecting_context" | "awaiting_confirmation" | null,
  "action_requested": "continue_chat" | "show_birth_form",
  "question_category": "career"|"relationship"|"wealth"|"health"|"family"|"decision"|"interpersonal"|"other"|null,
  "context_updates": { "agenda_status_updates": { "<agenda_id>": "partial"|"covered" } },
  "investigation_agenda": [ { "id":"...", "label":"...", "critical":true, "status":"unexplored", "supports":"支撑哪条破局假设" } ],
  "thought": { "breakthrough_hypotheses": ["…"], "agenda_derivation_note": "…" },
  "collection_progress": "advancing"|"stalled"|"resistant",
  "topic_drift_signal": "none"|"edge"|"off_topic",
  "drift_reason": "若偏离一句话说明，否则空字符串",
  "should_show_new_session_button": false
}
off_topic 时 should_show_new_session_button 必为 true。首轮 agenda 未生成时 investigation_agenda 必填；已生成则省略该字段。

${buildToolSuggestionPhaseAppendix(input, { includeNewCycleDetection: false })}`;
}

export async function callCollectingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const firstAgendaTurn = !input.agent_state?.agenda_generated;
  const structured = normalizeBaseAnalysisInput(input.base_analysis ?? null).structured ?? null;
  const { system, messages } = await buildPhaseTransportInput(
    input,
    buildCollectingTaskBlock(input),
  );

  let transport = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "collection_flash",
      max_tokens: firstAgendaTurn ? 7200 : 3600,
      temperature: 0.5,
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
    use_fallback: true,
  });

  if (resolved.compliance_failed) {
    console.warn(
      "[collecting-phase] compliance failed — using fallback (no re-POST)",
      transport.provider ?? "—",
    );
    resolved = {
      ...resolved,
      response: getPhaseResponseFallback(input.locale),
      used_fallback: true,
      compliance_failed: false,
    };
  }

  if (!resolved.response.trim()) {
    resolved = {
      ...resolved,
      response: getPhaseResponseFallback(input.locale),
      used_fallback: true,
    };
  }

  return finishCollectingPhase(input, transport, resolved.parsed, resolved.response, structured);
}

async function finishCollectingPhase(
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

  let suggest_refund = false;
  if (input.agent_state && collection_progress) {
    const { stopLoss } = projectCollectingStopLoss(input.agent_state, collection_progress, true);
    suggest_refund = shouldSuggestRefund({
      agent: input.agent_state,
      collection_progress,
      stall_offer: false,
    });
    if (stopLoss.triggered && !suggest_refund) {
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
    suggest_refund,
    served_provider: result.provider ?? null,
    ...drift,
  };
}
