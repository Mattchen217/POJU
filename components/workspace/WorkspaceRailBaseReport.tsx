"use client";

/**
 * Right-rail personal energy analysis report.
 * Folded = A4 icon only. Expanded = content flush in the rail (no paper parent).
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { ArchiveUnreadDot } from "@/components/archive/ArchiveUnreadDot";
import { A4PaperSheet, EnergyReportGlyph } from "@/components/ui/A4PaperSheet";
import { useWorkspacePojuPrepareOptional } from "@/components/workspace/WorkspacePojuPrepareContext";
import { parseBaseAnalysisSections } from "@/lib/base-analysis/parse-base-analysis-sections";
import { stripBaseAnalysisClosingLines } from "@/lib/base-analysis/report-closing";

import "@/styles/workspace-rail-report.css";

const REPORT_BLOCKS = [
  { id: "section_1", labelKey: "section_1" },
  { id: "section_2", labelKey: "section_2" },
  { id: "section_3", labelKey: "section_3" },
  { id: "section_4", labelKey: "section_4" },
  { id: "section_5", labelKey: "section_5" },
  { id: "section_6", labelKey: "section_6" },
] as const;

type ReportBlockId = (typeof REPORT_BLOCKS)[number]["id"];

function ReportTabLabel({ text }: { text: string }) {
  const lines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return <span className="ws-rail-report__tab-label">{text}</span>;
  }
  return (
    <span className="ws-rail-report__tab-label">
      {lines.map((line) => (
        <span key={line} className="ws-rail-report__tab-line">
          {line}
        </span>
      ))}
    </span>
  );
}

type Props = {
  displayText: string;
  locale: string;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
};

export function WorkspaceRailBaseReport({
  displayText,
  locale,
  expanded,
  onExpandedChange,
}: Props) {
  const t = useTranslations("base_analysis_view");
  const ts = useTranslations("base_analysis_view.sections");
  const prepare = useWorkspacePojuPrepareOptional();
  const showReportUnread = Boolean(prepare?.reportUnread);
  const [activeBlock, setActiveBlock] = useState<ReportBlockId>("section_1");

  const sectionBodies = useMemo(() => {
    const parsed = parseBaseAnalysisSections(
      stripBaseAnalysisClosingLines(displayText),
    );
    return REPORT_BLOCKS.map((_, i) => parsed[i]?.body?.trim() ?? "");
  }, [displayText]);

  useEffect(() => {
    if (expanded) return;
    setActiveBlock("section_1");
  }, [expanded]);

  const activeIndex = REPORT_BLOCKS.findIndex((b) => b.id === activeBlock);
  const prevBlock = activeIndex > 0 ? REPORT_BLOCKS[activeIndex - 1] : null;
  const nextBlock =
    activeIndex >= 0 && activeIndex < REPORT_BLOCKS.length - 1
      ? REPORT_BLOCKS[activeIndex + 1]
      : null;
  const activeBody = sectionBodies[Math.max(0, activeIndex)] ?? "";
  const localeAttr = locale.startsWith("zh") ? "zh" : locale.slice(0, 2);

  function selectBlock(id: ReportBlockId) {
    setActiveBlock(id);
    onExpandedChange(true);
  }

  function openReport() {
    selectBlock(REPORT_BLOCKS[0]!.id);
  }

  /* Collapsed: dog-ear paper icon only — no content nested inside a parent frame. */
  if (!expanded) {
    return (
      <div className="ws-rail-report ws-rail-report--folded">
        {showReportUnread ? (
          <ArchiveUnreadDot className="ws-rail-report__unread" />
        ) : null}
        <A4PaperSheet mode="folded" className="ws-rail-report__icon-sheet">
          <button
            type="button"
            className="ws-rail-report__icon-cover"
            onClick={openReport}
            aria-label={t("title")}
          >
            <EnergyReportGlyph className="ws-rail-report__glyph" />
            <span className="ws-rail-report__icon-title">{t("title")}</span>
          </button>
        </A4PaperSheet>
      </div>
    );
  }

  /* Expanded: content flush to the right rail — no A4 / paper parent wrapper. */
  return (
    <div className="ws-rail-report ws-rail-report--open" data-locale={localeAttr}>
      <div className="ws-rail-report__chrome">
        <div className="ws-rail-report__title-row">
          <h2 className="ws-rail-report__title">{t("title")}</h2>
          <p className="ws-rail-report__desc">{t("rail_description")}</p>
        </div>
        <nav
          className="ws-rail-report__tabs"
          role="tablist"
          aria-label={ts("tablist_label")}
          onKeyDown={(e) => {
            if (activeIndex < 0) return;
            let nextIdx = activeIndex;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              nextIdx = (activeIndex + 1) % REPORT_BLOCKS.length;
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              nextIdx =
                (activeIndex - 1 + REPORT_BLOCKS.length) % REPORT_BLOCKS.length;
            } else if (e.key === "Home") {
              nextIdx = 0;
            } else if (e.key === "End") {
              nextIdx = REPORT_BLOCKS.length - 1;
            } else {
              return;
            }
            e.preventDefault();
            const next = REPORT_BLOCKS[nextIdx];
            if (!next) return;
            selectBlock(next.id);
            window.requestAnimationFrame(() => {
              document.getElementById(`ws-report-tab-${next.id}`)?.focus();
            });
          }}
        >
          {REPORT_BLOCKS.map((block) => {
            const selected = activeBlock === block.id;
            return (
              <button
                key={block.id}
                type="button"
                role="tab"
                id={`ws-report-tab-${block.id}`}
                aria-selected={selected}
                aria-controls={`ws-report-panel-${block.id}`}
                tabIndex={selected ? 0 : -1}
                className={`ws-rail-report__tab${selected ? " is-active" : ""}`}
                onClick={() => selectBlock(block.id)}
              >
                <ReportTabLabel text={ts(block.labelKey)} />
              </button>
            );
          })}
        </nav>
      </div>

      <div
        className="ws-rail-report__panel"
        role="tabpanel"
        id={`ws-report-panel-${activeBlock}`}
        aria-labelledby={`ws-report-tab-${activeBlock}`}
      >
        <div className="ws-rail-report__body">
          {activeBody ? (
            <RichReadingText text={activeBody} locale={locale} dualLayer />
          ) : (
            <p className="ws-rail-report__empty">{t("not_found")}</p>
          )}
        </div>
        <div className="ws-rail-report__footer">
          <div className="ws-rail-report__footer-slot ws-rail-report__footer-slot--start">
            {prevBlock ? (
              <button
                type="button"
                className="ws-rail-report__nav"
                onClick={() => selectBlock(prevBlock.id)}
              >
                <span aria-hidden>‹</span>
                {ts("prev_page")}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="ws-rail-report__close"
            onClick={() => onExpandedChange(false)}
          >
            {ts("close_report")}
            <span aria-hidden>▴</span>
          </button>
          <div className="ws-rail-report__footer-slot ws-rail-report__footer-slot--end">
            {nextBlock ? (
              <button
                type="button"
                className="ws-rail-report__nav"
                onClick={() => selectBlock(nextBlock.id)}
              >
                {ts("next_page")}
                <span aria-hidden>›</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
