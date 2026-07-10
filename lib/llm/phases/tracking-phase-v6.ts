/**
 * POJU v6 Shadow — tracking 阶段（交付后追踪 · taskBlock 注入 user 侧）。
 *
 * ⚠️ 影子实现，不替换 tracking-phase.ts。
 */

import { parseBreakthroughCoreUpdatesFromLlm, type AgentPhase } from "@/lib/poju/agent-state";
import { parseActionStatusUpdates } from "@/lib/poju/action-status-updates";
import {
  callPhaseJsonTransport,
  parsePhaseResult,
  withPhaseStreamOpts,
} from "@/lib/llm/phases/phase-transport";
import { buildPhaseTransportInputV6 } from "@/lib/llm/phases/oriental-prompt-context-v6";
import { buildSpineBlock } from "@/lib/llm/phases/spine-block";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { buildToolSuggestionPhaseAppendix } from "@/lib/llm/phases/tool-suggestion-phase-appendix";
import {
  parseStartNewCycleFromParsed,
  parseToolSuggestionFromParsed,
} from "@/lib/poju/tool-suggestion";
import { parseTopicDriftFromParsed } from "@/lib/poju/topic-drift";

/** tracking 阶段专属控制面（user taskBlock · 无具体场景案例） */
export const POJU_V6_TRACKING_PHASE_RULES = `# 当前阶段任务 · tracking（交付后追踪门诊）

完整破局方案已交付。用户在已交付方案 + 脊柱 + 行动列表基础上回来——保持"欢迎回来、我们继续推进"的开放姿态，叠加下一层具体的微动作。

## 四种意图（按用户这句话的意图择一）
1. **追问现方案** → 在【已交付的那条行动】上精修：为什么这样、怎么调、下一小步。不重做分析、不复述命盘。
2. **进展汇报**（做了/没做/有效/没效）→ 先接住与肯定/校准，再针对反馈把对应行动【微调一格】，给出可立刻执行的下一步。
3. **全新的局**（与原 original_question 不是同一件事）→ 认出来，温和说明"这是另一个值得专门破的局，我们可以为它单独开一程"，
   设 \`topic_drift_signal: "off_topic"\`（系统会弹开新 Session）。**绝不**在这里重跑收集、绝不再出一份大交付。
4. **收尾/暂别** → 开放结尾："先去做，有进展或新情况随时回来，这个 Session 30 天都活着。" 不设复诊日。

判不准是"追问现方案"还是"新局"时，先问一句确认，别擅自当新局。

## 轻量行动状态（可选 · 仅用户明确报告某条行动进展时填写）
在 JSON 根字段 \`action_status_updates\` 里标出被提及的行动（无明确进展则省略整段）：
\`\`\`json
"action_status_updates": [
  { "action_index": 2, "status": "completed", "feedback": "用户原话摘要" }
]
\`\`\`
- \`action_index\` = 下面列表里的序号（1-based）；或填 \`action_id\`。
- \`status\` 只用：pending / completed / modified / skipped。
- **tracking 里禁止 \`start_new_cycle\`**：新问题一律用 \`topic_drift_signal: "off_topic"\`。

## 你不负责
- 是否开新 Session（后端 + UI 处理 off_topic）
- 重新生成交付报告（仅 final-delivery 模块调度）`;

function buildActionLinesV6(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const actions = agent?.actions ?? [];
  if (actions.length === 0) {
    return "(交付行动列表暂不可用 — 根据对话追问具体进展。)";
  }
  return actions
    .map((a, i) => `${i + 1}. [${a.category}] [${a.status}] ${a.text.slice(0, 120)}`)
    .join("\n");
}

function buildArchiveBlockV6(input: PhaseLLMInput): string {
  const archiveCompleted =
    input.archive_data?.actions
      ?.filter((a) => a.status === "completed")
      .map((a, i) => `${i + 1}. 【${a.title}】${a.user_feedback ? ` — 用户备注: ${a.user_feedback}` : ""}`)
      .join("\n") ?? "";
  if (!archiveCompleted) return "";
  return `
## 用户已在 Archive 中标记完成的行动
${archiveCompleted}`;
}

/** v6 tracking 动态 taskBlock */
export function buildTrackingTaskBlockV6(input: PhaseLLMInput): string {
  const spineBlock = buildSpineBlock(input.agent_state);
  const actionLines = buildActionLinesV6(input);
  const archiveBlock = buildArchiveBlockV6(input);
  const q = input.session.original_question;

  return `# 动态任务 · tracking
original_question："${q}"

${POJU_V6_TRACKING_PHASE_RULES}

${spineBlock}

## 已给出的行动
${actionLines}${archiveBlock}

${buildToolSuggestionPhaseAppendix(input, { includeNewCycleDetection: false })}`.trim();
}

/** v6 tracking LLM 入口（影子路径） */
export async function callTrackingPhaseV6(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const { system, messages } = await buildPhaseTransportInputV6(
    input,
    buildTrackingTaskBlockV6(input),
  );

  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "tracking_flash",
      max_tokens: 10000,
      temperature: 0.45,
      thinking_effort: "high",
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase: AgentPhase | null = rawPhase === "tracking" ? "tracking" : "tracking";

  const driftBase = parseTopicDriftFromParsed(parsed);
  const cycleHint = parseStartNewCycleFromParsed(parsed);
  const drift =
    cycleHint.start_new_cycle || driftBase.topic_drift_signal === "off_topic"
      ? {
          topic_drift_signal: "off_topic" as const,
          drift_reason:
            cycleHint.new_cycle_question ??
            driftBase.drift_reason ??
            "用户提出了与原问题不同的新局，建议单独开一程。",
          should_show_new_session_button: true,
        }
      : driftBase;

  const tool_suggestion = parseToolSuggestionFromParsed(parsed);
  const breakthrough_core_updates = parseBreakthroughCoreUpdatesFromLlm(parsed.breakthrough_core_updates);
  const action_status_updates = parseActionStatusUpdates(parsed);

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
    action_status_updates,
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    served_provider: result.provider ?? null,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
    tool_suggestion,
    start_new_cycle: false,
    new_cycle_question: null,
    breakthrough_core_updates,
    ...drift,
    llm_debug: result.llm_debug,
  };
}
