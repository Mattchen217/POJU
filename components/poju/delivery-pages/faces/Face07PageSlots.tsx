/**
 * Face 07 reader UI — field and relationship assembly (Page07 V2).
 * Section titles/order/gaps come from section-assembly SSOT (shared with PDF).
 */

"use client";

import type { Face07 } from "@/lib/llm/pro/delivery/page-schema/face-types";
import {
  isFace07Legacy,
  isFace07V2,
  projectLegacyFace07ForDisplay,
} from "@/lib/llm/pro/delivery/decision-report-v2/page07/legacy-adapter";
import { assemblePage07SectionsForDisplay } from "@/lib/llm/pro/delivery/decision-report-v2/page07/architecture/section-assembly";
import type { Face07V2 } from "@/lib/llm/pro/delivery/decision-report-v2/schemas";

function localeBucket(locale: string): string {
  const l = locale.toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("es")) return "es";
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de";
  return "en";
}

function resolvePage(page: Face07 | Record<string, unknown>): Face07V2 | null {
  if (isFace07V2(page) && (page as Face07V2).applicability_status) {
    return page as Face07V2;
  }
  if (isFace07Legacy(page)) return projectLegacyFace07ForDisplay(page);
  return projectLegacyFace07ForDisplay(page);
}

export function Face07PageSlots({
  page,
  locale,
}: {
  page: Face07 | Record<string, unknown>;
  locale: string;
}) {
  const data = resolvePage(page);
  if (!data) {
    return (
      <div className="dps-face dps-face--07" data-face="07">
        <p className="dps-face-prose">
          {localeBucket(locale) === "zh"
            ? "（第 07 页内容无法解析）"
            : "(Page 07 could not be parsed)"}
        </p>
      </div>
    );
  }

  const status = data.generation_status;
  const applicability = data.applicability_status;
  const skipped = applicability === "not_applicable";
  const insufficient = applicability === "insufficient_information";
  const incomplete =
    status === "blocked_on_required_inputs" ||
    status === "incomplete" ||
    status === "failed_structure" ||
    insufficient;
  const displayLocale = data.locale?.trim() || locale;
  const sections = assemblePage07SectionsForDisplay(data, displayLocale);
  const zh = localeBucket(displayLocale) === "zh";

  return (
    <div
      className="dps-face dps-face--07"
      data-face="07"
      data-schema-version="face07-v2"
      data-generation-status={status ?? "unknown"}
      data-applicability={applicability}
      data-page-incomplete={incomplete ? "1" : "0"}
      data-page-skipped={skipped ? "1" : "0"}
    >
      {skipped ? (
        <p className="dps-face-prose" data-status-banner="1">
          {zh
            ? "本题与场域或关系无关，本页已跳过，不另造判断。"
            : "This decision is not about a field or relationship. The page is skipped."}
        </p>
      ) : null}
      {insufficient ? (
        <p className="dps-face-prose" data-status-banner="1">
          {zh
            ? "信息不足，不能判断场域或关系是否影响本题。未编造内容。"
            : "Not enough information to judge field or relationship. Nothing was invented."}
        </p>
      ) : null}
      {incomplete && !insufficient ? (
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
