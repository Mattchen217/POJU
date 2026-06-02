"use client";

import { useEffect, useState } from "react";

/** `marketing` — homepage cards; `preparing` — full-screen analyzing scene. */
export type HeavyWebGLContext = "marketing" | "preparing";

function isDesktopFinePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: fine) and (min-width: 768px)").matches;
}

export function shouldAllowHeavyWebGL(context: HeavyWebGLContext = "marketing"): boolean {
  if (typeof window === "undefined") return true;
  // Preparing: full-screen Spline + SSE on desktop pegs the main thread — use static backdrop.
  if (context === "preparing" && isDesktopFinePointer()) return false;
  // Homepage cards use viewport lazy mount + concurrent slot cap (marketing-spline-slots).
  return true;
}

/**
 * Preparing pages always allow WebGL. Marketing cards gate mount timing / concurrency separately.
 */
export function useAllowHeavyWebGL(context: HeavyWebGLContext = "marketing"): boolean {
  const [allow, setAllow] = useState(() => shouldAllowHeavyWebGL(context));

  useEffect(() => {
    setAllow(shouldAllowHeavyWebGL(context));
  }, [context]);

  return allow;
}
