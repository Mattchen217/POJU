/** Syncro Polish v3 — fixed layout constants (do not change without doc approval). */
export const SYNCRO_RING_SIZE = 420;
export const SYNCRO_PARTICLE_SIZE = 380;
export const SYNCRO_LABEL_RADIUS = 195;
export const SYNCRO_CENTER_INFO_WIDTH = 140;
export const SYNCRO_AR_CAMERA_SIZE = 200;
export const SYNCRO_MAP_POINT_RADIUS = 140;
export const SYNCRO_MAP_POINT_SIZE = 12;
export const SYNCRO_COMPASS_PAGE_PADDING_TOP = 200;
export const SYNCRO_WHY_BUTTON_MARGIN_TOP = 100;

export const SYNCRO_ROTATE_LAYER_STYLE = {
  transformOrigin: "center center" as const,
  transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
  willChange: "transform" as const,
  backfaceVisibility: "hidden" as const,
  WebkitBackfaceVisibility: "hidden" as const,
};

export function syncroRotateTransform(deg: number): string {
  return `rotate3d(0, 0, 1, ${-deg}deg)`;
}
