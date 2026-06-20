/** Section headings for Glyph report — follow LLM output language, not page locale. */

export type GlyphReportSectionLabels = {
  eyebrow_about_question: string;
  eyebrow_inner_pattern: string;
  meta_glyph_pattern: string;
  meta_strategy: string;
  alignment_title: string;
  section_classical: string;
  section_dual_view: string;
  view_bazi_title: string;
  view_glyph_title: string;
  section_synthesis: string;
  section_hidden: string;
  section_moment: string;
  section_exploration: string;
  section_reflection: string;
};

const ZH: GlyphReportSectionLabels = {
  eyebrow_about_question: "关于你的问题",
  eyebrow_inner_pattern: "内在纹章",
  meta_glyph_pattern: "Glyph 纹章",
  meta_strategy: "策略",
  alignment_title: "印证与张力",
  section_classical: "这个 Glyph 说什么",
  section_dual_view: "双视角分析",
  view_bazi_title: "从你的性格画像看",
  view_glyph_title: "从 Glyph 的角度看",
  section_synthesis: "整合解读",
  section_hidden: "你可能没看到的",
  section_moment: "你当下的时机",
  section_exploration: "一个小练习",
  section_reflection: "一个值得深思的问题",
};

const EN: GlyphReportSectionLabels = {
  eyebrow_about_question: "About your question",
  eyebrow_inner_pattern: "The inner pattern",
  meta_glyph_pattern: "Glyph pattern",
  meta_strategy: "Strategy",
  alignment_title: "Alignment & tension resolution",
  section_classical: "What this glyph says",
  section_dual_view: "Dual perspective analysis",
  view_bazi_title: "From your profile",
  view_glyph_title: "From the glyph",
  section_synthesis: "The synthesis",
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
