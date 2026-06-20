"use client";

import { AlertTriangle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MarkedInline } from "@/components/cross-product/GlossaryText";
import { PojuDeepDiveCTA } from "@/components/cross-product/PojuDeepDiveCTA";
import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { TermMarkFirstVisitHint } from "@/components/cross-product/TermMarkFirstVisitHint";
import { GlyphCanvas } from "@/components/glyph/GlyphCanvas";
import { StreamingAnalysisView } from "@/components/poju/StreamingAnalysisView";
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
  pojuDeepDive?: {
    result_id: string;
    result_data: Record<string, unknown>;
  };
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

export function GlyphReport({
  reading,
  glyph,
  question,
  baseReportText,
  pojuDeepDive,
}: Props) {
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
  const displayQuestion = questionResponse ? question : question.trim();

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
        <TermMarkFirstVisitHint />

        <section
          className={cn(
            "glyph-delivery-hero",
            !baseReportText?.trim() && "glyph-delivery-hero--card-only",
          )}
        >
          <div className="glyph-delivery-hero__card">
            <GlyphCanvas glyph={glyph} animated={false} compact />
          </div>
          {baseReportText?.trim() ? (
            <div className="glyph-delivery-hero__chart">
              <StreamingAnalysisView
                content={baseReportText}
                status="completed"
                bytes_received={baseReportText.length}
                layout="panel"
              />
            </div>
          ) : null}
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
          <h2 className="glyph-delivery-section-title">{sectionLabels.section_classical}</h2>
          <div className="glyph-delivery-section__body">
            <RichReadingText
              text={safeReading.classical_voice}
              locale={outputLang}
              variant="poem"
            />
          </div>
        </section>

        <section className="glyph-delivery-section glyph-dual-section">
          <h2 className="glyph-delivery-section-title">{sectionLabels.section_dual_view}</h2>

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
            <h2 className="glyph-delivery-section-title">{sectionLabels.section_synthesis}</h2>
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
          <h2 className="glyph-delivery-section-title glyph-delivery-section-title--warn">
            <AlertTriangle size={16} aria-hidden />
            {sectionLabels.section_hidden}
          </h2>
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
          <h2 className="glyph-delivery-section-title glyph-delivery-section-title--serif">
            {sectionLabels.section_moment}
          </h2>
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
          <h2 className="glyph-delivery-section-title glyph-delivery-section-title--serif">
            {sectionLabels.section_reflection}
          </h2>
          <p className="glyph-delivery-reflection">{safeReading.reflection_question}</p>
        </section>

        {pojuDeepDive ? (
          <PojuDeepDiveCTA
            productId="glyph"
            result_id={pojuDeepDive.result_id}
            result_data={pojuDeepDive.result_data}
          />
        ) : null}
      </div>
    </div>
  );
}
