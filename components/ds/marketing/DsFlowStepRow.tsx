"use client";

import { useEffect, useState } from "react";

import { ACTIVITY_CAPTION_ROTATE_MS } from "@/lib/ui/activity-caption-timing";

export type FlowStep = { title: string; desc?: string };

export function DsFlowStepRow({
  steps,
  accentRgb,
  cycleMs = ACTIVITY_CAPTION_ROTATE_MS,
  activeIndex,
}: {
  steps: FlowStep[];
  accentRgb: string;
  /** Used only when `activeIndex` is not provided. */
  cycleMs?: number;
  /** When set, parent drives step highlight (no internal timer). */
  activeIndex?: number;
}) {
  const [internalActive, setInternalActive] = useState(0);
  const active = activeIndex ?? internalActive;

  useEffect(() => {
    if (activeIndex != null || steps.length <= 1) return;
    const id = window.setInterval(() => setInternalActive((x) => (x + 1) % steps.length), cycleMs);
    return () => window.clearInterval(id);
  }, [activeIndex, steps.length, cycleMs]);

  return (
    <div className="ds-flow-step-row">
      {steps.map((step, i) => {
        const on = i === active;
        return (
          <div
            key={step.title}
            className={`ds-flow-step-chip ${on ? "ds-flow-step-chip--active" : ""}`}
            style={
              on
                ? {
                    background: `linear-gradient(165deg, rgba(${accentRgb},0.16), rgba(255,255,255,0.02))`,
                    boxShadow: `inset 0 0 0 0.5px rgba(${accentRgb},0.5), 0 0 26px rgba(${accentRgb},0.16)`,
                  }
                : undefined
            }
          >
            <div className="flex items-center gap-2">
              <span
                className="ds-flow-step-chip__index"
                style={
                  on
                    ? { color: "#0a0510", background: `rgb(${accentRgb})` }
                    : {
                        color: `rgb(${accentRgb})`,
                        boxShadow: `inset 0 0 0 1px rgba(${accentRgb},0.5)`,
                      }
                }
              >
                {i + 1}
              </span>
              <p
                className="m-0 text-sm font-semibold leading-snug"
                style={{ color: on ? "#fff" : "var(--pj-text-secondary)" }}
              >
                {step.title}
              </p>
            </div>
            {step.desc ? (
              <p
                className="mt-2 text-[12.5px] leading-snug"
                style={{ color: on ? "rgba(255,255,255,0.82)" : "var(--pj-text-tertiary)" }}
              >
                {step.desc}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
