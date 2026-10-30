/**
 * Confirmed simp/trad character variants for term lookup.
 * This is NOT a full OpenCC conversion — only the explicit alias table below.
 * Raw caller input must be preserved separately by resolve APIs.
 */

/** Confirmed simplified → traditional pairs used by engines / LLM surfaces. */
export const HAN_SIMP_TO_TRAD: Readonly<Record<string, string>> = {
  门: "門",
  开: "開",
  关: "關",
  宫: "宮",
  阳: "陽",
  阴: "陰",
  伤: "傷",
  惊: "驚",
  腾: "騰",
  辅: "輔",
  兑: "兌",
  离: "離",
  运: "運",
  气: "氣",
  龙: "龍",
  马: "馬",
  鸡: "雞",
  猪: "豬",
  库: "庫",
  纳: "納",
  调: "調",
  时: "時",
  飞: "飛",
};

export const HAN_TRAD_TO_SIMP: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(HAN_SIMP_TO_TRAD).map(([simp, trad]) => [trad, simp]),
);

function mapHanChars(src: string, table: Readonly<Record<string, string>>): string {
  return [...src].map((c) => table[c] ?? c).join("");
}

/**
 * Return exact surface plus confirmed simp↔trad variants.
 * Empty / whitespace-only input → [].
 */
export function termHanVariants(surface: string): string[] {
  const s = surface.trim();
  if (!s) return [];
  return [...new Set([s, mapHanChars(s, HAN_SIMP_TO_TRAD), mapHanChars(s, HAN_TRAD_TO_SIMP)])];
}

/** Normalize for exact match tables; keeps raw separately at call sites. */
export function normalizeTermSurface(raw: string): string {
  return raw.trim();
}
