import type { Application } from "@splinetool/runtime";

import { applySplineZoom } from "@/lib/spline/apply-spline-zoom";

/** Workspace center is taller than Classic full-bleed — pull in so the subject fills the column. */
export const WORKSPACE_PREPARING_ANALYZING_ZOOM = 0.92;

const BACKDROP_NAMES = [
  "Background",
  "background",
  "BG",
  "Bg",
  "Backdrop",
  "backdrop",
  "Sky",
  "sky",
  "Environment",
  "environment",
  "BG Color",
  "Background Color",
] as const;

type OrbitControlsLike = {
  setZoom?: (zoom: number) => void;
  spherical?: { radius: number };
  initialSphericalRadius?: number;
  update?: () => void;
};

const orbitRadiusBase = new WeakMap<object, number>();

function getOrbitControls(app: Application): OrbitControlsLike | undefined {
  const raw =
    app.controls ??
    (app as Application & { _controls?: OrbitControlsLike | { orbitControls?: OrbitControlsLike } })
      ._controls;
  if (!raw || typeof raw !== "object") return undefined;
  if ("orbitControls" in raw) {
    return (raw as { orbitControls?: OrbitControlsLike }).orbitControls;
  }
  if ("spherical" in raw) {
    return raw as OrbitControlsLike;
  }
  return undefined;
}

/** Hide baked backdrop plates; clear color stays transparent (no purple fill). */
function clearPreparingBackdrop(app: Application): void {
  try {
    app.setBackgroundColor("transparent");
  } catch {
    // optional
  }

  for (const name of BACKDROP_NAMES) {
    try {
      const obj = app.findObjectByName(name) as { visible?: boolean } | undefined;
      if (obj && typeof obj.visible === "boolean") {
        obj.visible = false;
      }
    } catch {
      // optional
    }
  }
}

/**
 * Workspace preparing: transparent clear + closer view distance (higher zoom / shorter orbit).
 * Do not CSS-scale the canvas — that breaks Spline centering.
 */
export function configureWorkspacePreparingSpline(
  app: Application,
  zoom: number = WORKSPACE_PREPARING_ANALYZING_ZOOM,
): void {
  const apply = () => {
    clearPreparingBackdrop(app);
    applySplineZoom(app, zoom);

    const oc = getOrbitControls(app);
    if (oc?.spherical) {
      try {
        const key = oc as object;
        const current = oc.initialSphericalRadius ?? oc.spherical.radius;
        if (current != null && Number.isFinite(current) && current > 0) {
          const base = orbitRadiusBase.get(key) ?? current;
          orbitRadiusBase.set(key, base);
          /* Higher zoom → shorter radius → subject larger on screen. */
          oc.spherical.radius = base / Math.max(zoom, 0.001);
          oc.setZoom?.(zoom);
          oc.update?.();
        }
      } catch {
        // optional
      }
    }

    try {
      app.requestRender();
    } catch {
      // optional
    }
  };

  apply();
  requestAnimationFrame(apply);
  for (const delay of [120, 400, 800, 1500, 2500]) {
    window.setTimeout(apply, delay);
  }
}
