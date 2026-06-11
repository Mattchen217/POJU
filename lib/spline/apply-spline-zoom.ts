import type { Application } from "@splinetool/runtime";

const RETRY_DELAYS_MS = [0, 120, 400, 800, 1500, 2500, 4000];

type OrbitControlsLike = { setZoom?: (zoom: number) => void };

/** Apply camera zoom with retries — Match scene can reset zoom shortly after first paint. */
export function applySplineZoom(app: Application, zoom: number): void {
  if (zoom <= 0) return;

  const apply = () => {
    try {
      app.setZoom(zoom);
    } catch {
      // optional
    }

    try {
      const controls = app.controls as { orbitControls?: OrbitControlsLike } | undefined;
      controls?.orbitControls?.setZoom?.(zoom);
    } catch {
      // optional
    }
  };

  apply();
  requestAnimationFrame(apply);
  for (const delay of RETRY_DELAYS_MS) {
    if (delay === 0) continue;
    window.setTimeout(apply, delay);
  }
}
