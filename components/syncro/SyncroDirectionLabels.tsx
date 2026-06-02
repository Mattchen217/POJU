"use client";

import { SYNCRO_LABEL_RADIUS } from "@/lib/syncro/syncro-ring-layout";

const DIRECTIONS = [
  { id: "N", angle: 0 },
  { id: "NE", angle: 45 },
  { id: "E", angle: 90 },
  { id: "SE", angle: 135 },
  { id: "S", angle: 180 },
  { id: "SW", angle: 225 },
  { id: "W", angle: 270 },
  { id: "NW", angle: 315 },
] as const;

type Props = {
  highlightId: string;
  labelRadius?: number;
  /** Counter-rotate so labels stay upright inside a rotating parent (pass compass alpha). */
  counterRotateDeg?: number;
};

/** Direction labels on the ring; active = gold, larger, glow. */
export function SyncroDirectionLabels({
  highlightId,
  labelRadius = SYNCRO_LABEL_RADIUS,
  counterRotateDeg,
}: Props) {
  const upright =
    counterRotateDeg !== undefined ? ` rotate(${counterRotateDeg}deg)` : "";

  return (
    <>
      {DIRECTIONS.map((dir) => {
        const rad = ((dir.angle - 90) * Math.PI) / 180;
        const x = Math.cos(rad) * labelRadius;
        const y = Math.sin(rad) * labelRadius;
        const isHighlight = dir.id === highlightId;

        return (
          <div
            key={dir.id}
            className={`syncro-direction-label ${isHighlight ? "is-active" : ""}`}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))${upright}`,
            }}
          >
            {dir.id}
          </div>
        );
      })}
    </>
  );
}
