"use client";

import { useEffect, type ReactNode } from "react";

import {
  acquireSplineBlock,
  releaseSplineBlock,
} from "@/lib/spline/spline-runtime-registry";

function readSessionFromWindow(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("session")?.trim() || "";
}

function syncSessionSplineBlock(): void {
  if (typeof window === "undefined") return;
  if (readSessionFromWindow()) {
    acquireSplineBlock("workspace-session-url");
    return;
  }
  releaseSplineBlock("workspace-session-url");
}

/**
 * Runs as a layout wrapper (parent render before canvas / rail).
 * Reads `window.location` — workspace writes session via `history.replaceState`,
 * which does not update `useSearchParams`.
 */
export function WorkspaceGpuGate({ children }: { children: ReactNode }) {
  syncSessionSplineBlock();

  useEffect(() => {
    const sync = () => {
      syncSessionSplineBlock();
    };
    sync();
    window.addEventListener("popstate", sync);
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...args: Parameters<History["pushState"]>) => {
      origPush(...args);
      queueMicrotask(sync);
    };
    history.replaceState = (...args: Parameters<History["replaceState"]>) => {
      origReplace(...args);
      queueMicrotask(sync);
    };
    return () => {
      window.removeEventListener("popstate", sync);
      history.pushState = origPush;
      history.replaceState = origReplace;
      releaseSplineBlock("workspace-session-url");
    };
  }, []);

  return children;
}
