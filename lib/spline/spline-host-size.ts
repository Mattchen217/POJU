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

/**
 * Spline/Three default to `alpha: false`. An opaque canvas with the scene's
 * light clear color composites as a solid white plate in Chrome.
 * Creating the context first makes the runtime reuse these attributes.
 */
export function ensureSplineCanvasAlpha(canvas: HTMLCanvasElement): void {
  const attrs: WebGLContextAttributes = {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    depth: true,
    stencil: true,
  };
  canvas.getContext("webgl2", attrs) ?? canvas.getContext("webgl", attrs);
}

function setCanvasStyle(canvas: HTMLCanvasElement, prop: string, value: string): void {
  if (
    canvas.style.getPropertyValue(prop) === value &&
    canvas.style.getPropertyPriority(prop) === "important"
  ) {
    return;
  }
  canvas.style.setProperty(prop, value, "important");
}

/**
 * Runtime writes `canvas.style` every frame (often `width/height = innerWidth`).
 * CSS `!important` loses if this runs after paint — keep pinning from JS.
 */
export function pinSplineCanvasInHost(canvas: HTMLCanvasElement): void {
  setCanvasStyle(canvas, "position", "absolute");
  setCanvasStyle(canvas, "inset", "0px");
  setCanvasStyle(canvas, "left", "0px");
  setCanvasStyle(canvas, "top", "0px");
  setCanvasStyle(canvas, "right", "0px");
  setCanvasStyle(canvas, "bottom", "0px");
  setCanvasStyle(canvas, "width", "100%");
  setCanvasStyle(canvas, "height", "100%");
  setCanvasStyle(canvas, "max-width", "100%");
  setCanvasStyle(canvas, "max-height", "100%");
  setCanvasStyle(canvas, "display", "block");
  setCanvasStyle(canvas, "background", "transparent");
}

/** `"transparent"` is not always parsed by Spline's Color.setStyle. */
export function applySplineTransparentBackground(
  app: Application,
  canvas?: HTMLCanvasElement | null,
): void {
  for (const color of ["rgba(0, 0, 0, 0)", "#00000000"] as const) {
    try {
      app.setBackgroundColor(color);
      break;
    } catch {
      // try next encoding
    }
  }
  if (canvas) {
    canvas.style.setProperty("background", "transparent", "important");
  }
}

/** Fight runtime style writes for the lifetime of this canvas. */
export function watchSplineCanvasPin(canvas: HTMLCanvasElement): () => void {
  pinSplineCanvasInHost(canvas);
  const obs = new MutationObserver(() => pinSplineCanvasInHost(canvas));
  obs.observe(canvas, { attributes: true, attributeFilter: ["style"] });
  return () => obs.disconnect();
}
