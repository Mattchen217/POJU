"use client";

import { useCallback, useEffect, useRef } from "react";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

export const SYNCRO_FANGWEI_SCENE = "/spline/fangwei.splinecode";

const ROTATION_OBJECT_NAMES = ["Compass", "compass", "Ring", "ring", "Fangwei", "fangwei", "Scene"];

export type SyncroSplineCanvasProps = {
  compassDegree: number;
  vrMode?: boolean;
  onLoad?: () => void;
};

function applyCompassRotation(app: Application, compassDegree: number): void {
  const rad = -compassDegree * (Math.PI / 180);
  for (const name of ROTATION_OBJECT_NAMES) {
    try {
      const obj = app.findObjectByName(name);
      if (obj && "rotation" in obj && obj.rotation) {
        obj.rotation.y = rad;
        return;
      }
    } catch {
      // try next name
    }
  }
}

export function SyncroSplineCanvas({ compassDegree, vrMode, onLoad }: SyncroSplineCanvasProps) {
  const splineRef = useRef<Application | null>(null);

  useEffect(() => {
    if (!splineRef.current) return;
    applyCompassRotation(splineRef.current, compassDegree);
  }, [compassDegree]);

  const handleLoad = useCallback(
    (app: Application) => {
      splineRef.current = app;
      applyCompassRotation(app, compassDegree);
      onLoad?.();
    },
    [compassDegree, onLoad],
  );

  return (
    <div className={`syncro-spline-canvas ${vrMode ? "vr-mode" : ""}`}>
      <Spline scene={SYNCRO_FANGWEI_SCENE} className="h-full w-full" onLoad={handleLoad} />
    </div>
  );
}
