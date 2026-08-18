/**
 * Track live Spline Application instances so SPA navigations can hard-stop
 * leftover particle loops (react-spline / Spline runtime do not always halt
 * on unmount — the rAF can keep writing canvas.style at ~60fps).
 */

import { useEffect, useState } from "react";
import type { Application } from "@splinetool/runtime";

import { hardDisposeSplineApp, loseCanvasWebGL } from "@/lib/spline/throttle-spline-runtime";

const live = new Set<Application>();
const blockedListeners = new Set<() => void>();
const blockReasons = new Set<string>();
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

function syncQuietGpuFlag(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (splineBlocked) root.dataset.wsQuietGpu = "1";
  else delete root.dataset.wsQuietGpu;
}

function applyBlocked(forcePurge: boolean): void {
  const next = blockReasons.size > 0;
  const changed = next !== splineBlocked;
  splineBlocked = next;
  if (next) forceStopAllSplineRuntimes();
  else if (forcePurge) forceStopAllSplineRuntimes();
  syncQuietGpuFlag();
  if (changed) {
    for (const fn of [...blockedListeners]) fn();
  }
}

/** Delivery book / Pivot chat: refuse new Spline and kill anything already running. */
export function setSplineBlocked(blocked: boolean, reason = "manual"): void {
  if (blocked) acquireSplineBlock(reason);
  else releaseSplineBlock(reason);
}

export function acquireSplineBlock(reason: string): void {
  const alreadyHeld = blockReasons.has(reason);
  blockReasons.add(reason);
  if (alreadyHeld && splineBlocked) return;
  applyBlocked(true);
}

export function releaseSplineBlock(reason: string): void {
  blockReasons.delete(reason);
  applyBlocked(false);
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

/** Three.js stamps `data-engine` on its canvas — leftover Spline still has this after React unmount. */
export function purgeSplineDom(): void {
  if (typeof document === "undefined") return;
  const nodes = document.querySelectorAll(
    "canvas[data-engine], .spline-interactive-scene canvas, canvas.spline-interactive-scene__canvas",
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
  purgeSplineDom();
}

export function liveSplineRuntimeCount(): number {
  return live.size;
}

/** React: unmount Spline while delivery / Pivot chat is active. */
export function useSplineBlocked(): boolean {
  const [blocked, setBlocked] = useState(isSplineBlocked);

  useEffect(() => {
    const sync = () => setBlocked(isSplineBlocked());
    sync();
    return subscribeSplineBlocked(sync);
  }, []);

  return blocked;
}
