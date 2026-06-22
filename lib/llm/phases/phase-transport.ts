import { auditDeliveredText, sanitizeChatResponse, stripGlossTokensForPrompt } from "@/lib/llm/sanitize/compliance-terms";
import { repairEmptyKeepCnBrackets } from "@/lib/llm/sanitize/keep-cn-brackets";
import { salvagePhaseResponseText } from "@/lib/poju/extract-streaming-response";
import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  generateGeminiChatCompletion,
  getGeminiClient,
} from "@/lib/llm/gemini-shared";
import { callLLM, highOutputProviderConstraints, type LLMCallType } from "@/lib/llm/router";
import { openRouterChatCompletionStream } from "@/lib/llm/openrouter-stream";
import {
  getOpenRouterDefaultModel,
  isOpenRouterConfigured,
  openRouterProviderExtras,
} from "@/lib/llm/openrouter-shared";

export type PhaseStreamHooks = {
  onReasoning?: (fullReasoning: string) => void;
  onContent?: (fullContent: string) => void;
};

export type PhaseTransportResult = {
  content: string;
  model: string;
  tokens_used: number;
  reasoning?: string;
  reasoning_details?: unknown;
  finish_reason?: string | null;
  provider?: string | null;
};

/** POJU chat phases that must return a user-visible `response` string. */
const REPLY_REQUIRED_CALL_TYPES = new Set<LLMCallType>([
  "poju_reply",
  "collection_flash",
  "chat_flash",
  "tracking_flash",
]);

function shouldRetryEmptyReply(call_type?: LLMCallType): boolean {
  return call_type != null && REPLY_REQUIRED_CALL_TYPES.has(call_type);
}

function hasSalvageableResponse(rawText: string): boolean {
  return Boolean(salvagePhaseResponseText(rawText).trim());
}

function resolveStreamProvider(call_type: LLMCallType): Record<string, unknown> | undefined {
  const highOutput = new Set<LLMCallType>([
    "glyph_reading",
    "match_report",
    "syncro_batch",
    "main_delivery",
    "deep_analysis",
    "poju_situation_analysis",
    "poju_final_delivery",
  ]);
  return highOutput.has(call_type)
    ? highOutputProviderConstraints()
    : openRouterProviderExtras();
}

const RETRYABLE_COMPLIANCE_LABELS = new Set([
  "empty_keep_cn_bracket",
  "broken_marker",
  "bare_ganzhi",
]);

function isRetryableComplianceLabel(label: string): boolean {
  if (RETRYABLE_COMPLIANCE_LABELS.has(label)) return true;
  if (label.startsWith("term:") || label.startsWith("out_of_set:")) return true;
  return false;
}

export function auditPhaseChatCompliance(
  text: string,
  locale: string,
): Array<{ label: string; snippet?: string }> {
  return auditDeliveredText(text, locale).filter((v) => isRetryableComplianceLabel(v.label));
}

