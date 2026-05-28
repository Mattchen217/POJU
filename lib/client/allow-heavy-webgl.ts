"use client";

import { useEffect, useState } from "react";

import { isLikelyPwaContext } from "@/lib/client/pwa-standalone";

/**
 * iOS installed PWA + multiple Spline WebGL scenes → WKWebView OOM and reload crash loops.
 * Marketing / preparing pages skip WebGL when this is false.
 */
export function useAllowHeavyWebGL(): boolean {
  const [allow, setAllow] = useState(() => {
    if (typeof window === "undefined") return true;
    return !isLikelyPwaContext();
  });

  useEffect(() => {
    setAllow(!isLikelyPwaContext());
  }, []);

  return allow;
}
