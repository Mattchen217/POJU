import type { CSSProperties } from "react";

/** Syncro ring layout — fixed px (change only with product doc). */
export const SYNCRO_RING_SIZE = 420;
/** Particle canvas — slightly inside label ring (420); nudge via offsets below. */
export const SYNCRO_PARTICLE_SIZE = 400;
/** 0 = geometric center of compass-area; nudge if Spline art looks off. */
export const SYNCRO_PARTICLE_OFFSET_X = 0;
export const SYNCRO_PARTICLE_OFFSET_Y = 0;
export const SYNCRO_LABEL_RADIUS = 195;
export const SYNCRO_CENTER_INFO_WIDTH = 140;
export const SYNCRO_AR_CAMERA_SIZE = 200;
export const SYNCRO_MAP_POINT_RADIUS = 140;
export const SYNCRO_MAP_POINT_SIZE = 12;
export const SYNCRO_RING_MARGIN_TOP = 80;
export const SYNCRO_COMPASS_PAGE_PADDING_TOP = 80;
export const SYNCRO_WHY_BUTTON_MARGIN_TOP = 60;

/** Applied directly on the Spline root (no extra wrapper div). */
export function getSyncroParticleFieldStyle(options?: { opacity?: number }): CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: SYNCRO_PARTICLE_SIZE,
    height: SYNCRO_PARTICLE_SIZE,
    transform: `translate(calc(-50% + ${SYNCRO_PARTICLE_OFFSET_X}px), calc(-50% + ${SYNCRO_PARTICLE_OFFSET_Y}px))`,
    pointerEvents: "none",
    zIndex: 1,
    ...(options?.opacity !== undefined ? { opacity: options.opacity } : {}),
  };
}
