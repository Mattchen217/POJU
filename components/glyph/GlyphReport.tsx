"use client";

import {
  Columns2,
  Eye,
  Feather,
  Footprints,
  Hourglass,
  MessageCircle,
  ScrollText,
  Target,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { RichReadingText } from "@/components/cross-product/RichReadingText";
import { TermMarkFirstVisitHint } from "@/components/cross-product/TermMarkFirstVisitHint";

import { GlyphSectionLabel } from "@/components/glyph/GlyphSectionLabel";
import {
  glyphReportSectionLabels,
  resolveGlyphOutputLanguage,
} from "@/lib/glyph/report-section-labels";
import { cn } from "@/lib/utils/classnames";
import type { GlyphReadingContent } from "@/lib/llm/services/glyph-reading-service";
import { LEVEL_META, type SignData } from "@/types/oracle";

type Props = {
  reading: GlyphReadingContent;
  glyph: SignData;
  question: string;
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

export function GlyphReport({ reading, glyph, question }: Props) {
  const t = useTranslations("glyph");
  const pageLocale = useLocale();
  const outputLang = resolveGlyphOutputLanguage(reading, pageLocale);
  const sectionLabels = glyphReportSectionLabels(outputLang);
  const safeReading = reading;
  const windLabel = LEVEL_META[glyph.level]?.display_name ?? glyph.level;
  const timeframeKey = TIMEFRAME_KEYS[safeReading.exploration.timeframe] ?? "explore_time_today";
  const questionResponse = safeReading.question_response?.trim();
  const synthesisText =
    safeReading.synthesis?.trim() || safeReading.meaning_for_question?.trim() || "";

  if (safeReading.invalid_input) {
    return (
      <div className={cn("glyph-report")}>
        <div className="report-section meaning">
          <p>{t("reading_invalid_input")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("glyph-report")}>
      <TermMarkFirstVisitHint />
      {questionResponse ? (
        <div className="report-section meaning">
          <GlyphSectionLabel icon={Target}>{t("question_response_title")}</GlyphSectionLabel>
          <RichReadingText text={questionResponse} locale={outputLang} />
        </div>
      ) : (
        <div className="report-section question-recap">
          <GlyphSectionLabel icon={MessageCircle}>{t("your_question_label")}</GlyphSectionLabel>
          <p className="question-recap-text">{question}</p>
        </div>
      )}

      <div className="report-section wind-category">
        <h3>{windLabel}</h3>
        <p>{safeReading.wind_category_blurb}</p>
      </div>

      <div className="report-section classical">
        <GlyphSectionLabel icon={ScrollText}>{sectionLabels.section_classical}</GlyphSectionLabel>
        <RichReadingText
          text={safeReading.classical_voice}
          locale={outputLang}
          variant="poem"
          className="classical-text"
        />
      </div>

      <div className="report-section dual-view">
        <GlyphSectionLabel icon={Columns2}>{sectionLabels.section_dual_view}</GlyphSectionLabel>

        <div className="dual-view-card view-bazi">
          <h4>{sectionLabels.view_bazi_title}</h4>
          <RichReadingText text={safeReading.命理双视角.命理看此事} locale={outputLang} />
        </div>

        <div className="dual-view-card view-glyph">
          <h4>{sectionLabels.view_glyph_title}</h4>
          <RichReadingText text={safeReading.命理双视角.签文看此事} locale={outputLang} />
        </div>

        <div className="dual-view-resonance">
          <RichReadingText text={safeReading.命理双视角.两者印证或冲突} locale={outputLang} />
        </div>
      </div>

      <div className="report-section meaning">
        <GlyphSectionLabel icon={Target}>{sectionLabels.section_synthesis}</GlyphSectionLabel>
        <RichReadingText text={synthesisText} locale={outputLang} />
      </div>

      <div className="report-section tension">
        <GlyphSectionLabel icon={Eye}>{sectionLabels.section_hidden}</GlyphSectionLabel>
        <RichReadingText text={safeReading.hidden_tension} locale={outputLang} />
      </div>

      <div className="report-section moment">
        <GlyphSectionLabel icon={Hourglass}>{sectionLabels.section_moment}</GlyphSectionLabel>
        <RichReadingText text={safeReading.your_moment} locale={outputLang} />
      </div>

      <div className="report-section exploration">
        <GlyphSectionLabel icon={Footprints}>{sectionLabels.section_exploration}</GlyphSectionLabel>
        <div className="exploration-card">
          <RichReadingText text={safeReading.exploration.text} locale={outputLang} />
          <div className="explore-meta">
            <span>{t(timeframeKey)}</span>
            <span>·</span>
            <span>{safeReading.exploration.duration_estimate}</span>
            {safeReading.exploration.is_solo ? (
              <>
                <span>·</span>
                <span>{t("explore_solo")}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="report-section reflection">
        <GlyphSectionLabel icon={Feather}>{sectionLabels.section_reflection}</GlyphSectionLabel>
        <p className="reflection-question">{safeReading.reflection_question}</p>
      </div>

    </div>
  );
}
