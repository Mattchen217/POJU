"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";
import { isEvidenceLeadLabel } from "@/lib/reading/parse-reading-blocks";

import "@/styles/evidence-block.css";

export { isEvidenceLeadLabel };

type Props = {
  /** Visible summary label, e.g. "依据与推理" */
  label?: string;
  children: ReactNode;
  className?: string;
  /** Start expanded (default: collapsed). */
  defaultOpen?: boolean;
  /** Toggle leading mark — delivery reference uses play_arrow. */
  toggleIcon?: "chevron" | "play";
};

/**
 * Dual-layer delivery: folded golden "▸ 依据与推理" evidence block.
 * Label uses dotted underline when collapsed (same affordance as term-mark soft words).
 */
export function EvidenceBlock({
  label,
  children,
  className,
  defaultOpen = false,
  toggleIcon = "chevron",
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const zh = !label || /[\u4e00-\u9fff]/.test(label);
  const title = (label || (zh ? "依据与推理" : "Evidence & reasoning"))
    .replace(/[:：]\s*$/, "")
    .trim();

  return (
    <div className={cn("evidence-block", open && "evidence-block--open", className)}>
      <button
        type="button"
        className="evidence-block__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="evidence-block__chevron" aria-hidden>
          {toggleIcon === "play" ? (
            <span className="material-symbols-outlined evidence-block__play">play_arrow</span>
          ) : open ? (
            "▾"
          ) : (
            "▸"
          )}
        </span>
        <span className="evidence-block__label">{title}</span>
      </button>
      {/* Keep panel mounted when collapsed — unmount+remount re-runs MarkedInline against
          the parent dedupeScope Set and demotes gold terms to plain soft text. */}
      <div
        id={panelId}
        className="evidence-block__panel"
        role="region"
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}
