/** Section headings for Glyph report — follow LLM output language, not page locale. */

export type GlyphReportSectionLabels = {
  section_classical: string;
  section_dual_view: string;
  view_bazi_title: string;
  view_glyph_title: string;
  section_meaning: string;
  section_hidden: string;
  section_moment: string;
  section_exploration: string;
  section_reflection: string;
};

const ZH: GlyphReportSectionLabels = {
  section_classical: "这个 Glyph 说什么",
  section_dual_view: "双视角分析",
  view_bazi_title: "从你的性格画像看",
  view_glyph_title: "从 Glyph 的角度看",
  section_meaning: "针对你的问题",
  section_hidden: "你可能没看到的",
  section_moment: "你当下的时机",
  section_exploration: "一个小练习",
  section_reflection: "一个值得深思的问题",
};

const EN: GlyphReportSectionLabels = {
  section_classical: "What this glyph says",
  section_dual_view: "Dual perspective analysis",
  view_bazi_title: "From your profile",
  view_glyph_title: "From the glyph",
  section_meaning: "For your question",
  section_hidden: "What you may not see",
  section_moment: "Your current moment",
  section_exploration: "A small practice",
  section_reflection: "A question to sit with",
};

export function glyphReportSectionLabels(outputLanguage: string): GlyphReportSectionLabels {
  return outputLanguage.startsWith("zh") ? ZH : EN;
}

export function resolveGlyphOutputLanguage(
  reading: { _meta?: Record<string, unknown> },
  pageLocale: string,
): string {
  const meta = reading._meta?.output_language;
  return typeof meta === "string" && meta.trim() ? meta : pageLocale;
}
