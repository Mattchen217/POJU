"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";

import "@/styles/a4-paper-sheet.css";

export type A4PaperSheetMode = "folded" | "flat";

type Props = {
  mode: A4PaperSheetMode;
  children: ReactNode;
  className?: string;
  /** Show dog-ear flap (hidden automatically in flat mode via CSS). */
  showFold?: boolean;
};

/**
 * Charcoal-glass paper shell shared with wait-ritual artifacts.
 * `folded` = A4 icon with dog-ear; `flat` = rail-width open sheet.
 */
export function A4PaperSheet({
  mode,
  children,
  className,
  showFold = true,
}: Props) {
  return (
    <div
      className={clsx(
        "a4-paper-sheet",
        mode === "folded" ? "a4-paper-sheet--folded" : "a4-paper-sheet--flat",
        className,
      )}
    >
      <div className="a4-paper-sheet__paper">
        <div className="a4-paper-sheet__body">{children}</div>
      </div>
      {showFold ? (
        <span className="a4-paper-sheet__fold" aria-hidden>
          <span className="a4-paper-sheet__fold-face" />
          <span className="a4-paper-sheet__fold-crease" />
        </span>
      ) : null}
    </div>
  );
}

/** Sun / compute glyph used on wait-ritual compute artifact. */
export function A4PaperComputeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.2 6.2l1.6 1.6M16.2 16.2l1.6 1.6M6.2 17.8l1.6-1.6M16.2 7.8l1.6-1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Personal energy portrait mark — concentric rings + Q-tail.
 * Color via currentColor (gold on paper cover; white in collapsed rail).
 */
export function EnergyPortraitGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="5.6" stroke="currentColor" strokeWidth="1.45" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <path
        d="M13.15 13.15 17.6 17.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Personal energy analysis report mark — rounded document + fat text lines.
 * Color via currentColor (gold on paper cover; white in collapsed rail).
 */
export function EnergyReportGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="3.25"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M8.5 9h7M8.5 12.5h7M8.5 16h4.75"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Phase-4 delivery book — distinct from base energy report (open book). */
export function DeliveryBookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <path
        d="M4 5.5c2.2-1.2 4.6-1.2 6.5 0v13c-1.9-1.1-4.3-1.1-6.5 0V5.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M20 5.5c-2.2-1.2-4.6-1.2-6.5 0v13c1.9-1.1 4.3-1.1 6.5 0V5.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 5.5v13M13.5 5.5v13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
