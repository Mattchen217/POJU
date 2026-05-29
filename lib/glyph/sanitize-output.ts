import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";

/**
 * Display-layer fallback when the model leaks forbidden fortune-telling wording.
 * Compound phrases only for ZH — single 签 is not replaced (may false-positive e.g. 签字).
 */
const REPLACEMENT_MAP_ZH: Array<[RegExp, string]> = [
  [/抽到的签/g, "画出的 Glyph"],
  [/这支签/g, "这个 Glyph"],
  [/这张签/g, "这个 Glyph"],
  [/这只签/g, "这个 Glyph"],
  [/签文/g, "Glyph 文"],
  [/签的含义/g, "Glyph 的含义"],
  [/求签/g, "画 Glyph"],
  [/抽签/g, "画 Glyph"],
  [/解签/g, "读 Glyph"],
  [/卜签/g, "读 Glyph"],
  [/上签/g, "open Glyph"],
  [/中签/g, "flowing Glyph"],
  [/下签/g, "still Glyph"],
  [/灵签/g, "Glyph"],
  [/庙签/g, "Glyph"],
];

const REPLACEMENT_MAP_EN: Array<[RegExp, string]> = [
  [/\bfortune slip\b/gi, "Glyph"],
  [/\bdivine slip\b/gi, "Glyph"],
  [/\blot drawing\b/gi, "Glyph reading"],
  [/\bdrawing lots\b/gi, "drawing a Glyph"],
  [/\bdivination\b/gi, "reading"],
  [/\boracle\b/gi, "Glyph"],
  [/\boracle bone\b/gi, "Glyph pattern"],
  [/\bcasting lots\b/gi, "drawing a Glyph"],
];

function replacementMapForLocale(locale: string): Array<[RegExp, string]> {
  return locale.startsWith("zh") ? REPLACEMENT_MAP_ZH : REPLACEMENT_MAP_EN;
}

export function sanitizeGlyphOutput(text: string, locale: string): string {
  let result = text;
  const map = replacementMapForLocale(locale);

  for (const [pattern, replacement] of map) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/** Sanitize all user-visible strings in a Glyph reading payload. */
export function sanitizeGlyphReadingContent(
  reading: GlyphReadingContent,
  locale: string,
): GlyphReadingContent {
  const s = (text: string) => sanitizeGlyphOutput(text, locale);

  return {
    ...reading,
    wind_category_blurb: s(reading.wind_category_blurb),
    classical_voice: s(reading.classical_voice),
    命理双视角: {
      命理看此事: s(reading.命理双视角.命理看此事),
      签文看此事: s(reading.命理双视角.签文看此事),
      两者印证或冲突: s(reading.命理双视角.两者印证或冲突),
    },
    meaning_for_question: s(reading.meaning_for_question),
    hidden_tension: s(reading.hidden_tension),
    your_moment: s(reading.your_moment),
    exploration: {
      ...reading.exploration,
      text: s(reading.exploration.text),
      duration_estimate: s(reading.exploration.duration_estimate),
    },
    reflection_question: s(reading.reflection_question),
  };
}
