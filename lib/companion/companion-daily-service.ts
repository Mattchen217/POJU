/**
 * Generate one companion day reminder (macro four slots + evidence).
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
  CompanionDayCardsSchema,
  type CompanionBrief,
  type CompanionDayCards,
} from "./types";

export type GenerateCompanionDayResult = {
  cards: CompanionDayCards;
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
  let userContent = user;
  let cards: CompanionDayCards | null = null;
  let model = "";
  let tokens_used = 0;
  let cost_usd = 0;
  let latency_ms = 0;
  let auditRetried = false;
  let lastResult: Awaited<ReturnType<typeof requestJsonWithRepair<CompanionDayCards>>>["result"] | null =
    null;
  let lastParsed: Record<string, unknown> | null = null;
  let lastRaw = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await requestJsonWithRepair({
      llm: {
        call_type: "matrix_narrative",
        system,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 20_000,
        thinking_effort,
        response_format: "json",
        temperature: auditRetried ? 0.3 : 0.45,
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
    if (isCriticalDeliveryAuditFailure(auditViolations) && !auditRetried) {
      auditRetried = true;
      userContent =
        user +
        (input.locale.startsWith("zh")
          ? "\n\n上一稿不合规：前四段须决策/精力白话（禁气口吉凶恐吓）；evidence 禁引擎字段名与 cueCode，只用能量白话或合法 ⟦t:slug|白话⟧。"
          : "\n\nPrior draft failed compliance: face slots must be decision/energy coaching (no luck/doom); evidence must not echo engine keys/cueCodes — plain digest or legal ⟦t:slug|plain⟧ only.");
      continue;
    }
    break;
  }

  if (!cards || !lastResult) throw new Error("companion_daily_empty");

  const parsedCards = CompanionDayCardsSchema.parse(cards);
  return {
    cards: parsedCards,
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
