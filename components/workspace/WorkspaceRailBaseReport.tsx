"use client";

/**
 * Right-rail personal energy analysis report — same paper fold/expand UX as
 * the energy matrix list, with 6 curated section tabs.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { RichReadingText } from "@/components/cross-product/RichReadingText";
import {
  A4PaperSheet,
  EnergyReportGlyph,
  type A4PaperSheetMode,
} from "@/components/ui/A4PaperSheet";
import { parseBaseAnalysisSections } from "@/lib/base-analysis/parse-base-analysis-sections";
import { stripBaseAnalysisClosingLines } from "@/lib/base-analysis/report-closing";

const RAIL_PAPER_MORPH_MS = 680;

const REPORT_BLOCKS = [
  { id: "section_1", labelKey: "section_1" },
  { id: "section_2", labelKey: "section_2" },
  { id: "section_3", labelKey: "section_3" },
  { id: "section_4", labelKey: "section_4" },
  { id: "section_5", labelKey: "section_5" },
  { id: "section_6", labelKey: "section_6" },
] as const;

type ReportBlockId = (typeof REPORT_BLOCKS)[number]["id"];

/** Explicit 2-line section titles from i18n (`line1\nline2`). */
function ReportTabLabel({ text }: { text: string }) {
  const lines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return <span className="pcm-tabs__label pcm-tabs__label--stack">{text}</span>;
  }
  return (
    <span className="pcm-tabs__label pcm-tabs__label--stack">
      {lines.map((line) => (
        <span key={line} className="pcm-tabs__line">
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
  const [activeBlock, setActiveBlock] = useState<ReportBlockId>("section_1");
  const [railSheetMode, setRailSheetMode] = useState<A4PaperSheetMode>(() =>
    expanded ? "flat" : "folded",
  );
  const closeTimerRef = useRef<number | null>(null);
  const morphGenRef = useRef(0);
  const prefersReducedMotionRef = useRef(false);

  const sectionBodies = useMemo(() => {
    const parsed = parseBaseAnalysisSections(
      stripBaseAnalysisClosingLines(displayText),
    );
    return REPORT_BLOCKS.map((_, i) => parsed[i]?.body?.trim() ?? "");
  }, [displayText]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    prefersReducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!expanded) {
      setRailSheetMode("folded");
      return;
    }
    if (prefersReducedMotionRef.current) {
      setRailSheetMode("flat");
      return;
    }
    const gen = morphGenRef.current;
    setRailSheetMode("folded");
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (morphGenRef.current === gen) setRailSheetMode("flat");
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [expanded]);

  const activeIndex = REPORT_BLOCKS.findIndex((b) => b.id === activeBlock);
  const prevBlock = activeIndex > 0 ? REPORT_BLOCKS[activeIndex - 1] : null;
  const nextBlock =
    activeIndex >= 0 && activeIndex < REPORT_BLOCKS.length - 1
      ? REPORT_BLOCKS[activeIndex + 1]
      : null;

  function selectBlock(id: ReportBlockId) {
    setActiveBlock(id);
    onExpandedChange(true);
  }

  function openReport() {
    selectBlock(REPORT_BLOCKS[0]!.id);
  }

  function closeReport() {
    morphGenRef.current += 1;
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setRailSheetMode("folded");
    if (prefersReducedMotionRef.current) {
      onExpandedChange(false);
      return;
    }
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onExpandedChange(false);
    }, RAIL_PAPER_MORPH_MS);
  }

  const activeBody = sectionBodies[Math.max(0, activeIndex)] ?? "";

  return (
    <div
      className={`pcm-rail-paper pcm-rail-paper--report${
        railSheetMode === "flat" ? " is-flat" : " is-folded"
      }`}
    >
      <A4PaperSheet mode={railSheetMode} className="pcm-rail-paper__sheet">
        <button
          type="button"
          className="pcm-rail-paper__cover"
          onClick={openReport}
          aria-label={t("title")}
          tabIndex={railSheetMode === "folded" ? 0 : -1}
          aria-hidden={railSheetMode === "flat" ? true : undefined}
        >
          <EnergyReportGlyph className="pcm-rail-paper__glyph" />
          <span className="pcm-rail-paper__cover-title">{t("title")}</span>
        </button>

        <div
          className="pcm-rail-paper__list"
          aria-hidden={railSheetMode === "folded" ? true : undefined}
        >
          <div className="pcm pcm--rail pcm--tabbed" data-locale={locale.startsWith("zh") ? "zh" : locale.slice(0, 2)}>
          <div className="pcm-stage pcm-stage--in-paper">
            <div className="pcm-navframe">
              <div className="pcm-navframe__title-row">
                <h2 className="pcm-navframe__title">{t("title")}</h2>
                <p className="pcm-navframe__desc">{t("rail_description")}</p>
              </div>
              <nav
                className="pcm-tabs"
                role="tablist"
                aria-label={ts("tablist_label")}
                onKeyDown={(e) => {
                  if (activeIndex < 0) return;
                  let nextIdx = activeIndex;
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    nextIdx = (activeIndex + 1) % REPORT_BLOCKS.length;
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    nextIdx =
                      (activeIndex - 1 + REPORT_BLOCKS.length) %
                      REPORT_BLOCKS.length;
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
                    document.getElementById(`pcm-report-tab-${next.id}`)?.focus();
                  });
                }}
              >
                {REPORT_BLOCKS.map((block) => {
                  const selected = activeBlock === block.id && expanded;
                  return (
                    <button
                      key={block.id}
                      type="button"
                      role="tab"
                      id={`pcm-report-tab-${block.id}`}
                      aria-selected={selected}
                      aria-controls={`pcm-report-panel-${block.id}`}
                      aria-expanded={expanded && activeBlock === block.id}
                      tabIndex={activeBlock === block.id ? 0 : -1}
                      className={`pcm-tabs__btn${selected ? " is-active" : ""}`}
                      onClick={() => selectBlock(block.id)}
                    >
                      <ReportTabLabel text={ts(block.labelKey)} />
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className={`pcm-shell${expanded ? "" : " is-collapsed"}`}>
              {expanded ? (
                <div
                  className="pcm-shell__panel"
                  role="tabpanel"
                  id={`pcm-report-panel-${activeBlock}`}
                  aria-labelledby={`pcm-report-tab-${activeBlock}`}
                >
                  <div className="pcm-rail-report__body">
                    {activeBody ? (
                      <RichReadingText text={activeBody} locale={locale} dualLayer />
                    ) : (
                      <p className="pcm-rail-report__empty">{t("not_found")}</p>
                    )}
                  </div>
                  <div className="pcm-shell__footer">
                    <div className="pcm-shell__footer-slot pcm-shell__footer-slot--start">
                      {prevBlock ? (
                        <button
                          type="button"
                          className="pcm-shell__nav pcm-shell__nav--prev"
                          onClick={() => selectBlock(prevBlock.id)}
                        >
                          <span className="pcm-shell__nav-icon" aria-hidden>
                            ‹
                          </span>
                          {ts("prev_page")}
                        </button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="pcm-shell__collapse"
                      onClick={closeReport}
                    >
                      {ts("close_report")}
                      <span className="pcm-shell__collapse-icon" aria-hidden>
                        ▴
                      </span>
                    </button>
                    <div className="pcm-shell__footer-slot pcm-shell__footer-slot--end">
                      {nextBlock ? (
                        <button
                          type="button"
                          className="pcm-shell__nav pcm-shell__nav--next"
                          onClick={() => selectBlock(nextBlock.id)}
                        >
                          {ts("next_page")}
                          <span className="pcm-shell__nav-icon" aria-hidden>
                            ›
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          </div>
        </div>
      </A4PaperSheet>
    </div>
  );
}
