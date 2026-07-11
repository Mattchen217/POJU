import { auditDeliveredText, repairChatTermMarkers, sanitizeChatResponse, stripForbiddenShenSha, stripGlossTokensForPrompt } from "@/lib/llm/sanitize/compliance-terms";
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
  isUnderstandingFieldFilled,
  parseCoreDilemmaPatch,
  parseDesiredDirectionPatch,
  resolveCoreDilemmaRaw,
  resolveDesiredDirectionRaw,
} from "@/lib/poju/agent-state";

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

  if (isEmptyPhaseCompletion(result)) {
    const failedProvider = result.provider?.trim();
    const pinned = options?.locked_provider?.trim();
    console.warn(
      "[phase-transport] empty completion (raw_length=0) — controlled retry once",
      JSON.stringify({
        phase: options?.phase_name ?? "—",
        call_type,
        provider: failedProvider ?? "—",
        finish_reason: result.finish_reason ?? "—",
        locked: pinned ?? null,
        retry_same_provider: Boolean(pinned),
      }),
    );
    try {
      const retried = await runOnce({
        extra_ignore: pinned ? undefined : failedProvider ? [failedProvider] : undefined,
      });
      result = retried;
      if (result.llm_debug) {
        result = { ...result, llm_debug: { ...result.llm_debug, retried: true } };
      }
    } catch (err) {
      console.warn(
        "[phase-transport] empty-content retry threw — not upgrading to provider_queue",
        err,
      );
    }
    result = salvageContentFromReasoning(result);

    if (isEmptyPhaseCompletion(result)) {
      if (result.finish_reason === "length") {
        console.warn(
          "[phase-transport] empty content with finish_reason=length — reasoning likely consumed max_tokens",
          JSON.stringify({ phase: options?.phase_name ?? "—", max_tokens }),
        );
      }
      console.warn(
        "[phase-transport] empty completion after retry — will use empty-generation fallback",
        JSON.stringify({
          phase: options?.phase_name ?? "—",
          provider: result.provider ?? "—",
          finish_reason: result.finish_reason ?? "—",
        }),
      );
    }
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

/** Normalize common LLM JSON drift (quotes, colons, spaced keys, trailing commas). */
export function tolerantJsonRepair(s: string): string {
  return s
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, '"')
    .replace(/：/g, ":")
    .replace(/，/g, ",")
    .replace(/"([^"]*?)\s+([^"]*?)"(\s*:)/g, (_, a, b, c) => `"${a}${b}"${c}`)
    .replace(/,(\s*[}\]])/g, "$1");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function grabSalvageStringField(text: string, keyAliases: string[]): string | undefined {
  for (const k of keyAliases) {
    const key = escapeRegExp(k);
    const re = new RegExp(
      `["'「」]?${key}["'「」]?\\s*[:：]\\s*["'「」]((?:[^"'「」\\\\]|\\\\.)*)["'「」]`,
      "i",
    );
    const m = text.match(re);
    if (m?.[1]?.trim()) {
      return m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
    }
  }
  return undefined;
}

function extractNestedJsonBlock(text: string, containerAliases: string[]): string | null {
  for (const key of containerAliases) {
    const re = new RegExp(`["'「」]?${escapeRegExp(key)}["'「」]?\\s*[:：]\\s*\\{`, "i");
    const m = re.exec(text);
    if (!m || m.index === undefined) continue;
    const braceStart = text.indexOf("{", m.index);
    if (braceStart < 0) continue;
    let depth = 0;
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) return text.slice(braceStart, i + 1);
      }
    }
    if (depth > 0) return text.slice(braceStart);
  }
  return null;
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  const attempts = [
    raw,
    raw.replace(/,(\s*[}\]])/g, "$1"),
    tolerantJsonRepair(raw),
    tolerantJsonRepair(raw.replace(/,(\s*[}\]])/g, "$1")),
  ];
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* next */
    }
  }
  return null;
}

const DILEMMA_CONTAINER_KEYS = ["core_dilemma", "coredilemma", "困境", "核心困境"];
const DIRECTION_CONTAINER_KEYS = ["desired_direction", "desireddirection", "行动", "期望方向", "目标方向"];

