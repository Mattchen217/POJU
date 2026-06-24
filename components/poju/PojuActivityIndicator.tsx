"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";
import "@/styles/poju-activity.css";

/** Wider framing so the POJU figure stays visible in the 2:1 chat strip. */
const POJU_CHAT_ACTIVITY_ZOOM = 0.68;

const ROTATE_MS = 2800;

export function PojuActivityIndicator({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    setI(0);
    if (lines.length <= 1) return;
    const id = window.setInterval(
      () => setI((p) => (p + 1) % linesRef.current.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [lines]);

  const caption = lines[i] ?? lines[0] ?? "";

  return (
    <div className="poju-activity" role="status" aria-live="polite">
      <div className="poju-activity__stage">
        <Suspense fallback={<div className="poju-activity__fallback" aria-hidden />}>
          <SplineInteractiveScene
            scene="/spline/POJUCHAT.splinecode"
            className="poju-activity__scene"
            initialZoom={POJU_CHAT_ACTIVITY_ZOOM}
            pointerFollow={false}
            webGLContext="preparing"
            renderOnDemand={false}
          />
        </Suspense>
        {caption ? (
          <p key={caption} className="poju-activity__caption">
            {caption}
          </p>
        ) : null}
      </div>
    </div>
  );
}
