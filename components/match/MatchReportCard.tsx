"use client";

import { Award, ChevronDown, Compass, Infinity, type LucideIcon } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

const CARD_LUCIDE: Record<string, LucideIcon> = {
  infinity: Infinity,
  award: Award,
  compass: Compass,
};

type MatchReportCardProps = {
  icon: string;
  title: string;
  summary: string;
  color: string;
  defaultExpanded?: boolean;
  children: ReactNode;
};

export function MatchReportCard({
  icon,
  title,
  summary,
  color,
  defaultExpanded = false,
  children,
}: MatchReportCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isMonogram = icon.length === 1;
  const LucideGlyph = !isMonogram ? CARD_LUCIDE[icon] : null;

  return (
    <div
      className={`match-report-card ${expanded ? "expanded" : ""}`}
      style={{ "--c": color } as CSSProperties}
    >
      <button
        type="button"
        className="card-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="card-icon">
          {isMonogram ? icon : LucideGlyph ? <LucideGlyph size={20} strokeWidth={2} /> : icon}
        </div>
        <div className="card-header-text">
          <h3>{title}</h3>
          <p className="card-summary">{summary}</p>
        </div>
        <div className="card-toggle" aria-hidden>
          <ChevronDown size={18} strokeWidth={2} />
        </div>
      </button>

      {expanded ? <div className="card-body">{children}</div> : null}
    </div>
  );
}
