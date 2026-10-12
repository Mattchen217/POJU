/**
 * Companion day generation — 1 invoke = 1–2 days (pair JSON).
 *
 * Lab/production: **one streaming OpenRouter call** per attempt (wall 285s).
 * No requestJsonWithRepair second gun — that left OR billed while the invoke
 * hung until Vercel FUNCTION_INVOCATION_TIMEOUT.
 *
 * Prefix-cache: static system + Brief-first user; session_id =
 * companionCacheSessionId(sessionId:locale).
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";
import { companionCacheSessionId } from "@/lib/llm/cache-session-id";
import { openRouterChatCompletionStream } from "@/lib/llm/openrouter-stream";
import { DELIVERY_SINGLE_CALL_TIMEOUT_MS } from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  buildLabCallTrace,
  type LabCallTrace,
} from "@/lib/llm/pro/delivery/lab/call-trace";
import { estimateCostUsd, type ReasoningEffort } from "@/lib/llm/router";
import { sanitizeDeepStringFields } from "@/lib/llm/sanitize/compliance-terms";
import { polishDeepStringFields } from "@/lib/llm/sanitize/delivery-grammar-polish";
import {
  auditDeepStringFields,
  isCriticalDeliveryAuditFailure,
} from "@/lib/llm/services/delivery-audit-regen";
import {
  parseJsonLoose,
  type JsonValidateResult,
} from "@/lib/llm/services/delivery-resilience";

import { companionTextSimilarity } from "./batch-gate";
import {
  buildCompanionPairSystem,
  buildCompanionPairUser,
  type CompanionPairDayFeed,
} from "./companion-daily-prompt";
import { sanitizeCompanionEvidenceMarkers } from "./energy-digest";
import {
  gateCompanionDay,
  type CompanionDayGateResult,
} from "./gate-companion-day";
import { normalizeCompanionLocale } from "./locale-voice";
import {
  CompanionDayCardsSchema,
  type CompanionBrief,
  type CompanionDayCards,
} from "./types";

const PAIR_NEAR_DUP_FAIL = 0.52;

export type CompanionPairDayResult = {
  day_index: number;
  cards: CompanionDayCards;
  day_gate: CompanionDayGateResult;
};

export type GenerateCompanionPairCardsResult = {
  days: CompanionPairDayResult[];
  /** Aggregate: false if any day_gate fails or pair near-dup. */
  pair_gate: CompanionDayGateResult;
  meta: {
    model: string;
    tokens_used: number;
    cost_usd: number;
    latency_ms: number;
  };
  call_trace: LabCallTrace;
  system: string;
  user: string;
};

export type GenerateCompanionDayResult = {
  cards: CompanionDayCards;
  day_gate: CompanionDayGateResult;
  meta: GenerateCompanionPairCardsResult["meta"];
  call_trace: LabCallTrace;
  system: string;
  user: string;
};

type PairDayRaw = CompanionDayCards & { day_index: number };

function faceForAudit(cards: CompanionDayCards): Record<string, string> {
  return {
    today_is: cards.today_is,
    suitable: cards.suitable,
    unsuitable: cards.unsuitable,
    suggestion: cards.suggestion,
  };
}

