import type { CSSProperties } from "react";

/** Syncro ring layout — fixed px (change only with product doc). */
/** On-screen ring diameter (px) — compact for single-page compass stack. */
export const SYNCRO_RING_SIZE = 300;
/**
 * Spline renders into a square WebGL canvas — edges clip in a rectangle, not a circle.
 * We draw larger then scale down so the cloud sits inside the canvas with margin.
 */
export const SYNCRO_PARTICLE_CANVAS_SIZE = 520;
/** Target visual diameter on screen (px). */
export const SYNCRO_PARTICLE_DISPLAY_SIZE = 260;
export const SYNCRO_PARTICLE_DISPLAY_SCALE =
  SYNCRO_PARTICLE_DISPLAY_SIZE / SYNCRO_PARTICLE_CANVAS_SIZE;
export const SYNCRO_PARTICLE_OFFSET_X = 5;
export const SYNCRO_PARTICLE_OFFSET_Y = 0;
export const SYNCRO_LABEL_RADIUS = 138;
export const SYNCRO_CENTER_INFO_WIDTH = 140;
export const SYNCRO_AR_CAMERA_SIZE = 200;
export const SYNCRO_MAP_POINT_RADIUS = 140;
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
