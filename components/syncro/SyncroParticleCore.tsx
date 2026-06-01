"use client";

import { useAllowHeavyWebGL } from "@/lib/client/allow-heavy-webgl";
import { SYNCRO_FANGWEI_SCENE } from "@/components/syncro/SyncroSplineCanvas";
import Spline from "@splinetool/react-spline";

/**
 * Spline particle ring for Syncro concentric layout (Layer 2).
 * Rotation is applied by the parent `.rotating-layer` (compass heading).
 */
export function SyncroParticleCore() {
  const allowWebGL = useAllowHeavyWebGL();

  return (
    <div className="particle-layer" aria-hidden>
      {allowWebGL ? (
        <Spline scene={SYNCRO_FANGWEI_SCENE} className="syncro-particle-spline" />
      ) : (
        <div className="syncro-particle-spline syncro-particle-spline--static" />
      )}
    </div>
  );
}