function validatePairDays(
  parsed: Record<string, unknown>,
  expectedIndexes: number[],
): JsonValidateResult<{ days: PairDayRaw[] }> {
  const daysRaw = parsed.days;
  if (!Array.isArray(daysRaw) || daysRaw.length !== expectedIndexes.length) {
    return {
      ok: false,
      missing: ["days"],
      message: `companion_pair_days_len:want_${expectedIndexes.length}_got_${Array.isArray(daysRaw) ? daysRaw.length : 0}`,
      parsed,
    };
  }
  const out: PairDayRaw[] = [];
  const missing: string[] = [];
  for (let i = 0; i < expectedIndexes.length; i++) {
    const want = expectedIndexes[i]!;
    const row = daysRaw[i];
    if (!row || typeof row !== "object") {
      missing.push(`days[${i}]`);
      continue;
    }
    const obj = row as Record<string, unknown>;
    /** Coerce day_index to feed order — never fail/repair on 1-based labels. */
    const cardsParse = CompanionDayCardsSchema.safeParse({
      today_is: obj.today_is,
      suitable: obj.suitable,
      unsuitable: obj.unsuitable,
      suggestion: obj.suggestion,
      evidence: obj.evidence,
    });
    if (!cardsParse.success) {
      missing.push(
        ...cardsParse.error.issues.map(
          (iss) => `days[${i}].${iss.path.join(".") || "cards"}`,
        ),
      );
      continue;
    }
    out.push({ day_index: want, ...cardsParse.data });
  }
  if (missing.length) {
    return {
      ok: false,
      missing,
      message: `companion_pair_invalid:${missing.join(",")}`,
      parsed,
    };
  }
  return { ok: true, value: { days: out } };
}

function sanitizePairDay(raw: PairDayRaw, locale: string): PairDayRaw {
  let cards = sanitizeDeepStringFields(
    {
      today_is: raw.today_is,
      suitable: raw.suitable,
      unsuitable: raw.unsuitable,
      suggestion: raw.suggestion,
      evidence: raw.evidence,
    },
    locale,
  ) as CompanionDayCards;
  cards = polishDeepStringFields(cards, locale) as CompanionDayCards;
  cards = {
    ...cards,
    evidence: sanitizeCompanionEvidenceMarkers(cards.evidence),
  };
  return { day_index: raw.day_index, ...cards };
}

function gatePairDays(
  days: PairDayRaw[],
  locale: string,
): {
  results: CompanionPairDayResult[];
  pair_gate: CompanionDayGateResult;
} {
  const results: CompanionPairDayResult[] = days.map((d) => {
    const cards = CompanionDayCardsSchema.parse({
      today_is: d.today_is,
      suitable: d.suitable,
      unsuitable: d.unsuitable,
      suggestion: d.suggestion,
      evidence: d.evidence,
    });
    return {
      day_index: d.day_index,
      cards,
      day_gate: gateCompanionDay({
        cards,
        dayIndex: d.day_index,
        locale,
      }),
    };
  });

  for (const r of results) {
    if (!r.day_gate.passed) {
      return {
        results,
        pair_gate: {
          passed: false,
          failed_rule: r.day_gate.failed_rule,
          detail: `day ${r.day_index + 1}: ${r.day_gate.detail ?? ""}`,
        },
      };
    }
  }

  if (results.length >= 2) {
    const a = results[0]!;
    const b = results[1]!;
    const score = companionTextSimilarity(a.cards.today_is, b.cards.today_is);
    if (score >= PAIR_NEAR_DUP_FAIL) {
      return {
        results,
        pair_gate: {
          passed: false,
          failed_rule: "companion_pair_today_is_near_dup",
          detail: `同枪两日 today_is 近复 score=${Math.round(score * 100) / 100}`,
        },
      };
    }
  }

  return { results, pair_gate: { passed: true } };
}

/**
 * Single streaming OpenRouter invoke — accumulates content, then JSON-parse once.
 * Wall = DELIVERY_SINGLE_CALL_TIMEOUT_MS (285s). No repair gun.
 */
