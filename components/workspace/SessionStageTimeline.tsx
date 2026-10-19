"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

const STAGE_COUNT = 5;
const TITLE_KEYS = ["stage1", "stage2", "stage3", "stage4", "stage5"] as const;

type TipCoords = { top: number; left: number };

type Props = {
  /** 0 = never started (all gray); 1-5 = current (breathe); 6 = all complete; undefined -> treat as 1 */
  stage?: number;
  className?: string;
};

/**
 * Per-session How+Get stage timeline (SoT workbench/11-session-stage-timeline.md).
 * Idle: line + dots only. Hover/click reveals stage title tooltip (portaled to body).
 */
export function SessionStageTimeline({ stage = 1, className }: Props) {
  const t = useTranslations("workspace.sessionStage");
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [tipCoords, setTipCoords] = useState<TipCoords>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  const neverStarted = stage === 0;
  const complete = !neverStarted && stage >= 6;
  const current = neverStarted
    ? null
    : complete
      ? null
      : Math.min(5, Math.max(1, Math.floor(stage || 1)));

  const close = useCallback(() => setOpenIdx(null), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const reposition = useCallback(() => {
    if (openIdx == null) return;
    const el = dotRefs.current[openIdx];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const ideal = r.left + r.width / 2;
    const left = Math.min(window.innerWidth - pad, Math.max(pad, ideal));
    setTipCoords({ top: r.top - 8, left });
  }, [openIdx]);

  useLayoutEffect(() => {
    if (openIdx == null) return;
    reposition();
  }, [openIdx, reposition]);

  useEffect(() => {
    if (openIdx == null) return;
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onReposition = () => reposition();
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [openIdx, close, reposition]);

  const tipTitle = openIdx != null ? t(TITLE_KEYS[openIdx]) : "";
  const tipId = openIdx != null ? `${baseId}-tip-${openIdx + 1}` : undefined;

  const tipPortal =
    mounted && openIdx != null
      ? createPortal(
          <span
            id={tipId}
            role="tooltip"
            className="session-stage-timeline__tip session-stage-timeline__tip--portal"
            style={{ top: tipCoords.top, left: tipCoords.left }}
          >
            {tipTitle}
          </span>,
          document.body,
        )
      : null;

  const rootClass = ["session-stage-timeline", className].filter(Boolean).join(" ");

  return (
    <div
      ref={rootRef}
      className={rootClass}
      role="group"
      aria-label={t("aria")}
    >
      <div className="session-stage-timeline__track" aria-hidden>
        {Array.from({ length: STAGE_COUNT }, (_, i) => {
          const n = i + 1;
          const done = complete || (current != null && n < current);
          const isCurrent = !complete && current === n;
          const upcoming = !done && !isCurrent;
          const tipOpen = openIdx === i;
          const title = t(TITLE_KEYS[i]);
          return (
            <div key={n} className="session-stage-timeline__slot">
              {i > 0 ? (
                <span
                  className={`session-stage-timeline__seg${
                    done || isCurrent ? " is-lit" : ""
                  }`}
                />
              ) : null}
              <button
                type="button"
                ref={(el) => {
                  dotRefs.current[i] = el;
                }}
                className={`session-stage-timeline__dot${
                  done ? " is-done" : ""
                }${isCurrent ? " is-current" : ""}${
                  upcoming ? " is-upcoming" : ""
                }`}
                aria-label={title}
                aria-describedby={tipOpen ? tipId : undefined}
                onMouseEnter={() => setOpenIdx(i)}
                onMouseLeave={() => setOpenIdx((v) => (v === i ? null : v))}
                onFocus={() => setOpenIdx(i)}
                onBlur={() => setOpenIdx((v) => (v === i ? null : v))}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIdx((v) => (v === i ? null : i));
                }}
              />
            </div>
          );
        })}
      </div>
      {tipPortal}
    </div>
  );
}