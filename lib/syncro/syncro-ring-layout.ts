import type { CSSProperties } from "react";

/** Syncro ring layout — fixed px (AR fig.1 reference). */
export const SYNCRO_RING_SIZE = 380;
export const SYNCRO_LABEL_RADIUS = 172;
/** Particle display diameter — larger than ring so Spline cloud reaches direction labels. */
export const SYNCRO_PARTICLE_DISPLAY_SIZE = 440;
export const SYNCRO_PARTICLE_CANVAS_SIZE = 520;
export const SYNCRO_PARTICLE_DISPLAY_SCALE =
  SYNCRO_PARTICLE_DISPLAY_SIZE / SYNCRO_PARTICLE_CANVAS_SIZE;
/** Nudge particle field — Spline visual center vs ring (px). */
export const SYNCRO_PARTICLE_OFFSET_X = 17;
export const SYNCRO_PARTICLE_OFFSET_Y = 5;
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
