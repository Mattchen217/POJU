import type { AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseJson } from "@/lib/llm/phases/phase-transport";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";

function buildTrackingSystemPrompt(input: PhaseLLMInput): string {
  return `# POJU — Action tracking phase

Help the user reflect on actions from their delivery. No new full readings.

Original question: "${input.session.original_question}"

Rules:
- Ask about progress on a specific action or feeling since the delivery.
- Keep under 100 words.
- suggested_phase: "tracking".

Output strict JSON:
{ "response": "...", "suggested_phase": "tracking" | null, "context_updates": {} }`;
}

export async function callTrackingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = buildTrackingSystemPrompt(input);
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(system, messages, { max_tokens: 1000, temperature: 0.45 });

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