async function invokeCompanionPairStream(input: {
  system: string;
  user: string;
  expectedIndexes: number[];
  thinking_effort: ReasoningEffort;
  cacheSession: string;
  temperature: number;
}): Promise<{
  pairDays: PairDayRaw[];
  parsed: Record<string, unknown>;
  raw: string;
  model: string;
  tokens_used: number;
  cost_usd: number;
  latency_ms: number;
  streamMeta: {
    reasoning?: string;
    prompt_tokens: number;
    completion_tokens: number;
    reasoning_tokens: number;
    generation_id?: string | null;
    finish_reason?: string | null;
  };
}> {
  const t0 = Date.now();
  const streamed = await openRouterChatCompletionStream(
    {
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      max_tokens: 20_000,
      temperature: input.temperature,
      json_mode: true,
      reasoning_effort: input.thinking_effort,
      timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      disable_slow_stream_abort: true,
      session_id: input.cacheSession,
      call_type: "matrix_narrative",
      phase_name: "companion_daily_pair",
      route_path: "once",
    },
    {},
  );

  const raw = (streamed.text ?? "").trim();
  if (!raw) {
    throw new Error("companion_pair_empty_content");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonLoose(raw);
  } catch (e) {
    throw new Error(
      e instanceof Error ? `companion_pair_json:${e.message}` : "companion_pair_json",
    );
  }

  const validated = validatePairDays(parsed, input.expectedIndexes);
  if (!validated.ok) {
    throw new Error(validated.message);
  }

  const latency_ms = Date.now() - t0;
  const tokens_used = streamed.tokens_used;
  return {
    pairDays: validated.value.days,
    parsed,
    raw,
    model: streamed.model || "",
    tokens_used,
    cost_usd: estimateCostUsd(
      streamed.prompt_tokens,
      streamed.completion_tokens,
      streamed.cached_tokens,
    ),
    latency_ms,
    streamMeta: {
      reasoning: streamed.reasoning,
      prompt_tokens: streamed.prompt_tokens,
      completion_tokens: streamed.completion_tokens,
      reasoning_tokens: streamed.reasoning_tokens,
      generation_id: streamed.generation_id ?? null,
      finish_reason: streamed.finish_reason ?? null,
    },
  };
}

/**
 * One LLM invoke → 1–2 day cards. indexes length 1 or 2.
 */
