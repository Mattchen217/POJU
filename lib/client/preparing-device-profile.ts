"use client";

export type PreparingDeviceProfile = {
  isDesktop: boolean;
  /** Mobile touch follow; desktop mouse bridge adds main-thread load. */
  pointerFollow: boolean;
  /** Internal canvas resolution multiplier (CSS still fills viewport). */
  renderScale: number;
  /** Let SSE connect before parsing .splinecode on desktop. */
  deferSplineMs: number;
};

export function getPreparingDeviceProfile(): PreparingDeviceProfile {
  if (typeof window === "undefined") {
    return { isDesktop: false, pointerFollow: true, renderScale: 1, deferSplineMs: 0 };
  }

  const isDesktop = window.matchMedia("(pointer: fine) and (min-width: 768px)").matches;
  if (isDesktop) {
    return {
      isDesktop: true,
      pointerFollow: false,
      renderScale: 0.5,
      deferSplineMs: 900,
    };
  }

  return { isDesktop: false, pointerFollow: true, renderScale: 1, deferSplineMs: 0 };
}
