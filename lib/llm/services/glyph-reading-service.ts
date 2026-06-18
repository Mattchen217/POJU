/**
 * Glyph v5 — full reading via `callLLM({ call_type: 'glyph_reading' })`.
 */

import { signDataToPromptGlyph } from "@/lib/glyph/sign-to-prompt";
import { loadGlyphBySignData } from "@/lib/glyph/load-glyph";
import {
  auditGlyphReadingContent,
  logGlyphOutputViolations,
} from "@/lib/glyph/sanitize-output";
import { normalizeGlyphReadingShape } from "@/lib/glyph/reading-response";
import { buildGlyphReadingPrompt } from "@/lib/llm/prompts/glyph-deepseek-prompt";
import {
  hasBaseAnalysisPayload,
  normalizeBaseAnalysisInput,
} from "@/lib/llm/prompts/base-analysis-context";
import { callLLM } from "@/lib/llm/router";
import {
  getStoredProfile,
  recordProfileUsage,
} from "@/lib/profile/stored-profiles-service";
import type { SignData } from "@/types/oracle";
import type { UserProfile } from "@/lib/profile/types";

/** Prior cap 3000 caused finish_reason:length — truncated JSON, client retry + double billing. */
export const GLYPH_READING_MAX_TOKENS = 15_000;
/** Match Vercel route maxDuration (300s); leave headroom for parse + JSON response. */
export const GLYPH_READING_TIMEOUT_MS = 290_000;

export type GlyphDualViewReading = {
  命理看此事: string;
  签文看此事: string;
  两者印证或冲突: string;
};

export type GlyphReadingContent = {
  wind_category_blurb: string;
  classical_voice: string;
  /** Direct answer to the user's draw question (v5.1+). */
  question_response?: string;
  命理双视角: GlyphDualViewReading;
  meaning_for_question: string;
  hidden_tension: string;
  your_moment: string;
  exploration: {
    text: string;
    timeframe: "today" | "tonight" | "within_24h" | "this_week";
    duration_estimate: string;
    is_solo: boolean;
  };
  reflection_question: string;
  invalid_input?: boolean;
  _meta?: Record<string, unknown>;
};

export type GenerateGlyphReadingInput = {
  sign: SignData;
  question: string;
  locale: string;
  profile_id: string;
  /** Idempotency / logging — same draw session should not re-bill on client retry. */
  reading_id?: string;
  /** Required for server API — client loads from IndexedDB and sends. */
  user_profile?: UserProfile | null;
  base_analysis?: unknown | null;
};

export type GlyphReadingServiceResult = {
  reading: GlyphReadingContent;
  meta: {
    model: string;
    tokens_used: number;
    cost_usd: number;
    latency_ms: number;
  };
};

function parseJsonContent(raw: string): unknown {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/g, "")
    .trim();
  return JSON.parse(cleaned) as unknown;
}

function extractJsonObject(raw: string): string {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return cleaned.slice(start, end + 1);
  }
  return cleaned;
}

