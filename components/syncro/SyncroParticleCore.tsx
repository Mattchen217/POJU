"use client";

import { useCallback } from "react";
import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

import { useAllowHeavyWebGL } from "@/lib/client/allow-heavy-webgl";
import { SYNCRO_FANGWEI_SCENE } from "@/components/syncro/SyncroSplineCanvas";
import { getSyncroParticleFieldStyle } from "@/lib/syncro/syncro-ring-layout";

function preventSplineCanvasFocus(app: Application) {
  const canvas = (app as Application & { canvas?: HTMLCanvasElement }).canvas;
  if (!canvas) return;
  canvas.tabIndex = -1;
  if (document.activeElement === canvas) {
    canvas.blur();
  }
}

type Props = {
  /**
   * Compass / AR / MAP: size & position on `.syncro-particle-spline` itself (no wrapper box).
   * Legacy ring uses `.particle-layer` instead.
   */
  bare?: boolean;
  opacity?: number;
  /** Scale particle field to a smaller ring (e.g. wait page mini compass). */
  ringSize?: number;
};

export function SyncroParticleCore({ bare = false, opacity, ringSize }: Props) {
  const allowWebGL = useAllowHeavyWebGL();
  const onSplineLoad = useCallback((app: Application) => {
    preventSplineCanvasFocus(app);
  }, []);
  const fieldStyle = bare ? getSyncroParticleFieldStyle({ opacity, ringSize }) : undefined;
  const className = bare
    ? "syncro-particle-spline syncro-particle-field"
    : "syncro-particle-spline";

  if (bare) {
    return allowWebGL ? (
      <Spline
        scene={SYNCRO_FANGWEI_SCENE}
        className={className}
        style={fieldStyle}
        onLoad={onSplineLoad}
      />
    ) : (
      <div
        className={`${className} syncro-particle-spline--static`}
        style={fieldStyle}
        aria-hidden
      />
    );
  }

  const spline = allowWebGL ? (
    <Spline scene={SYNCRO_FANGWEI_SCENE} className="syncro-particle-spline" onLoad={onSplineLoad} />
  ) : (
    <div className="syncro-particle-spline syncro-particle-spline--static" />
  );

  return (
    <div className="particle-layer" aria-hidden>
      {spline}
    </div>
  );
}
