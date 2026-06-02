"use client";

import type { ReactNode } from "react";

import { SyncroDirectionLabels } from "@/components/syncro/SyncroDirectionLabels";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";

type Props = {
  highlightId: string;
  /** Compass heading (deg); ring rotates -alpha. */
  rotationDeg?: number;
  /** False for map mode (static ring). */
  enableRotation?: boolean;
  particleOpacity?: number;
  /** Center overlay (compass text, AR camera, map hub). */
  center?: ReactNode;
  /** Extra layer inside rotating ring (e.g. map tap points). */
  ringOverlay?: ReactNode;
};

/** Shared particle ring + direction labels (AR / compass / map). */
export function SyncroRingStage({
  highlightId,
  rotationDeg = 0,
  enableRotation = true,
  particleOpacity,
  center,
  ringOverlay,
}: Props) {
  return (
    <div className="compass-stage">
      <div className="compass-area concentric-system">
        <div
          className="syncro-ring-rotate"
          style={
            enableRotation
              ? {
                  transform: `rotate(${-rotationDeg}deg)`,
                }
              : undefined
          }
        >
          <SyncroParticleCore bare opacity={particleOpacity} />
          <SyncroDirectionLabels
            highlightId={highlightId}
            counterRotateDeg={enableRotation ? rotationDeg : undefined}
          />
          {ringOverlay}
        </div>
        {center ? <div className="syncro-ring-center">{center}</div> : null}
      </div>
    </div>
  );
}
