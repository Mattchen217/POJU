"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";

import "@/styles/evidence-block.css";

type Props = {
  /** Visible summary label, e.g. "依据与推理" */
  label?: string;
  children: ReactNode;
  className?: string;
  /** Start expanded (default: collapsed). */
  defaultOpen?: boolean;
};

/**
 * Dual-layer delivery: folded "▸ 依据与推理" evidence block.
 * Body stays marker-free; gold terms live here.
 */
export function EvidenceBlock({
  label,
  children,
  className,
  defaultOpen = false,
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
          {open ? "▾" : "▸"}
        </span>
        <span className="evidence-block__label">{title}</span>
      </button>
      {open ? (
        <div id={panelId} className="evidence-block__panel" role="region">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Lead labels that should render as folded evidence (not always-visible chrome). */
export function isEvidenceLeadLabel(label: string): boolean {
  const t = label.replace(/[:：]\s*$/, "").trim();
  return /依据|推理|结构依据|时机判断|Profile\s*basis|Structural\s*basis|Timing\s*verdict|Evidence|Rationale|为什么这条|Why this/i.test(
    t,
  );
}
