/** Match Spline scene — homepage card, hero, analyzing wait. */
export const MATCH_SPLINE_SCENE = "/spline/Match.splinecode";

/** Smaller zoom = wider framing (smaller orbs in frame). */
export const MATCH_SPLINE_CARD_ZOOM = 0.05;
/** Multiplier on orbit radius — card ~300px needs camera much farther than hero. */
export const MATCH_SPLINE_CARD_RADIUS_FACTOR = 9;
/** Must match `.match-card-spline-shell` — size multiplier is `100% / shell scale`. */
export const MATCH_SPLINE_CARD_SHELL_SCALE = 0.3;
/** Horizontal nudge (px) — scene orbs sit slightly left of card center. */
export const MATCH_SPLINE_CARD_OFFSET_X_PX = 14;

/** Camera zoom — smaller = wider framing (less top/bottom crop in canvas). */
export const MATCH_SPLINE_HERO_ZOOM = 0.1;
export const MATCH_SPLINE_HERO_PWA_ZOOM = 0.092;
/**
 * Pre-expand shell scale (see `.match-hero-spline`) — must match CSS var.
 * Larger = bigger on page; do not scale inset:0 directly (clips top/bottom).
 */
export const MATCH_SPLINE_HERO_DISPLAY_SCALE = 0.8;
export const MATCH_SPLINE_HERO_PWA_DISPLAY_SCALE = 0.72;
/** Extra vertical room in shell before scale — keeps particle wisps uncropped. */
export const MATCH_SPLINE_HERO_SHELL_HEIGHT_RATIO = 1.38;
/** Vertical nudge after centering — negative moves up. */
export const MATCH_SPLINE_HERO_SHELL_OFFSET_Y = "0%";

export const MATCH_SPLINE_ANALYZING_ZOOM = 0.11;
export const MATCH_SPLINE_ANALYZING_DISPLAY_SCALE = 0.62;
