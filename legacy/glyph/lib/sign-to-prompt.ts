import { LEVEL_META } from "@/types/oracle";
import type { SignData } from "@/types/oracle";
import type { GlyphPromptSign } from "@/lib/llm/prompts/glyph-deepseek-prompt";

/** Map `signs.json` row → prompt payload (full `raw_md_content` preserved). */
export function signDataToPromptGlyph(sign: SignData): GlyphPromptSign {
  const meta = LEVEL_META[sign.level];
  const verse = sign.verse_lines_en?.join("\n") ?? "";
  const themes: string[] = [
    meta.display_name,
    meta.subtitle,
    sign.jixiong_zh ? `吉凶: ${sign.jixiong_zh}` : "",
    sign.palace_zh ? `宫位: ${sign.palace_zh}` : "",
    sign.story_figure ? `典故: ${sign.story_figure}` : "",
  ].filter(Boolean);

  return {
    id: sign.sign_number,
    name: sign.story_figure ? `${sign.story_figure} · #${sign.sign_number}` : `Glyph #${sign.sign_number}`,
    wind_category: meta.display_name,
    classical_text: sign.raw_md_content,
    modern_translation: [sign.summary_line_en, verse].filter(Boolean).join("\n\n"),
    key_themes: themes,
  };
}
