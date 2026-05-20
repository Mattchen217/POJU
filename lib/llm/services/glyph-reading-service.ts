/**
 * Glyph v5 — DeepSeek full reading (Step 5+).
 * Replaces inline Gemini/OpenRouter logic in `/api/oracle/full-reading`.
 */

import type { SignData } from "@/types/oracle";

export const GLYPH_READING_NOT_WIRED =
  "Glyph v5 reading service not wired yet (implement in Step 5)";

export type GenerateGlyphReadingInput = {
  sign: SignData;
  question: string;
  locale: string;
  /** POJU stored profile id — Step 3+ */
  profile_id?: string;
  /** Legacy birth fields until prepare flow ships */
  user_birth?: {
    year: number;
    month: number;
    day: number;
    shichen: string;
  };
};

export type GlyphReadingServiceResult = {
  reading: Record<string, unknown>;
  meta: {
    model: string;
    tokens_used: number;
    cost_usd: number;
    latency_ms: number;
  };
};

export async function generateGlyphReading(
  _input: GenerateGlyphReadingInput,
): Promise<GlyphReadingServiceResult> {
  throw new Error(GLYPH_READING_NOT_WIRED);
}
