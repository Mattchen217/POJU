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
};

/** Upright direction labels on the ring; highlightId is gold, others white. */
export function SyncroDirectionLabels({
  highlightId,
  labelRadius = SYNCRO_LABEL_RADIUS,
}: Props) {
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
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              fontSize: 14,
              fontWeight: isHighlight ? 600 : 500,
              color: isHighlight ? "#D4A574" : "#FFFFFF",
              opacity: isHighlight ? 1 : 0.65,
              textShadow: isHighlight
                ? "0 0 12px rgba(212, 165, 116, 0.6), 0 0 24px rgba(212, 165, 116, 0.3)"
                : "none",
              letterSpacing: 1.5,
              transition:
                "color 400ms ease, opacity 400ms ease, text-shadow 400ms ease, font-weight 400ms ease",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 3,
            }}
          >
            {dir.id}
          </div>
        );
      })}
    </>
  );
}
