"use client";

import { useEffect } from "react";

import {
  acquireSplineBlock,
  releaseSplineBlock,
} from "@/lib/spline/spline-runtime-registry";

/**
 * While mounted, refuse Spline boot (sync, same render) and dispose leftovers.
 * Delivery / Pivot chat have no 3D scene — do not hide a running canvas.
 */
export function QuietGpuGuard({ reason }: { reason: string }) {
  acquireSplineBlock(reason);

  useEffect(() => {
    acquireSplineBlock(reason);
    return () => releaseSplineBlock(reason);
  }, [reason]);

  return null;
}