export async function callPhaseJsonTransport(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  options?: {
    temperature?: number;
    max_tokens?: number;
    call_type?: LLMCallType;
    session_id?: string;
    phase_name?: string;
    stream_hooks?: PhaseStreamHooks;
    signal?: AbortSignal;
  },
): Promise<PhaseTransportResult> {
  const temperature = options?.temperature ?? 0.5;
  const max_tokens = options?.max_tokens ?? 2500;
  const call_type = options?.call_type ?? "poju_reply";
  const streamHooks = options?.stream_hooks;

  const runOnce = async (): Promise<PhaseTransportResult> => {
    if (isOpenRouterConfigured()) {
      if (streamHooks) {
        const chatMessages = [
          { role: "system" as const, content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ];
        const streamed = await openRouterChatCompletionStream(
          {
            messages: chatMessages,
            max_tokens,
            temperature,
            json_mode: true,
            reasoning_effort: call_type === "collection_flash" ? "medium" : "medium",
            session_id: options?.session_id,
            call_type: call_type,
            phase_name: options?.phase_name,
            provider: resolveStreamProvider(call_type),
          },
          {
            onReasoning: streamHooks.onReasoning,
            onContent: streamHooks.onContent,
          },
        );
        return {
          content: streamed.text,
          model: streamed.model ?? getOpenRouterDefaultModel(),
          tokens_used: streamed.tokens_used ?? 0,
          reasoning: streamed.reasoning,
          finish_reason: streamed.finish_reason,
          provider: streamed.provider,
        };
      }

      const result = await callLLM({
        call_type,
        system,
        messages,
        max_tokens,
        temperature,
        response_format: "json",
        session_id: options?.session_id,
        phase_name: options?.phase_name,
      });
      return {
        content: result.content,
        model: result.actual_model,
        tokens_used: result.meta.tokens_used,
        reasoning: result.reasoning,
        reasoning_details: result.reasoning_details,
        finish_reason: result.meta.finish_reason,
        provider: result.meta.provider,
      };
    }

    if (!getGeminiClient()) {
      throw new Error("missing_llm_api_key");
    }
    const gemini = await generateGeminiChatCompletion({
      systemInstruction: system,
      messages,
      temperature,
      maxOutputTokens: max_tokens,
    });
    return { content: gemini.text, model: gemini.modelUsed, tokens_used: gemini.tokens_used };
  };

  let result = await runOnce();
  if (shouldRetryEmptyReply(call_type) && !hasSalvageableResponse(result.content)) {
    console.warn(
      `[phase-transport] empty salvageable response — retrying once (call_type=${call_type} phase=${options?.phase_name ?? "—"} provider=${result.provider ?? "—"})`,
    );
    result = await runOnce();
  }
  return result;
}

export function parsePhaseJson(rawText: string): Record<string, unknown> {
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

/** Parse phase JSON; sanitize `response` when locale provided (output-side gloss tokens). */
export function parsePhaseResult(
  rawText: string,
  options?: { locale?: string },
): {
  parsed: Record<string, unknown>;
  response: string;
} {
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!cleaned) return { parsed: {}, response: "" };

  const sanitizeResponse = (raw: string): string => {
    if (!options?.locale || !raw.trim()) return raw;
    const audited = sanitizeChatResponse(raw, options.locale);
    auditDeliveredText(audited, options.locale);
    return audited;
  };

  let parsed: Record<string, unknown> = {};
  try {
    parsed = parsePhaseJson(rawText);
  } catch {
    parsed = {};
  }

  const salvaged = salvagePhaseResponseText(rawText).trim();
  const response = sanitizeResponse(salvaged);
  if (typeof parsed.response === "string") parsed.response = response;
  else if (response && !parsed.response) parsed.response = response;

  return { parsed, response };
}

export type PhaseResponseResolveContext = {
  locale?: string;
  phase_name?: string;
  call_type?: string;
  model?: string;
  finish_reason?: string | null;
  provider?: string | null;
  raw_length?: number;
  use_fallback?: boolean;
  structured?: ProfileStructured | null;
};

/** Log bad markers / bare terms before retry or fallback. */
export function logPhaseComplianceFailure(
  rawText: string,
  ctx: PhaseResponseResolveContext,
  violations: Array<{ label: string; snippet?: string }>,
): void {
  const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 400);
  console.warn(
    "[phase-transport] phase response compliance failure",
    JSON.stringify({
      phase: ctx.phase_name ?? "—",
      call_type: ctx.call_type ?? "—",
      provider: ctx.provider ?? "—",
      model: ctx.model ?? "—",
      finish_reason: ctx.finish_reason ?? "—",
      violations: violations.slice(0, 6).map((v) => v.label),
      raw_preview: preview,
    }),
  );
}

/** Log when user-visible fallback copy is shown — includes supplier + finish_reason for triage. */
export function logPhaseResponseFallback(rawText: string, ctx: PhaseResponseResolveContext): void {
  const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 400);
  console.warn(
    "[phase-transport] phase response fallback triggered",
    JSON.stringify({
      phase: ctx.phase_name ?? "—",
      call_type: ctx.call_type ?? "—",
      provider: ctx.provider ?? "—",
      model: ctx.model ?? "—",
      finish_reason: ctx.finish_reason ?? "—",
      raw_length: ctx.raw_length ?? rawText.length,
      raw_preview: preview,
    }),
  );
}

