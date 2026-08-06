"use client";

import { useEffect, useRef, useState } from "react";
import { ACTIVITY_CAPTION_ROTATE_MS } from "@/lib/ui/activity-caption-timing";
import "@/styles/poju-activity.css";

const ROTATE_MS = ACTIVITY_CAPTION_ROTATE_MS;

/**
 * Compact wait row (spinner ± copy) — replaces the former Spline meditation scene.
 * Stages 1 & 3 typically pass empty `lines` (spinner only).
 * Stage 2 uses `thinkingLine` for deep-analysis / agenda copy (+ progress).
 */
export function PojuActivityIndicator({
  lines,
  thinkingLine,
}: {
  lines: string[];
  /** Live status / progress under (or instead of) rotating captions. */
  thinkingLine?: string | null;
}) {
  const [i, setI] = useState(0);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const captions = lines.map((s) => s.trim()).filter(Boolean);

  useEffect(() => {
    setI(0);
    if (captions.length <= 1) return;
    const id = window.setInterval(
      () => setI((p) => (p + 1) % linesRef.current.filter((s) => s.trim()).length),
      ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [captions.length, lines]);

  const caption = captions[i] ?? captions[0] ?? "";
  const status = thinkingLine?.trim() ?? "";
  const statusParts = status
    ? status.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];
  const primary = caption || statusParts[0] || "";
  const secondary = caption
    ? status && status !== caption
      ? status
      : ""
    : statusParts.slice(1).join("\n");

  return (
    <div className="poju-activity" role="status" aria-live="polite" aria-busy="true">
      <div className="poju-activity__row">
        <span className="poju-activity__spin" aria-hidden />
        {primary ? (
          <div className="poju-activity__text">
            <p key={primary} className="poju-activity__caption">
              {primary}
            </p>
            {secondary ? <p className="poju-activity__sub">{secondary}</p> : null}
          </div>
        ) : (
          <span className="poju-activity__visually-hidden">Loading</span>
        )}
      </div>
    </div>
  );
}
