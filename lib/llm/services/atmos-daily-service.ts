/**
 * Atmos daily reading — engine snapshot → coaching copy via callLLM.
 */

import { z } from "zod";

import {
  AtmosEngineSnapshotSchema,
  type AtmosEngineSnapshot,
} from "@/lib/atmos/build-atmos-engine-snapshot";
import { atmosCacheSessionId } from "@/lib/llm/cache-session-id";
import { buildAtmosDailyPrompt } from "@/lib/llm/prompts/atmos-daily-prompt";
import { callLLM } from "@/lib/llm/router";
import {
  auditDeepStringFields,
  buildAuditRegenHint,
  isCriticalDeliveryAuditFailure,
} from "@/lib/llm/services/delivery-audit-regen";
import {
  parseJsonLoose,
  requestJsonWithRepair,
  type JsonValidateResult,
} from "@/lib/llm/services/delivery-resilience";
import { sanitizeDeepStringFields } from "@/lib/llm/sanitize/compliance-terms";
import { polishDeepStringFields } from "@/lib/llm/sanitize/delivery-grammar-polish";

export const AtmosDailyReadingSchema = z.object({
  field_tone: z.string().min(1),
  what_to_watch: z.string().min(1),
  one_move: z.string().min(1),
});

export type AtmosDailyReadingContent = z.infer<typeof AtmosDailyReadingSchema>;

export type GenerateAtmosDailyInput = {
  snapshot: AtmosEngineSnapshot;
  locale: string;
  profileId?: string;
  userQuestion?: string;
};

export type GenerateAtmosDailyResult = {
  reading: AtmosDailyReadingContent;
  fullText: string;
  meta: {
    model: string;
    tokens_used: number;
    cost_usd: number;
    latency_ms: number;
  };
};

function formatFullText(reading: AtmosDailyReadingContent, locale: string): string {
  const zh = locale.startsWith("zh");
  if (zh) {
    return `### 场域基调\n${reading.field_tone}\n\n### 今日留意\n${reading.what_to_watch}\n\n### 一个动作\n${reading.one_move}`;
  }
  return `### Field tone\n${reading.field_tone}\n\n### What to watch\n${reading.what_to_watch}\n\n### One move\n${reading.one_move}`;
}

function validateReading(parsed: Record<string, unknown>): JsonValidateResult<AtmosDailyReadingContent> {
  const result = AtmosDailyReadingSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      missing: ["field_tone", "what_to_watch", "one_move"],
      message: result.error.message,
      parsed,
    };
  }
  return { ok: true, value: result.data };
}

export async function generateAtmosDailyReading(
  input: GenerateAtmosDailyInput,
): Promise<GenerateAtmosDailyResult> {
  const snapshot = AtmosEngineSnapshotSchema.parse(input.snapshot);
  const { system, user } = buildAtmosDailyPrompt({
    snapshot,
    locale: input.locale,
    userQuestion: input.userQuestion,
  });

  const sessionId = atmosCacheSessionId(
    input.profileId?.trim() || "anon",
    snapshot.asOf.baziDayDate,
  );

  let userContent = user;
  let reading: AtmosDailyReadingContent | null = null;
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
        max_tokens: 2000,
        thinking_effort: "off",
        response_format: "json",
        temperature: auditRetried ? 0.3 : 0.45,
        session_id: sessionId,
        phase_name: "atmos_daily",
      },
      validate: validateReading,
      repairHint: (missing) =>
        `Return valid JSON with keys: ${missing.join(", ")}. No markdown fences.`,
      allowRepair: true,
    });

    reading = sanitizeDeepStringFields(out.value, input.locale) as AtmosDailyReadingContent;
    reading = polishDeepStringFields(reading, input.locale) as AtmosDailyReadingContent;
    model = out.result.actual_model;
    tokens_used = out.result.meta.tokens_used;
    cost_usd = out.result.meta.cost_usd;
    latency_ms = out.result.meta.latency_ms;

    const auditViolations = auditDeepStringFields(reading, input.locale, "syncro");
    if (isCriticalDeliveryAuditFailure(auditViolations) && !auditRetried) {
      auditRetried = true;
      userContent = user + buildAuditRegenHint(auditViolations, input.locale);
      continue;
    }
    break;
  }

  if (!reading) {
    throw new Error("atmos_daily_empty");
  }

  return {
    reading,
    fullText: formatFullText(reading, input.locale),
    meta: { model, tokens_used, cost_usd, latency_ms },
  };
}

/** Re-export for tests / probe. */
export { parseJsonLoose };
