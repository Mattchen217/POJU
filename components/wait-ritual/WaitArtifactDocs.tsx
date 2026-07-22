"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";

import type { BaseAnalysisArtifactKind } from "@/lib/base-analysis/progress-stages";
import {
  WAIT_ARTIFACT_CENTER_HOLD_MS,
  WAIT_ARTIFACT_SPAWN_MS,
} from "@/lib/wait-ritual/constants";

type Props = {
  artifacts: BaseAnalysisArtifactKind[];
  /** When false, hide translate slot (zh pipeline). */
  includeTranslate: boolean;
};

/** spawn → hold (center) → seated (left 2×2 slots). */
type SeatState = "spawn" | "hold" | "seated";

const ORDER: BaseAnalysisArtifactKind[] = ["compute", "narrative", "evidence", "translate"];

function Glyph({ kind }: { kind: BaseAnalysisArtifactKind }) {
  switch (kind) {
    case "compute":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="wait-artifact-doc__glyph">
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
    case "narrative":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="wait-artifact-doc__glyph">
          <path
            d="M6 7.5h12M6 12h12M6 16.5h8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "evidence":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="wait-artifact-doc__glyph">
          <path
            d="M7 17.5 15.2 5.8a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L10 18.5H7v-1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M14.2 7.2 16.8 9.8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "translate":
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="wait-artifact-doc__glyph">
          <path
            d="M5 7h8M9 7c0 5-2 8-5 10M7.5 11.5h5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M14 14h5l-2.5 6M15.2 17.2h2.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function ArtifactDoc({
  kind,
  slotIndex,
  slotCount,
  caption,
}: {
  kind: BaseAnalysisArtifactKind;
  slotIndex: number;
  slotCount: number;
  caption: string;
}) {
  const [state, setState] = useState<SeatState>("spawn");
  const slotCol = slotIndex % 2;
  const slotRow = Math.floor(slotIndex / 2);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setState("seated");
      return;
    }

    const toHold = window.setTimeout(() => setState("hold"), WAIT_ARTIFACT_SPAWN_MS);
    const toSeat = window.setTimeout(
      () => setState("seated"),
      WAIT_ARTIFACT_SPAWN_MS + WAIT_ARTIFACT_CENTER_HOLD_MS,
    );
    return () => {
      window.clearTimeout(toHold);
      window.clearTimeout(toSeat);
    };
  }, []);

  // First paint: start at scale 0.35 then next frame promote to hold-size spawn.
  const [spawnActive, setSpawnActive] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSpawnActive(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={clsx(
        "wait-artifact-doc",
        state === "spawn" && "wait-artifact-doc--spawn",
        state === "spawn" && spawnActive && "wait-artifact-doc--spawn-active",
        state === "hold" && "wait-artifact-doc--hold",
        state === "seated" && "wait-artifact-doc--seated",
      )}
      style={
        {
          "--artifact-slot": slotIndex,
          "--artifact-count": slotCount,
          "--artifact-col": slotCol,
          "--artifact-row": slotRow,
        } as CSSProperties
      }
      aria-hidden
    >
      <div className="wait-artifact-doc__sheet">
        <div className="wait-artifact-doc__paper">
          <div className="wait-artifact-doc__cover">
            <Glyph kind={kind} />
            <p className="wait-artifact-doc__caption">{caption}</p>
          </div>
        </div>
        {/* Dog-ear outside clipped paper so the flap stays visible */}
        <span className="wait-artifact-doc__fold" aria-hidden>
          <span className="wait-artifact-doc__fold-face" />
          <span className="wait-artifact-doc__fold-crease" />
        </span>
        {/* Completed badge — only after seated */}
        {state === "seated" ? (
          <span className="wait-artifact-doc__done" aria-hidden>
            <svg viewBox="0 0 16 16" className="wait-artifact-doc__done-icon">
              <path
                d="M3.5 8.2 6.6 11.2 12.5 4.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Wait-ritual documents: center scale-up → hold 5s → seat in centered-left 2×2 slots.
 * Cover layout: glyph + done caption on the paper. Non-interactive.
 */
export function WaitArtifactDocs({ artifacts, includeTranslate }: Props) {
  const t = useTranslations("wait_ritual.artifacts");
  const visibleKinds = ORDER.filter((k) => {
    if (k === "translate" && !includeTranslate) return false;
    return artifacts.includes(k);
  });
  const slotCount = includeTranslate ? 4 : 3;

  if (visibleKinds.length === 0) return null;

  return (
    <div className="wait-artifact-layer" aria-hidden>
      {visibleKinds.map((kind) => {
        const slotIndex = ORDER.filter((k) => k !== "translate" || includeTranslate).indexOf(kind);
        return (
          <ArtifactDoc
            key={kind}
            kind={kind}
            slotIndex={slotIndex}
            slotCount={slotCount}
            caption={t(`${kind}_done` as "compute_done")}
          />
        );
      })}
    </div>
  );
}
