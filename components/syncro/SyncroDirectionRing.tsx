"use client";

import type { DirectionId } from "@/lib/syncro/current-system";

/** Label radius as % of concentric container (outer ring). */
export const SYNCRO_DIRECTION_RING_RADIUS_PCT = 47;

const DIRECTION_RING: Array<{ id: DirectionId; label: string; angle: number }> = [
  { id: "N", label: "N", angle: 0 },
  { id: "NE", label: "NE", angle: 45 },
  { id: "E", label: "E", angle: 90 },
  { id: "SE", label: "SE", angle: 135 },
  { id: "S", label: "S", angle: 180 },
  { id: "SW", label: "SW", angle: 225 },
  { id: "W", label: "W", angle: 270 },
  { id: "NW", label: "NW", angle: 315 },
];

export type SyncroDirectionRingProps = {
  activeDirection: DirectionId;
};

/**
 * Layer 1 — eight compass labels on the outer ring (inside `.rotating-layer`).
 */
export function SyncroDirectionRing({ activeDirection }: SyncroDirectionRingProps) {
  const radius = SYNCRO_DIRECTION_RING_RADIUS_PCT;

  return (
    <div className="direction-ring" aria-hidden>
      {DIRECTION_RING.map((dir) => {
        const rad = ((dir.angle - 90) * Math.PI) / 180;
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;

        return (
          <div
            key={dir.id}
            className={`direction-label ${dir.id === activeDirection ? "active" : ""}`}
            style={{
              transform: `translate(calc(-50% + ${x}%), calc(-50% + ${y}%))`,
            }}
          >
            {dir.label}
          </div>
        );
      })}
    </div>
  );
}
