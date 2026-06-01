"use client";

import type { DirectionId } from "@/lib/syncro/current-system";

/** Distance from center to direction labels (px). */
export const SYNCRO_DIRECTION_RING_RADIUS = 130;

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
  const radius = SYNCRO_DIRECTION_RING_RADIUS;

  return (
    <div className="direction-ring" aria-hidden>
      {DIRECTION_RING.map((dir) => (
        <div
          key={dir.id}
          className={`direction-label ${dir.id === activeDirection ? "active" : ""}`}
          style={{
            transform: `rotate(${dir.angle}deg) translateY(-${radius}px) rotate(${-dir.angle}deg)`,
          }}
        >
          {dir.label}
        </div>
      ))}
    </div>
  );
}
