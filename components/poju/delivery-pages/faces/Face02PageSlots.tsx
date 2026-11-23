/**
 * Face 02 reader UI — content_units assembly (Page02 V2).
 * Section layout reads PAGE02_SECTION_DEFINITIONS (same SSOT as PDF).
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
import {
  PAGE02_SECTION_DEFINITIONS,
  page02SectionById,
  type Page02SectionId,
} from "@/lib/llm/pro/delivery/decision-report-v2/page02/architecture/sections";
import type { Face02V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

function localeBucket(locale: string): string {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de";
  return "en";
}

function sectionTitle(sectionId: Page02SectionId, locale: string): string {
  const def = page02SectionById(sectionId);
  if (!def) return sectionId;
  return localeBucket(locale) === "zh" ? def.title_zh : def.title_en;
}

function Section({
  sectionId,
  title,
  children,
}: {
  sectionId: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="delivery-book-stage__modules dps-page dps-face-section"
      data-section-id={sectionId}
    >
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

function GapNotes({
  page,
  sectionId,
  locale,
}: {
  page: Face02V2;
  sectionId: Page02SectionId;
  locale: string;
}) {
  const gaps = (page.missing_inputs ?? []).filter(
    (g) => g.section_id === sectionId,
  );
  if (!gaps.length) return null;
  const zh = localeBucket(locale) === "zh";
  return (
    <div className="dps-face-gaps" data-gaps-for={sectionId}>
      <p className="dps-face-prose">
        {zh ? "数据缺口（不可当作已确认事实）" : "Data gaps (not confirmed facts)"}
      </p>
      <ul className="dps-face-list">
        {gaps.map((g) => (
          <li key={g.gap_id}>
            [{g.status}] {g.field_id}: {g.affects_content}
          </li>
        ))}
      </ul>
    </div>
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

  const order = (data.reading_order?.length
    ? data.reading_order
    : PAGE02_SECTION_DEFINITIONS.map((s) => s.section_id)) as Page02SectionId[];

  const status = data.generation_status;
  const incomplete =
    status === "blocked_on_required_inputs" ||
    status === "incomplete" ||
    status === "failed_structure";

  const blocks: Record<string, ReactNode> = {
    page_summary: (
      <Section
        key="summary"
        sectionId="page_summary"
        title={sectionTitle("page_summary", locale)}
      >
        <UnitList
          page={data}
          unitIds={data.page_summary_unit_ids}
          emptyZh={page02SectionById("page_summary")!.empty_display_zh}
          emptyEn={page02SectionById("page_summary")!.empty_display_en}
          locale={locale}
        />
        <GapNotes page={data} sectionId="page_summary" locale={locale} />
      </Section>
    ),
    relevant_personal_factors: (
      <Section
        key="factors"
        sectionId="relevant_personal_factors"
        title={sectionTitle("relevant_personal_factors", locale)}
      >
        <UnitList
          page={data}
          unitIds={data.relevant_personal_factor_unit_ids}
          emptyZh={page02SectionById("relevant_personal_factors")!.empty_display_zh}
          emptyEn={page02SectionById("relevant_personal_factors")!.empty_display_en}
          locale={locale}
        />
        <GapNotes
          page={data}
          sectionId="relevant_personal_factors"
          locale={locale}
        />
      </Section>
    ),
    personal_reality_interplay: (
      <Section
        key="interplay"
        sectionId="personal_reality_interplay"
        title={sectionTitle("personal_reality_interplay", locale)}
      >
        <UnitList
          page={data}
          unitIds={data.personal_reality_interplay_unit_ids}
          emptyZh={page02SectionById("personal_reality_interplay")!.empty_display_zh}
          emptyEn={page02SectionById("personal_reality_interplay")!.empty_display_en}
          locale={locale}
        />
        <GapNotes
          page={data}
          sectionId="personal_reality_interplay"
          locale={locale}
        />
      </Section>
    ),
    why_judgment_fits: (
      <Section
        key="why"
        sectionId="why_judgment_fits"
        title={sectionTitle("why_judgment_fits", locale)}
      >
        <UnitList
          page={data}
          unitIds={data.why_judgment_fits_unit_ids}
          emptyZh={page02SectionById("why_judgment_fits")!.empty_display_zh}
          emptyEn={page02SectionById("why_judgment_fits")!.empty_display_en}
          locale={locale}
        />
        <GapNotes page={data} sectionId="why_judgment_fits" locale={locale} />
      </Section>
    ),
    explanation_boundary: (
      <Section
        key="boundary"
        sectionId="explanation_boundary"
        title={sectionTitle("explanation_boundary", locale)}
      >
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
        <GapNotes page={data} sectionId="explanation_boundary" locale={locale} />
      </Section>
    ),
  };

  return (
    <div
      className="dps-face dps-face--02 dps-face-dual--abc"
      data-face="02"
      data-schema-version="face02-v2"
      data-generation-status={status ?? "unknown"}
      data-page-incomplete={incomplete ? "1" : "0"}
    >
      {incomplete ? (
        <p className="dps-face-prose" data-status-banner="1">
          {localeBucket(locale) === "zh"
            ? `本页尚未正式完成（状态：${status}）。缺口未补齐前，请勿把未确认信息当作事实。`
            : `This page is not formally complete (status: ${status}). Do not treat unresolved gaps as facts.`}
        </p>
      ) : null}
      {order.map((key) => blocks[key] ?? null)}
    </div>
  );
}
