/**
 * Generate one companion day reminder (macro four slots + evidence).
 * Lab: no quality auto-retry — day_gate returned for Lab dump.
 * Production (medium): at most 1+1 on day_gate / critical audit.
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";
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

import { buildCompanionDailyPrompt } from "./companion-daily-prompt";
import { sanitizeCompanionEvidenceMarkers } from "./energy-digest";
import {
  gateCompanionDay,
  type CompanionDayGateResult,
} from "./gate-companion-day";
import {
  CompanionDayCardsSchema,
  type CompanionBrief,
  type CompanionDayCards,
} from "./types";

export type GenerateCompanionDayResult = {
  cards: CompanionDayCards;
  day_gate: CompanionDayGateResult;
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

function validateCards(parsed: Record<string, unknown>): JsonValidateResult<CompanionDayCards> {
  const result = CompanionDayCardsSchema.safeParse(parsed);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".") || "cards");
    return {
      ok: false,
      missing,
      message: `companion_cards_invalid:${missing.join(",")}`,
      parsed,
    };
  }
  return { ok: true, value: result.data };
}

/** Audit face slots only — evidence may keep closed-set ⟦t:⟧ terms. */
function faceForAudit(cards: CompanionDayCards): Record<string, string> {
  return {
    today_is: cards.today_is,
    suitable: cards.suitable,
    unsuitable: cards.unsuitable,
    suggestion: cards.suggestion,
  };
}

export async function generateCompanionDayCards(input: {
  brief: CompanionBrief;
  snapshot: AtmosEngineSnapshot;
  dayIndex: number;
  locale: string;
  sessionId: string;
  thinking_effort?: ReasoningEffort;
  /** Neighbor today_is fingerprints — anti near-clone across days. */
  priorFingerprints?: string[];
}): Promise<GenerateCompanionDayResult> {
  const { system, user } = buildCompanionDailyPrompt({
    brief: input.brief,
    snapshot: input.snapshot,
    dayIndex: input.dayIndex,
    locale: input.locale,
    priorFingerprints: input.priorFingerprints,
  });

  const thinking_effort: ReasoningEffort = input.thinking_effort ?? "medium";
  /** Lab uses high — hard-stop on quality fail (no auto retry). Prod medium may 1+1. */
  const allowQualityRetry = thinking_effort !== "high";
  let userContent = user;
  let cards: CompanionDayCards | null = null;
  let model = "";
  let tokens_used = 0;
  let cost_usd = 0;
  let latency_ms = 0;
  let qualityRetried = false;
  let lastResult: Awaited<ReturnType<typeof requestJsonWithRepair<CompanionDayCards>>>["result"] | null =
    null;
  let lastParsed: Record<string, unknown> | null = null;
  let lastRaw = "";
  let day_gate: CompanionDayGateResult = { passed: true };

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
        session_id: input.sessionId,
        phase_name: "companion_daily",
      },
      validate: validateCards,
      repairHint: (missing) =>
        `Return valid JSON with today_is, suitable, unsuitable, suggestion, evidence. Missing: ${missing.join(", ")}`,
      allowRepair: true,
    });

    cards = sanitizeDeepStringFields(out.value, input.locale) as CompanionDayCards;
    cards = polishDeepStringFields(cards, input.locale) as CompanionDayCards;
    cards = {
      ...cards,
      evidence: sanitizeCompanionEvidenceMarkers(cards.evidence),
    };
    model = out.result.actual_model;
    tokens_used = out.result.meta.tokens_used;
    cost_usd = out.result.meta.cost_usd;
    latency_ms = out.result.meta.latency_ms;
    lastResult = out.result;
    lastParsed = out.parsed;
    lastRaw = out.result.content;

    const auditViolations = auditDeepStringFields(
      faceForAudit(cards),
      input.locale,
      "syncro",
    );
    day_gate = gateCompanionDay({
      cards,
      dayIndex: input.dayIndex,
      locale: input.locale,
    });

    const qualityFail =
      isCriticalDeliveryAuditFailure(auditViolations) || !day_gate.passed;

    if (qualityFail && allowQualityRetry && !qualityRetried) {
      qualityRetried = true;
      const zh = input.locale.startsWith("zh");
      userContent =
        user +
        (zh
          ? `\n\n上一稿不合格（${day_gate.failed_rule ?? "audit"}）：禁绿/红数字与「对齐+盖章」万能骨架；中/后段 suggestion 须吃窗阶段；前四段决策陪练白话；evidence 只用能量白话或合法 ⟦t:slug|白话⟧。`
          : `\n\nPrior draft failed (${day_gate.failed_rule ?? "audit"}): ban green/red integers and alignment/stamp skeleton; mid/late suggestion must match window phase; face slots = coaching; evidence = plain digest or legal ⟦t:slug|plain⟧.`);
      continue;
    }
    break;
  }

  if (!cards || !lastResult) throw new Error("companion_daily_empty");

  const parsedCards = CompanionDayCardsSchema.parse(cards);
  day_gate = gateCompanionDay({
    cards: parsedCards,
    dayIndex: input.dayIndex,
    locale: input.locale,
  });

  return {
    cards: parsedCards,
    day_gate,
    meta: { model, tokens_used, cost_usd, latency_ms },
    system,
    user: userContent,
    call_trace: buildLabCallTrace({
      phase: "companion_daily",
      system,
      user: userContent,
      user_feed: user,
      result: lastResult,
      raw_text: lastRaw,
      parsed: lastParsed ?? parsedCards,
    }),
  };
}
