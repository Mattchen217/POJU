/**
 * Face 01 reader UI — 本题决策结论 (Batch 0 / SoT 2026-11).
 * Continuous user-facing page number; no internal claim/evidence/term ids shown.
 */

"use client";

import type { ReactNode } from "react";
import type { Face01 } from "@/lib/llm/pro/delivery/page-schema/face-types";
import {
  isFace01Legacy,
  isFace01V2,
  projectLegacyFace01ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page01/legacy-adapter";
import { faceSegmentLabel } from "@/lib/llm/pro/delivery/face-segment-locale";
import type { Face01V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

const STATUS_LABEL: Record<
  string,
  Record<string, string>
> = {
  zh: {
    satisfied: "已满足",
    unconfirmed: "未确认",
    conflicted: "存在冲突",
    not_applicable: "不适用",
  },
  en: {
    satisfied: "Satisfied",
    unconfirmed: "Unconfirmed",
    conflicted: "Conflicted",
    not_applicable: "Not applicable",
  },
  es: {
    satisfied: "Cumplida",
    unconfirmed: "Sin confirmar",
    conflicted: "En conflicto",
    not_applicable: "No aplicable",
  },
  fr: {
    satisfied: "Remplie",
    unconfirmed: "Non confirmée",
    conflicted: "En conflit",
    not_applicable: "Non applicable",
  },
  de: {
    satisfied: "Erfüllt",
    unconfirmed: "Unbestätigt",
    conflicted: "Konflikt",
    not_applicable: "Nicht anwendbar",
  },
};

function localeBucket(locale: string): string {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de";
  return "en";
}

function statusLabel(status: string, locale: string): string {
  const bag = STATUS_LABEL[localeBucket(locale)] ?? STATUS_LABEL.en;
  return bag[status] ?? status;
}

function Section({
  title,
  children,
  emphasis,
}: {
  title: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`delivery-book-stage__modules dps-page dps-face-section${
        emphasis ? " dps-face01-core" : ""
      }`}
    >
      <div className="delivery-book-stage__section-head">
        <span className="delivery-book-stage__section-dot" aria-hidden />
        <h3 className="delivery-book-stage__section-title">{title}</h3>
      </div>
      <div className="delivery-book-stage__section-card">{children}</div>
    </div>
  );
}

function resolvePage(page: Face01 | Record<string, unknown>): Face01V2 | null {
  if (isFace01V2(page)) return page;
  if (isFace01Legacy(page)) return projectLegacyFace01ForDisplay(page);
  return projectLegacyFace01ForDisplay(page);
}

export function Face01PageSlots({
  page,
  locale,
  onJumpToPage02Evidence,
}: {
  page: Face01 | Record<string, unknown>;
  locale: string;
  /** Optional jump — target evidence ids kept internal; UI only signals page 02. */
  onJumpToPage02Evidence?: (targetEvidenceIds: string[]) => void;
}) {
  const data = resolvePage(page);
  if (!data) {
    return (
      <div className="dps-face dps-face--01" data-face="01">
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh"
            ? "（第 01 页内容无法解析）"
            : "(Page 01 could not be parsed)"}
        </p>
      </div>
    );
  }

  return (
    <div
      className="dps-face dps-face--01 dps-face-dual--pointer"
      data-face="01"
      data-schema-version="face01-v2"
    >
      <Section title={faceSegmentLabel("01", "A", locale)} emphasis>
        {data.core_judgment.text.split(/\n+/).map((p, i) => (
          <p key={i} className="dps-face-prose dps-face01-core-text">
            {p}
          </p>
        ))}
      </Section>

      <Section title={faceSegmentLabel("01", "B", locale)}>
        <ul className="dps-face-list">
          {data.why_this_path.map((row, i) => (
            <li key={i}>
              <span>{row.text}</span>
              {onJumpToPage02Evidence ? (
                <button
                  type="button"
                  className="dps-face01-jump"
                  onClick={() =>
                    onJumpToPage02Evidence(row.target_evidence_ids)
                  }
                >
                  {localeBucket(locale) === "zh" ? "查看依据" : "See evidence"}
                </button>
              ) : (
                <span className="dps-face01-jump-hint">
                  {localeBucket(locale) === "zh"
                    ? " · 依据见下一页"
                    : " · see next page"}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={faceSegmentLabel("01", "C", locale)}>
        <ul className="dps-face-list">
          {data.recommendation_conditions.map((row, i) => (
            <li key={i}>
              <span className="dps-face01-status" data-status={row.status}>
                {statusLabel(row.status, locale)}
              </span>
              <span> — {row.condition}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={faceSegmentLabel("01", "D", locale)}>
        <ul className="dps-face-list">
          {data.not_recommended.map((row, i) => (
            <li key={i}>
              <strong>{row.option}</strong>
              <div className="dps-face-prose">{row.reason}</div>
              <div className="dps-face-prose dps-face01-cost">
                {localeBucket(locale) === "zh" ? "代价/冲突：" : "Cost/conflict: "}
                {row.cost_or_conflict}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={faceSegmentLabel("01", "E", locale)}>
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh" ? "当前依据" : "Current basis"}
        </p>
        <ul className="dps-face-list">
          {data.applicability_boundary.current_basis.map((t, i) => (
            <li key={`b-${i}`}>{t}</li>
          ))}
        </ul>
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh" ? "失效信号" : "Invalidation signals"}
        </p>
        <ul className="dps-face-list">
          {data.applicability_boundary.invalidation_conditions.map((t, i) => (
            <li key={`i-${i}`}>{t}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
