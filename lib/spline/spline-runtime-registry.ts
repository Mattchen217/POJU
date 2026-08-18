/**
 * Track live Spline Application instances so SPA navigations can hard-stop
 * leftover particle loops (react-spline does not always halt on unmount alone).
 */

import { useEffect, useState } from "react";
import type { Application } from "@splinetool/runtime";

import { hardDisposeSplineApp, loseCanvasWebGL } from "@/lib/spline/throttle-spline-runtime";

const live = new Set<Application>();
const blockedListeners = new Set<() => void>();
let splineBlocked = false;

export function isSplineBlocked(): boolean {
  return splineBlocked;
}

export function subscribeSplineBlocked(onChange: () => void): () => void {
  blockedListeners.add(onChange);
  return () => {
    blockedListeners.delete(onChange);
  };
}

/** Delivery book / heavy text pages: refuse new Spline and kill anything already running. */
export function setSplineBlocked(blocked: boolean): void {
  splineBlocked = blocked;
  if (blocked) forceStopAllSplineRuntimes();
  for (const fn of [...blockedListeners]) fn();
}

export function registerSplineRuntime(app: Application): void {
  if (splineBlocked) {
    hardDisposeSplineApp(app);
    return;
  }
  live.add(app);
}

export function unregisterSplineRuntime(app: Application | null | undefined): void {
  if (!app) return;
  live.delete(app);
}

function stripOrphanSplineCanvases(): void {
  if (typeof document === "undefined") return;
  const nodes = document.querySelectorAll(
    ".spline-interactive-scene canvas, canvas.spline-interactive-scene__canvas",
  );
  for (const node of nodes) {
    if (!(node instanceof HTMLCanvasElement)) continue;
    loseCanvasWebGL(node);
    node.remove();
  }
}

/** Stop every tracked Spline — call when opening delivery book / leaving heavy scenes. */
export function forceStopAllSplineRuntimes(): void {
  for (const app of [...live]) {
    hardDisposeSplineApp(app);
    live.delete(app);
  }
  stripOrphanSplineCanvases();
}

export function liveSplineRuntimeCount(): number {
  return live.size;
}

/** React: unmount Spline while delivery (or any blocker) is active. */
export function useSplineBlocked(): boolean {
  const [blocked, setBlocked] = useState(isSplineBlocked);

  useEffect(() => {
    const sync = () => setBlocked(isSplineBlocked());
    sync();
    return subscribeSplineBlocked(sync);
  }, []);

  return blocked;
}
