/**
 * Shared LLM transport for all POJU phases (stream / non-stream / resend).
 * Pure mechanism — phase callers own control flow.
 */
import { auditDeliveredText, stripGlossTokensForPrompt } from "@/lib/llm/sanitize/compliance-terms";
import { repairEmptyKeepCnBrackets } from "@/lib/llm/sanitize/keep-cn-brackets";
import { salvagePhaseResponseText } from "@/lib/poju/extract-streaming-response";
import { pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import type { RelationLabel } from "@/lib/calculations/relation-engine";
import {
  generateGeminiChatCompletion,
  getGeminiClient,
} from "@/lib/llm/gemini-shared";
import { getPojuEmptyGenerationMessage, getPojuServiceBusyMessage, isPojuFailurePlaceholderMessage } from "@/lib/llm/poju-service-busy-message";
import { buildLlmDebug, type LLMCallDebug } from "@/lib/llm/llm-debug";
import type { LLMCallType, ReasoningEffort } from "@/lib/llm/router";
import {
  getOpenRouterDefaultModel,
  isOpenRouterConfigured,
  openRouterChatCompletion,
  openRouterProviderExtras,
  type OpenRouterRoutePath,
} from "@/lib/llm/openrouter-shared";
import {
  extractJson,
  getPhaseEmptyGenerationFallback,
  getPhaseResponseFallback,
  hasSalvagedUnderstandingFields,
  isPhaseOpeningPayloadUsable,
  isPhaseParseFailed,
  parsePhaseResult,
  type PhaseResponseResolveContext,
} from "@/lib/poju/shared/json-tools";

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
  llm_debug?: LLMCallDebug;
  /** Opening-only: transport-level resend count (empty / bad JSON). */
  opening_resends?: number;
};

/** OpenRouter returned zero-length completion body. */
export function isEmptyPhaseCompletion(result: PhaseTransportResult): boolean {
  return result.content.trim().length === 0;
}

/** Try to recover JSON content when body is empty but reasoning contains a JSON block. */
export function salvageContentFromReasoning(result: PhaseTransportResult): PhaseTransportResult {
  if (!isEmptyPhaseCompletion(result)) return result;
  const reasoning = result.reasoning?.trim() ?? "";
  if (reasoning.length < 40) return result;

  const jsonSlice = extractJson(reasoning).trim();
  if (jsonSlice.startsWith("{") && jsonSlice.length > 20) {
    console.info("[phase-transport] salvaged JSON from reasoning");
    return { ...result, content: jsonSlice };
  }

  return result;
}

/** Opening segment-1: empty body or parse failed without salvaged understanding fields → resend. */
export const MAX_OPENING_TRANSPORT_RESEND = 4;

/**
 * Non-opening empty-content resends at transport layer (same params — never provider ignore).
 * OpenRouter call layer also same-param resends (MAX_EMPTY_CONTENT_RESEND); this is a safety net.
 */
export const MAX_EMPTY_TRANSPORT_RESEND = 3;

export function isOpeningTransportResendNeeded(rawContent: string): boolean {
  if (!rawContent.trim()) return true;
  const { parsed, response } = parsePhaseResult(rawContent, {});
  if (isPhaseOpeningPayloadUsable(parsed, response)) return false;
  if (!isPhaseParseFailed(parsed)) return !response.trim();
  return !hasSalvagedUnderstandingFields(parsed);
}

const RETRYABLE_COMPLIANCE_LABELS = new Set([
  "empty_keep_cn_bracket",
  "broken_marker",
  "bare_ganzhi",
]);

function isRetryableComplianceLabel(label: string): boolean {
  if (RETRYABLE_COMPLIANCE_LABELS.has(label)) return true;
  if (label.startsWith("term:") || label.startsWith("out_of_set:")) return true;
  if (label.startsWith("relation_")) return true;
  if (label.startsWith("compliance_redline:")) return true;
  if (label.startsWith("divination:") || label.startsWith("bazi_term:")) return true;
  return false;
}

