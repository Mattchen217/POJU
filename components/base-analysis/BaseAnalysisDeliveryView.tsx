"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { BaseAnalysisPillarCard } from "@/components/base-analysis/BaseAnalysisPillarCard";
import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { Link } from "@/i18n/navigation";
import { parseBaseAnalysisSections } from "@/lib/base-analysis/parse-base-analysis-sections";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";

import "@/styles/glyph-delivery.css";
import "@/styles/base-analysis-delivery.css";
import "@/styles/poju-deep-dive.css";

type Props = {
  displayText: string;
  structured?: ProfileStructured | null;
  locale: string;
  profileId?: string;
  displayName?: string;
  variant?: "page" | "modal";
  header?: ReactNode;
};

export function BaseAnalysisDeliveryView({
  displayText,
  structured,
  locale,
  profileId,
  displayName,
  variant = "page",
  header,
}: Props) {
  const t = useTranslations("base_analysis_view");
  const sections = parseBaseAnalysisSections(displayText);
  const showCta = variant === "page" && profileId;

  return (
    <div className={`base-analysis-delivery glyph-reading-page${variant === "modal" ? " base-analysis-delivery--modal" : ""}`}>
      <div className="glyph-delivery-panel">
        <div className="glyph-delivery-inner base-analysis-delivery__inner">
          {header}

          <header className="glyph-delivery-header base-analysis-delivery__header">
            <p className="glyph-delivery-eyebrow">{t("eyebrow")}</p>
            <h1 className="glyph-delivery-question base-analysis-delivery__title">
              {displayName ? `${displayName} · ` : ""}
              {t("title")}
            </h1>
          </header>

          {structured ? (
            <div className="base-analysis-delivery__pillar-wrap">
              <BaseAnalysisPillarCard structured={structured} locale={locale} />
            </div>
          ) : null}

          <div className="base-analysis-delivery__sections">
            {sections.map((section, i) => (
              <section key={`${section.title}-${i}`} className="base-analysis-delivery__section">
                {section.title ? (
                  <div className="glyph-delivery-section-heading">
                    <h2 className="glyph-delivery-section-title">{section.title}</h2>
                  </div>
                ) : null}
                <div className="glyph-delivery-card base-analysis-delivery__card">
                  <RichReadingText text={section.body} locale={locale} />
                </div>
              </section>
            ))}
          </div>

          {showCta ? (
            <div className="poju-deep-dive-cta base-analysis-delivery__poju-card">
              <div className="pdd-content">
                <div className="pdd-title">{t("poju_cta_title")}</div>
                <div className="pdd-description">{t("poju_cta_description")}</div>
              </div>
              <Link href="/poju" className="pdd-cta-btn">
                <span>{t("poju_cta_button")}</span>
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
