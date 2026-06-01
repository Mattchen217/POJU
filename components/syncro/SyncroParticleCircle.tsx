"use client";

import { SyncroDirectionRing } from "@/components/syncro/SyncroDirectionRing";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";
import type { DirectionId } from "@/lib/syncro/current-system";

export type SyncroParticleCircleProps = {
  /** Degrees; negative compass heading — rotates layer 1+2 together. */
  rotation: number;
  activeDirection: DirectionId;
};

/**
 * Legacy wrapper: concentric rotating scene (particle + direction ring).
 * Prefer `SyncroParticleCore` + `SyncroDirectionRing` inside a `.rotating-layer` for new UI.
 */
export function SyncroParticleCircle({ rotation, activeDirection }: SyncroParticleCircleProps) {
  return (
    <div
      className="syncro-particle-circle-legacy"
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: "transform 200ms ease-out",
      }}
    >
      <SyncroParticleCore />
      <SyncroDirectionRing activeDirection={activeDirection} />
    </div>
  );
}
