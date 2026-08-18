/**
 * Spline particle ticks keep calling requestAnimationFrame after the canvas is gone.
 * When the workspace is in quiet mode, drop self-rescheduling rAF (render loops).
 * One-shot rAF (new closures) still run.
 */

let installed = false;
let suppressLoops = false;
let nativeRaf: typeof requestAnimationFrame | null = null;
let nativeCancel: typeof cancelAnimationFrame | null = null;

export function setSuppressRenderLoops(next: boolean): void {
  suppressLoops = next;
}

export function installQuietRafGuard(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  nativeRaf = window.requestAnimationFrame.bind(window);
  nativeCancel = window.cancelAnimationFrame.bind(window);
  const hits = new WeakMap<FrameRequestCallback, number>();

  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    if (!suppressLoops || !nativeRaf) return nativeRaf!(cb);
    const n = (hits.get(cb) ?? 0) + 1;
    hits.set(cb, n);
    if (n > 1) return 0;
    return nativeRaf(cb);
  };
}

/** Cancel a window of recently issued rAF ids (orphaned Spline ticks). */
export function cancelRecentAnimationFrames(): void {
  if (!nativeRaf || !nativeCancel) {
    if (typeof window === "undefined") return;
    nativeRaf = window.requestAnimationFrame.bind(window);
    nativeCancel = window.cancelAnimationFrame.bind(window);
  }
  const probe = nativeRaf(() => undefined);
  nativeCancel(probe);
  for (let i = probe; i > probe - 256 && i > 0; i -= 1) {
    nativeCancel(i);
  }
}
