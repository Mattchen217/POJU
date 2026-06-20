"use client";

import { AlertTriangle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MarkedInline } from "@/components/cross-product/GlossaryText";
import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { GlyphCanvas } from "@/components/glyph/GlyphCanvas";
import { GlyphDeliveryChart } from "@/components/glyph/GlyphDeliveryChart";
import {
  glyphReportSectionLabels,
  resolveGlyphOutputLanguage,
} from "@/lib/glyph/report-section-labels";
import {
  hiddenTensionColumns,
  synthesisCardsFromText,
} from "@/lib/glyph/synthesis-cards";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import { cn } from "@/lib/utils/classnames";
import { LEVEL_META, type SignData } from "@/types/oracle";

import "@/styles/glyph-delivery.css";

type Props = {
  reading: GlyphReadingContent;
  glyph: SignData;
  question: string;
  baseReportText?: string;
};

const TIMEFRAME_KEYS: Record<
  GlyphReadingContent["exploration"]["timeframe"],
  "explore_time_today" | "explore_time_tonight" | "explore_time_24h" | "explore_time_week"
> = {
  today: "explore_time_today",
  tonight: "explore_time_tonight",
  within_24h: "explore_time_24h",
  this_week: "explore_time_week",
};

function SectionHeading({
  title,
  variant = "default",
}: {
  title: string;
  variant?: "default" | "warn" | "moment";
}) {
  if (variant === "warn") {
    return (
      <div className="glyph-delivery-section-heading glyph-delivery-section-heading--warn">
        <AlertTriangle size={16} aria-hidden />
        <h2 className="glyph-delivery-section-title">{title}</h2>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "glyph-delivery-section-heading",
        variant === "moment" && "glyph-delivery-section-heading--moment",
      )}
    >
      <h2 className="glyph-delivery-section-title">{title}</h2>
    </div>
  );
}

