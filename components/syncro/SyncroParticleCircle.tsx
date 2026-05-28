"use client";

import { useCallback, useEffect, useRef } from "react";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

import { useAllowHeavyWebGL } from "@/lib/client/allow-heavy-webgl";
import type { DirectionId } from "@/lib/syncro/current-system";
import { SYNCRO_FANGWEI_SCENE } from "@/components/syncro/SyncroSplineCanvas";

const ROTATION_OBJECT_NAMES = [
  "CompassGroup",
  "Particles",
  "Root",
  "Compass",
  "compass",
  "Ring",
  "ring",
  "Fangwei",
  "fangwei",
];

export type SyncroParticleCircleProps = {
  /** Degrees; negative compass heading keeps labels fixed on screen. */
  rotation: number;
  activeDirection: DirectionId;
};

function applySplineRotation(app: Application, rotationDeg: number): void {
  const rad = (rotationDeg * Math.PI) / 180;
  for (const name of ROTATION_OBJECT_NAMES) {
    try {
      const obj = app.findObjectByName(name) as { rotation?: { z?: number; y?: number } } | null;
      if (obj?.rotation) {
        if (typeof obj.rotation.z === "number") {
          obj.rotation.z = rad;
        } else if (typeof obj.rotation.y === "number") {
          obj.rotation.y = rad;
        }
        return;
      }
    } catch {
      /* try next */
    }
  }
}

const DIRECTION_LABELS: Array<{ id: DirectionId; label: string; angle: number }> = [
  { id: "N", label: "N", angle: 0 },
  { id: "NE", label: "NE", angle: 45 },
  { id: "E", label: "E", angle: 90 },
  { id: "SE", label: "SE", angle: 135 },
  { id: "S", label: "S", angle: 180 },
  { id: "SW", label: "SW", angle: 225 },
  { id: "W", label: "W", angle: 270 },
  { id: "NW", label: "NW", angle: 315 },
];

export function SyncroParticleCircle({ rotation, activeDirection }: SyncroParticleCircleProps) {
  const allowWebGL = useAllowHeavyWebGL();
  const splineRef = useRef<Application | null>(null);
  const smoothedRotationRef = useRef(rotation);

  useEffect(() => {
    if (!splineRef.current) return;

    const target = rotation;
    let current = smoothedRotationRef.current;
    let diff = target - current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    current += diff * 0.2;
    smoothedRotationRef.current = current;
    applySplineRotation(splineRef.current, current);
  }, [rotation]);

  const handleLoad = useCallback(
    (app: Application) => {
      splineRef.current = app;
      applySplineRotation(app, smoothedRotationRef.current);
    },
    [],
  );

  return (
    <div className="particle-circle">
      {allowWebGL ? (
        <Spline scene={SYNCRO_FANGWEI_SCENE} className="syncro-particle-spline" onLoad={handleLoad} />
      ) : (
        <div className="syncro-particle-spline syncro-particle-spline--static" aria-hidden />
      )}
      <DirectionLabels rotation={rotation} activeDirection={activeDirection} />
    </div>
  );
}

function DirectionLabels({
  rotation,
  activeDirection,
}: {
  rotation: number;
  activeDirection: DirectionId;
}) {
  const radius = 130;

  return (
    <div className="direction-labels" aria-hidden>
      {DIRECTION_LABELS.map((dir) => {
        const angleOnScreen = dir.angle + rotation;
        const rad = (angleOnScreen * Math.PI) / 180;
        const x = Math.sin(rad) * radius;
        const y = -Math.cos(rad) * radius;

        return (
          <span
            key={dir.id}
            className={`dir-label ${dir.id === activeDirection ? "active" : ""}`}
            style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
          >
            {dir.label}
          </span>
        );
      })}
    </div>
  );
}
