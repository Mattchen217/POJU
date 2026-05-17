import type { AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseJson } from "@/lib/llm/phases/phase-transport";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";

function buildDeliverySystemPrompt(input: PhaseLLMInput): string {
  return `# POJU — Post-delivery phase

The full structured delivery is shown in the UI card above this chat. Do NOT repeat the long analysis.

Original question: "${input.session.original_question}"

Rules:
- Short acknowledgment (40-80 words).
- Invite reflection or questions about the action cards.
- No new ═══ ANALYSIS ═══ blocks.
- suggested_phase: "tracking" or "delivered".

Output strict JSON:
{ "response": "...", "suggested_phase": "tracking" | "delivered" | null, "context_updates": {} }`;
}

export async function callDeliveryPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = buildDeliverySystemPrompt(input);
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(system, messages, { max_tokens: 800, temperature: 0.4 });

  let parsed: Record<string, unknown>;
  try {
    parsed = parsePhaseJson(result.content);
  } catch {
    parsed = {
      response:
        "Your full reading is in the delivery card above. Tell me which action you want to start with, or what still feels unclear.",
      suggested_phase: "tracking",
    };
  }

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase: AgentPhase | null =
    rawPhase === "tracking" || rawPhase === "delivered" ? rawPhase : "tracking";

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
  };
}
