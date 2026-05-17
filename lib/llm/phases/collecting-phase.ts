import {
  findMissingFields,
  REQUIRED_FIELDS_BY_CATEGORY,
} from "@/lib/poju/agent-state";
import { formatContextForPrompt, formatMissingFieldsForPrompt } from "@/lib/poju/context-extractor";
import type { AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseJson } from "@/lib/llm/phases/phase-transport";
import { sanitizeResponse } from "@/lib/llm/phases/response-sanitizer";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { sanitizerStateFromSession } from "@/lib/llm/phases/types";

const VALID_SUGGESTED: AgentPhase[] = ["collecting_context", "awaiting_confirmation", "awaiting_profile"];

function formatFieldKey(key: string): string {
  return key.replace(/_/g, " ");
}

function buildCollectingSystemPrompt(input: PhaseLLMInput): string {
  const agent = input.agent_state;
  if (!agent) {
    return buildCollectingSystemPromptFallback(input);
  }

  const contextText = formatContextForPrompt(agent);
  const missingFields = findMissingFields(agent);
  const missingText = formatMissingFieldsForPrompt(missingFields);
  const completeness = agent.collection_completeness;
  const cat = agent.question_category;
  const requiredList = cat
    ? (REQUIRED_FIELDS_BY_CATEGORY[cat] ?? []).map((f) => `  - ${formatFieldKey(f)}`).join("\n")
    : "  (Determine category first, then gather category-specific fields.)";

  const profileGate =
    agent.current_phase === "awaiting_profile"
      ? "\n# PROFILE REQUIRED\nBirth chart not linked yet. Gently ask for birth info (or note they can skip). Set suggested_phase to awaiting_profile unless they skip.\n"
      : "";

  return `# YOU ARE POJU (Information Collection Phase)
${profileGate}

You are a focused interviewer — like a doctor taking history or a lawyer learning the case. NOT a casual chatbot.

The user paid for this session. Original question:
"${input.session.original_question}"

Question category: ${cat ?? "not yet determined"}
Completeness: ${(completeness * 100).toFixed(0)}%

## Already collected
${contextText}

## Still missing
${missingText}

## Required fields for this category
${requiredList}

# PRIMARY DIRECTIVE
Ask the NEXT most important question(s) to fill missing fields.
- Never repeat what is already collected
- 1–2 specific questions per turn (50–120 words)
- Reference what they said before
- No final verdict, no ═══ ANALYSIS ═══ blocks, no BaZi/五行/用神 claims in user-facing text

# WHEN TO SET suggested_phase
- "awaiting_confirmation" when completeness ≥ 70% OR you have enough specifics for 3 concrete actions
- "awaiting_profile" only if birth chart is still required for this domain and not skipped
- Otherwise "collecting_context"

# OUTPUT (strict JSON)
{
  "response": "...",
  "suggested_phase": "collecting_context" | "awaiting_confirmation" | "awaiting_profile" | null,
  "context_updates": { },
  "question_category": "career" | "relationship" | "wealth" | "health" | "family" | "decision" | "interpersonal" | "other" | null
}

Locale hint: ${input.locale}`;
}

function buildCollectingSystemPromptFallback(input: PhaseLLMInput): string {
  return `# POJU — Context collection
Original question: "${input.session.original_question}"
Ask one focused follow-up. JSON only with response, suggested_phase, context_updates.`;
}

export async function callCollectingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = buildCollectingSystemPrompt(input);
  const messages = formatPhaseMessageHistory(input.session.messages);
  const result = await callPhaseJsonTransport(system, messages, { max_tokens: 2000 });

  let parsed: Record<string, unknown>;
  try {
    parsed = parsePhaseJson(result.content);
  } catch {
    parsed = { response: result.content, suggested_phase: null, context_updates: {} };
  }

  let response = typeof parsed.response === "string" ? parsed.response : String(parsed.response ?? "");
  response = sanitizeResponse(response, sanitizerStateFromSession(input.session));

  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  const rawPhase = typeof parsed.suggested_phase === "string" ? parsed.suggested_phase.trim() : null;
  const suggested_phase = rawPhase && VALID_SUGGESTED.includes(rawPhase as AgentPhase) ? (rawPhase as AgentPhase) : null;

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
  };
}
