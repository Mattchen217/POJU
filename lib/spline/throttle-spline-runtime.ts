/**
 * Runtime guards for heavy Spline scenes (e.g. POJUREN with ~100k particles).
 * Particle counts live inside .splinecode; we pause / downscale / soft-cap emitters.
 */

import type { Application } from "@splinetool/runtime";

const TARGET_MAX_PARTICLES = 18_000;

type LooseObj = {
  name?: string;
  type?: string;
  visible?: boolean;
  intensity?: number;
  rate?: number;
  emitRate?: number;
  maxParticles?: number;
  particleCount?: number;
  count?: number;
  children?: unknown[];
  [key: string]: unknown;
};

function walk(node: unknown, visit: (o: LooseObj) => void): void {
  if (!node || typeof node !== "object") return;
  const o = node as LooseObj;
  visit(o);
  const kids = o.children;
  if (Array.isArray(kids)) {
    for (const c of kids) walk(c, visit);
  }
}

function rootsFromApp(app: Application): unknown[] {
  const a = app as unknown as Record<string, unknown>;
  const out: unknown[] = [];
  for (const key of ["_scene", "scene", "_root", "root"]) {
    if (a[key]) out.push(a[key]);
  }
  try {
    const getAll = (a as { getAllObjects?: () => unknown[] }).getAllObjects;
    if (typeof getAll === "function") {
      const list = getAll.call(app);
      if (Array.isArray(list)) out.push(...list);
    }
  } catch {
    /* optional */
  }
  return out;
}

/** Best-effort: lower emitter caps so Spline does not sit at the 100k hard limit. */
export function softCapSplineParticles(app: Application, max = TARGET_MAX_PARTICLES): number {
  let touched = 0;
  for (const root of rootsFromApp(app)) {
    walk(root, (o) => {
      const name = String(o.name ?? o.type ?? "");
      const looksParticle = /particle|emitter/i.test(name);
      if (!looksParticle && o.maxParticles == null && o.particleCount == null) return;

      for (const key of ["maxParticles", "particleCount", "count"] as const) {
        const v = o[key];
        if (typeof v === "number" && v > max) {
          o[key] = max;
          touched += 1;
        }
      }
      for (const key of ["emitRate", "rate", "intensity"] as const) {
        const v = o[key];
        if (typeof v === "number" && v > 1) {
          o[key] = Math.max(0.15, v * 0.25);
          touched += 1;
        }
      }
    });
  }
  return touched;
}

export function loseCanvasWebGL(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return;
  try {
    const gl =
      (canvas.getContext("webgl2") as WebGLRenderingContext | null) ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* optional */
  }
}

/** Best-effort: cancel leftover rAF ids the runtime stashes on the Application. */
function cancelStashedAnimationFrames(app: object): void {
  const rec = app as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (!/raf|frame|anim|tick|loop/i.test(key)) continue;
    const v = rec[key];
    if (typeof v === "number" && v > 0) {
      try {
        cancelAnimationFrame(v);
      } catch {
        /* optional */
      }
    }
  }
}

export function pauseSplineRuntime(app: Application | null | undefined): void {
  if (!app) return;
  try {
    (app as unknown as { stop?: () => void }).stop?.();
  } catch {
    /* optional */
  }
  try {
    (app as unknown as { pause?: () => void }).pause?.();
  } catch {
    /* optional */
  }
  try {
    app.renderOnDemand = true;
  } catch {
    /* optional */
  }
  cancelStashedAnimationFrames(app);
}

/**
 * Unmount path: stop the loop, dispose the scene, and drop the WebGL context.
 * `stop()` alone does not cancel Spline particle rAF.
 */
export function hardDisposeSplineApp(
  app: Application | null | undefined,
  canvas?: HTMLCanvasElement | null,
): void {
  if (!app) {
    loseCanvasWebGL(canvas);
    return;
  }
  pauseSplineRuntime(app);
  try {
    app.setSize?.(1, 1);
  } catch {
    /* optional */
  }
  try {
    (app as unknown as { dispose?: () => void }).dispose?.();
  } catch {
    /* optional */
  }
  loseCanvasWebGL(canvas);
}

export function resumeSplineRuntime(
  app: Application | null | undefined,
  opts?: { continuous?: boolean },
): void {
  if (!app) return;
  try {
    if (opts?.continuous) {
      app.renderOnDemand = false;
    }
  } catch {
    /* optional */
  }
  try {
    app.play?.();
  } catch {
    /* optional */
  }
}
