/**
 * Strip internal 用神 retune formulas that leak into user-visible chat.
 * 金木水火土 / WUXING as imagery stay; 「补水补木」-style jargon maps to vernacular.
 */

const RETUNE_JARGON_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/补水补木/g, "重建恢复"],
  [/补木补水/g, "重建恢复"],
  [/补水木/g, "重建恢复"],
];

/** Deterministic scrub for chat / gate prose (zh compounds only). */
export function scrubInternalRetuneJargon(text: string): string {
  if (!text?.trim()) return text ?? "";
  let out = text;
  for (const [re, to] of RETUNE_JARGON_REPLACEMENTS) {
    out = out.replace(re, to);
  }
  return out;
}
