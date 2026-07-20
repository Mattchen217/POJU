import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

/** Which full Ten Gods appear in this natal chart (for abbreviation expansion). */
export type TenGodContext = {
  hasZhengGuan: boolean;
  hasQiSha: boolean;
  hasShiShen: boolean;
  hasShangGuan: boolean;
  hasBiJian: boolean;
  hasJieCai: boolean;
  hasZhengYin: boolean;
  hasPianYin: boolean;
};

const TEN_GOD_LABELS = [
  "正官",
  "七杀",
  "食神",
  "伤官",
  "比肩",
  "劫财",
  "正印",
  "偏印",
] as const;

type TenGodLabel = (typeof TEN_GOD_LABELS)[number];

function collectLabels(text: string, into: Set<TenGodLabel>): void {
  for (const label of TEN_GOD_LABELS) {
    if (text.includes(label)) into.add(label);
  }
}

/**
 * Extract which Ten Gods appear in this chart.
 * Sources: pillars_detail.ten_god + pattern string (格局 often names gods).
 * If pillars_detail is missing, returns all-false → cleanText falls back to "A与B" dual form.
 */
export function extractTenGodContext(structured: ProfileStructured): TenGodContext {
  const found = new Set<TenGodLabel>();

  const detail = structured.pillars_detail;
  if (detail) {
    for (const pos of ["year", "month", "day", "hour"] as const) {
      const tg = detail[pos]?.ten_god?.trim();
      if (tg) collectLabels(tg, found);
    }
  }

  if (structured.pattern) collectLabels(structured.pattern, found);

  return {
    hasZhengGuan: found.has("正官"),
    hasQiSha: found.has("七杀"),
    hasShiShen: found.has("食神"),
    hasShangGuan: found.has("伤官"),
    hasBiJian: found.has("比肩"),
    hasJieCai: found.has("劫财"),
    hasZhengYin: found.has("正印"),
    hasPianYin: found.has("偏印"),
  };
}