export function GlyphReport({ reading, glyph, question, baseReportText }: Props) {
  const t = useTranslations("glyph");
  const pageLocale = useLocale();
  const outputLang = resolveGlyphOutputLanguage(reading, pageLocale);
  const sectionLabels = glyphReportSectionLabels(outputLang);
  const safeReading = reading;
  const windMeta = LEVEL_META[glyph.level];
  const windLabel = windMeta?.display_name ?? glyph.level;
  const strategyLabel = windMeta?.subtitle ?? "";
  const timeframeKey = TIMEFRAME_KEYS[safeReading.exploration.timeframe] ?? "explore_time_today";
  const questionResponse = safeReading.question_response?.trim();
  const synthesisText =
    safeReading.synthesis?.trim() || safeReading.meaning_for_question?.trim() || "";
  const synthesisCards = synthesisCardsFromText(synthesisText);
  const hiddenCols = hiddenTensionColumns(safeReading.hidden_tension);
  const displayQuestion = question.trim();

  if (safeReading.invalid_input) {
    return (
      <div className="glyph-delivery-panel">
        <div className="glyph-delivery-inner">
          <p>{t("reading_invalid_input")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glyph-delivery-panel">
      <div className="glyph-delivery-inner">
        <section
          className={cn(
            "glyph-delivery-hero",
            !baseReportText?.trim() && "glyph-delivery-hero--card-only",
          )}
        >
          <div className="glyph-delivery-hero__card">
            <GlyphCanvas glyph={glyph} animated={false} compact />
          </div>
          {baseReportText?.trim() ? <GlyphDeliveryChart content={baseReportText} /> : null}
        </section>

        <div className="glyph-delivery-divider" aria-hidden />

        <header className="glyph-delivery-header">
          <p className="glyph-delivery-eyebrow">{sectionLabels.eyebrow_about_question}</p>
          <h1 className="glyph-delivery-question">{displayQuestion}</h1>
          <div className="glyph-delivery-meta">
            <span>
              {sectionLabels.meta_glyph_pattern}:{" "}
              <strong className="glyph-delivery-meta__wind">{windLabel}</strong>
            </span>
            {strategyLabel ? (
              <>
                <span className="glyph-delivery-meta__sep">|</span>
                <span>
                  {sectionLabels.meta_strategy}:{" "}
                  <span className="glyph-delivery-meta__strategy">{strategyLabel}</span>
                </span>
              </>
            ) : null}
          </div>
        </header>

        {questionResponse ? (
          <section className="glyph-delivery-intro">
            <RichReadingText text={questionResponse} locale={outputLang} />
          </section>
        ) : null}

        <section className="glyph-delivery-wind-card">
          <p className="glyph-delivery-wind-card__eyebrow">
            {sectionLabels.eyebrow_inner_pattern}
          </p>
          <h2 className="glyph-delivery-wind-card__title">{windLabel}</h2>
          <RichReadingText text={safeReading.wind_category_blurb} locale={outputLang} />
        </section>

        <section className="glyph-delivery-section">
          <SectionHeading title={sectionLabels.section_classical} />
          <div className="glyph-delivery-section__body">
            <RichReadingText
              text={safeReading.classical_voice}
              locale={outputLang}
              variant="poem"
            />
          </div>
        </section>

        <section className="glyph-delivery-section glyph-dual-section">
          <SectionHeading title={sectionLabels.section_dual_view} />

          <div className="glyph-dual-block">
            <span className="glyph-dual-pill">{sectionLabels.view_bazi_title}</span>
            <RichReadingText text={safeReading.命理双视角.命理看此事} locale={outputLang} />
          </div>

          <div className="glyph-dual-block">
            <span className="glyph-dual-pill">{sectionLabels.view_glyph_title}</span>
            <RichReadingText text={safeReading.命理双视角.签文看此事} locale={outputLang} />
          </div>

          <div className="glyph-dual-alignment">
            <h3 className="glyph-dual-alignment__title">{sectionLabels.alignment_title}</h3>
            <RichReadingText text={safeReading.命理双视角.两者印证或冲突} locale={outputLang} />
          </div>
        </section>

        {synthesisText ? (
          <section className="glyph-delivery-section">
            <SectionHeading title={sectionLabels.section_synthesis} />
            {synthesisCards.length > 1 ? (
              <div className="glyph-synthesis-grid">
                {synthesisCards.map((card, i) => (
                  <div key={i} className="glyph-synthesis-card">
                    {card.title ? (
                      <h4 className="glyph-synthesis-card__title">{card.title}</h4>
                    ) : null}
                    <p className="glyph-synthesis-card__body">
                      <MarkedInline text={card.body} locale={outputLang} keyBase={i * 10} />
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <RichReadingText text={synthesisText} locale={outputLang} />
            )}
          </section>
        ) : null}

        <section className="glyph-delivery-section">
          <SectionHeading title={sectionLabels.section_hidden} variant="warn" />
          {hiddenCols ? (
            <div className="glyph-hidden-grid">
              <RichReadingText text={hiddenCols[0]} locale={outputLang} />
              <RichReadingText text={hiddenCols[1]} locale={outputLang} />
            </div>
          ) : (
            <RichReadingText text={safeReading.hidden_tension} locale={outputLang} />
          )}
        </section>

        <section className="glyph-delivery-section">
          <SectionHeading title={sectionLabels.section_moment} variant="moment" />
          <RichReadingText text={safeReading.your_moment} locale={outputLang} />
        </section>

        <footer className="glyph-delivery-practice">
          <div className="glyph-delivery-practice__glow" aria-hidden />
          <div className="glyph-delivery-practice__head">
            <span className="glyph-delivery-eyebrow">{sectionLabels.section_exploration}</span>
            <span className="glyph-delivery-practice__meta">
              {t(timeframeKey)}
              <span> · </span>
              {safeReading.exploration.duration_estimate}
              {safeReading.exploration.is_solo ? (
                <>
                  <span> · </span>
                  {t("explore_solo")}
                </>
              ) : null}
            </span>
          </div>
          <RichReadingText text={safeReading.exploration.text} locale={outputLang} />
        </footer>

        <section className="glyph-delivery-section">
          <SectionHeading title={sectionLabels.section_reflection} variant="moment" />
          <p className="glyph-delivery-reflection">{safeReading.reflection_question}</p>
        </section>
      </div>
    </div>
  );
}
