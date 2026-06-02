import type { CSSProperties } from "react";

/** Reference ring diameter (px); on screen uses min(76vmin, 400px) via CSS. */
export const SYNCRO_RING_SIZE = 400;
/** Labels on outer ring; particle ~94% of label diameter (just inside). */
export const SYNCRO_LABEL_RADIUS = Math.round(SYNCRO_RING_SIZE * 0.48);
export const SYNCRO_PARTICLE_DISPLAY_SIZE = Math.round(SYNCRO_RING_SIZE * 0.92);
/**
 * Spline renders into a square WebGL canvas — edges clip in a rectangle, not a circle.
 */
export const SYNCRO_PARTICLE_CANVAS_SIZE = 520;
export const SYNCRO_PARTICLE_DISPLAY_SCALE =
  SYNCRO_PARTICLE_DISPLAY_SIZE / SYNCRO_PARTICLE_CANVAS_SIZE;
export const SYNCRO_PARTICLE_OFFSET_X = 5;
export const SYNCRO_PARTICLE_OFFSET_Y = 0;
export const SYNCRO_CENTER_INFO_WIDTH = 160;
/** AR live camera circle (~52% of ring). */
export const SYNCRO_AR_CAMERA_SIZE = Math.round(SYNCRO_RING_SIZE * 0.52);
export const SYNCRO_MAP_POINT_RADIUS = Math.round(SYNCRO_RING_SIZE * 0.38);
export const SYNCRO_MAP_POINT_SIZE = 12;
export const SYNCRO_RING_MARGIN_TOP = 0;
export const SYNCRO_COMPASS_PAGE_PADDING_TOP = 0;
export const SYNCRO_WHY_BUTTON_MARGIN_TOP = 8;

/** Styles on Spline host — no extra product wrapper div. */
export function getSyncroParticleFieldStyle(options?: { opacity?: number }): CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: SYNCRO_PARTICLE_CANVAS_SIZE,
    height: SYNCRO_PARTICLE_CANVAS_SIZE,
    transform: `translate(calc(-50% + ${SYNCRO_PARTICLE_OFFSET_X}px), calc(-50% + ${SYNCRO_PARTICLE_OFFSET_Y}px)) scale(${SYNCRO_PARTICLE_DISPLAY_SCALE})`,
    transformOrigin: "center center",
    overflow: "visible",
    pointerEvents: "none",
    zIndex: 1,
    ...(options?.opacity !== undefined ? { opacity: options.opacity } : {}),
  };
}
