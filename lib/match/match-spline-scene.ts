/** Match Spline scene — homepage card, hero, analyzing wait. */
export const MATCH_SPLINE_SCENE = "/spline/Match.splinecode";

/** How Match works band — red/green orbs convergence. */
export const MATCH_HOW_WORKS_SPLINE_SCENE = "/spline/Red%20and%20green%20balls.splinecode";
/** Smaller zoom = wider framing / camera farther back. */
export const MATCH_HOW_WORKS_SPLINE_ZOOM = 0.118;
export const MATCH_HOW_WORKS_SPLINE_RADIUS_FACTOR = 3.2;
/** Shift all scene objects (+X) — may be overridden by Spline animation; use SCENE_PAN_X for display. */
export const MATCH_HOW_WORKS_SPLINE_CONTENT_OFFSET_X = 750;
export const MATCH_HOW_WORKS_SPLINE_CONTENT_OFFSET_Y = 0;
/** Canvas wrapper pan — primary horizontal positioning control (screen pixels). */
export const MATCH_HOW_WORKS_SPLINE_SCENE_PAN_X = "150px";
/** Scale canvas around center — does not change pan offset. */
export const MATCH_HOW_WORKS_SPLINE_SCENE_SCALE = 1.1;
/**
 * Pre-expand shell then scale down (see `.match-how-works-spline__shell`).
 * Avoids clipping wisps at container edges.
 */
export const MATCH_HOW_WORKS_SPLINE_DISPLAY_SCALE = 0.58;
export const MATCH_HOW_WORKS_SPLINE_SHELL_HEIGHT_RATIO = 1.62;
export const MATCH_HOW_WORKS_SPLINE_SHELL_OFFSET_X = "0px";
export const MATCH_HOW_WORKS_SPLINE_SHELL_OFFSET_Y = "-2%";

/** Analyzing wait — narrower container; less pan so green orb is not clipped. */
export const MATCH_ANALYZING_ORBS_SCENE_PAN_X = "145px";
export const MATCH_ANALYZING_ORBS_SCENE_SCALE = 1.05;
export const MATCH_ANALYZING_ORBS_DISPLAY_SCALE = 0.52;
export const MATCH_ANALYZING_ORBS_SHELL_HEIGHT_RATIO = 1.62;
export const MATCH_ANALYZING_ORBS_SHELL_OFFSET_X = "0px";
export const MATCH_ANALYZING_ORBS_SHELL_OFFSET_Y = "-2%";

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
export const MATCH_SPLINE_HERO_PWA_ZOOM = 0.078;
export const MATCH_SPLINE_HERO_RADIUS_FACTOR = 1.15;
export const MATCH_SPLINE_HERO_PWA_RADIUS_FACTOR = 2.8;
/**
 * Pre-expand shell scale (see `.match-hero-spline`) — must match CSS var.
 * Larger = bigger on page; do not scale inset:0 directly (clips top/bottom).
 */
export const MATCH_SPLINE_HERO_DISPLAY_SCALE = 0.8;
export const MATCH_SPLINE_HERO_PWA_DISPLAY_SCALE = 0.68;
/** Extra vertical room in shell before scale — keeps particle wisps uncropped. */
export const MATCH_SPLINE_HERO_SHELL_HEIGHT_RATIO = 1.38;
export const MATCH_SPLINE_HERO_SHELL_WIDTH_RATIO = 1.35;
export const MATCH_SPLINE_HERO_PWA_SHELL_WIDTH_RATIO = 1.55;
/** Vertical nudge after centering — negative moves up. */
export const MATCH_SPLINE_HERO_SHELL_OFFSET_Y = "0%";

export const MATCH_SPLINE_ANALYZING_ZOOM = 0.11;
export const MATCH_SPLINE_ANALYZING_DISPLAY_SCALE = 0.62;
