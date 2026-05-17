/**
 * Step 10 — Greeting 阶段：中性问诊 prompt + JSON + 幻觉 sanitizer（Part1 §11）
 */

import {
  generateGeminiChatCompletion,
  getGeminiClient,
} from "@/lib/llm/gemini-shared";
import { isOpenRouterConfigured, openRouterChatCompletion } from "@/lib/llm/openrouter-shared";
import {
  detectInitialLanguage,
  sanitizeResponse,
} from "@/lib/llm/phases/response-sanitizer";
import {
  type PhaseLLMInput,
  type PhaseLLMResult,
  sanitizerStateFromSession,
} from "@/lib/llm/phases/types";
import type { AgentPhase } from "@/lib/poju/agent-state";
import { resolveSessionHasProfile } from "@/lib/poju/session-profile";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

const VALID_SUGGESTED: AgentPhase[] = ["greeting", "awaiting_profile", "collecting_context"];

export function shouldUseGreetingPhase(session: POJUSessionState, profile: UserProfile | null): boolean {
  if (resolveSessionHasProfile(session) || profile || session.profile_skipped || session.main_delivery_done) return false;
  const phase = session.agent_v2?.current_phase;
  if (phase && phase !== "greeting") return false;
  return true;
}

export function buildGreetingSystemPrompt(input: {
  original_question: string;
  locale: string;
}): string {
  const { original_question, locale } = input;
  const langHint = detectInitialLanguage(original_question);

  return `# YOU ARE POJU (Greeting & Engagement Phase)

You are POJU, an AI thinking partner on the pojulife platform.
The user has paid $9.99 to start this session with this question:
"${original_question}"

You are at the EARLY STAGE of conversation. You do NOT have:
- Their astrological profile (no birth info yet)
- Any deep analysis
- Detailed knowledge of their situation

# YOUR GOAL IN THIS PHASE

1. Greet warmly if they say hello
2. Listen attentively if they share concern
3. Ask thoughtful, NEUTRAL questions to understand the situation
4. When they've shared substantive concern → suggest moving to "awaiting_profile"

# 🚨 ABSOLUTE FORBIDDEN BEHAVIORS

You DO NOT have their profile. You CANNOT make these statements:

❌ "Your natural pattern is..." (no profile data!)
❌ "Your personality tends to..."
❌ "In your makeup, there's..."
❌ "You're typically..."
❌ "Your strength is..."
❌ "Your nature/天性/天然..."
❌ "From what I see in you..."
❌ "You're not lacking action ability..."
❌ "你其实是一个生命力很强、很有主见的人"  ← HALLUCINATION
❌ "从你的个人特质来看"  ← HALLUCINATION
❌ "你的能量分布"  ← HALLUCINATION
❌ Future predictions ("You will succeed")
❌ Cosmic claims ("The energy is right for...")
❌ Personality claims about a person you've never met

# ✅ WHAT YOU CAN DO

✓ Acknowledge what they said
✓ Ask neutral questions
✓ Mirror back their words
✓ Identify topics neutrally ("You mentioned career...")
✓ Express empathy ("That sounds frustrating")

# 💬 RESPONSE LANGUAGE

Detect from user's input. Respond in same language.
Their original_question was: "${original_question}"
${langHint}
Session locale hint: ${locale}

# 🔄 PHASE PROGRESSION

When user has shared substantive concern (not just "hi"), set suggested_phase to "awaiting_profile".
Substantive concern means:
- A specific area of life is mentioned (career, relationship, money, health, family, decision)
- AND they express some level of difficulty or question
- AND it's beyond a 1-word greeting

# 🎯 CONTEXT EXTRACTION

If user shares anything substantive, extract initial context.
Be conservative — only extract what's EXPLICITLY stated.

# OUTPUT FORMAT (strict JSON object, no markdown fence)

{
  "response": "Your reply. 50-150 words. Natural, warm, NEUTRAL. No personality claims.",
  "suggested_phase": "greeting" | "awaiting_profile" | null,
  "question_category": "career" | "relationship" | "wealth" | "health" | "family" | "decision" | "interpersonal" | "other" | null,
  "context_updates": {}
}

# 🔒 FINAL CHECK BEFORE OUTPUT

1. Did I claim anything about their personality/nature/天性? → REWRITE
2. Did I make any future prediction? → REMOVE
3. Did I say "I see in you that..."? → REPHRASE as questions
4. Am I making cosmic/energetic claims? → REMOVE

If unsure: ASK A QUESTION instead of making a claim.`;
}

function formatMessageHistory(input: PhaseLLMInput): Array<{ role: "user" | "assistant"; content: string }> {
  const fromSession = input.session.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => !m.is_rejected)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  if (fromSession.length > 0) return fromSession;

  if (input.user_message.trim()) {
    return [{ role: "user", content: input.user_message.trim() }];
  }
  return [];
}

function parseGreetingJson(rawText: string): Record<string, unknown> {
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

function normalizeSuggestedPhase(raw: unknown): AgentPhase | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim() as AgentPhase;
  return VALID_SUGGESTED.includes(s) ? s : null;
}

async function callGreetingTransport(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ content: string; model: string; tokens_used: number }> {
  if (isOpenRouterConfigured()) {
    const msgs = [
      { role: "system" as const, content: system },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const out = await openRouterChatCompletion({
      messages: msgs,
      temperature: 0.45,
      max_tokens: 1500,
      json_mode: true,
      reasoning_effort: "high",
    });
    return { content: out.text, model: out.model, tokens_used: out.tokens_used };
  }
  if (!getGeminiClient()) {
    throw new Error("missing_llm_api_key");
  }
  const gemini = await generateGeminiChatCompletion({
    systemInstruction: system,
    messages,
    temperature: 0.45,
    maxOutputTokens: 1500,
  });
  return { content: gemini.text, model: gemini.modelUsed, tokens_used: gemini.tokens_used };
}

export async function callGreetingPhase(input: PhaseLLMInput): Promise<PhaseLLMResult> {
  const system = buildGreetingSystemPrompt({
    original_question: input.session.original_question,
    locale: input.locale,
  });
  const messages = formatMessageHistory(input);
  const sanitizerState = sanitizerStateFromSession(input.session);

  const result = await callGreetingTransport(system, messages);

  let parsed: Record<string, unknown>;
  try {
    parsed = parseGreetingJson(result.content);
  } catch (e) {
    console.error("[greeting-phase] JSON parse failed:", e);
    parsed = {
      response: result.content,
      suggested_phase: null,
      context_updates: {},
      question_category: null,
    };
  }

  let response = typeof parsed.response === "string" ? parsed.response : String(parsed.response ?? "");
  response = sanitizeResponse(response, sanitizerState);

  const context_updates =
    parsed.context_updates && typeof parsed.context_updates === "object" && !Array.isArray(parsed.context_updates)
      ? (parsed.context_updates as Record<string, unknown>)
      : {};

  const question_category =
    typeof parsed.question_category === "string" ? parsed.question_category : null;
  if (question_category && !context_updates.question_category) {
    context_updates.question_category = question_category;
  }

  return {
    response,
    suggested_phase: normalizeSuggestedPhase(parsed.suggested_phase),
    context_updates,
    question_category,
    current_summary: null,
    main_delivery_data: null,
    actions: [],
    tokens_used: result.tokens_used,
    total_cost: 0,
    call_count: 1,
    model: result.model,
  };
}
