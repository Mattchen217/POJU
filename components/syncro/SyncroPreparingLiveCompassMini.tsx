"use client";

import { useEffect, useRef, useState } from "react";

import { SyncroDirectionLabels } from "@/components/syncro/SyncroDirectionLabels";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";
import { compassDegreeToDirection } from "@/lib/syncro/current-system";
import {
  SYNCRO_LABEL_RADIUS,
  SYNCRO_PREPARING_RING_SIZE,
  SYNCRO_RING_SIZE,
} from "@/lib/syncro/syncro-ring-layout";

import "@/styles/syncro-compass.css";

const RING_SCALE = SYNCRO_PREPARING_RING_SIZE / SYNCRO_RING_SIZE;
const PREPARING_LABEL_RADIUS = Math.round(SYNCRO_LABEL_RADIUS * RING_SCALE);

/** Small auto-rotating compass + particles for the Syncro wait page. */
export function SyncroPreparingLiveCompassMini() {
  const [compassDegree, setCompassDegree] = useState(48);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      setCompassDegree((48 + ((now - start) / 1000) * 10) % 360);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const highlightId = compassDegreeToDirection(compassDegree);

  return (
    <div
      className="syncro-preparing-live-compass"
      aria-hidden
      style={{
        position: "relative",
        width: SYNCRO_PREPARING_RING_SIZE,
        height: SYNCRO_PREPARING_RING_SIZE,
        margin: "0 auto 12px",
        overflow: "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `rotate(${-compassDegree}deg)`,
          transformOrigin: "center center",
        }}
      >
        <SyncroParticleCore bare opacity={0.92} ringSize={SYNCRO_PREPARING_RING_SIZE} />
        <SyncroDirectionLabels
          highlightId={highlightId}
          labelRadius={PREPARING_LABEL_RADIUS}
          counterRotateDeg={compassDegree}
          labelScale={RING_SCALE}
        />
      </div>
    </div>
  );
}
