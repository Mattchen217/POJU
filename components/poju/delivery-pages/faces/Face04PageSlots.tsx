/**
 * Face 04 reader UI — content_units assembly (Page04 V2 Core Bottleneck).
 * Section titles/order/gaps come from section-assembly SSOT (shared with PDF).
 */

"use client";

import type { Face04 } from "@/lib/llm/pro/delivery/page-schema/face-types";
import {
  isFace04Legacy,
  isFace04V2,
  projectLegacyFace04ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page04/legacy-adapter";
import { assemblePage04SectionsForDisplay } from "@/lib/llm/pro/delivery/decision-report-v2/page04/architecture/section-assembly";
import type { Face04V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

function localeBucket(locale: string): string {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de";
  return "en";
}

function resolvePage(page: Face04 | Record<string, unknown>): Face04V2 | null {
  if (isFace04V2(page) && Array.isArray((page as Face04V2).content_units)) {
    return page as Face04V2;
  }
  if (isFace04Legacy(page)) return projectLegacyFace04ForDisplay(page);
  return projectLegacyFace04ForDisplay(page);
}

export function Face04PageSlots({
  page,
  locale,
}: {
  page: Face04 | Record<string, unknown>;
  locale: string;
}) {
  const data = resolvePage(page);
  if (!data) {
    return (
      <div className="dps-face dps-face--04" data-face="04">
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh"
            ? "（第 04 页内容无法解析）"
            : "(Page 04 could not be parsed)"}
        </p>
      </div>
    );
  }

  const status = data.generation_status;
  const incomplete =
    status === "blocked_on_required_inputs" ||
    status === "incomplete" ||
    status === "failed_structure";
  const displayLocale = data.locale?.trim() || locale;
  const sections = assemblePage04SectionsForDisplay(data, displayLocale);
  const zh = localeBucket(displayLocale) === "zh";

  return (
    <div
      className="dps-face dps-face--04"
      data-face="04"
      data-schema-version="face04-v2"
      data-generation-status={status ?? "unknown"}
      data-page-incomplete={incomplete ? "1" : "0"}
    >
      {incomplete ? (
        <p className="dps-face-prose" data-status-banner="1">
          {zh
            ? `本页尚未正式完成（状态：${status}）。缺口未补齐前，请勿把未确认信息当作事实。`
            : `This page is not formally complete (status: ${status}). Do not treat unresolved gaps as facts.`}
        </p>
      ) : null}
      {sections.map((s) => (
        <div
          key={s.section_id}
          className="delivery-book-stage__modules dps-page dps-face-section"
          data-section-id={s.section_id}
        >
          <div className="delivery-book-stage__section-head">
            <span className="delivery-book-stage__section-dot" aria-hidden />
            <h3 className="delivery-book-stage__section-title">{s.title}</h3>
          </div>
          <div className="delivery-book-stage__section-card">
            {s.texts.length ? (
              <ul className="dps-face-list">
                {s.texts.map((t, i) => (
                  <li key={`${s.section_id}-${i}`}>
                    <div className="dps-face-prose">{t}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dps-face-prose">{s.empty_display}</p>
            )}
            {s.gap_lines.length ? (
              <div className="dps-face-gaps" data-gaps-for={s.section_id}>
                <p className="dps-face-prose">
                  {zh
                    ? "数据缺口（不可当作已确认事实）"
                    : "Data gaps (not confirmed facts)"}
                </p>
                <ul className="dps-face-list">
                  {s.gap_lines.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
