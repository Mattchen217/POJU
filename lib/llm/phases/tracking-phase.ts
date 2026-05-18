import type { AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseJson } from "@/lib/llm/phases/phase-transport";
import { buildOrientalSystemPrompt } from "@/lib/llm/phases/oriental-prompt-context";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";

function buildTrackingTaskBlock(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const actions = agent?.actions ?? [];
  const actionLines =
    actions.length > 0
      ? actions
          .map((a, i) => `${i + 1}. [${a.category}] [${a.status}] ${a.text.slice(0, 120)}`)
          .join("\n")
      : "(交付行动列表暂不可用 — 根据对话追问具体进展。)";

  return `# 当前任务：追踪反馈

主交付已完成。用户回来汇报进展、提问或收尾。这是【对话延伸】，不是新 Session 的完整分析。

## 原始问题
"${input.session.original_question}"

## 已给出的行动
${actionLines}

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

## 输出 JSON

{ "response": "...", "suggested_phase": "tracking", "context_updates": {} }`;
}

export async function callTrackingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = await buildOrientalSystemPrompt(input, buildTrackingTaskBlock(input));
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(system, messages, {
    call_type: "tracking_flash",
    max_tokens: 1000,
    temperature: 0.45,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parsePhaseJson(result.content);
  } catch {
    parsed = { response: result.content, suggested_phase: "tracking" };
  }

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase: AgentPhase | null = rawPhase === "tracking" ? "tracking" : "tracking";

  return {
    response: typeof parsed.response === "string" ? parsed.response : String(parsed.response ?? ""),
    suggested_phase,
    context_updates: {},
    question_category: null,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}
