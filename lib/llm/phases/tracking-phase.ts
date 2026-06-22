import type { AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseResult, withPhaseStreamOpts } from "@/lib/llm/phases/phase-transport";
import { buildOrientalSystemPrompt } from "@/lib/llm/phases/oriental-prompt-context";
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

${archiveCompleted}

若有已完成行动，优先自然提及并追问可观察的微小变化或反馈，例如：
✓ "你已经做了【${input.archive_data?.actions.find((a) => a.status === "completed")?.title ?? "…"}】，这周状态怎么样?"
✗ 不要重复完整交付或三条行动全文`
    : "";

  return `# 当前任务：追踪反馈

主交付已完成。用户回来汇报进展、提问或收尾。这是【对话延伸】，不是新 Session 的完整分析。

## 原始问题
"${input.session.original_question}"

## 已给出的行动
${actionLines}
${archiveBlock}

## 原则

- 先听，不主动评判
- 不重复完整交付或 3 条行动全文
- 完成某行动 → 问可观察的微小变化
- 没做/改了 → 问阻碍，不批评
- 有新进展 → 可简短联系命局（1 句）
- 全新话题 → 说明一个 Session 专注一个问题，可开新 Session

## 风格

- 80 字以内（中文）/ 60 词以内（英文）
- suggested_phase 保持 "tracking"

## 追踪对话的术语与时间表述

继承 poju-base（POJU_SESSION_GUARDRAILS / POJU_OUTPUT_BRANDING）中的术语规则：
- 不用「方子」→ 用「方案」/「破局方案」
- 不用「诊脉」→ 用「推演」/「看局」
- 不用「调方」→ 用「调整方向」
- 不用「病灶」「复诊」「开方」

时间表述：
- 不指定「几个月后」「几周后」「下周再来」
- 用「随时回来」「有进展时」「遇到卡点立刻回来」
- 可提醒 Session 30 天有效、期间可多次回来

用户想结束时（说「谢谢」「好的」「我先去做」）：
✓ 「好。去做，有进展或问题随时回来。」
✓ 「你的 Session 30 天有效，随时进来。」
✗ 「三个月后我们再调整。」
✗ 「下次复诊见。」

## 话题偏移（相对 original_question）

同样识别 topic_drift_signal："none" | "edge" | "off_topic"。完全偏离时拒绝深入新话题，引导新 Session。

## 输出 JSON

{
  "response": "...",
  "suggested_phase": "tracking",
  "context_updates": {},
  "topic_drift_signal": "none" | "edge" | "off_topic",
  "drift_reason": "",
  "should_show_new_session_button": false
}

${buildToolSuggestionPhaseAppendix(input, { includeNewCycleDetection: true })}`;
}

export async function callTrackingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = await buildOrientalSystemPrompt(input, buildTrackingTaskBlock(input));
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(
    system,
    messages,
    withPhaseStreamOpts(input, {
      call_type: "tracking_flash",
      max_tokens: 1000,
      temperature: 0.45,
    }),
  );

  const { parsed, response } = parsePhaseResult(result.content, { locale: input.locale });

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase: AgentPhase | null = rawPhase === "tracking" ? "tracking" : "tracking";

  const drift = parseTopicDriftFromParsed(parsed);
  const tool_suggestion = parseToolSuggestionFromParsed(parsed);
  const { start_new_cycle, new_cycle_question } = parseStartNewCycleFromParsed(parsed);

  return {
    response,
    suggested_phase,
    context_updates: {},
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
    ...drift,
  };
}
