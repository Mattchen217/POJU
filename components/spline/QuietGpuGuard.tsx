"use client";

import { useLayoutEffect } from "react";

import {
  acquireSplineBlock,
  flushBlockedSplineRuntimes,
  releaseSplineBlock,
} from "@/lib/spline/spline-runtime-registry";

/**
 * While mounted, refuse Spline boot (same render) and dispose leftovers after commit.
 * Disposing during render leaves Spline resize() throwing getPixelRatio forever.
 */
export function QuietGpuGuard({ reason }: { reason: string }) {
  acquireSplineBlock(reason);

  useLayoutEffect(() => {
    acquireSplineBlock(reason);
    flushBlockedSplineRuntimes();
    return () => releaseSplineBlock(reason);
  }, [reason]);

  return null;
}
