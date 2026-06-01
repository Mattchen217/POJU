"use client";

import { useAllowHeavyWebGL } from "@/lib/client/allow-heavy-webgl";
import { SYNCRO_FANGWEI_SCENE } from "@/components/syncro/SyncroSplineCanvas";
import Spline from "@splinetool/react-spline";

type Props = {
  /** No border-radius / overflow mask — used inside 380px inline wrapper. */
  bare?: boolean;
};

export function SyncroParticleCore({ bare = false }: Props) {
  const allowWebGL = useAllowHeavyWebGL();

  const spline = allowWebGL ? (
    <Spline scene={SYNCRO_FANGWEI_SCENE} className="syncro-particle-spline" />
  ) : (
    <div className="syncro-particle-spline syncro-particle-spline--static" />
  );

  if (bare) {
    return (
      <div style={{ width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
        {spline}
      </div>
    );
  }

  return (
    <div className="particle-layer" aria-hidden>
      {spline}
    </div>
  );
}
