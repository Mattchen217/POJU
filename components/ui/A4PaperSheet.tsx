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
 * Base energy analysis report mark — rounded document + text lines.
 * (Not the vault「决策报告」/「30日提醒」marks.)
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

/**
 * Decision report (历史交付 · 决策报告) — sealed dossier + cross seal.
 * Distinct from portrait rings and reminders calendar; reads at ~11px.
 */
export function DeliveryBookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      {/* back leaf — depth */}
      <path
        d="M9 4.25h8.25A1.75 1.75 0 0 1 19 6v11.5"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* front leaf */}
      <rect
        x="4.25"
        y="5.25"
        width="12.75"
        height="14.5"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* wax seal */}
      <circle cx="10.6" cy="12.4" r="3.35" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8.85 12.4h3.5M10.6 10.65v3.5"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 30-day reminders (历史交付 · 30日提醒) — calendar with day ticks.
 * Distinct from portrait rings and decision-report seal.
 */
export function RemindersGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <rect
        x="4.25"
        y="6"
        width="15.5"
        height="13.75"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M4.25 10.1h15.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8.75 4v3.35M15.25 4v3.35"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* day marks — filled / hollow to suggest a schedule */}
      <circle cx="8.35" cy="13.35" r="1.05" fill="currentColor" />
      <circle cx="12" cy="13.35" r="1.05" fill="currentColor" />
      <circle cx="15.65" cy="13.35" r="1.05" fill="currentColor" />
      <circle cx="8.35" cy="16.85" r="1.05" fill="currentColor" />
      <circle
        cx="12"
        cy="16.85"
        r="1.05"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}
