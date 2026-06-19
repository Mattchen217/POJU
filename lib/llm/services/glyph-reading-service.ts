/**
 * Glyph v5 — full reading via `callLLM({ call_type: 'glyph_reading' })`.
 */

import { glyphCacheSessionId } from "@/lib/llm/cache-session-id";
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
import {
  parseJsonLoose,
  requestJsonWithRepair,
  type JsonValidateResult,
} from "@/lib/llm/services/delivery-resilience";
import { sanitizeDeepStringFields } from "@/lib/llm/sanitize/compliance-terms";
import {
  getStoredProfile,
  recordProfileUsage,
} from "@/lib/profile/stored-profiles-service";
import type { SignData } from "@/types/oracle";
import type { UserProfile } from "@/lib/profile/types";

export const GLYPH_READING_MAX_TOKENS = 15_000;
export const GLYPH_READING_TIMEOUT_MS = 290_000;

export type GlyphDualViewReading = {
  命理看此事: string;
  签文看此事: string;
  两者印证或冲突: string;
};

export type GlyphReadingContent = {
  wind_category_blurb: string;
  classical_voice: string;
  question_response?: string;
  命理双视角: GlyphDualViewReading;
  synthesis?: string;
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
  reading_id?: string;
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

function softFallback(field: string, locale: string): string {
  const zh = locale.startsWith("zh");
  const map: Record<string, [string, string]> = {
    classical_voice: [
      "The sign speaks in its own language — listen for what resonates rather than forcing a single reading.",
      "签文自有其声，先听共鸣，不必急于定于一解。",
    ],
    hidden_tension: [
      "There is tension beneath the surface of this question; naming it clearly will matter more than rushing to resolve it.",
      "问题底下有未说清的张力，先把它说清楚，比急着下结论更重要。",
    ],
    your_moment: [
      "Stay with one small next step rather than solving the whole horizon today.",
      "今天先守住一小步，不必一次解决整个人生方向。",
    ],
    exploration_text: [
      "Take ten quiet minutes to write down what you already know but haven't said aloud.",
      "留十分钟，把心里已知却还没说出口的事实写下来。",
    ],
    reflection_question: [
      "What would you want to remember about how you felt at the end of this reading?",
      "读完这一签，你最想记住的是自己当时的什么感受？",
    ],
    签文看此事: [
      "The sign line points to patience and clarity before action.",
      "签意提醒：先看清时机，再动。",
    ],
    两者印证或冲突: [
      "Chart and sign both ask you to look at timing before committing.",
      "命盘与签文都在提醒：先辨时机，再定取舍。",
    ],
  };
  const pair = map[field];
  if (!pair) {
    return zh ? "此处信息暂缺，可结合上文继续体会。" : "This detail was not fully captured; read it in light of the sections above.";
  }
  return zh ? pair[1] : pair[0];
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

function validateReading(
  parsed: Record<string, unknown>,
  locale: string,
): JsonValidateResult<GlyphReadingContent> {
  const shaped = normalizeGlyphReadingShape(parsed);
  const dualRaw = shaped.命理双视角;
  const dual =
    dualRaw && typeof dualRaw === "object" && !Array.isArray(dualRaw)
      ? (dualRaw as Record<string, unknown>)
      : null;

  const explorationRaw = shaped.exploration;
  const exploration =
    explorationRaw && typeof explorationRaw === "object" && !Array.isArray(explorationRaw)
      ? (explorationRaw as Record<string, unknown>)
      : null;

  const invalid = shaped.invalid_input === true;
  const synthesisText = asString(shaped.synthesis) || asString(shaped.meaning_for_question);

  const reading: GlyphReadingContent = {
    wind_category_blurb: asString(shaped.wind_category_blurb),
    classical_voice: asString(shaped.classical_voice),
    question_response: asString(shaped.question_response) || undefined,
    命理双视角: {
      命理看此事: asString(dual?.命理看此事 ?? dual?.["命理看此事"]),
      签文看此事: asString(dual?.签文看此事 ?? dual?.["签文看此事"]),
      两者印证或冲突: asString(dual?.两者印证或冲突 ?? dual?.["两者印证或冲突"]),
    },
    synthesis: synthesisText || undefined,
    meaning_for_question: synthesisText,
    hidden_tension: asString(shaped.hidden_tension),
    your_moment: asString(shaped.your_moment),
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
    reflection_question: asString(shaped.reflection_question),
    invalid_input: invalid,
    _meta:
      shaped._meta && typeof shaped._meta === "object"
        ? (shaped._meta as Record<string, unknown>)
        : undefined,
  };

  if (invalid) {
    return { ok: true, value: reading };
  }

  const missingCore: string[] = [];
  if (!reading.wind_category_blurb) missingCore.push("wind_category_blurb");
  if (!reading.命理双视角.命理看此事) missingCore.push("命理看此事");
  if (!reading.meaning_for_question) missingCore.push("meaning_for_question");

  if (missingCore.length > 0) {
    return {
      ok: false,
      missing: missingCore,
      message: `Glyph reading missing core fields: ${missingCore.join(", ")}`,
      parsed: shaped,
    };
  }

  if (!reading.classical_voice) {
    reading.classical_voice = softFallback("classical_voice", locale);
    console.warn("[glyph-reading] soft fallback: classical_voice");
  }
  if (!reading.命理双视角.签文看此事) {
    reading.命理双视角.签文看此事 = softFallback("签文看此事", locale);
    console.warn("[glyph-reading] soft fallback: 签文看此事");
  }
  if (!reading.命理双视角.两者印证或冲突) {
    reading.命理双视角.两者印证或冲突 = softFallback("两者印证或冲突", locale);
    console.warn("[glyph-reading] soft fallback: 两者印证或冲突");
  }
  if (!reading.hidden_tension) {
    reading.hidden_tension = softFallback("hidden_tension", locale);
    console.warn("[glyph-reading] soft fallback: hidden_tension");
  }
  if (!reading.your_moment) {
    reading.your_moment = softFallback("your_moment", locale);
    console.warn("[glyph-reading] soft fallback: your_moment");
  }
  if (!reading.exploration.text) {
    reading.exploration.text = softFallback("exploration_text", locale);
    console.warn("[glyph-reading] soft fallback: exploration.text");
  }
  if (!reading.reflection_question) {
    reading.reflection_question = softFallback("reflection_question", locale);
    console.warn("[glyph-reading] soft fallback: reflection_question");
  }

  return { ok: true, value: reading };
}

function finalizeGlyphReading(reading: GlyphReadingContent, locale: string): GlyphReadingContent {
  const violations = auditGlyphReadingContent(reading, locale);
  if (violations.length > 0) {
    logGlyphOutputViolations(violations, "glyph-reading");
  }
  return sanitizeDeepStringFields(reading, locale) as GlyphReadingContent;
}

function buildRepairHint(missing: string[], locale: string): string {
  const fields = missing.join(", ");
  return locale.startsWith("zh")
    ? `上次回复缺失或被截断。请仅补全以下字段并返回【完整】合法 JSON：${fields}。不要省略其他已有字段。`
    : `Previous reply was missing or truncated. Return ONLY complete valid JSON, filling these fields: ${fields}. Keep all other fields intact.`;
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

  const sessionId = glyphCacheSessionId(input.reading_id, input.profile_id);

  console.log(
    `[glyph-reading] Calling DeepSeek (glyph_reading, max_tokens: ${GLYPH_READING_MAX_TOKENS}, session: ${sessionId})...`,
  );

  const { value: reading, result } = await requestJsonWithRepair({
    llm: {
      call_type: "glyph_reading",
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: GLYPH_READING_MAX_TOKENS,
      response_format: "json",
      temperature: 0.55,
      timeout_ms: GLYPH_READING_TIMEOUT_MS,
      session_id: sessionId,
    },
    validate: (parsed) => validateReading(parsed, input.locale),
    repairHint: (missing) => buildRepairHint(missing, input.locale),
  });

  console.info("[glyph-reading] LLM complete", {
    reading_id: input.reading_id ?? null,
    model: result.actual_model,
    tokens_used: result.meta.tokens_used,
    latency_ms: result.meta.latency_ms,
  });

  const finalized = finalizeGlyphReading(reading, input.locale);

  if (typeof window !== "undefined") {
    await recordProfileUsage(input.profile_id, "glyph");
  }

  return {
    reading: finalized,
    meta: {
      model: result.actual_model,
      tokens_used: result.meta.tokens_used,
      cost_usd: result.meta.cost_usd,
      latency_ms: result.meta.latency_ms,
    },
  };
}

export function parseGlyphReadingJson(raw: string): Record<string, unknown> {
  return normalizeGlyphReadingShape(parseJsonLoose(raw));
}