export async function generateCompanionDayPairCards(input: {
  brief: CompanionBrief;
  days: CompanionPairDayFeed[];
  locale: string;
  sessionId: string;
  thinking_effort?: ReasoningEffort;
  priorFingerprints?: string[];
}): Promise<GenerateCompanionPairCardsResult> {
  const locale = normalizeCompanionLocale(input.locale);
  const feeds = input.days.slice(0, 2);
  if (!feeds.length) throw new Error("companion_pair_empty_feed");

  const expectedIndexes = feeds.map((d) => d.dayIndex);
  const system = buildCompanionPairSystem(locale);
  const user = buildCompanionPairUser({
    brief: input.brief,
    locale,
    days: feeds,
    priorFingerprints: input.priorFingerprints,
  });

  const thinking_effort: ReasoningEffort = input.thinking_effort ?? "medium";
  /** Lab high: no quality auto-retry. Production medium: at most 1+1. */
  const allowQualityRetry = thinking_effort !== "high";
  const cacheSession = companionCacheSessionId(`${input.sessionId}:${locale}`);

  let userContent = user;
  let pairDays: PairDayRaw[] | null = null;
  let model = "";
  let tokens_used = 0;
  let cost_usd = 0;
  let latency_ms = 0;
  let qualityRetried = false;
  let lastParsed: Record<string, unknown> | null = null;
  let lastRaw = "";
  let lastReasoning: string | undefined;
  let lastPromptTokens = 0;
  let lastCompletionTokens = 0;
  let lastReasoningTokens = 0;
  let lastGenerationId: string | null = null;
  let lastFinishReason: string | null = null;
  let gated: ReturnType<typeof gatePairDays> | null = null;

  for (let attempt = 0; attempt < (allowQualityRetry ? 2 : 1); attempt++) {
    const out = await invokeCompanionPairStream({
      system,
      user: userContent,
      expectedIndexes,
      thinking_effort,
      cacheSession,
      temperature: qualityRetried ? 0.3 : 0.45,
    });

    pairDays = out.pairDays.map((d) => sanitizePairDay(d, locale));
    model = out.model;
    tokens_used = out.tokens_used;
    cost_usd = out.cost_usd;
    latency_ms = out.latency_ms;
    lastParsed = out.parsed;
    lastRaw = out.raw;
    lastReasoning = out.streamMeta.reasoning;
    lastPromptTokens = out.streamMeta.prompt_tokens;
    lastCompletionTokens = out.streamMeta.completion_tokens;
    lastReasoningTokens = out.streamMeta.reasoning_tokens;
    lastGenerationId = out.streamMeta.generation_id ?? null;
    lastFinishReason = out.streamMeta.finish_reason ?? null;

    let auditCritical = false;
    for (const d of pairDays) {
      const auditViolations = auditDeepStringFields(
        faceForAudit(d),
        locale,
        "syncro",
      );
      if (isCriticalDeliveryAuditFailure(auditViolations)) {
        auditCritical = true;
        break;
      }
    }

    gated = gatePairDays(pairDays, locale);
    const qualityFail = auditCritical || !gated.pair_gate.passed;

    if (qualityFail && allowQualityRetry && !qualityRetried) {
      qualityRetried = true;
      const zh = locale === "zh";
      const rule = gated.pair_gate.failed_rule ?? "audit";
      userContent =
        user +
        (zh
          ? `\n\n上一稿不合格（${rule}）：禁绿/红数字与「对齐+盖章」；today_is 禁「适合/不宜」腔；禁布置或验收主张里具体作业；中/后段须点战略边界（非作业表）；两日 today_is 须明显不同；evidence 只用能量白话或合法 ⟦t:slug|白话⟧。`
          : `\n\nPrior draft failed (${rule}): ban green/red integers and alignment/stamp; today_is not suitable-voice; ban claim-homework assign/quiz; mid/late must hit strategic rails (not chore lists); two today_is must differ; evidence = plain digest or legal ⟦t:slug|plain⟧.`);
      continue;
    }
    break;
  }

  if (!pairDays || !gated) throw new Error("companion_pair_empty");

  return {
    days: gated.results,
    pair_gate: gated.pair_gate,
    meta: { model, tokens_used, cost_usd, latency_ms },
    system,
    user: userContent,
    call_trace: buildLabCallTrace({
      phase: "companion_daily_pair",
      system,
      user: userContent,
      user_feed: user,
      result: {
        reasoning: lastReasoning,
        actual_model: model,
        meta: {
          call_type: "matrix_narrative",
          tokens_used,
          latency_ms,
          cost_usd,
          cached_tokens: 0,
          thinking_enabled: thinking_effort !== "off",
          thinking_effort,
          finish_reason: lastFinishReason,
          completion_tokens: lastCompletionTokens,
          prompt_tokens: lastPromptTokens,
          reasoning_tokens: lastReasoningTokens,
          generation_id: lastGenerationId,
        },
      },
      raw_text: lastRaw,
      parsed: lastParsed ?? { days: pairDays },
    }),
  };
}

/** Thin wrapper: one day via pair invoke (length 1). Prefer pair for production fill. */
export async function generateCompanionDayCards(input: {
  brief: CompanionBrief;
  snapshot: AtmosEngineSnapshot;
  dayIndex: number;
  locale: string;
  sessionId: string;
  thinking_effort?: ReasoningEffort;
  priorFingerprints?: string[];
}): Promise<GenerateCompanionDayResult> {
  const pair = await generateCompanionDayPairCards({
    brief: input.brief,
    days: [{ dayIndex: input.dayIndex, snapshot: input.snapshot }],
    locale: input.locale,
    sessionId: input.sessionId,
    thinking_effort: input.thinking_effort,
    priorFingerprints: input.priorFingerprints,
  });
  const first = pair.days[0];
  if (!first) throw new Error("companion_daily_empty");
  return {
    cards: first.cards,
    day_gate: first.day_gate.passed ? pair.pair_gate : first.day_gate,
    meta: pair.meta,
    call_trace: pair.call_trace,
    system: pair.system,
    user: pair.user,
  };
}
