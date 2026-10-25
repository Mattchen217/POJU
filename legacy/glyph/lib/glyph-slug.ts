/**
 * Glyph palace slugs — `gp_` prefix isolates from bazi branch_zi etc.
 */

import type { GlyphLevel } from "@/types/oracle";

export const GLYPH_PALACE_SLUG = {
  子: "gp_zi",
  丑: "gp_chou",
  寅: "gp_yin",
  卯: "gp_mao",
  辰: "gp_chen",
  巳: "gp_si",
  午: "gp_wu",
  未: "gp_wei",
  申: "gp_shen",
  酉: "gp_you",
  戌: "gp_xu",
  亥: "gp_hai",
} as const;

/** Glyph wind levels — already used as SignData.level slugs. */
export const GLYPH_LEVEL_SLUG: Record<GlyphLevel, GlyphLevel> = {
  divine_tailwind: "divine_tailwind",
  fair_sky: "fair_sky",
  still_water: "still_water",
  crosswind: "crosswind",
  eye_of_storm: "eye_of_storm",
};

export type GlyphPalaceTraditional = keyof typeof GLYPH_PALACE_SLUG;
