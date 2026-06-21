"use client";

import { useTranslations, useLocale } from "next-intl";

import { RichReadingText } from "@/components/cross-product/RichReadingText";
import "@/styles/poju-unlock-report.css";
import "@/styles/reading-typography.css";

type Props = {
  excerpt: string;
  onOpen: () => void;
};

export function PojuReportChatCard({ excerpt, onOpen }: Props) {
  const t = useTranslations("poju.chat");
  const locale = useLocale();

  return (
    <button type="button" className="poju-report-card" onClick={onOpen}>
      <div className="poju-report-card__lab">{t("unlock_report_card_label")}</div>
      <div className="poju-report-card__title">{t("unlock_report_card_title")}</div>
      {excerpt ? (
        <div className="poju-report-card__excerpt">
          <RichReadingText text={excerpt} locale={locale} />
        </div>
      ) : null}
      <span className="poju-report-card__cta">{t("unlock_report_view_full")}</span>
    </button>
  );
}
