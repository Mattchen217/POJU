import { auditDeliveredText, sanitizeChatResponse, stripGlossTokensForPrompt } from "@/lib/llm/sanitize/compliance-terms";
import { repairEmptyKeepCnBrackets } from "@/lib/llm/sanitize/keep-cn-brackets";
import { salvagePhaseResponseText } from "@/lib/poju/extract-streaming-response";
import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  generateGeminiChatCompletion,
  getGeminiClient,
} from "@/lib/llm/gemini-shared";
import { callLLM, type LLMCallType } from "@/lib/llm/router";
import { openRouterChatCompletionStream } from "@/lib/llm/openrouter-stream";
import {
  getOpenRouterDefaultModel,
  isOpenRouterConfigured,
  openRouterProviderExtras,
  type OpenRouterRoutePath,
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

function resolveStreamProvider(
  locked_provider?: string,
  extra_ignore?: string[],
): Record<string, unknown> | undefined {
  return openRouterProviderExtras({
    lockedProvider: locked_provider?.trim() || undefined,
    extra_ignore,
  });
}

/** OpenRouter returned zero-length completion body. */
export function isEmptyPhaseCompletion(result: PhaseTransportResult): boolean {
  return result.content.trim().length === 0;
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
    /** Temporary ignore slugs (legacy — prefer escape hatch over re-POST). */
    provider_extra_ignore?: string[];
    locked_provider?: string;
    route_path?: OpenRouterRoutePath;
    thinking_effort?: import("@/lib/llm/router").ReasoningEffort;
  },
): Promise<PhaseTransportResult> {
  const temperature = options?.temperature ?? 0.5;
  const max_tokens = options?.max_tokens ?? 2500;
  const call_type = options?.call_type ?? "poju_reply";
  const streamHooks = options?.stream_hooks;
  const extraIgnore = options?.provider_extra_ignore;

  const runOnce = async (retry?: {
    extra_ignore?: string[];
    use_full_order?: boolean;
  }): Promise<PhaseTransportResult> => {
    const mergedIgnore = [
      ...(extraIgnore ?? []),
      ...(retry?.extra_ignore ?? []),
    ].filter(Boolean);
    const providerIgnore = mergedIgnore.length > 0 ? [...new Set(mergedIgnore)] : undefined;
    const locked = retry?.use_full_order
      ? undefined
      : options?.locked_provider?.trim() || undefined;
    const routePath = options?.route_path ?? "chat";
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
            reasoning_effort: options?.thinking_effort ?? "xhigh",
            session_id: options?.session_id,
            call_type: call_type,
            phase_name: options?.phase_name,
            provider: resolveStreamProvider(locked, providerIgnore),
            route_path: routePath,
            locked_provider: locked ?? null,
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
        route_path: routePath,
        locked_provider: locked,
        thinking_effort: options?.thinking_effort,
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

    console.error(
      "[poju] OpenRouter not configured — POJU falling back to Gemini flash; deep-thinking disabled.",
    );
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
  if (isEmptyPhaseCompletion(result)) {
    const failedProvider = result.provider?.trim();
    console.warn(
      "[phase-transport] empty completion (raw_length=0) — controlled retry once",
      JSON.stringify({
        phase: options?.phase_name ?? "—",
        call_type,
        provider: failedProvider ?? "—",
        finish_reason: result.finish_reason ?? "—",
        locked: options?.locked_provider?.trim() ?? null,
      }),
    );
    result = await runOnce({
      extra_ignore: failedProvider ? [failedProvider] : undefined,
      use_full_order: Boolean(options?.locked_provider?.trim()),
    });
  }

  return result;
}

/** Strip fences / prose wrappers; return innermost JSON object substring when present. */
export function extractJson(raw: string): string {
  let s = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}

export function parsePhaseJson(rawText: string): Record<string, unknown> {
  const fenced = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const cleaned = extractJson(rawText);
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    try {
      const repaired = cleaned.replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(repaired) as Record<string, unknown>;
    } catch {
      const grab = (re: RegExp) => fenced.match(re)?.[1];
      const response = (() => {
        const m = cleaned.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/)
          ?? fenced.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, "\t") : "";
      })();
      const sufficientRaw = grab(/"sufficient"\s*:\s*(true|false)/);
      const understandingSufficientRaw = grab(/"understanding_sufficient"\s*:\s*(true|false)/);
      const suggestedRaw = grab(/"suggested_phase"\s*:\s*(null|"[a-z_]+")/);
      const salvaged: Record<string, unknown> = { response, _parse_failed: true };
      if (understandingSufficientRaw != null) {
        salvaged.understanding_sufficient = understandingSufficientRaw === "true";
      }
      if (sufficientRaw != null) {
        salvaged.understanding = { sufficient: sufficientRaw === "true", missing: "" };
      }
      if (suggestedRaw != null) {
        salvaged.suggested_phase =
          suggestedRaw === "null" ? null : suggestedRaw.replace(/"/g, "");
      }
      return salvaged;
    }
  }
}

/** JSON salvage — preserve recovered control fields; only strip unsafe breakthrough updates. */
export function guardParseFailedFields(parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed._parse_failed !== true) return parsed;
  return {
    ...parsed,
    breakthrough_core_updates: null,
    understanding_sufficient:
      typeof parsed.understanding_sufficient === "boolean" ? parsed.understanding_sufficient : undefined,
    understanding: parsed.understanding ?? { sufficient: false, missing: "" },
    suggested_phase: parsed.suggested_phase ?? null,
  };
}

