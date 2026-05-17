import { formatContextForPrompt } from "@/lib/poju/context-extractor";
import type { AgentPhase, ContextSummary } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseJson } from "@/lib/llm/phases/phase-transport";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import { sanitizeResponse } from "@/lib/llm/phases/response-sanitizer";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { sanitizerStateFromSession } from "@/lib/llm/phases/types";

const VALID_SUGGESTED: AgentPhase[] = ["awaiting_confirmation", "collecting_context", "delivered"];

function buildConfirmationSystemPrompt(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  const contextBlock = agent ? formatContextForPrompt(agent) : "";

  return `# POJU — Confirmation phase

Summarize what you understood. Do NOT deliver final BaZi analysis or action packages.

Original question: "${input.session.original_question}"

Context:
${contextBlock}

Rules:
- Brief intro (2-3 sentences) asking user to confirm or correct.
- Populate current_summary JSON matching ContextSummary schema.
- suggested_phase: "awaiting_confirmation" until user confirms; "collecting_context" if they want to add more; never "delivered" from chat alone.
- No ═══ ANALYSIS ═══ sections.

Output strict JSON:
{
  "response": "short confirmation ask",
  "suggested_phase": "awaiting_confirmation" | "collecting_context" | null,
  "current_summary": {
    "generated_at": "ISO",
    "category": "career|...",
    "sections": [{ "section_id": "...", "title": "...", "items": [{ "item_id": "...", "label": "...", "value": "...", "field_key": "..." }] }]
  },
  "context_updates": {}
}`;
}

function normalizeSummary(raw: unknown): ContextSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as ContextSummary;
  if (!Array.isArray(s.sections)) return null;
  return {
    generated_at: typeof s.generated_at === "string" ? s.generated_at : new Date().toISOString(),
    category: String(s.category ?? "other"),
    sections: s.sections,
  };
}

export async function callConfirmationPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = buildConfirmationSystemPrompt(input);
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(system, messages, { max_tokens: 3000 });

  let parsed: Record<string, unknown>;
  try {
    parsed = parsePhaseJson(result.content);
  } catch {
    parsed = { response: result.content, suggested_phase: "awaiting_confirmation", context_updates: {} };
  }

  let response = typeof parsed.response === "string" ? parsed.response : String(parsed.response ?? "");
  response = sanitizeResponse(response, sanitizerStateFromSession(input.session));

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase = rawPhase && VALID_SUGGESTED.includes(rawPhase as AgentPhase) ? (rawPhase as AgentPhase) : "awaiting_confirmation";

  return {
    response,
    suggested_phase,
    context_updates:
      parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
        ? (parsed.context_updates as Record<string, unknown>)
        : {},
    question_category: null,
    current_summary: normalizeSummary(parsed.current_summary),
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
    thinking_process: thinkingFromPhaseTransport(result, parsed, input.locale),
  };
}
