"use client";

import { useLocale } from "next-intl";

import { GlossaryText } from "@/components/cross-product/GlossaryText";

type Props = {
  title: string;
  fullText: string;
  onClose: () => void;
};

export function AtmosDayReadingSheet({ title, fullText, onClose }: Props) {
  const locale = useLocale();
  return (
    <div
      className="atmos-reading-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="atmos-reading-sheet">
        <header className="atmos-reading-sheet__head">
          <h3 className="atmos-reading-sheet__title">{title}</h3>
          <button
            type="button"
            className="atmos-reading-sheet__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="atmos-reading-sheet__body">
          <GlossaryText text={fullText} locale={locale} />
        </div>
      </div>
    </div>
  );
}
