"use client";

import { useState, type ReactNode } from "react";

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

  return (
    <div
      className={`match-report-card ${expanded ? "expanded" : ""}`}
      style={{ borderLeftColor: color }}
    >
      <button
        type="button"
        className="card-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="card-icon" style={{ background: color }}>
          {icon}
        </div>
        <div className="card-header-text">
          <h3>{title}</h3>
          <p className="card-summary">{summary}</p>
        </div>
        <div className="card-toggle" aria-hidden>
          {expanded ? "−" : "+"}
        </div>
      </button>

      {expanded ? <div className="card-body">{children}</div> : null}
    </div>
  );
}
