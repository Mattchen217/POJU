/**
 * Term polarity for delivery UI coloring (favorable / neutral / caution).
 * @see Cursor 指令 - Glyph 交付页 UI 重排
 */

import { CLOSED_SET_SLUG, relationPolarityToken } from "@/lib/glossary/term-closed-set";
import { TEN_GOD_NATURE } from "@/lib/match/data/stems-branches";

export type TermPolarity = "favorable" | "neutral" | "caution";

const HAN_TO_SLUG = CLOSED_SET_SLUG;

const FAVORABLE_HAN = new Set([
  "用神",
  "喜神",
  "食神",
  "正财",
  "正官",
  "正印",
  "天乙贵人",
  "禄神",
  "文昌",
  "桃花",
  "驿马",
  "六合",
  "三合",
]);

const CAUTION_HAN = new Set([
  "飞刃",
  "羊刃",
  "忌神",
  "七杀",
  "劫财",
  "伤官",
  "六冲",
  "三刑",
  "六害",
  "孤辰",
  "寡宿",
]);

function slugFromHan(han: string): string | undefined {
  return HAN_TO_SLUG[han];
}

const FAVORABLE_SLUGS = new Set(
  [...FAVORABLE_HAN].map((h) => slugFromHan(h)).filter(Boolean) as string[],
);
const CAUTION_SLUGS = new Set(
  [...CAUTION_HAN].map((h) => slugFromHan(h)).filter(Boolean) as string[],
);

for (const [han, meta] of Object.entries(TEN_GOD_NATURE)) {
  const slug = slugFromHan(han);
  if (!slug) continue;
  if (meta.category === "helpful") FAVORABLE_SLUGS.add(slug);
  else if (meta.category === "challenging") CAUTION_SLUGS.add(slug);
}

/** Structural ids always favorable/caution regardless of han map. */
FAVORABLE_SLUGS.add("yong_shen");
FAVORABLE_SLUGS.add("favorable_element");
CAUTION_SLUGS.add("unfavorable_element");
CAUTION_SLUGS.add("fei_ren");

export function termPolarityById(termId: string): TermPolarity {
  const rel = relationPolarityToken(termId);
  if (rel === "green") return "favorable";
  if (rel === "red") return "caution";
  if (rel === "gold") return "neutral";

  if (CAUTION_SLUGS.has(termId)) return "caution";
  if (FAVORABLE_SLUGS.has(termId)) return "favorable";
  return "neutral";
}
