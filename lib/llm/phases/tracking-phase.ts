import { parseBreakthroughCoreUpdatesFromLlm, type AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { buildPhaseTransportInput } from "@/lib/llm/phases/oriental-prompt-context";
import { buildSpineBlock } from "@/lib/llm/phases/spine-block";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildToolSuggestionPhaseAppendix } from "@/lib/llm/phases/tool-suggestion-phase-appendix";
import {
  parseStartNewCycleFromParsed,
  parseToolSuggestionFromParsed,
} from "@/lib/poju/tool-suggestion";
import { parseTopicDriftFromParsed } from "@/lib/poju/topic-drift";

function buildTrackingTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const spineBlock = buildSpineBlock(agent);
  const actions = agent?.actions ?? [];
  const actionLines =
    actions.length > 0
      ? actions
          .map((a, i) => `${i + 1}. [${a.category}] [${a.status}] ${a.text.slice(0, 120)}`)
          .join("\n")
      : "(交付行动列表暂不可用 — 根据对话追问具体进展。)";

  const archiveCompleted =
    input.archive_data?.actions
      ?.filter((a) => a.status === "completed")
      .map((a, i) => `${i + 1}. 【${a.title}】${a.user_feedback ? ` — 用户备注: ${a.user_feedback}` : ""}`)
      .join("\n") ?? "";

  const archiveBlock = archiveCompleted
    ? `

## 用户已在 Archive 中标记完成的行动
${archiveCompleted}`
    : "";

  return `# 任务：追踪 · 动态破局陪伴（PDF 步骤 18）

主交付已完成。用户回来汇报进展 / 提问 / 收尾。这不是新分析，
而是你作为他的长期破局顾问，在【已给的方案 + 你的破局脊柱】上继续陪他推进。

原始问题："${input.session.original_question}"

${spineBlock}

## 已给出的行动
${actionLines}${archiveBlock}

## 你要做到（动态，不是打卡）
1. 先听，不评判。完成某行动 → 问可观察的微小变化；没做 → 问阻碍，不批评。
2. 在脊柱上解读进展：他的反馈【印证】还是【削弱】了某条破局方向？
   把"为什么这一步有效 / 卡住"扣回他的命盘结构讲一句（自然用 ⟦t:⟧，密度克制）。
3. 顺势给【下一层】：在已选方向上叠加一个具体微动作 / 调整一个做法 ——
   不重复三条原文，是它的延伸。
4. 若进展改变了方向判断，输出 breakthrough_core_updates 演进脊柱
   （对应 direction 的 status：reinforced / weakened / selected；没变化则省略该键）。

## 边界与时间
- 全新话题 → 说明一个 Session 专注一个问题，可开新 Session。
- 不指定"几个月后 / 下周再来"；用"随时回来""有进展时"。Session 30 天有效。
- topic_drift_signal："none" | "edge" | "off_topic"。完全偏离时拒绝深入，引导新 Session。

输出 JSON：response, suggested_phase:"tracking", context_updates,
  breakthrough_core_updates, topic_drift_signal, drift_reason, should_show_new_session_button
  （breakthrough_core_updates 形如 { "breakthrough_directions": [ { "direction":"...", "status":"reinforced"|"weakened"|"selected", "structural_basis":"...", "what_would_confirm":"..." } ] }）

${buildToolSuggestionPhaseAppendix(input, { includeNewCycleDetection: true })}`;
}

export async function callTrackingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const { system, messages } = await buildPhaseTransportInput(
    input,
    buildTrackingTaskBlock(input),
  );
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "tracking_flash",
      max_tokens: 7000,
      temperature: 0.45,
      thinking_effort: "xhigh",
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase: AgentPhase | null = rawPhase === "tracking" ? "tracking" : "tracking";

  const drift = parseTopicDriftFromParsed(parsed);
  const tool_suggestion = parseToolSuggestionFromParsed(parsed);
  const { start_new_cycle, new_cycle_question } = parseStartNewCycleFromParsed(parsed);
  const breakthrough_core_updates = parseBreakthroughCoreUpdatesFromLlm(parsed.breakthrough_core_updates);

  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  return {
    response,
    suggested_phase,
    context_updates,
    question_category: typeof parsed.question_category === "string" ? parsed.question_category : null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    served_provider: result.provider ?? null,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
    tool_suggestion,
    start_new_cycle,
    new_cycle_question,
    breakthrough_core_updates,
    ...drift,
  };
}
