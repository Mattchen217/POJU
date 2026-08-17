"use client";

import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";
import { isEvidenceLeadLabel } from "@/lib/reading/parse-reading-blocks";
import { deliveryEvidenceLabelPlain } from "@/lib/llm/pro/delivery/delivery-locale";

import "@/styles/evidence-block.css";

export { isEvidenceLeadLabel };

type Props = {
  /** Visible summary label, e.g. "依据与推理" */
  label?: string;
  /** When label omitted, pick default from locale (zh/en/es/de/fr). */
  locale?: string;
  children: ReactNode;
  className?: string;
  /** Start expanded (default: collapsed). */
  defaultOpen?: boolean;
  /** Toggle leading mark — delivery reference uses play_arrow when collapsed. */
  toggleIcon?: "chevron" | "play";
};

/** Swap expand/collapse verb in the visible label. */
function labelForOpenState(title: string, open: boolean): string {
  if (!open) return title;
  return title
    .replace(/^展开/, "关闭")
    .replace(/^Expand\b/i, "Close");
}

/**
 * Dual-layer delivery: folded golden evidence block.
 * Collapsed = children not mounted (OOM guard). Evidence GlossaryText trees are heavy;
 * keeping them alive while hidden tipped Chrome Out of Memory on long idle.
 */
export function EvidenceBlock({
  label,
  locale = "en",
  children,
  className,
  defaultOpen = false,
  toggleIcon = "chevron",
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const baseTitle = (label || deliveryEvidenceLabelPlain(locale))
    .replace(/[:：]\s*$/, "")
    .trim();
  const title = labelForOpenState(baseTitle, open);

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
            <span className="material-symbols-outlined evidence-block__play">
              {open ? "expand_more" : "play_arrow"}
            </span>
          ) : open ? (
            "▾"
          ) : (
            "▸"
          )}
        </span>
        <span className="evidence-block__label">{title}</span>
      </button>
      <div
        id={panelId}
        className="evidence-block__panel"
        role="region"
        hidden={!open}
      >
        {open ? children : null}
      </div>
    </div>
  );
}