export function auditPhaseChatCompliance(
  text: string,
  locale: string,
  structured?: ProfileStructured | null,
  opts?: { relations?: RelationLabel[] },
): Array<{ label: string; snippet?: string }> {
  return auditDeliveredText(text, locale, structured, opts).filter((v) =>
    isRetryableComplianceLabel(v.label),
  );
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
  const extraIgnore = options?.provider_extra_ignore;

  const runOnce = async (retry?: {
    extra_ignore?: string[];
  }): Promise<PhaseTransportResult> => {
    const mergedIgnore = [
      ...(extraIgnore ?? []),
      ...(retry?.extra_ignore ?? []),
    ].filter(Boolean);
    const locked = options?.locked_provider?.trim() || undefined;
    const routePath = options?.route_path ?? "chat";
    const thinking_effort: ReasoningEffort = options?.thinking_effort ?? "high";
    if (isOpenRouterConfigured()) {
      const chatMessages = [
        { role: "system" as const, content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const defaultModel = getOpenRouterDefaultModel();
      const uniqueIgnore =
        mergedIgnore.length > 0 ? [...new Set(mergedIgnore)] : undefined;
      const startTime = Date.now();
      const out = await openRouterChatCompletion({
        messages: chatMessages,
        max_tokens,
        temperature,
        json_mode: true,
        reasoning_effort: thinking_effort,
        session_id: options?.session_id,
        call_type,
        phase_name: options?.phase_name,
        route_path: routePath,
        locked_provider: locked ?? null,
        provider: openRouterProviderExtras({
          lockedProvider: locked,
          extra_ignore: uniqueIgnore,
        }),
        signal: options?.signal,
      });
      const latency_ms = Date.now() - startTime;
      const transport = out.transport;
      const llm_debug = buildLlmDebug({
        phase: options?.phase_name ?? call_type,
        requested_effort: thinking_effort,
        max_tokens,
        model: out.model || defaultModel,
        served_provider: out.provider,
        finish_reason: out.finish_reason,
        prompt_tokens: out.prompt_tokens,
        cached_tokens: out.cached_tokens,
        completion_tokens: out.completion_tokens,
        reasoning_tokens: out.reasoning_tokens,
        latency_ms,
        generation_time_ms: out.generation_time_ms,
        generation_id: out.generation_id,
        attempt: transport?.attempt ?? 1,
        retried: (transport?.retried ?? false) || Boolean(retry),
        fell_back: transport?.fell_back ?? false,
      });
      return {
        content: out.text,
        model: out.model || defaultModel,
        tokens_used: out.tokens_used,
        reasoning: out.reasoning,
        reasoning_details: out.reasoning_details,
        finish_reason: out.finish_reason,
        provider: out.provider,
        llm_debug,
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
  result = salvageContentFromReasoning(result);

  if (options?.phase_name === "opening") {
    let openingResends = 0;
    for (let i = 1; i < MAX_OPENING_TRANSPORT_RESEND; i++) {
      const emptyRaw = isEmptyPhaseCompletion(result);
      const badJson = isOpeningTransportResendNeeded(result.content);
      if (!emptyRaw && !badJson) break;

      openingResends = i;
      const failedProvider = result.provider?.trim();
      const pinned = options?.locked_provider?.trim();
      console.info(
        `[phase-transport] opening resend ${i}/${MAX_OPENING_TRANSPORT_RESEND - 1}`,
        JSON.stringify({
          phase: options?.phase_name ?? "opening",
          call_type,
          empty: emptyRaw,
          bad_json: badJson && !emptyRaw,
          provider: failedProvider ?? "—",
          locked: pinned ?? null,
          same_params: emptyRaw,
        }),
      );
      try {
        // Empty content: same params (never provider ignore — quality must not drop).
        // Bad JSON only: may ignore failed provider once (not an empty-reply case).
        const retried = await runOnce({
          extra_ignore:
            emptyRaw || pinned
              ? undefined
              : failedProvider
                ? [failedProvider]
                : undefined,
        });
        result = retried;
        if (result.llm_debug) {
          result = {
            ...result,
            llm_debug: { ...result.llm_debug, retried: true, attempt: i + 1 },
          };
        }
      } catch (err) {
        console.warn("[phase-transport] opening resend threw — stopping resend loop", err);
        break;
      }
      result = salvageContentFromReasoning(result);
    }
    return { ...result, opening_resends: openingResends };
  }

  // Empty content: same-param invisible resends (never provider ignore / never degrade effort).
  for (let i = 1; i < MAX_EMPTY_TRANSPORT_RESEND && isEmptyPhaseCompletion(result); i++) {
    console.info(
      `[phase-transport] empty completion — invisible same-param resend ${i}/${MAX_EMPTY_TRANSPORT_RESEND - 1}`,
      JSON.stringify({
        phase: options?.phase_name ?? "—",
        call_type,
        provider: result.provider ?? "—",
        finish_reason: result.finish_reason ?? "—",
      }),
    );
    try {
      const retried = await runOnce();
      result = retried;
      if (result.llm_debug) {
        result = {
          ...result,
          llm_debug: { ...result.llm_debug, retried: true, attempt: i + 1 },
        };
      }
    } catch (err) {
      console.warn(
        "[phase-transport] empty-content same-param resend threw — not upgrading to provider_queue / slug fail",
        err,
      );
      break;
    }
    result = salvageContentFromReasoning(result);
  }

  if (isEmptyPhaseCompletion(result)) {
    if (result.finish_reason === "length") {
      console.warn(
        "[phase-transport] empty content with finish_reason=length — reasoning likely consumed max_tokens",
        JSON.stringify({ phase: options?.phase_name ?? "—", max_tokens }),
      );
    }
    console.warn(
      "[phase-transport] empty completion after same-param resends — empty-generation fallback",
      JSON.stringify({
        phase: options?.phase_name ?? "—",
        provider: result.provider ?? "—",
        finish_reason: result.finish_reason ?? "—",
      }),
    );
  }

  return result;
}

/** User-visible text for compliance logging — never include reasoning drafts. */
function userVisibleComplianceText(rawText: string, response: string): string {
  const visible = response.trim();
  if (visible) return visible;
  return rawText.trim();
}

/** Log compliance violations — alert only, never mutates response. */
function logPhaseComplianceViolation(
  complianceTarget: string,
  ctx: PhaseResponseResolveContext,
  violations: Array<{ label: string; snippet?: string }>,
): void {
  const preview = complianceTarget.replace(/\s+/g, " ").trim().slice(0, 400);
  console.warn(
    "[phase-transport] phase response compliance alert",
    JSON.stringify({
      phase: ctx.phase_name ?? "—",
      call_type: ctx.call_type ?? "—",
      provider: ctx.provider ?? "—",
      model: ctx.model ?? "—",
      finish_reason: ctx.finish_reason ?? "—",
      violations: violations.slice(0, 6).map((v) => v.label),
      content_preview: preview,
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
  const preview = userVisibleComplianceText(rawText, "").replace(/\s+/g, " ").trim().slice(0, 400);
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

  const openingUnusable =
    ctx.phase_name === "opening" && response.trim() && !isPhaseOpeningPayloadUsable(parsed, response);

  if (response.trim() && !openingUnusable) {
    const violations = auditPhaseChatCompliance(response, ctx.locale ?? "en", ctx.structured, {
      relations: ctx.audit_relations,
    });
    if (violations.length > 0) {
      logPhaseComplianceAlert(
        userVisibleComplianceText(rawText, response),
        { ...ctx, raw_length: response.length },
        violations,
      );
    }
    return { parsed, response, used_fallback: false, compliance_failed: false };
  }

  if (openingUnusable) {
    response = "";
  }

  if (ctx.use_fallback === false) {
    return { parsed, response: "", used_fallback: false, compliance_failed: false };
  }
  const emptyBody = rawText.trim().length === 0;
  const parseFailed = isPhaseParseFailed(parsed);
  const salvagedUnderstanding = hasSalvagedUnderstandingFields(parsed);
  const useEmptyGeneration =
    emptyBody ||
    openingUnusable ||
    (parseFailed && !response.trim() && !salvagedUnderstanding) ||
    (ctx.phase_name === "opening" && parseFailed && !salvagedUnderstanding);
  logPhaseResponseFallback(rawText, { ...ctx, raw_length: rawText.length });
  return {
    parsed,
    response: useEmptyGeneration
      ? getPhaseEmptyGenerationFallback(ctx.locale)
      : getPhaseResponseFallback(ctx.locale),
    used_fallback: true,
    compliance_failed: false,
  };
}

/** User-visible fallback when the model returns no parseable `response` (e.g. truncated JSON). */

/** True when text is the infrastructure fallback copy (not conversational content). */
export function isPhaseResponseFallback(text: string): boolean {
  return isPojuFailurePlaceholderMessage(text);
}

/** Prefer streamed content over fallback placeholder when parse/salvage failed server-side. */
export function resolveStreamedCompleteResponse(
  llmResponse: string,
  streamedText: string,
  locale?: string,
): string {
  const resolved = llmResponse.trim();
  if (resolved && !isPhaseResponseFallback(resolved)) return resolved;
  const streamed = streamedText.trim();
  if (streamed) {
    const salvaged = salvagePhaseResponseText(streamed).trim();
    if (salvaged && !isPhaseResponseFallback(salvaged)) return salvaged;
  }
  if (!resolved && !streamed.trim()) {
    return getPhaseEmptyGenerationFallback(locale);
  }
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
