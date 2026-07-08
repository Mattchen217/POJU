/**
 * Block 65 — render-layer layout prep (insert `\n` only; zero character loss).
 * Breaks inline structural markers so parseReadingBlocks can build hierarchy.
 */

/** Strip only newline chars — for layout-preservation checks. */
export function normalizeLayoutWhitespace(text: string): string {
  return text.replace(/[\r\n]+/g, "");
}

/** Insert paragraph breaks before inline structural cues without removing characters. */
export function prepareReadingLayoutText(text: string): string {
  if (!text.trim()) return text;
  let out = text;

  out = out.replace(/(\s*)\*{3}(\s*)/g, (_, before, after) => `${before}\n\n***\n\n${after}`);

  out = out.replace(/([。！？!?…])\s*(>+\s)/g, "$1\n\n$2");
  out = out.replace(/([^\n>])\s+(>+\s)/g, "$1\n\n$2");

  out = out.replace(/([。！？!?…])\s*(###\s)/g, "$1\n\n$2");
  out = out.replace(/([^\n#*\s])\s+(###\s)/g, "$1\n\n$2");

  out = out.replace(/([。！？!?…])\s*(\*\*[^*\n]+:\*\*)/g, "$1\n\n$2");

  out = out.replace(/([^\n])\s+(###\s*Action\s*\d+\s*:)/gi, "$1\n\n$2");

  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}