export function isPhaseParseFailed(parsed: Record<string, unknown>): boolean {
  return parsed._parse_failed === true;
}

/** Parse phase JSON; sanitize `response` when locale provided (output-side gloss tokens). */
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

/** Parse phase JSON; sanitize `response` when locale provided (output-side gloss tokens). */
export function parsePhaseResult(
  rawText: string,
  options?: { locale?: string; logContext?: PhaseResponseResolveContext },
): {
  parsed: Record<string, unknown>;
  response: string;
  salvaged: boolean;
} {
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!cleaned) return { parsed: {}, response: "", salvaged: false };

  const sanitizeResponse = (raw: string): string => {
    if (!options?.locale || !raw.trim()) return raw;
    const audited = sanitizeChatResponse(raw, options.locale);
    auditDeliveredText(audited, options.locale);
    return audited;
  };

  let parsed: Record<string, unknown> = {};
  let jsonParsed = false;
  try {
    parsed = guardParseFailedFields(parsePhaseJson(rawText));
    jsonParsed = !isPhaseParseFailed(parsed);
  } catch {
    parsed = {};
  }

  const salvagedRaw = salvagePhaseResponseText(rawText).trim();
  let response = "";
  if (typeof parsed.response === "string" && parsed.response.trim()) {
    response = sanitizeResponse(parsed.response);
  } else if (salvagedRaw) {
    response = sanitizeResponse(salvagedRaw);
    if (!jsonParsed) {
      logPhaseSalvage(rawText, options?.logContext, salvagedRaw.startsWith("{") ? "partial_json" : "prose");
    }
  }

  if (isPhaseParseFailed(parsed) && !response.trim()) {
    response = getPhaseResponseFallback(options?.locale);
  }

  if (typeof parsed.response === "string") parsed.response = response;
  else if (response) parsed.response = response;

  return { parsed, response, salvaged: !jsonParsed && Boolean(salvagedRaw) };
}

/** Log when salvage extracts user-visible text from broken / prose output. */
export function logPhaseSalvage(
  rawText: string,
  ctx: PhaseResponseResolveContext | undefined,
  mode: "prose" | "partial_json",
): void {
  const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 400);
  console.warn(
    "[phase-transport] phase response salvaged",
    JSON.stringify({
      mode,
      phase: ctx?.phase_name ?? "—",
      call_type: ctx?.call_type ?? "—",
      provider: ctx?.provider ?? "—",
      finish_reason: ctx?.finish_reason ?? "—",
      raw_preview: preview,
    }),
  );
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

/** Log compliance violations — alert only, never mutates response. */
function logPhaseComplianceViolation(
  rawText: string,
  ctx: PhaseResponseResolveContext,
  violations: Array<{ label: string; snippet?: string }>,
): void {
  const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 400);
  console.warn(
    "[phase-transport] phase response compliance alert",
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

export function logPhaseComplianceAlert(
  rawText: string,
  ctx: PhaseResponseResolveContext,
  violations: Array<{ label: string; snippet?: string }>,
): void {
  logPhaseComplianceViolation(rawText, ctx, violations);
}

/** @deprecated Use logPhaseComplianceAlert. */
export const logPhaseComplianceFailure = logPhaseComplianceAlert;

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
  let { parsed, response } = parsePhaseResult(rawText, {
    locale: ctx.locale,
    logContext: ctx,
  });

  if (response.trim() && ctx.structured !== undefined) {
    const repaired = repairEmptyKeepCnBrackets(response, ctx.structured, ctx.locale ?? "en");
    response = repaired.text;
    if (typeof parsed.response === "string") parsed.response = response;
    else if (response) parsed.response = response;
  }

  if (response.trim()) {
    const violations = auditPhaseChatCompliance(response, ctx.locale ?? "en");
    if (violations.length > 0) {
      logPhaseComplianceAlert(rawText, { ...ctx, raw_length: rawText.length }, violations);
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

/** True when text is the infrastructure fallback copy (not conversational content). */
export function isPhaseResponseFallback(text: string): boolean {
  const t = text.trim();
  if (!t.startsWith("[POJU]")) return false;
  return (
    t.includes("could not be generated") ||
    t.includes("未能生成") ||
    t.includes("No se pudo generar")
  );
}

/** Prefer streamed content over fallback placeholder when parse/salvage failed server-side. */
export function resolveStreamedCompleteResponse(
  llmResponse: string,
  streamedText: string,
  locale?: string,
): string {
  const streamed = streamedText.trim();
  const resolved = llmResponse.trim();
  if (resolved && !isPhaseResponseFallback(resolved)) return resolved;
  if (streamed) return streamed;
  return getPhaseResponseFallback(locale);
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
    thinking_effort?: import("@/lib/llm/router").ReasoningEffort;
  },
>(
  input: {
    stream_hooks?: PhaseStreamHooks;
    signal?: AbortSignal;
    session: { session_id: string; locked_provider?: string };
  },
  opts: T,
): T & {
  stream_hooks?: PhaseStreamHooks;
  signal?: AbortSignal;
  session_id?: string;
  phase_name?: string;
  locked_provider?: string;
  route_path: OpenRouterRoutePath;
} {
  return {
    ...opts,
    stream_hooks: input.stream_hooks,
    signal: input.signal,
    session_id: pojuCacheSessionId(input.session.session_id),
    phase_name: opts.phase_name,
    locked_provider: input.session.locked_provider?.trim() || undefined,
    route_path: "chat",
  };
}
