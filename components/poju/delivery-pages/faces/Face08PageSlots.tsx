/**
 * Face 08 reader UI — risk monitoring and decision review (Page08 V2).
 * Section titles/order/gaps come from section-assembly SSOT (shared with PDF).
 */

"use client";

import type { ReactElement } from "react";
import type { Face08 } from "@/lib/llm/pro/delivery/page-schema/face-types";
import {
  isFace08Legacy,
  isFace08V2,
  projectLegacyFace08ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page08/legacy-adapter";
import { assemblePage08SectionsForDisplay } from "@/lib/llm/pro/delivery/decision-report-v2/page08/architecture/section-assembly";
import type { Face08V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

function localeBucket(locale: string): string {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de";
  return "en";
}

function resolvePage(page: Face08 | Record<string, unknown>): Face08V2 | null {
  if (isFace08V2(page)) return page;
  if (isFace08Legacy(page)) return projectLegacyFace08ForDisplay(page);
  return projectLegacyFace08ForDisplay(page);
}

export function Face08PageSlots({
  page,
  locale,
}: {
  page: Face08 | Record<string, unknown>;
  locale: string;
}): ReactElement {
  const data = resolvePage(page);
  if (!data) {
    return (
      <div className="dps-face dps-face--08" data-face="08">
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh"
            ? "（第 08 页内容无法解析）"
            : "(Page 08 could not be parsed)"}
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
  const sections = assemblePage08SectionsForDisplay(data, displayLocale);
  const zh = localeBucket(displayLocale) === "zh";

  return (
    <div
      className="dps-face dps-face--08"
      data-face="08"
      data-schema-version="face08-v2"
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
          className="dps-face-section"
          data-section={s.section_id}
          data-reading-rank={s.reading_rank}
        >
          <h3 className="dps-face-section-title">{s.title}</h3>
          {s.texts.length ? (
            s.texts.map((t, i) => (
              <p key={`${s.section_id}_${i}`} className="dps-face-prose">
                {t}
              </p>
            ))
          ) : (
            <p className="dps-face-prose dps-face-prose--empty">
              {s.empty_display}
            </p>
          )}
          {s.gap_lines.length ? (
            <div className="dps-face-gaps" data-gaps="1">
              {s.gap_lines.map((g, i) => (
                <p key={`gap_${s.section_id}_${i}`} className="dps-face-prose">
                  {g}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
