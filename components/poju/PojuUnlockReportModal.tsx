"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { ReadingDecoderBanner } from "@/components/reading-ritual/ReadingDecoderBanner";

import "@/styles/poju-unlock-report.css";
import "@/styles/poju-new-session-btn.css";
import "@/styles/reading-ritual.css";

type Props = {
  open: boolean;
  reportText: string;
  gateMode?: boolean;
  onClose: () => void;
  onDecodeParagraph?: (paragraph: string) => void;
};

function splitReportParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function PojuUnlockReportModal({
  open,
  reportText,
  gateMode = false,
  onClose,
  onDecodeParagraph,
}: Props) {
  const t = useTranslations("poju.chat");
  const decodeEnabled = Boolean(onDecodeParagraph) && !gateMode;
  const paragraphs = decodeEnabled ? splitReportParagraphs(reportText) : [];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="poju-unlock-report-overlay"
      role="dialog"
      aria-modal
      aria-labelledby="poju-unlock-report-title"
      onClick={gateMode ? undefined : onClose}
    >
      <div className="poju-unlock-report-panel" onClick={(e) => e.stopPropagation()}>
        <header className="poju-unlock-report-panel__head">
          <div>
            <h2 id="poju-unlock-report-title" className="poju-unlock-report-panel__title">
              {t("unlock_report_modal_title")}
            </h2>
            <p className="poju-unlock-report-panel__hint">
              {gateMode ? t("unlock_report_gate_hint") : t("unlock_report_modal_hint")}
            </p>
          </div>
        </header>

        {decodeEnabled ? <ReadingDecoderBanner variant="poju" /> : null}

        <div className="poju-unlock-report-panel__body">
          {decodeEnabled ? (
            <div className="poju-unlock-report-panel__text poju-unlock-report-panel__text--decode">
              {paragraphs.map((para, i) => (
                <p
                  key={i}
                  className="poju-unlock-report-panel__para"
                  role="button"
                  tabIndex={0}
                  onClick={() => onDecodeParagraph?.(para)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onDecodeParagraph?.(para);
                    }
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          ) : (
            <pre className="poju-unlock-report-panel__text">{reportText}</pre>
          )}
        </div>

        <footer className="poju-unlock-report-panel__foot">
          <button
            type="button"
            className="poju-new-session-btn poju-unlock-report-panel__close-btn"
            onClick={onClose}
          >
            {gateMode ? t("unlock_report_close_continue") : t("unlock_report_close")}
          </button>
        </footer>
      </div>
    </div>
  );
}
