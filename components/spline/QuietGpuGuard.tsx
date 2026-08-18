"use client";

import { useEffect } from "react";

/**
 * While mounted, stop leftover Spline / Three.js rAF and workspace starfield.
 * Use on Pivot chat + delivery — those surfaces have no 3D scene.
 */
export function QuietGpuGuard({ reason }: { reason: string }) {
  useEffect(() => {
    let released = false;
    void import("@/lib/spline/spline-runtime-registry").then((m) => {
      if (released) return;
      m.acquireSplineBlock(reason);
    });
    return () => {
      released = true;
      void import("@/lib/spline/spline-runtime-registry").then((m) => {
        m.releaseSplineBlock(reason);
      });
    };
  }, [reason]);

  return null;
}
