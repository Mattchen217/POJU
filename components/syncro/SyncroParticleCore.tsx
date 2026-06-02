"use client";

import { useAllowHeavyWebGL } from "@/lib/client/allow-heavy-webgl";
import { SYNCRO_FANGWEI_SCENE } from "@/components/syncro/SyncroSplineCanvas";
import { getSyncroParticleFieldStyle } from "@/lib/syncro/syncro-ring-layout";
import Spline from "@splinetool/react-spline";

type Props = {
  /**
   * Compass / AR / MAP: size & position on `.syncro-particle-spline` itself (no wrapper box).
   * Legacy ring uses `.particle-layer` instead.
   */
  bare?: boolean;
  opacity?: number;
};

export function SyncroParticleCore({ bare = false, opacity }: Props) {
  const allowWebGL = useAllowHeavyWebGL();
  const fieldStyle = bare ? getSyncroParticleFieldStyle({ opacity }) : undefined;
  const className = bare
    ? "syncro-particle-spline syncro-particle-field"
    : "syncro-particle-spline";

  if (bare) {
    return allowWebGL ? (
      <Spline scene={SYNCRO_FANGWEI_SCENE} className={className} style={fieldStyle} />
    ) : (
      <div
        className={`${className} syncro-particle-spline--static`}
        style={fieldStyle}
        aria-hidden
      />
    );
  }

  const spline = allowWebGL ? (
    <Spline scene={SYNCRO_FANGWEI_SCENE} className="syncro-particle-spline" />
  ) : (
    <div className="syncro-particle-spline syncro-particle-spline--static" />
  );

  return (
    <div className="particle-layer" aria-hidden>
      {spline}
    </div>
  );
}
