import type { Application } from "@splinetool/runtime";

import { applySplineZoom } from "@/lib/spline/apply-spline-zoom";

type OrbitControlsLike = {
  setZoom?: (zoom: number) => void;
  spherical?: { radius: number };
  initialSphericalRadius?: number;
  update?: () => void;
  target?: { x: number; y: number; z: number };
  object?: {
    isOrthographicCamera?: boolean;
    zoom?: number;
    updateProjectionMatrix?: () => void;
    position?: { x?: number; y?: number; z?: number };
  };
};

const cameraPosBase = new WeakMap<object, { x: number; y: number; z: number }>();
const orbitRadiusBase = new WeakMap<object, number>();
const orbitTargetBase = new WeakMap<object, { x: number; y: number; z: number }>();

const CAMERA_NAMES = [
  "personal camera",
  "Personal Camera",
  "Camera",
  "camera",
  "Main Camera",
  "MainCamera",
] as const;

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

/** Pan orbit pivot — positive target X shifts scene content right on screen. */
function panOrbitTarget(oc: OrbitControlsLike, offsetX: number, offsetY: number): void {
  const target = oc.target;
  if (!target) return;

  const key = oc as object;
  const base =
    orbitTargetBase.get(key) ??
    ({
      x: typeof target.x === "number" ? target.x : 0,
      y: typeof target.y === "number" ? target.y : 0,
      z: typeof target.z === "number" ? target.z : 0,
    } satisfies { x: number; y: number; z: number });
  orbitTargetBase.set(key, base);
  target.x = base.x + offsetX;
  target.y = base.y + offsetY;

  try {
    oc.update?.();
  } catch {
    // optional
  }
}

/** Pull Match camera back — card uses zoom / radiusFactor + orbit radius. */
export function pullMatchCameraBack(
  app: Application,
  zoom: number,
  radiusFactor = 1,
  cameraOffsetX = 0,
  cameraOffsetY = 0,
  targetOffsetX = 0,
  targetOffsetY = 0,
): void {
  const effectiveZoom = zoom / Math.max(radiusFactor, 1);

  applySplineZoom(app, effectiveZoom);

  const oc = getOrbitControls(app);
  if (oc) {
    try {
      oc.setZoom?.(effectiveZoom);
    } catch {
      // optional
    }

    try {
      if (oc.object?.isOrthographicCamera && typeof oc.object.zoom === "number") {
        oc.object.zoom = effectiveZoom;
        oc.object.updateProjectionMatrix?.();
      }
    } catch {
      // optional
    }

    try {
      const key = oc as object;
      const current = oc.initialSphericalRadius ?? oc.spherical?.radius;
      if (current != null && oc.spherical) {
        const base = orbitRadiusBase.get(key) ?? current;
        orbitRadiusBase.set(key, base);
        oc.spherical.radius =
          (base / Math.max(effectiveZoom, 0.001)) * Math.max(radiusFactor, 1);
        oc.update?.();
      }
    } catch {
      // optional
    }

    if (targetOffsetX !== 0 || targetOffsetY !== 0) {
      panOrbitTarget(oc, targetOffsetX, targetOffsetY);
    }
  }

  for (const name of CAMERA_NAMES) {
    try {
      const obj = app.findObjectByName(name) as
        | { position?: { x: number; y: number; z: number } }
        | undefined;
      if (!obj?.position || typeof obj.position.z !== "number") continue;

      const key = obj as object;
      const base =
        cameraPosBase.get(key) ??
        ({
          x: typeof obj.position.x === "number" ? obj.position.x : 0,
          y: typeof obj.position.y === "number" ? obj.position.y : 0,
          z: obj.position.z,
        } satisfies { x: number; y: number; z: number });
      cameraPosBase.set(key, base);
      obj.position.x = base.x + cameraOffsetX;
      obj.position.y = base.y + cameraOffsetY;
      obj.position.z = base.z * Math.max(radiusFactor, 1);
    } catch {
      // optional
    }
  }

  try {
    app.requestRender();
  } catch {
    // optional
  }
}

/** Match card load hook — card viewport needs extra camera pull vs hero. */
export function configureMatchSplineFraming(
  app: Application,
  zoom: number,
  radiusFactor: number,
  cameraOffsetX = 0,
  cameraOffsetY = 0,
  targetOffsetX = 0,
  targetOffsetY = 0,
): void {
  const apply = () =>
    pullMatchCameraBack(
      app,
      zoom,
      radiusFactor,
      cameraOffsetX,
      cameraOffsetY,
      targetOffsetX,
      targetOffsetY,
    );

  apply();
  requestAnimationFrame(apply);
  for (const delay of [120, 400, 800, 1500, 2500, 4000, 6000]) {
    window.setTimeout(apply, delay);
  }

  try {
    app.setBackgroundColor("transparent");
  } catch {
    // optional
  }
}
