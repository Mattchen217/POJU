/**
 * Glossary appendix reader — internal page id 03.
 * Soft labels from SSOT only; no traditional forms, no term_id shown.
 */

"use client";

import {
  isGlossaryAppendixPage,
  isLegacyChartAppendixPage,
} from "@/lib/llm/pro/delivery/decision-report-v2/reading-order";
import { resolveGlossaryAppendixRows } from "@/lib/llm/pro/delivery/decision-report-v2/glossary-appendix";
import type { Face03Glossary } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";
import { faceSegmentLabel } from "@/lib/llm/pro/delivery/face-segment-locale";

export function Face03GlossarySlots({
  page,
  locale,
}: {
  page: Record<string, unknown>;
  locale: string;
}) {
  if (isLegacyChartAppendixPage(page)) {
    // Historical reports: keep readable without promoting chart appendix as product.
    const bazi = String(page.bazi_slice ?? "").trim();
    const ziwei = String(page.ziwei_slice ?? "").trim();
    const contrast = String(page.contrast ?? "").trim();
    return (
      <div className="dps-face dps-face--03 dps-face--legacy-chart" data-face="03">
        <p className="dps-face-prose">
          {locale.toLowerCase().startsWith("zh")
            ? "（历史报告盘面附录 · 只读）"
            : "(Historical chart appendix · read-only)"}
        </p>
        {bazi ? <p className="dps-face-prose">{bazi}</p> : null}
        {ziwei ? <p className="dps-face-prose">{ziwei}</p> : null}
        {contrast ? <p className="dps-face-prose">{contrast}</p> : null}
      </div>
    );
  }

  if (!isGlossaryAppendixPage(page)) {
    return (
      <div className="dps-face dps-face--03" data-face="03">
        <p className="dps-face-prose">
          {locale.toLowerCase().startsWith("zh")
            ? "（术语附录不可用）"
            : "(Glossary appendix unavailable)"}
        </p>
      </div>
    );
  }

  const glossary = page as unknown as Face03Glossary;
  const rows = resolveGlossaryAppendixRows(glossary, locale);

  return (
    <div
      className="dps-face dps-face--03 dps-face-dual--appendix"
      data-face="03"
      data-kind="glossary_appendix"
    >
      <div className="delivery-book-stage__modules dps-page dps-face-section">
        <div className="delivery-book-stage__section-head">
          <span className="delivery-book-stage__section-dot" aria-hidden />
          <h3 className="delivery-book-stage__section-title">
            {faceSegmentLabel("03", "A", locale)}
          </h3>
        </div>
        <div className="delivery-book-stage__section-card">
          <p className="dps-face-prose">{glossary.reading_note}</p>
        </div>
      </div>
      <div className="delivery-book-stage__modules dps-page dps-face-section">
        <div className="delivery-book-stage__section-head">
          <span className="delivery-book-stage__section-dot" aria-hidden />
          <h3 className="delivery-book-stage__section-title">
            {faceSegmentLabel("03", "B", locale)}
          </h3>
        </div>
        <div className="delivery-book-stage__section-card">
          {rows.length === 0 ? (
            <p className="dps-face-prose">
              {locale.toLowerCase().startsWith("zh")
                ? "本报告依据层未使用软译术语。"
                : "No soft terms were used in this report’s evidence layer."}
            </p>
          ) : (
            <ul className="dps-face-list dps-glossary-list">
              {rows.map((row) => (
                <li key={row.term_id}>
                  <strong>{row.soft_label}</strong>
                  <div className="dps-face-prose">{row.definition}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
