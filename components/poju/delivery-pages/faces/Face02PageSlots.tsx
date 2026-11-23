/**
 * Face 02 reader UI — content_units assembly (Page02 V2).
 */

"use client";

import type { ReactNode } from "react";
import type { Face02 } from "@/lib/llm/pro/delivery/page-schema/face-types";
import {
  isFace02Legacy,
  isFace02V2,
  projectLegacyFace02ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page02/legacy-adapter";
import {
  face02UnitDisplayText,
  resolveFace02Units,
} from "@/lib/llm/pro/delivery/decision-report-v2/page02/content-units";
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
  if (isFace02V2(page) && Array.isArray((page as Face02V2).content_units)) {
    return page as Face02V2;
  }
  if (isFace02Legacy(page)) return projectLegacyFace02ForDisplay(page);
  return projectLegacyFace02ForDisplay(page);
}

function UnitList({
  page,
  unitIds,
  emptyZh,
  emptyEn,
  locale,
}: {
  page: Face02V2;
  unitIds: readonly string[];
  emptyZh: string;
  emptyEn: string;
  locale: string;
}) {
  const units = resolveFace02Units(page, unitIds);
  if (!units.length) {
    return (
      <p className="dps-face-prose">
        {localeBucket(locale) === "zh" ? emptyZh : emptyEn}
      </p>
    );
  }
  return (
    <ul className="dps-face-list">
      {units.map((u) => (
        <li key={u.unit_id}>
          <div className="dps-face-prose">{face02UnitDisplayText(u)}</div>
        </li>
      ))}
    </ul>
  );
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
        <UnitList
          page={data}
          unitIds={data.page_summary_unit_ids}
          emptyZh="（无摘要）"
          emptyEn="(No summary)"
          locale={locale}
        />
      </Section>
    ),
    relevant_personal_factors: (
      <Section key="factors" title={faceSegmentLabel("02", "B", locale)}>
        <UnitList
          page={data}
          unitIds={data.relevant_personal_factor_unit_ids}
          emptyZh="本题暂无可用的个人结构依据。"
          emptyEn="No personal-structure evidence is available for this decision."
          locale={locale}
        />
      </Section>
    ),
    personal_reality_interplay: (
      <Section key="interplay" title={faceSegmentLabel("02", "C", locale)}>
        <UnitList
          page={data}
          unitIds={data.personal_reality_interplay_unit_ids}
          emptyZh="本题暂无个人与现实交汇的可认证说明。"
          emptyEn="No certified personal–reality interplay is available."
          locale={locale}
        />
      </Section>
    ),
    why_judgment_fits: (
      <Section key="why" title={faceSegmentLabel("02", "D", locale)}>
        <UnitList
          page={data}
          unitIds={data.why_judgment_fits_unit_ids}
          emptyZh="（无解释）"
          emptyEn="(No explanation)"
          locale={locale}
        />
      </Section>
    ),
    explanation_boundary: (
      <Section key="boundary" title={faceSegmentLabel("02", "E", locale)}>
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh" ? "个人分析依据" : "Personal analysis basis"}
        </p>
        <UnitList
          page={data}
          unitIds={data.explanation_boundary.personal_unit_ids}
          emptyZh="（本题无可用个人分析依据）"
          emptyEn="(No personal-analysis basis for this decision)"
          locale={locale}
        />
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh" ? "已确认事实依据" : "Confirmed fact basis"}
        </p>
        <UnitList
          page={data}
          unitIds={data.explanation_boundary.confirmed_fact_unit_ids}
          emptyZh="（本题无已确认事实可列）"
          emptyEn="(No confirmed facts to list)"
          locale={locale}
        />
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh"
            ? "解释性假设（非已确认事实）"
            : "Explanatory hypotheses (not confirmed facts)"}
        </p>
        <UnitList
          page={data}
          unitIds={data.explanation_boundary.hypothesis_unit_ids}
          emptyZh="（无额外假设说明）"
          emptyEn="(No hypothesis notes)"
          locale={locale}
        />
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
