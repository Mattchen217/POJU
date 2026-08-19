"use client";

import { useEffect, useRef } from "react";

import { startLandingStarfield } from "@/lib/workspace/landing-starfield";

/**
 * Workspace center sky — same ANIMATION_41 field as public/v2-landing.html.
 * Stays up for idle home, chat, and session URLs. Spline quiet-GPU must not
 * tear this layer down (that flag only stops 3D scenes).
 */

export function WorkspaceStarfieldGate() {
  return <WorkspaceStarfieldLayer />;
}

export function WorkspaceStarfieldLayer() {
  const webglRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const webgl = webglRef.current;
    const fallback = fallbackRef.current;
    if (!webgl || !fallback) return;
    return startLandingStarfield({ webgl, fallback });
  }, []);

  return (
    <div className="workspace-shell__starfield" aria-hidden>
      <canvas
        ref={fallbackRef}
        className="workspace-shell__starfield-canvas workspace-shell__starfield-canvas--fallback"
      />
      <canvas
        ref={webglRef}
        className="workspace-shell__starfield-canvas workspace-shell__starfield-canvas--webgl"
      />
    </div>
  );
}
