import { buildPOJUSystemPrompt } from "@/lib/llm/poju-prompts";
import { repairLLMOutput, validateLLMOutput } from "@/lib/llm/output-validator";
import { applyPojuOutputPolicies } from "@/lib/poju/output-policy";
import {
  GEMINI_PRIMARY_MODEL,
  generateGeminiChatCompletion,
  getGeminiClient,
} from "@/lib/llm/gemini-shared";
import type { POJUSessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

interface CallInput {
  session: POJUSessionState;
  profile: UserProfile | null;
  locale: string;
}

export interface POJULLMResponse {
  response: string;
  model: string;
  tokens_used: number;
  user_intent:
    | "greeting"
    | "sharing_situation"
    | "asking_specific"
    | "reporting_progress"
    | "wrapping_up"
    | "unclear"
    | "off_topic";
  current_state: "greeting" | "collecting_context" | "awaiting_profile" | "analyzing" | "delivered" | "tracking";
  action_requested?: "continue_chat" | "show_birth_form" | "deliver_main" | "track_progress";
  topic_drift_detected: boolean;
  context_updates: Record<string, any>;
  contains_delivery: boolean;
  main_delivery?: any;
  new_actions?: any[];
}

export async function callPOJULLM(input: CallInput): Promise<POJULLMResponse> {
  const { session, profile, locale } = input;
  const systemPrompt = buildPOJUSystemPrompt({
    session,
    profile,
    locale,
  });

  const conversationMessages = session.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => !m.is_rejected)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const lastMessage = session.messages[session.messages.length - 1];
  if (lastMessage?.role === "system") {
    conversationMessages.push({
      role: "user",
      content: lastMessage.content,
    });
  }

  if (!getGeminiClient()) {
    console.error("[poju-llm] Missing GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY");
    return emptyFailureResponse(session, locale, GEMINI_PRIMARY_MODEL);
  }

  try {
    const { text, modelUsed, tokens_used } = await generateGeminiChatCompletion({
      systemInstruction: systemPrompt,
      messages: conversationMessages,
      temperature: 0.55,
      maxOutputTokens: 4096,
    });

    const parsed = parseStep5LLMResponse(text, locale, session, profile);

    return {
      response: parsed.response,
      model: modelUsed,
      tokens_used,
      user_intent: parsed.user_intent || "unclear",
      current_state: parsed.current_state || (session.main_delivery_done ? "tracking" : "collecting_context"),
      action_requested: parsed.action_requested,
      topic_drift_detected: parsed.topic_drift_detected || false,
      context_updates: parsed.context_updates || {},
      contains_delivery: parsed.contains_delivery || false,
      main_delivery: parsed.main_delivery,
      new_actions: parsed.new_actions,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[poju-llm] Gemini API failed:", msg);
    return emptyFailureResponse(session, locale, GEMINI_PRIMARY_MODEL);
  }
}

function emptyFailureResponse(session: POJUSessionState, locale: string, model: string): POJULLMResponse {
  return {
    response: getLLMFailureMessage(locale),
    model,
    tokens_used: 0,
    user_intent: "unclear",
    current_state: session.main_delivery_done ? "tracking" : "collecting_context",
    topic_drift_detected: false,
    contains_delivery: false,
    context_updates: {},
  };
}

function parseStep5LLMResponse(
  rawText: string,
  locale: string,
  session: POJUSessionState,
  profile: UserProfile | null,
): any {
  try {
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const validation = validateLLMOutput(parsed);
    const base = validation.valid ? validation.data : repairLLMOutput(parsed, locale);
    if (!validation.valid) {
      console.warn("[poju-llm] Invalid output, attempting repair:", validation.error);
    }
    return applyPojuOutputPolicies(base, { session, profile, locale });
  } catch {
    console.error("[poju-llm] JSON parse failed");
    return applyPojuOutputPolicies(repairLLMOutput({ response: rawText || getLLMFailureMessage(locale) }, locale), {
      session,
      profile,
      locale,
    });
  }
}

function getLLMFailureMessage(locale: string): string {
  const messages: Record<string, string> = {
    en: "I'm having trouble connecting right now. Could you try again in a moment? Your session is saved.",
    zh: "我现在连接有点问题,请稍后再试一下。你的会话已经保存。",
    es: "Tengo problemas para conectarme en este momento. ¿Podrías intentarlo de nuevo en un momento? Tu sesión está guardada.",
    fr: "J'ai des difficultés à me connecter en ce moment. Pourriez-vous réessayer dans un instant ? Votre session est sauvegardée.",
    de: "Ich habe gerade Verbindungsprobleme. Könnten Sie es in einem Moment erneut versuchen? Ihre Sitzung ist gespeichert.",
  };
  const langCode = locale.split("-")[0];
  return messages[langCode] || messages.en;
}
