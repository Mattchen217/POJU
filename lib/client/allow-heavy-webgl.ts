"use client";

import { useEffect, useState } from "react";

import { isSplineBlocked, useSplineBlocked } from "@/lib/spline/spline-runtime-registry";

/** `marketing` — homepage cards; `preparing` — full-screen analyzing scene. */
export type HeavyWebGLContext = "marketing" | "preparing";

export function shouldAllowHeavyWebGL(_context: HeavyWebGLContext = "marketing"): boolean {
  if (typeof window === "undefined") return true;
  if (isSplineBlocked()) return false;
  return true;
}

/**
 * Preparing pages always allow WebGL. Marketing cards gate mount timing / concurrency separately.
 * Delivery book sets the Spline block flag so leftover heroes cannot remount.
 */
export function useAllowHeavyWebGL(context: HeavyWebGLContext = "marketing"): boolean {
  const blocked = useSplineBlocked();
  const [allow, setAllow] = useState(() => shouldAllowHeavyWebGL(context));

  useEffect(() => {
    setAllow(shouldAllowHeavyWebGL(context));
  }, [context, blocked]);

  return allow && !blocked;
}
