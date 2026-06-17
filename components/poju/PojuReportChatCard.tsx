"use client";

import { useTranslations } from "next-intl";

import "@/styles/poju-unlock-report.css";

type Props = {
  excerpt: string;
  onOpen: () => void;
};

export function PojuReportChatCard({ excerpt, onOpen }: Props) {
  const t = useTranslations("poju.chat");

  return (
    <button type="button" className="poju-report-card" onClick={onOpen}>
      <div className="poju-report-card__lab">{t("unlock_report_card_label")}</div>
      <div className="poju-report-card__title">{t("unlock_report_card_title")}</div>
      {excerpt ? <p className="poju-report-card__excerpt">{excerpt}</p> : null}
      <span className="poju-report-card__cta">{t("unlock_report_view_full")}</span>
    </button>
  );
}
