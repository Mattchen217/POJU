import {
  findMissingFields,
  REQUIRED_FIELDS_BY_CATEGORY,
} from "@/lib/poju/agent-state";
import { formatContextForPrompt, formatMissingFieldsForPrompt } from "@/lib/poju/context-extractor";
import type { AgentPhase } from "@/lib/poju/agent-state";
import { callPhaseJsonTransport, formatPhaseMessageHistory, parsePhaseJson } from "@/lib/llm/phases/phase-transport";
import { thinkingFromPhaseTransport } from "@/lib/llm/thinking-process";
import { sanitizeResponse } from "@/lib/llm/phases/response-sanitizer";
import type { PojuV4ActionRequested } from "@/lib/poju/types";
import type { PhaseLLMInput, PhaseLLMResult } from "@/lib/llm/phases/types";
import { sanitizerStateFromSession } from "@/lib/llm/phases/types";

const VALID_SUGGESTED: AgentPhase[] = ["collecting_context", "awaiting_confirmation", "awaiting_profile"];
const VALID_ACTIONS: PojuV4ActionRequested[] = [
  "continue_chat",
  "show_birth_form",
  "deliver_main",
  "track_progress",
];

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
      ? "\n# PROFILE REQUIRED\nBirth chart not linked yet. In your `response`, explain why birth details help (device-only storage). Set `action_requested` to \"show_birth_form\" when you are ready for the form UI — or \"continue_chat\" if you still need more context first. User may skip.\n"
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

# WHEN TO SET suggested_phase / action_requested
- "awaiting_confirmation" when completeness ≥ 70% OR you have enough specifics for 3 concrete actions
- When personalized BaZi is needed and no birth profile is linked: explain in \`response\`, set \`action_requested\` to "show_birth_form", and \`suggested_phase\` to "awaiting_profile"
- Otherwise keep \`action_requested\` "continue_chat" and \`suggested_phase\` "collecting_context"

# OUTPUT (strict JSON)
{
  "response": "...",
  "suggested_phase": "collecting_context" | "awaiting_confirmation" | "awaiting_profile" | null,
  "action_requested": "continue_chat" | "show_birth_form",
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

  const rawAction = typeof parsed.action_requested === "string" ? parsed.action_requested.trim() : null;
  let action_requested: PojuV4ActionRequested | null =
    rawAction && VALID_ACTIONS.includes(rawAction as PojuV4ActionRequested)
      ? (rawAction as PojuV4ActionRequested)
      : null;
  if (!action_requested && suggested_phase === "awaiting_profile") {
    action_requested = "show_birth_form";
  }

  return {
    response,
    suggested_phase,
    action_requested,
    context_updates,
    question_category: typeof parsed.question_category === "string" ? parsed.question_category : null,
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
