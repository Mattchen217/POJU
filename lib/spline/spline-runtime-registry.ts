/**
 * Track live Spline Application instances so SPA navigations can hard-stop
 * leftover particle loops (react-spline does not always halt on unmount alone).
 */

import type { Application } from "@splinetool/runtime";

import { pauseSplineRuntime } from "@/lib/spline/throttle-spline-runtime";

const live = new Set<Application>();

export function registerSplineRuntime(app: Application): void {
  live.add(app);
}

export function unregisterSplineRuntime(app: Application | null | undefined): void {
  if (!app) return;
  live.delete(app);
}

/** Stop every tracked Spline — call when opening delivery book / leaving heavy scenes. */
export function forceStopAllSplineRuntimes(): void {
  for (const app of [...live]) {
    pauseSplineRuntime(app);
    try {
      (app as unknown as { dispose?: () => void }).dispose?.();
    } catch {
      /* optional */
    }
    live.delete(app);
  }
}

export function liveSplineRuntimeCount(): number {
  return live.size;
}
