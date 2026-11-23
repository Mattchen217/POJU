/**
 * Face 05 reader UI — path_units assembly (Page05 V2 Feasible Paths).
 * Section titles/order/gaps come from section-assembly SSOT (shared with PDF).
 */

"use client";

import type { Face05 } from "@/lib/llm/pro/delivery/page-schema/face-types";
import {
  isFace05Legacy,
  isFace05V2,
  projectLegacyFace05ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page05/legacy-adapter";
import { assemblePage05SectionsForDisplay } from "@/lib/llm/pro/delivery/decision-report-v2/page05/architecture/section-assembly";
import type { Face05V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

function localeBucket(locale: string): string {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de";
  return "en";
}

function resolvePage(page: Face05 | Record<string, unknown>): Face05V2 | null {
  if (isFace05V2(page) && Array.isArray((page as Face05V2).path_units)) {
    return page as Face05V2;
  }
  if (isFace05Legacy(page)) return projectLegacyFace05ForDisplay(page);
  return projectLegacyFace05ForDisplay(page);
}

export function Face05PageSlots({
  page,
  locale,
}: {
  page: Face05 | Record<string, unknown>;
  locale: string;
}) {
  const data = resolvePage(page);
  if (!data) {
    return (
      <div className="dps-face dps-face--05" data-face="05">
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh"
            ? "（第 05 页内容无法解析）"
            : "(Page 05 could not be parsed)"}
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
  const sections = assemblePage05SectionsForDisplay(data, displayLocale);
  const zh = localeBucket(displayLocale) === "zh";

  return (
    <div
      className="dps-face dps-face--05"
      data-face="05"
      data-schema-version="face05-v2"
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
