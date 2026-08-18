import type { Application } from "@splinetool/runtime";

/** Below this, Spline/Three.js builds a 0×0 framebuffer and spams WebGL errors. */
const MIN_PX = 2;

export function readSplineHostSize(el: HTMLElement | null | undefined): { w: number; h: number } {
  if (!el) return { w: 0, h: 0 };
  const rect = el.getBoundingClientRect();
  return {
    w: Math.floor(rect.width || el.clientWidth || 0),
    h: Math.floor(rect.height || el.clientHeight || 0),
  };
}

export function isSplineHostUsable(w: number, h: number): boolean {
  return w >= MIN_PX && h >= MIN_PX;
}

/** Never pass 0 to Application.setSize — that marks textures incomplete. */
export function applySplineHostSize(
  app: Application,
  cssW: number,
  cssH: number,
  scale = 1,
): boolean {
  if (!isSplineHostUsable(cssW, cssH)) return false;
  const factor = scale > 0 && scale < 1 ? scale : 1;
  const w = Math.max(1, Math.floor(cssW * factor));
  const h = Math.max(1, Math.floor(cssH * factor));
  try {
    app.setSize(w, h);
    return true;
  } catch {
    return false;
  }
}

export function ensureCanvasBackingStore(canvas: HTMLCanvasElement, cssW: number, cssH: number): void {
  const w = Math.max(1, Math.floor(cssW) || 1);
  const h = Math.max(1, Math.floor(cssH) || 1);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}