function salvageUnderstandingPatches(cleaned: string): {
  core_dilemma?: Record<string, unknown>;
  desired_direction?: Record<string, unknown>;
} {
  const out: {
    core_dilemma?: Record<string, unknown>;
    desired_direction?: Record<string, unknown>;
  } = {};

  const dilemmaBlock = extractNestedJsonBlock(cleaned, DILEMMA_CONTAINER_KEYS);
  if (dilemmaBlock) {
    const nested = tryParseJsonObject(dilemmaBlock);
    const patch = parseCoreDilemmaPatch(nested ?? dilemmaBlock);
    if (patch) out.core_dilemma = patch;
  }

  const directionBlock = extractNestedJsonBlock(cleaned, DIRECTION_CONTAINER_KEYS);
  if (directionBlock) {
    const nested = tryParseJsonObject(directionBlock);
    const patch = parseDesiredDirectionPatch(nested ?? directionBlock);
    if (patch) out.desired_direction = patch;
  }

  const flatDilemma = {
    concrete_event: grabSalvageStringField(cleaned, [
      "concrete_event",
      "concreteevent",
      "具体事件",
      "事件",
    ]),
    stakes: grabSalvageStringField(cleaned, ["stakes", "利害", "在意", "在乎", "代价"]),
    sticking_point: grabSalvageStringField(cleaned, [
      "sticking_point",
      "stickingpoint",
      "stickingpoint",
      "卡点",
      "过不去",
    ]),
  };
  const flatDilemmaPatch = parseCoreDilemmaPatch(flatDilemma);
  if (flatDilemmaPatch) {
    out.core_dilemma = { ...out.core_dilemma, ...flatDilemmaPatch };
  }

  const flatDirection = {
    wants: grabSalvageStringField(cleaned, [
      "wants",
      "w蚂蚁",
      "想要",
      "期望",
      "方向",
      "希望",
    ]),
    priority: grabSalvageStringField(cleaned, ["priority", "优先", "优先级", "最在意"]),
  };
  const flatDirectionPatch = parseDesiredDirectionPatch(flatDirection);
  if (flatDirectionPatch) {
    out.desired_direction = { ...out.desired_direction, ...flatDirectionPatch };
  }

  return out;
}

export function parsePhaseJson(rawText: string): Record<string, unknown> {
  const fenced = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const cleaned = extractJson(rawText);

  const direct = tryParseJsonObject(cleaned);
  if (direct) return direct;

  const grab = (re: RegExp) => fenced.match(re)?.[1] ?? cleaned.match(re)?.[1];
  const response = (() => {
    const m =
      cleaned.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/) ??
      fenced.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
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
    salvaged.suggested_phase = suggestedRaw === "null" ? null : suggestedRaw.replace(/"/g, "");
  }

  const understanding = salvageUnderstandingPatches(fenced);
  if (understanding.core_dilemma && Object.keys(understanding.core_dilemma).length > 0) {
    salvaged.core_dilemma = understanding.core_dilemma;
  }
  if (understanding.desired_direction && Object.keys(understanding.desired_direction).length > 0) {
    salvaged.desired_direction = understanding.desired_direction;
  }

  return salvaged;
}

/** JSON salvage — preserve recovered control fields; only strip unsafe breakthrough updates. */
export function guardParseFailedFields(parsed: Record<string, unknown>): Record<string, unknown> {
  if (parsed._parse_failed !== true) return parsed;
  return {
    ...parsed,
    breakthrough_core_updates: null,
    core_dilemma: parsed.core_dilemma,
    desired_direction: parsed.desired_direction,
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
  return getPojuServiceBusyMessage(locale);
}

export function getPhaseEmptyGenerationFallback(locale?: string): string {
  return getPojuEmptyGenerationMessage(locale);
}

export function hasSalvagedUnderstandingFields(parsed: Record<string, unknown>): boolean {
  const dilemma = parseCoreDilemmaPatch(resolveCoreDilemmaRaw(parsed));
  const direction = parseDesiredDirectionPatch(resolveDesiredDirectionRaw(parsed));
  const candidates = [
    dilemma?.concrete_event,
    dilemma?.stakes,
    dilemma?.sticking_point,
    direction?.wants,
    direction?.priority,
  ];
  return candidates.some((v) => isUnderstandingFieldFilled(v));
}

/** Opening turn is usable when JSON parsed cleanly, or salvage recovered understanding/response field. */
export function isPhaseOpeningPayloadUsable(
  parsed: Record<string, unknown>,
  response: string,
): boolean {
  if (isPojuFailurePlaceholderMessage(response)) return false;
  if (!response.trim()) return false;
  if (!isPhaseParseFailed(parsed)) return true;
  if (parsed._prose_salvaged === true) return hasSalvagedUnderstandingFields(parsed);
  if (hasSalvagedUnderstandingFields(parsed)) return true;
  const jsonSalvagedResponse =
    typeof parsed.response === "string" && parsed.response.trim() === response.trim();
  return jsonSalvagedResponse;
}

export function getPhaseParseFailureFallback(locale?: string): string {
  return getPhaseEmptyGenerationFallback(locale);
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
    let audited = repairChatTermMarkers(raw, options.locale);
    audited = sanitizeChatResponse(audited, options.locale);
    const hits = auditDeliveredText(audited, options.locale).filter((v) =>
      v.label.startsWith("out_of_set"),
    );
    if (hits.length) {
      audited = stripForbiddenShenSha(audited);
      console.warn("[chat] 集外神煞已剥离:", hits.map((h) => h.label));
    }
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
      parsed._prose_salvaged = true;
      logPhaseSalvage(rawText, options?.logContext, salvagedRaw.startsWith("{") ? "partial_json" : "prose");
    }
  }

  if (isPhaseParseFailed(parsed) && !response.trim()) {
    // Defer to resolvePhaseResponse — broken JSON uses empty-generation copy, not busy fallback.
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
  audit_relations?: RelationLabel[];
};

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
