"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Persistent /app layout gate. WorkspaceShell never unmounts across tab/chat,
 * so GPU must be stopped from this layout when a session (chat/delivery) is open.
 */
export function WorkspaceGpuGate() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session")?.trim() || "";

  useEffect(() => {
    if (!sessionId) return;
    let released = false;
    void import("@/lib/spline/spline-runtime-registry").then((m) => {
      if (released) return;
      m.acquireSplineBlock("workspace-session-url");
    });
    return () => {
      released = true;
      void import("@/lib/spline/spline-runtime-registry").then((m) => {
        m.releaseSplineBlock("workspace-session-url");
      });
    };
  }, [sessionId]);

  return null;
}
