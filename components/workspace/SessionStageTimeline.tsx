"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const STAGE_COUNT = 5;
const TITLE_KEYS = ["stage1", "stage2", "stage3", "stage4", "stage5"] as const;

type Props = {
  /** 1–5 = current (breathe); 6 = all complete; undefined → treat as 1 */
  stage?: number;
  className?: string;
};

/**
 * Per-session How+Get stage timeline (SoT workbench/11-session-stage-timeline.md).
 * Idle: line + dots only. Hover/click reveals stage title tooltip.
 */
export function SessionStageTimeline({ stage = 1, className }: Props) {
  const t = useTranslations("workspace.sessionStage");
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const complete = stage >= 6;
  const current = complete ? null : Math.min(5, Math.max(1, Math.floor(stage || 1)));

  const close = useCallback(() => setOpenIdx(null), []);

  useEffect(() => {
    if (openIdx == null) return;
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openIdx, close]);

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
          const tipId = `${baseId}-tip-${n}`;
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
                className={`session-stage-timeline__dot${
                  done ? " is-done" : ""
                }${isCurrent ? " is-current" : ""}${
                  upcoming ? " is-upcoming" : ""
                }`}
                aria-label={title}
                aria-describedby={tipOpen ? tipId : undefined}
                title={title}
                onMouseEnter={() => setOpenIdx(i)}
                onMouseLeave={() => setOpenIdx((v) => (v === i ? null : v))}
                onFocus={() => setOpenIdx(i)}
                onBlur={() => setOpenIdx((v) => (v === i ? null : v))}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIdx((v) => (v === i ? null : i));
                }}
              />
              {tipOpen ? (
                <span id={tipId} role="tooltip" className="session-stage-timeline__tip">
                  {title}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
