/**
 * Glyph v5 — DeepSeek reading prompt (Step 5).
 * Stub until ORIENTAL_COUNSELOR_BASE + base_analysis + full sign text are wired.
 */

export type GlyphPromptSign = {
  id: number;
  name: string;
  wind_category: string;
  classical_text: string;
  modern_translation: string;
  key_themes: string[];
};

export type BuildGlyphReadingPromptInput = {
  profile: unknown;
  question: string;
  glyph: GlyphPromptSign;
  locale: string;
};

export function buildGlyphReadingPrompt(_input: BuildGlyphReadingPromptInput): {
  system: string;
  user: string;
} {
  return {
    system: "",
    user: "",
  };
}
