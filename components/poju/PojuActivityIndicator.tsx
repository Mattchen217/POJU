"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { SplineInteractiveScene } from "@/components/spline/SplineInteractiveScene";
import { ACTIVITY_CAPTION_ROTATE_MS } from "@/lib/ui/activity-caption-timing";
import "@/styles/poju-activity.css";

/** Framing for strip height = (width÷2)×⅔; nudge figure to vertical center. */
const POJU_CHAT_ACTIVITY_ZOOM = 0.74;

const ROTATE_MS = ACTIVITY_CAPTION_ROTATE_MS;

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