async function resolveProfileBundle(input: GenerateGlyphReadingInput): Promise<{
  user_profile: UserProfile;
  base_analysis: unknown;
}> {
  if (input.user_profile && input.base_analysis != null) {
    return { user_profile: input.user_profile, base_analysis: input.base_analysis };
  }

  if (typeof window !== "undefined" && input.profile_id) {
    const row = await getStoredProfile(input.profile_id);
    if (row?.user_profile && hasBaseAnalysisPayload(normalizeBaseAnalysisInput(row.base_analysis))) {
      return {
        user_profile: row.user_profile,
        base_analysis: row.base_analysis,
      };
    }
  }

  throw new Error(
    "Profile has no base_analysis. Complete /glyph/draw preparation first, or pass user_profile + base_analysis in the request.",
  );
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function validateReading(parsed: Record<string, unknown>): GlyphReadingContent {
  const dualRaw = parsed.命理双视角;
  const dual =
    dualRaw && typeof dualRaw === "object" && !Array.isArray(dualRaw)
      ? (dualRaw as Record<string, unknown>)
      : null;

  const explorationRaw = parsed.exploration;
  const exploration =
    explorationRaw && typeof explorationRaw === "object" && !Array.isArray(explorationRaw)
      ? (explorationRaw as Record<string, unknown>)
      : null;

  const invalid = parsed.invalid_input === true;

  const reading: GlyphReadingContent = {
    wind_category_blurb: asString(parsed.wind_category_blurb),
    classical_voice: asString(parsed.classical_voice),
    question_response:
      asString(parsed.question_response) || asString(parsed.meaning_for_question) || undefined,
    命理双视角: {
      命理看此事: asString(dual?.命理看此事 ?? dual?.["命理看此事"]),
      签文看此事: asString(dual?.签文看此事 ?? dual?.["签文看此事"]),
      两者印证或冲突: asString(dual?.两者印证或冲突 ?? dual?.["两者印证或冲突"]),
    },
    meaning_for_question: asString(parsed.meaning_for_question),
    hidden_tension: asString(parsed.hidden_tension),
    your_moment: asString(parsed.your_moment),
    exploration: {
      text: asString(exploration?.text),
      timeframe: (["today", "tonight", "within_24h", "this_week"].includes(
        asString(exploration?.timeframe),
      )
        ? asString(exploration?.timeframe)
        : "today") as GlyphReadingContent["exploration"]["timeframe"],
      duration_estimate: asString(exploration?.duration_estimate) || "10 minutes",
      is_solo: exploration?.is_solo !== false,
    },
    reflection_question: asString(parsed.reflection_question),
    invalid_input: invalid,
    _meta:
      parsed._meta && typeof parsed._meta === "object"
        ? (parsed._meta as Record<string, unknown>)
        : undefined,
  };

  if (!reading.wind_category_blurb) {
    throw new Error("Glyph reading missing wind_category_blurb");
  }

  if (!invalid) {
    if (
      !reading.classical_voice ||
      !reading.命理双视角.命理看此事 ||
      !reading.命理双视角.签文看此事 ||
      !reading.命理双视角.两者印证或冲突 ||
      !reading.meaning_for_question ||
      !reading.hidden_tension ||
      !reading.your_moment ||
      !reading.exploration.text ||
      !reading.reflection_question
    ) {
      console.error("[glyph-reading] validateReading missing fields", {
        classical_voice: Boolean(reading.classical_voice),
        dual_bazi: Boolean(reading.命理双视角.命理看此事),
        dual_glyph: Boolean(reading.命理双视角.签文看此事),
        dual_resonance: Boolean(reading.命理双视角.两者印证或冲突),
        meaning: Boolean(reading.meaning_for_question),
        hidden: Boolean(reading.hidden_tension),
        moment: Boolean(reading.your_moment),
        exploration: Boolean(reading.exploration.text),
        reflection: Boolean(reading.reflection_question),
      });
      throw new Error("Glyph reading missing required fields");
    }
  }

  return reading;
}

async function requestGlyphReadingJson(
  system: string,
  user: string,
  readingId?: string,
): Promise<{ content: string; actual_model: string; meta: GlyphReadingServiceResult["meta"] }> {
  const result = await callLLM({
    call_type: "glyph_reading",
    system,
    messages: [{ role: "user", content: user }],
    max_tokens: GLYPH_READING_MAX_TOKENS,
    thinking_effort: "low",
    response_format: "json",
    temperature: 0.55,
    timeout_ms: GLYPH_READING_TIMEOUT_MS,
  });

  console.info("[glyph-reading] LLM complete", {
    reading_id: readingId ?? null,
    model: result.actual_model,
    tokens_used: result.meta.tokens_used,
    latency_ms: result.meta.latency_ms,
    content_chars: result.content.length,
  });

  return {
    content: result.content,
    actual_model: result.actual_model,
    meta: {
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      cost_usd: result.meta.cost_usd,
      latency_ms: result.meta.latency_ms,
    },
  };
}

function parseReadingRecord(raw: string): Record<string, unknown> {
  try {
    return normalizeGlyphReadingShape(parseJsonContent(raw) as Record<string, unknown>);
  } catch (firstError) {
    try {
      return normalizeGlyphReadingShape(
        parseJsonContent(extractJsonObject(raw)) as Record<string, unknown>,
      );
    } catch {
      throw firstError;
    }
  }
}

function finalizeGlyphReading(
  reading: GlyphReadingContent,
  locale: string,
): GlyphReadingContent {
  const violations = auditGlyphReadingContent(reading, locale);
  if (violations.length > 0) {
    logGlyphOutputViolations(violations, "glyph-reading");
  }
  return reading;
}

export async function generateGlyphReading(
  input: GenerateGlyphReadingInput,
): Promise<GlyphReadingServiceResult> {
  if (!input.profile_id?.trim()) {
    throw new Error("profile_id is required");
  }

  const { user_profile, base_analysis } = await resolveProfileBundle(input);
  const sign = loadGlyphBySignData(input.sign);
  const glyph = signDataToPromptGlyph(sign);

  const { system, user } = buildGlyphReadingPrompt({
    profile: user_profile,
    base_analysis,
    question: input.question.trim(),
    glyph,
    locale: input.locale,
  });

  console.log(
    `[glyph-reading] Calling DeepSeek (glyph_reading, max_tokens: ${GLYPH_READING_MAX_TOKENS}, timeout_ms: ${GLYPH_READING_TIMEOUT_MS})...`,
  );

  const llm = await requestGlyphReadingJson(system, user, input.reading_id);

  let parsed: Record<string, unknown>;
  try {
    parsed = parseReadingRecord(llm.content);
  } catch (e) {
    console.error("[glyph-reading] JSON parse failed:", e);
    console.error("[glyph-reading] Raw (first 800):", llm.content.slice(0, 800));
    console.error("[glyph-reading] Raw (last 400):", llm.content.slice(-400));
    throw new Error("Glyph reading output is not valid JSON");
  }

  let reading = validateReading(parsed);
  reading = finalizeGlyphReading(reading, input.locale);

  if (typeof window !== "undefined") {
    await recordProfileUsage(input.profile_id, "glyph");
  }

  return {
    reading,
    meta: llm.meta,
  };
}
