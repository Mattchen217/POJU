"use client";

import { useLayoutEffect, type ReactNode } from "react";

import {
  acquireSplineBlock,
  flushBlockedSplineRuntimes,
  releaseSplineBlock,
} from "@/lib/spline/spline-runtime-registry";

function sessionInUrl(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(new URLSearchParams(window.location.search).get("session")?.trim());
}

/**
 * Layout wrapper: after commit, refuse Spline on `?session=` URLs.
 * Do not patch history/rAF and do not acquire during render — that caused
 * React #185 and a 100% CPU busy-loop.
 */
export function WorkspaceGpuGate({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    if (!sessionInUrl()) {
      releaseSplineBlock("workspace-session-url");
      return;
    }
    acquireSplineBlock("workspace-session-url");
    flushBlockedSplineRuntimes();
    return () => releaseSplineBlock("workspace-session-url");
  }, []);

  return children;
}
