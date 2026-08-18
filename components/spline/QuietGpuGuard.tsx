"use client";

import { useLayoutEffect } from "react";

import {
  acquireSplineBlock,
  flushBlockedSplineRuntimes,
  releaseSplineBlock,
} from "@/lib/spline/spline-runtime-registry";

/** Chat / delivery: block Spline after commit. Never during render. */
export function QuietGpuGuard({ reason }: { reason: string }) {
  useLayoutEffect(() => {
    acquireSplineBlock(reason);
    flushBlockedSplineRuntimes();
    return () => releaseSplineBlock(reason);
  }, [reason]);

  return null;
}
