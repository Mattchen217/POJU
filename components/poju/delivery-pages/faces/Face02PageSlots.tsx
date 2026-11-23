/**
 * Face 02 reader UI — 为什么这个判断适合你 (Page02 V2).
 * Historical destiny_reason shape projects via legacy adapter.
 */

"use client";

import type { ReactNode } from "react";
import type { Face02 } from "@/lib/llm/pro/delivery/page-schema/face-types";
import {
  isFace02Legacy,
  isFace02V2,
  projectLegacyFace02ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page02/legacy-adapter";
import { faceSegmentLabel } from "@/lib/llm/pro/delivery/face-segment-locale";
import type { Face02V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

function localeBucket(locale: string): string {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de";
  return "en";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="delivery-book-stage__modules dps-page dps-face-section">
      <div className="delivery-book-stage__section-head">
        <span className="delivery-book-stage__section-dot" aria-hidden />
        <h3 className="delivery-book-stage__section-title">{title}</h3>
      </div>
      <div className="delivery-book-stage__section-card">{children}</div>
    </div>
  );
}

function resolvePage(page: Face02 | Record<string, unknown>): Face02V2 | null {
  if (isFace02V2(page)) return page;
  if (isFace02Legacy(page)) return projectLegacyFace02ForDisplay(page);
  return projectLegacyFace02ForDisplay(page);
}

export function Face02PageSlots({
  page,
  locale,
}: {
  page: Face02 | Record<string, unknown>;
  locale: string;
}) {
  const data = resolvePage(page);
  if (!data) {
    return (
      <div className="dps-face dps-face--02" data-face="02">
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh"
            ? "（第 02 页内容无法解析）"
            : "(Page 02 could not be parsed)"}
        </p>
      </div>
    );
  }

  const order = data.reading_order?.length
    ? data.reading_order
    : ([
        "page_summary",
        "relevant_personal_factors",
        "personal_reality_interplay",
        "why_judgment_fits",
        "explanation_boundary",
      ] as const);

  const blocks: Record<string, ReactNode> = {
    page_summary: (
      <Section key="summary" title={faceSegmentLabel("02", "A", locale)}>
        <p className="dps-face-prose">{data.page_summary}</p>
      </Section>
    ),
    relevant_personal_factors: (
      <Section key="factors" title={faceSegmentLabel("02", "B", locale)}>
        {data.relevant_personal_factors.length === 0 ? (
          <p className="dps-face-prose">
            {localeBucket(locale) === "zh"
              ? "本题暂无可用的个人结构依据。"
              : "No personal-structure evidence is available for this decision."}
          </p>
        ) : (
          <ul className="dps-face-list">
            {data.relevant_personal_factors.map((row) => (
              <li key={row.factor_id}>
                <strong>{row.title}</strong>
                <div className="dps-face-prose">{row.text}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    ),
    personal_reality_interplay: (
      <Section key="interplay" title={faceSegmentLabel("02", "C", locale)}>
        {data.personal_reality_interplay.length === 0 ? (
          <p className="dps-face-prose">
            {localeBucket(locale) === "zh"
              ? "本题暂无个人与现实交汇的可认证说明。"
              : "No certified personal–reality interplay is available."}
          </p>
        ) : (
          <ul className="dps-face-list">
            {data.personal_reality_interplay.map((row, i) => (
              <li key={i}>
                <div className="dps-face-prose">{row.text}</div>
                <div className="dps-face-prose dps-face02-condition">
                  {localeBucket(locale) === "zh" ? "条件/边界：" : "Condition: "}
                  {row.conditionality}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    ),
    why_judgment_fits: (
      <Section key="why" title={faceSegmentLabel("02", "D", locale)}>
        <p className="dps-face-prose">{data.why_judgment_fits.text}</p>
      </Section>
    ),
    explanation_boundary: (
      <Section key="boundary" title={faceSegmentLabel("02", "E", locale)}>
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh" ? "个人分析依据" : "Personal analysis basis"}
        </p>
        <ul className="dps-face-list">
          {data.explanation_boundary.personal_analysis_basis.map((t, i) => (
            <li key={`p-${i}`}>{t}</li>
          ))}
        </ul>
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh" ? "已确认事实依据" : "Confirmed fact basis"}
        </p>
        <ul className="dps-face-list">
          {data.explanation_boundary.confirmed_fact_basis.map((t, i) => (
            <li key={`f-${i}`}>{t}</li>
          ))}
        </ul>
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh" ? "不确定性" : "Uncertainty"}
        </p>
        <ul className="dps-face-list">
          {data.explanation_boundary.uncertainty_notes.map((t, i) => (
            <li key={`u-${i}`}>{t}</li>
          ))}
        </ul>
      </Section>
    ),
  };

  return (
    <div
      className="dps-face dps-face--02 dps-face-dual--abc"
      data-face="02"
      data-schema-version="face02-v2"
    >
      {order.map((key) => blocks[key] ?? null)}
    </div>
  );
}
