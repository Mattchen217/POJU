/** Match Spline scene — homepage card, hero, analyzing wait. */
export const MATCH_SPLINE_SCENE = "/spline/Match.splinecode";

/** Smaller zoom = wider framing; card viewport is tiny — pull back far below hero (0.11). */
export const MATCH_SPLINE_CARD_ZOOM = 0.018;
export const MATCH_SPLINE_HERO_ZOOM = 0.11;
/** CSS scale on desktop hero — shrinks footprint without changing camera zoom. */
export const MATCH_SPLINE_HERO_DISPLAY_SCALE = 0.62;
/** PWA hero — full-bleed background; zoom only (no CSS scale box). */
export const MATCH_SPLINE_HERO_PWA_ZOOM = 0.035;
/** Deprecated on PWA — use zoom-only framing; kept at 1 so hero is not shrunk into a center box. */
export const MATCH_SPLINE_HERO_PWA_DISPLAY_SCALE = 1;
export const MATCH_SPLINE_ANALYZING_ZOOM = 0.11;
export const MATCH_SPLINE_ANALYZING_DISPLAY_SCALE = 0.62;
