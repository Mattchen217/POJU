"use client";

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import "@/styles/poju-activity.css";

const Spline = lazy(() => import("@splinetool/react-spline"));

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
      <Suspense fallback={<div className="poju-activity__fallback" aria-hidden />}>
        <Spline scene="/spline/POJUCHAT.splinecode" className="poju-activity__scene" />
      </Suspense>
      <p key={caption} className="poju-activity__caption">
        {caption}
      </p>
    </div>
  );
}
