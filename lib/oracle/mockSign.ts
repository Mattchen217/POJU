import type { GlyphLevel, SignData } from "@/types/oracle";

/** 无 signs.json 时用于预览 / 开发占位（勿用于生产抽签） */
export function mockSignForLevel(level: GlyphLevel, signNumber: number): SignData {
  return {
    sign_number: signNumber,
    level,
    verse_lines_en: [
      "The path ahead asks for patience, not haste,",
      "Yet motion stirs beneath a quiet face.",
      "What you seek is forming out of sight—",
      "Trust the rhythm; align with inner light.",
    ],
    summary_line_en:
      "A mirror for this moment: stay honest, stay present, and let clarity arrive in its own hour.",
    raw_md_content: "[preview-only placeholder for RAG]",
  };
}

export const PREVIEW_LEVEL_ORDER: GlyphLevel[] = [
  "divine_tailwind",
  "fair_sky",
  "still_water",
  "crosswind",
  "eye_of_storm",
];
