/**
 * Companion day generation — 1 invoke = 1–2 days (pair JSON).
 * Lab: no quality auto-retry. Production medium: at most 1+1 on day/pair gate.
 *
 * Prefix-cache: static system + stable Brief-first user; session_id =
 * companionCacheSessionId(sessionId:locale).
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";
import { companionCacheSessionId } from "@/lib/llm/cache-session-id";
import { DELIVERY_SINGLE_CALL_TIMEOUT_MS } from "@/lib/llm/pro/delivery/delivery-tasks";
import {
  buildLabCallTrace,
  type LabCallTrace,
} from "@/lib/llm/pro/delivery/lab/call-trace";
import type { ReasoningEffort } from "@/lib/llm/router";
import { sanitizeDeepStringFields } from "@/lib/llm/sanitize/compliance-terms";
import { polishDeepStringFields } from "@/lib/llm/sanitize/delivery-grammar-polish";
import {
  auditDeepStringFields,
  isCriticalDeliveryAuditFailure,
} from "@/lib/llm/services/delivery-audit-regen";
import {
  requestJsonWithRepair,
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
    const idx =
      typeof obj.day_index === "number" && Number.isFinite(obj.day_index)
        ? Math.floor(obj.day_index)
        : want;
    if (idx !== want) {
      missing.push(`days[${i}].day_index`);
      continue;
    }
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
): { results: CompanionPairDayResult[]; pair_gate: CompanionDayGateResult } {
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
  const allowQualityRetry = thinking_effort !== "high";
  const cacheSession = companionCacheSessionId(`${input.sessionId}:${locale}`);

  let userContent = user;
  let pairDays: PairDayRaw[] | null = null;
  let model = "";
  let tokens_used = 0;
  let cost_usd = 0;
  let latency_ms = 0;
  let qualityRetried = false;
  let lastResult: Awaited<
    ReturnType<typeof requestJsonWithRepair<{ days: PairDayRaw[] }>>
  >["result"] | null = null;
  let lastParsed: Record<string, unknown> | null = null;
  let lastRaw = "";
  let gated: ReturnType<typeof gatePairDays> | null = null;

  for (let attempt = 0; attempt < (allowQualityRetry ? 2 : 1); attempt++) {
    const out = await requestJsonWithRepair({
      llm: {
        call_type: "matrix_narrative",
        system,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 20_000,
        thinking_effort,
        response_format: "json",
        temperature: qualityRetried ? 0.3 : 0.45,
        session_id: cacheSession,
        phase_name: "companion_daily_pair",
        /** Same wall as delivery page LLM — default OpenRouter fetch is 90s and aborts mid-reasoning (499). */
        timeout_ms: DELIVERY_SINGLE_CALL_TIMEOUT_MS,
      },
      validate: (parsed) => validatePairDays(parsed, expectedIndexes),
      repairHint: (missing) =>
        `Return JSON {"days":[...]} with day_index matching feed (${expectedIndexes.join(",")}). Missing: ${missing.join(", ")}`,
      allowRepair: true,
    });

    pairDays = out.value.days.map((d) => sanitizePairDay(d, locale));
    model = out.result.actual_model;
    tokens_used = out.result.meta.tokens_used;
    cost_usd = out.result.meta.cost_usd;
    latency_ms = out.result.meta.latency_ms;
    lastResult = out.result;
    lastParsed = out.parsed;
    lastRaw = out.result.content;

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

  if (!pairDays || !lastResult || !gated) throw new Error("companion_pair_empty");

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
      result: lastResult,
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