/**
 * Parse phase JSON + optional user-visible fallback when salvage fails.
 * Use after `callPhaseJsonTransport` (which may already retry once on empty salvage).
 */
export function resolvePhaseResponse(
  rawText: string,
  ctx: PhaseResponseResolveContext,
): {
  parsed: Record<string, unknown>;
  response: string;
  used_fallback: boolean;
  compliance_failed: boolean;
} {
  let { parsed, response } = parsePhaseResult(rawText, { locale: ctx.locale });

  if (response.trim() && ctx.structured !== undefined) {
    const repaired = repairEmptyKeepCnBrackets(response, ctx.structured, ctx.locale ?? "en");
    response = repaired.text;
    if (typeof parsed.response === "string") parsed.response = response;
    else if (response) parsed.response = response;
  }

  if (response.trim()) {
    const violations = auditPhaseChatCompliance(response, ctx.locale ?? "en");
    if (violations.length > 0) {
      logPhaseComplianceFailure(rawText, { ...ctx, raw_length: rawText.length }, violations);
      return { parsed, response: "", used_fallback: false, compliance_failed: true };
    }
    return { parsed, response, used_fallback: false, compliance_failed: false };
  }

  if (ctx.use_fallback === false) {
    return { parsed, response: "", used_fallback: false, compliance_failed: false };
  }
  logPhaseResponseFallback(rawText, { ...ctx, raw_length: rawText.length });
  return {
    parsed,
    response: getPhaseResponseFallback(ctx.locale),
    used_fallback: true,
    compliance_failed: false,
  };
}

/** User-visible fallback when the model returns no parseable `response` (e.g. truncated JSON). */
export function getPhaseResponseFallback(locale?: string): string {
  const loc = locale?.toLowerCase().startsWith("zh")
    ? "zh"
    : locale?.toLowerCase().startsWith("es")
      ? "es"
      : "en";
  const messages: Record<string, string> = {
    en: "[POJU] Reply could not be generated. Please send again. Your session is saved.",
    zh: "[POJU] 本轮回复未能生成，请重试发送。会话已保存。",
    es: "[POJU] No se pudo generar la respuesta. Reintenta. Tu sesión está guardada.",
  };
  return messages[loc] ?? messages.en!;
}

export function formatPhaseMessageHistory(
  messages: Array<{ role: string; content: string; is_rejected?: boolean }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => !m.is_rejected)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: stripGlossTokensForPrompt(m.content),
    }));
}

/**
 * Prepend per-turn dynamic context (date, language, task) to the latest user turn.
 * Keeps the system prompt byte-stable for OpenRouter/DeepSeek prefix cache.
 */
export function applyTurnContext(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  turnContext: string,
): Array<{ role: "user" | "assistant"; content: string }> {
  const ctx = turnContext.trim();
  if (!ctx) return messages;

  if (messages.length === 0) {
    return [{ role: "user", content: ctx }];
  }

  const last = messages[messages.length - 1]!;
  if (last.role === "user") {
    return [
      ...messages.slice(0, -1),
      { role: "user", content: `${ctx}\n\n---\n\n${last.content}` },
    ];
  }

  return [
    ...messages,
    {
      role: "user",
      content: `${ctx}\n\n(Continue the conversation above per the current task.)`,
    },
  ];
}

/** Pass stream hooks + abort signal from phase input into transport options. */
export function withPhaseStreamOpts<
  T extends {
    temperature?: number;
    max_tokens?: number;
    call_type?: import("@/lib/llm/router").LLMCallType;
    phase_name?: string;
  },
>(
  input: { stream_hooks?: PhaseStreamHooks; signal?: AbortSignal; session: { session_id: string } },
  opts: T,
): T & { stream_hooks?: PhaseStreamHooks; signal?: AbortSignal; session_id?: string; phase_name?: string } {
  return {
    ...opts,
    stream_hooks: input.stream_hooks,
    signal: input.signal,
    session_id: pojuCacheSessionId(input.session.session_id),
    phase_name: opts.phase_name,
  };
}
