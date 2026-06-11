/** How Glyph works — burst + wind card cycle timings (keep CSS in sync via CSS vars). */
export const GLYPH_HOW_BURST_DURATION_MS = 1350;
export const GLYPH_HOW_CARD_HOLD_MS = 2200;
/** One full cycle: Spline burst → wind card → card removed before next burst. */
export const GLYPH_HOW_CYCLE_MS = GLYPH_HOW_BURST_DURATION_MS + GLYPH_HOW_CARD_HOLD_MS;
