import type { Application } from "@splinetool/runtime";

const RETRY_DELAYS_MS = [0, 120, 400, 800, 1500, 2500, 4000];

type OrbitControlsLike = { setZoom?: (zoom: number) => void };

type ZoomJob = {
  cancelled: boolean;
  raf: number;
  timers: number[];
};

const zoomJobs = new WeakMap<object, ZoomJob>();

export function cancelSplineZoomRetries(app: object | null | undefined): void {
  if (!app) return;
  const job = zoomJobs.get(app);
  if (!job) return;
  job.cancelled = true;
  if (job.raf) cancelAnimationFrame(job.raf);
  for (const id of job.timers) window.clearTimeout(id);
  zoomJobs.delete(app);
}

/** Apply camera zoom with retries — Match scene can reset zoom shortly after first paint. */
export function applySplineZoom(app: Application, zoom: number): void {
  if (zoom <= 0) return;
  cancelSplineZoomRetries(app);

  const job: ZoomJob = { cancelled: false, raf: 0, timers: [] };
  zoomJobs.set(app, job);

  const apply = () => {
    if (job.cancelled) return;
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
  job.raf = requestAnimationFrame(apply);
  for (const delay of RETRY_DELAYS_MS) {
    if (delay === 0) continue;
    job.timers.push(window.setTimeout(apply, delay));
  }
}
