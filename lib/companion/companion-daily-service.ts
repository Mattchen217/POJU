/**
 * Generate primary/backup dual cards for one companion day.
 */

import type { AtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";
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

export async function generateCompanionDayCards(input: {
  brief: CompanionBrief;
  snapshot: AtmosEngineSnapshot;
  dayIndex: number;
  locale: string;
  sessionId: string;
}): Promise<GenerateCompanionDayResult> {
  const { system, user } = buildCompanionDailyPrompt({
    brief: input.brief,
    snapshot: input.snapshot,
    dayIndex: input.dayIndex,
    locale: input.locale,
  });

  let userContent = user;
  let cards: CompanionDayCards | null = null;
  let model = "";
  let tokens_used = 0;
  let cost_usd = 0;
  let latency_ms = 0;
  let auditRetried = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await requestJsonWithRepair({
      llm: {
        call_type: "matrix_narrative",
        system,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 20_000,
        thinking_effort: "off",
        response_format: "json",
        temperature: auditRetried ? 0.3 : 0.45,
        session_id: input.sessionId,
        phase_name: "companion_daily",
      },
      validate: validateCards,
      repairHint: (missing) =>
        `Return valid JSON with primary/backup field_tone, against_plan, one_move. Missing: ${missing.join(", ")}`,
      allowRepair: true,
    });

    cards = sanitizeDeepStringFields(out.value, input.locale) as CompanionDayCards;
    cards = polishDeepStringFields(cards, input.locale) as CompanionDayCards;
    model = out.result.actual_model;
    tokens_used = out.result.meta.tokens_used;
    cost_usd = out.result.meta.cost_usd;
    latency_ms = out.result.meta.latency_ms;

    const auditViolations = auditDeepStringFields(cards, input.locale, "syncro");
    if (isCriticalDeliveryAuditFailure(auditViolations) && !auditRetried) {
      auditRetried = true;
      userContent =
        user +
        (input.locale.startsWith("zh")
          ? "\n\n上一稿含违规专名，请用生活白话重写连接，保留双卡结构。"
          : "\n\nPrior draft had jargon leaks. Rewrite connectives in plain language; keep dual-card JSON.");
      continue;
    }
    break;
  }

  if (!cards) throw new Error("companion_daily_empty");

  return {
    cards: CompanionDayCardsSchema.parse(cards),
    meta: { model, tokens_used, cost_usd, latency_ms },
  };
}
