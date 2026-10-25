import type { CSSProperties } from "react";

/** Syncro ring layout — fixed px (AR fig.1 reference). */
export const SYNCRO_RING_SIZE = 380;
export const SYNCRO_LABEL_RADIUS = 172;
/** Particle display diameter — fills direction-label ring; source asset is 512×512. */
export const SYNCRO_PARTICLE_DISPLAY_SIZE = 440;
export const SYNCRO_PARTICLE_CANVAS_SIZE = 512;
export const SYNCRO_PARTICLE_DISPLAY_SCALE =
  SYNCRO_PARTICLE_DISPLAY_SIZE / SYNCRO_PARTICLE_CANVAS_SIZE;
/** Centered on ring — no nudge (512×512 asset aligned to compass center). */
export const SYNCRO_PARTICLE_OFFSET_X = 0;
export const SYNCRO_PARTICLE_OFFSET_Y = 0;
export const SYNCRO_CENTER_INFO_WIDTH = 140;
export const SYNCRO_AR_CAMERA_SIZE = 200;
export const SYNCRO_MAP_POINT_RADIUS = 140;
export const SYNCRO_MAP_POINT_SIZE = 12;
export const SYNCRO_RING_MARGIN_TOP = 0;
export const SYNCRO_COMPASS_PAGE_PADDING_TOP = 0;
export const SYNCRO_WHY_BUTTON_MARGIN_TOP = 8;
/** Wait page mini compass ring diameter. */
export const SYNCRO_PREPARING_RING_SIZE = 132;

/** Styles on Spline host — no extra product wrapper div. */
export function getSyncroParticleFieldStyle(options?: {
  opacity?: number;
  /** Ring container size in px — scales particle field (default full compass). */
  ringSize?: number;
}): CSSProperties {
  const ringSize = options?.ringSize ?? SYNCRO_RING_SIZE;
  const scale =
    (SYNCRO_PARTICLE_DISPLAY_SIZE / SYNCRO_PARTICLE_CANVAS_SIZE) * (ringSize / SYNCRO_RING_SIZE);
  return {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: SYNCRO_PARTICLE_CANVAS_SIZE,
    height: SYNCRO_PARTICLE_CANVAS_SIZE,
    transform: `translate(calc(-50% + ${SYNCRO_PARTICLE_OFFSET_X}px), calc(-50% + ${SYNCRO_PARTICLE_OFFSET_Y}px)) scale(${scale})`,
    transformOrigin: "center center",
    overflow: "visible",
    pointerEvents: "none",
    zIndex: 1,
    ...(options?.opacity !== undefined ? { opacity: options.opacity } : {}),
  };
}
